# Dhoota — API Design

**Version**: 2.0
**Date**: March 11, 2026
**Status**: Draft

---

## 1. Overview

Dhoota has a single primary API endpoint — `POST /api/chat/message` — that handles every user interaction. Supporting endpoints exist for authentication, media upload, and webhooks, but the chat endpoint is the universal contract for all feature operations.

---

## 2. Route Structure

```
app/
└── api/
    ├── chat/
    │   └── message/
    │       └── route.ts        # THE unified endpoint
    │
    ├── auth/
    │   ├── callback/route.ts   # Supabase Auth callback
    │   ├── citizen/route.ts    # Mobile + invite code verification
    │   └── session/route.ts    # Session info
    │
    ├── media/
    │   ├── presign/route.ts    # Generate presigned upload URL
    │   └── confirm/route.ts    # Confirm upload + create DB record
    │
    ├── webhooks/
    │   ├── zapier/route.ts     # Zapier job callbacks
    │   └── supabase/route.ts   # Supabase DB webhook handler
    │
    └── public/
        ├── feed/route.ts       # Public activity feed (SSR data)
        └── website/route.ts    # Website config (SSR data)
```

---

## 3. The Universal Chat Endpoint

### 3.1 Request/Response Contract

```typescript
// POST /api/chat/message

interface SendMessageRequest {
  conversationId: string;
  source: 'chat' | 'follow_up' | 'inline_action' | 'default_option' | 'qa_response' | 'confirmation';
  content?: string;
  optionId?: string;
  params?: Record<string, unknown>;
  files?: FileReference[];
  targetResourceId?: string;
  targetResourceType?: string;
}

interface FileReference {
  s3Key: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
}

interface ChatMessageResponse {
  messageId: string;
  conversationId: string;
  widgets: Widget[];
  followUps: OptionReference[];
  defaultOptions: OptionReference[];
  conversationState: 'active' | 'awaiting_input' | 'awaiting_confirmation';
}

interface OptionReference {
  optionId: string;
  name: string;
  icon: string;
  params?: Record<string, unknown>;
}

interface Widget {
  id: string;
  type: string;
  data: Record<string, unknown>;
  actions?: WidgetAction[];
  bookmarkable: boolean;
}

interface WidgetAction {
  label: string;
  icon: string;
  optionId: string;
  params?: Record<string, unknown>;
  targetResourceId?: string;
  targetResourceType?: string;
  requiresConfirmation?: boolean;
}
```

### 3.2 Processing Flow

```typescript
export async function POST(request: Request) {
  // 1. Authentication & tenant resolution
  const session = await getSession(request);
  const { tenantId, userId, userType } = session;

  const body: SendMessageRequest = await request.json();

  // 2. Load user context
  const context = await loadUserContext(tenantId, userId, userType);
  // context includes: available options, user config, recent conversation messages

  // 3. Persist user message
  const userMessage = await saveUserMessage(body, context);

  // 4. Option resolution
  let resolved: ResolvedOption;

  switch (body.source) {
    case 'default_option':
    case 'follow_up':
    case 'inline_action':
      resolved = await resolveDirectOption(body.optionId!, context);
      break;

    case 'qa_response':
      resolved = await continueQASession(body, context);
      break;

    case 'confirmation':
      resolved = await handleConfirmation(body, context);
      break;

    case 'chat':
    default:
      resolved = await resolveFromText(body.content!, context);
      break;
  }

  // 5. Guided Q&A (if needed)
  if (resolved.type === 'predefined' && resolved.needsMoreInput) {
    const qaResult = await qaEngine.processStep(resolved, body, context);

    if (qaResult.status === 'need_more') {
      const response = buildQAResponse(qaResult, context);
      await saveAssistantMessage(response, context);
      return Response.json(response);
    }

    resolved.params = qaResult.collectedParams;
  }

  // 6. LLM input refinement (for write operations)
  if (resolved.type === 'predefined' && resolved.option!.hasWriteTemplates) {
    const refined = await llm.refineInput(
      resolved.params!,
      resolved.option!.inputSchema,
      { tenantId, recentActivities: context.recentActivities }
    );

    if (!body.source !== 'confirmation') {
      const confirmResponse = buildConfirmationResponse(refined, resolved.option!, context);
      await saveAssistantMessage(confirmResponse, context);
      return Response.json(confirmResponse);
    }
  }

  // 7. SQL execution
  let sqlResults: SqlResult[];

  if (resolved.type === 'dynamic') {
    sqlResults = await executeDynamicQuery(resolved.dynamicSql!, tenantId);
  } else {
    sqlResults = await executeSqlTemplates(
      resolved.option!.sqlTemplates,
      resolved.params!,
      tenantId
    );
  }

  // 8. LLM response formatting
  const formatted = await llm.formatResponse(
    sqlResults,
    resolved.option?.responsePrompt ?? 'Format the query results clearly.',
    context
  );

  // 9. Build and persist response
  const response: ChatMessageResponse = {
    messageId: generateId(),
    conversationId: body.conversationId,
    widgets: formatted.widgets,
    followUps: formatted.followUps,
    defaultOptions: context.defaultOptions,
    conversationState: 'active',
  };

  await saveAssistantMessage(response, context);
  await logOptionExecution(resolved, body, sqlResults, response, context);

  return Response.json(response);
}
```

### 3.3 Source-Specific Behavior

| Source | Option Resolution | LLM Involved | Typical Flow |
|--------|------------------|:---:|---|
| `default_option` | Direct by `optionId` | No (resolution) | Load option → Q&A if needed → Execute |
| `follow_up` | Direct by `optionId` | No (resolution) | Load option → Q&A with pre-filled params → Execute |
| `inline_action` | Direct by `optionId` | No (resolution) | Load option → Pre-filled from target → Q&A for remaining → Execute |
| `chat` | LLM classifies intent | Yes | Classify → Match or dynamic SQL → Q&A if needed → Execute |
| `qa_response` | Continue existing session | Possibly | Check completeness → Ask next or proceed to refinement |
| `confirmation` | Resume from confirmation | No | Execute SQL → Format response |

---

## 4. Init Config Endpoint

When the user first loads the app, the client calls a batch init:

```typescript
// POST /api/chat/init
interface InitRequest {
  conversationId: string;
}

interface InitResponse {
  conversationId: string;
  messages: ChatMessageResponse[];
  userConfig: {
    userType: string;
    theme: Record<string, unknown>;
    displayName: string;
  };
}
```

Processing:
1. Load user type config + user overrides
2. Execute all `initOptionIds` in parallel (read-only options)
3. Aggregate results into multiple `ChatMessageResponse` messages
4. Append default options menu
5. Return as a batch

---

## 5. Authentication Endpoints

### 5.1 Email OTP (Workers, Candidates, Admins)

```typescript
// POST /api/auth/otp/send
interface SendOtpRequest {
  email: string;
}

// POST /api/auth/otp/verify
interface VerifyOtpRequest {
  email: string;
  token: string;
}

// Response: Supabase session (JWT in HttpOnly cookie)
```

Uses Supabase Auth's built-in OTP flow.

### 5.2 Citizen Authentication (Mobile + Invite Code)

```typescript
// POST /api/auth/citizen
interface CitizenAuthRequest {
  phone: string;
  inviteCode: string;
}

// POST /api/auth/citizen/verify
interface CitizenVerifyRequest {
  phone: string;
  token: string;
}
```

Processing:
1. Hash the phone and invite code
2. Look up the pairing in `invite_codes` table
3. Validate the code is unused or belongs to this phone
4. Send OTP to the phone via Supabase Auth (phone provider)
5. On verification, create/find citizen record and establish session
6. JWT includes citizen's accessible suggestion box tenant IDs

---

## 6. Media Upload Endpoints

### 6.1 Presigned URL Generation

```typescript
// POST /api/media/presign
interface PresignRequest {
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  context: 'activity' | 'note' | 'website' | 'suggestion_box' | 'profile';
}

interface PresignResponse {
  uploadUrl: string;
  s3Key: string;
  expiresAt: string;
}
```

S3 key structure: `{tenantId}/{context}/{uuid}/{filename}`

### 6.2 Upload Confirmation

```typescript
// POST /api/media/confirm
interface ConfirmUploadRequest {
  s3Key: string;
  activityId?: string;
  noteId?: string;
}
```

Processing:
1. Verify the S3 object exists
2. Create `activity_media` record
3. Trigger image processing webhook (Zapier) for variant generation

---

## 7. Webhook Endpoints

### 7.1 Zapier Callbacks

```typescript
// POST /api/webhooks/zapier
interface ZapierCallbackRequest {
  jobId: string;
  status: 'completed' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
}
```

Processing:
1. Validate webhook signature
2. Update `job_tickets` record
3. If the job was triggered from a conversation, append a message with the result widget

### 7.2 Supabase DB Webhooks

```typescript
// POST /api/webhooks/supabase
interface SupabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
}
```

Triggers:
- New media upload → Trigger image processing Zapier workflow
- New activity → Trigger tag suggestion Zapier workflow (if `ai_features` enabled)
- Job ticket completed → Notify user via Realtime

---

## 8. Middleware

### 8.1 Authentication Middleware

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public routes — no auth required
  if (isPublicRoute(path)) return NextResponse.next();

  // Auth routes — redirect if already logged in
  if (isAuthRoute(path)) {
    const session = await getSession(request);
    if (session) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  // Protected routes — require auth
  const session = await getSession(request);
  if (!session) return NextResponse.redirect(new URL('/login', request.url));

  // Inject tenant context into headers
  const response = NextResponse.next();
  response.headers.set('x-tenant-id', session.tenantId);
  response.headers.set('x-user-type', session.userType);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 8.2 Rate Limiting

Applied at the edge (Vercel Edge Middleware or API route level):

| Endpoint | Rate Limit | Window |
|----------|-----------|--------|
| `/api/chat/message` | 60 requests | per minute |
| `/api/auth/otp/send` | 5 requests | per minute |
| `/api/auth/citizen` | 5 requests | per minute |
| `/api/media/presign` | 30 requests | per minute |
| `/api/webhooks/*` | 100 requests | per minute |

### 8.3 Request Validation

Every API endpoint validates input using Zod schemas:

```typescript
import { z } from 'zod';

const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  source: z.enum(['chat', 'follow_up', 'inline_action', 'default_option', 'qa_response', 'confirmation']),
  content: z.string().max(5000).optional(),
  optionId: z.string().max(100).optional(),
  params: z.record(z.unknown()).optional(),
  files: z.array(z.object({
    s3Key: z.string(),
    originalFilename: z.string(),
    mimeType: z.string(),
    fileSizeBytes: z.number(),
  })).optional(),
  targetResourceId: z.string().uuid().optional(),
  targetResourceType: z.string().max(50).optional(),
});
```

---

## 9. Supabase Client Configuration

### 9.1 Server-Side Client

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createServerSupabase() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set({ name, value, ...options }),
        remove: (name, options) => cookieStore.delete({ name, ...options }),
      },
    }
  );
}
```

### 9.2 Service Role Client

For operations that bypass RLS (admin operations, webhook handlers):

```typescript
import { createClient } from '@supabase/supabase-js';

export function createServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

### 9.3 Client-Side Client

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
```

---

## 10. LLM Provider Integration

### 10.1 Provider Abstraction

```typescript
interface LLMProvider {
  id: string;
  name: string;

  classifyIntent(
    userText: string,
    availableOptions: OptionSummary[],
    conversationContext: string[]
  ): Promise<IntentClassification>;

  extractParams(
    userText: string,
    targetSchema: object
  ): Promise<Record<string, unknown>>;

  refineInput(
    rawParams: Record<string, unknown>,
    targetSchema: object,
    context: RefinementContext
  ): Promise<RefinedInput>;

  formatResponse(
    results: unknown,
    responsePrompt: string,
    context: FormatContext
  ): Promise<FormattedResponse>;

  generateDynamicSQL(
    userIntent: string,
    tableSchemas: TableSchema[],
    tenantId: string
  ): Promise<DynamicSQLResult>;

  adaptiveQuestionGrouping(
    questions: OptionQuestion[],
    knownParams: Record<string, unknown>,
    userBehaviorHints: string[]
  ): Promise<QuestionGroup[]>;
}
```

### 10.2 Implementation Pattern

```typescript
class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  async classifyIntent(
    userText: string,
    availableOptions: OptionSummary[],
    conversationContext: string[]
  ): Promise<IntentClassification> {
    const optionList = availableOptions
      .map(o => `${o.id}: ${o.description} [keywords: ${o.keywords.join(', ')}]`)
      .join('\n');

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You classify user messages into one of these options:\n${optionList}\n\nRespond with JSON: { "optionId": "...", "confidence": 0.0-1.0, "extractedParams": {...} }\nIf no option matches, respond with { "optionId": null, "confidence": 0 }`
        },
        ...conversationContext.map(c => ({ role: 'user' as const, content: c })),
        { role: 'user', content: userText }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    return JSON.parse(response.choices[0].message.content!);
  }

  // ... similar implementations for other methods
}
```

### 10.3 Dynamic SQL Generation

```typescript
async generateDynamicSQL(
  userIntent: string,
  tableSchemas: TableSchema[],
  tenantId: string
): Promise<DynamicSQLResult> {
  const schemaDescription = tableSchemas
    .map(t => `${t.name}: ${t.columns.map(c => `${c.name} (${c.type})`).join(', ')}`)
    .join('\n');

  const response = await this.client.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [{
      role: 'system',
      content: `Generate a PostgreSQL SELECT query for the user's request.
Rules:
- ONLY SELECT statements
- ALWAYS include WHERE tenant_id = $1
- Available tables:\n${schemaDescription}
- Return JSON: { "sql": "...", "description": "..." }`
    }, {
      role: 'user',
      content: userIntent,
    }],
    response_format: { type: 'json_object' },
    temperature: 0,
  });

  const result = JSON.parse(response.choices[0].message.content!);

  // Validate: only SELECT, has tenant_id filter
  validateDynamicSQL(result.sql);

  return result;
}
```

---

## 11. Zapier Integration

### 11.1 Triggering Jobs

```typescript
async function triggerZapierJob(
  type: JobType,
  tenantId: string,
  userId: string,
  inputData: Record<string, unknown>
): Promise<string> {
  const job = await db.insert('job_tickets', {
    tenant_id: tenantId,
    created_by: userId,
    type,
    status: 'queued',
    input_data: inputData,
  });

  await fetch(process.env.ZAPIER_WEBHOOK_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': process.env.ZAPIER_WEBHOOK_SECRET!,
    },
    body: JSON.stringify({
      jobId: job.id,
      type,
      tenantId,
      inputData,
      callbackUrl: `${process.env.APP_URL}/api/webhooks/zapier`,
    }),
  });

  return job.id;
}
```

### 11.2 Job Types & Flows

| Job Type | Input | Processing | Output |
|----------|-------|-----------|--------|
| `report_generation` | Report type, date range, filters | Query data → Generate PDF/Excel → Upload to S3 | S3 URL, summary stats |
| `image_processing` | S3 key, variant configs | Download → Resize/compress → Upload variants | Variant S3 keys |
| `ai_summary` | Activity IDs, summary type | Fetch activities → LLM summary → Store | Summary text |
| `suggestion_report` | Tenant ID, date range | Aggregate suggestions → LLM analysis → Generate report | Report data |
| `export` | Query, format | Execute query → Format CSV/Excel → Upload to S3 | S3 URL |

---

## 12. Public Website API

The public website uses SSR with data loaded server-side:

```typescript
// app/(public)/[slug]/page.tsx
export default async function PublicWebsite({ params }: { params: { slug: string } }) {
  const supabase = createServiceSupabase();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug')
    .eq('slug', params.slug)
    .single();

  if (!tenant) notFound();

  const { data: websiteConfig } = await supabase
    .from('website_configs')
    .select('*, website_widgets(*)')
    .eq('tenant_id', tenant.id)
    .eq('is_published', true)
    .single();

  if (!websiteConfig) notFound();

  const { data: activities } = await supabase
    .from('activities')
    .select('*, activity_tags(tag:tags(*)), activity_media(*)')
    .eq('tenant_id', tenant.id)
    .eq('visibility', 'public')
    .is('deleted_at', null)
    .order('activity_date', { ascending: false })
    .limit(20);

  return <PublicWebsiteLayout config={websiteConfig} activities={activities} />;
}
```

The public website chat uses the same `/api/chat/message` endpoint, but with `anonymous` or `citizen` user type context, limiting available options.

---

## 13. Error Handling

### 13.1 Standard Error Response

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

### 13.2 Error Codes

| Code | HTTP Status | Description |
|------|:-----------:|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid session |
| `FORBIDDEN` | 403 | Feature not available / option not in user's available set |
| `OPTION_NOT_FOUND` | 404 | Referenced option doesn't exist |
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `RATE_LIMITED` | 429 | Too many requests |
| `LLM_ERROR` | 502 | LLM provider error |
| `SQL_ERROR` | 500 | Database query failure |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### 13.3 Pipeline Error Recovery

```typescript
async function handlePipelineError(
  error: Error,
  stage: string,
  context: UserContext
): Promise<ChatMessageResponse> {
  await logError(error, stage, context);

  switch (stage) {
    case 'resolution':
      return {
        messageId: generateId(),
        conversationId: context.conversationId,
        widgets: [{
          id: generateId(),
          type: 'error_card',
          data: {
            message: "I couldn't understand that. Could you try rephrasing?",
            retryable: true,
          },
          bookmarkable: false,
        }],
        followUps: [],
        defaultOptions: context.defaultOptions,
        conversationState: 'active',
      };

    case 'llm_refinement':
    case 'llm_formatting':
      // Fall back to raw data display
      return buildRawDataResponse(context);

    default:
      return buildGenericErrorResponse(context);
  }
}
```

---

## 14. Security

### 14.1 Input Sanitization

- All user text content sanitized with DOMPurify before storage
- SQL templates use parameterized queries exclusively
- Dynamic SQL validated against allow-list of operations (SELECT only)
- File uploads validated for MIME type and size

### 14.2 Authorization Flow

Every API call goes through:
1. **Authentication**: JWT validation → user identity
2. **Tenant resolution**: JWT claims → tenant_id
3. **Feature check**: Is the option's required toggle enabled for this tenant?
4. **User type check**: Is the option available for this user type?
5. **RLS enforcement**: Database queries scoped by tenant_id via RLS policies

### 14.3 Dynamic SQL Guardrails

```typescript
function validateDynamicSQL(sql: string): void {
  const normalized = sql.trim().toUpperCase();

  if (!normalized.startsWith('SELECT')) {
    throw new Error('Dynamic SQL must be a SELECT statement');
  }

  const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
    'TRUNCATE', 'EXEC', 'EXECUTE', 'GRANT', 'REVOKE'];
  for (const keyword of forbidden) {
    if (normalized.includes(keyword)) {
      throw new Error(`Forbidden keyword in dynamic SQL: ${keyword}`);
    }
  }

  if (!sql.includes('$1')) {
    throw new Error('Dynamic SQL must use $1 placeholder for tenant_id');
  }
}
```
