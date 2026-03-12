# Dhoota — Project Structure

**Version**: 2.0
**Date**: March 11, 2026
**Status**: Draft

---

## 1. Overview

Dhoota is a **single Next.js application** — no monorepo, no Turborepo, no separate apps. The project uses Next.js App Router with route groups to serve different experiences from one codebase.

---

## 2. Top-Level Structure

```
dhoota/
├── docs/                               # Design documents (this folder)
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DESIGN_DATABASE.md
│   ├── DESIGN_CHAT_FRAMEWORK.md
│   ├── DESIGN_API.md
│   └── PROJECT_STRUCTURE.md
│
├── supabase/                           # Supabase project config & migrations
│   ├── config.toml
│   ├── migrations/
│   │   ├── 001_create_enums.sql
│   │   ├── 002_create_tenants_users.sql
│   │   └── ...
│   └── seed.sql
│
├── src/                                # Application source code
│   ├── app/                            # Next.js App Router
│   ├── lib/                            # Shared libraries & utilities
│   ├── components/                     # React components
│   └── types/                          # TypeScript type definitions
│
├── public/                             # Static assets
├── .env.local                          # Environment variables (git-ignored)
├── .env.example                        # Env template
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 3. Source Code Structure

### 3.1 `src/app/` — Next.js App Router

```
src/app/
├── (app)/                              # Authenticated experience
│   ├── layout.tsx                      # Main layout: sidebar + chat area
│   ├── page.tsx                        # Chat interface (the entire app UI)
│   └── loading.tsx                     # Loading state
│
├── (public)/                           # Public website experience
│   ├── layout.tsx                      # Public layout wrapper
│   └── [slug]/                         # Tenant-specific public site
│       ├── layout.tsx                  # Themed layout (banner, widgets, footer)
│       ├── page.tsx                    # SSR activity feed
│       ├── chat/
│       │   └── page.tsx               # Public chat interface
│       └── activity/
│           └── [id]/
│               └── page.tsx           # Single activity page (SEO)
│
├── (auth)/                             # Authentication pages
│   ├── layout.tsx                      # Auth layout (centered card)
│   ├── login/
│   │   └── page.tsx                   # Email OTP login
│   ├── verify/
│   │   └── page.tsx                   # OTP verification
│   └── citizen/
│       └── page.tsx                   # Mobile + invite code auth
│
├── api/                                # API routes
│   ├── chat/
│   │   ├── message/
│   │   │   └── route.ts              # Universal chat endpoint
│   │   └── init/
│   │       └── route.ts              # Init config batch execution
│   ├── auth/
│   │   ├── callback/
│   │   │   └── route.ts             # Supabase auth callback
│   │   ├── citizen/
│   │   │   └── route.ts             # Citizen authentication
│   │   └── session/
│   │       └── route.ts             # Session info
│   ├── media/
│   │   ├── presign/
│   │   │   └── route.ts             # Presigned upload URL
│   │   └── confirm/
│   │       └── route.ts             # Upload confirmation
│   └── webhooks/
│       ├── zapier/
│       │   └── route.ts             # Zapier job callbacks
│       └── supabase/
│           └── route.ts             # Supabase DB webhooks
│
├── layout.tsx                          # Root layout (providers, fonts, metadata)
├── not-found.tsx                       # 404 page
└── error.tsx                           # Global error boundary
```

### 3.2 `src/lib/` — Shared Libraries

```
src/lib/
├── supabase/
│   ├── server.ts                       # Server-side Supabase client
│   ├── client.ts                       # Browser-side Supabase client
│   ├── service.ts                      # Service role client (bypass RLS)
│   └── middleware.ts                   # Supabase session helpers for middleware
│
├── pipeline/                           # Option processing pipeline
│   ├── index.ts                        # Pipeline orchestrator
│   ├── resolver.ts                     # Option resolution (Stage 1)
│   ├── qa-engine.ts                    # Guided Q&A engine (Stage 2)
│   ├── refiner.ts                      # LLM input refinement (Stage 3)
│   ├── executor.ts                     # SQL template execution (Stage 4)
│   ├── formatter.ts                    # LLM response formatting (Stage 5)
│   └── dynamic-sql.ts                  # Dynamic SQL generation & validation
│
├── llm/
│   ├── provider.ts                     # LLM provider interface
│   ├── openai.ts                       # OpenAI implementation
│   ├── anthropic.ts                    # Anthropic implementation
│   ├── factory.ts                      # Provider factory & fallback
│   └── prompts/                        # Prompt templates
│       ├── classify-intent.ts
│       ├── extract-params.ts
│       ├── refine-input.ts
│       ├── format-response.ts
│       └── generate-sql.ts
│
├── options/
│   ├── loader.ts                       # Load option definitions from DB
│   ├── filter.ts                       # Filter options by user type + toggles
│   └── context.ts                      # Build user context (available options, config)
│
├── auth/
│   ├── session.ts                      # Session management utilities
│   ├── guards.ts                       # Auth guards for API routes
│   └── citizen.ts                      # Citizen auth helpers (invite code validation)
│
├── media/
│   ├── s3.ts                           # S3 client & presigned URL generation
│   └── processing.ts                   # Image processing utilities
│
├── jobs/
│   ├── trigger.ts                      # Zapier webhook trigger
│   └── types.ts                        # Job type definitions
│
├── realtime/
│   └── channels.ts                     # Supabase Realtime channel helpers
│
├── validation/
│   ├── schemas.ts                      # Zod schemas for API validation
│   └── dynamic-sql.ts                  # Dynamic SQL safety validator
│
└── utils/
    ├── id.ts                           # ID generation
    ├── date.ts                         # Date utilities
    ├── format.ts                       # Text formatting
    └── errors.ts                       # Error classes & handling
```

### 3.3 `src/components/` — React Components

```
src/components/
├── chat/
│   ├── ChatContainer.tsx               # Main chat container with message list + input
│   ├── ChatInput.tsx                   # Text input with file attach, option pills
│   ├── MessageList.tsx                 # Scrollable message list
│   ├── MessageBubble.tsx              # Individual message (user or assistant)
│   └── ConversationSidebar.tsx        # Conversation list, search, new chat
│
├── widgets/                            # Response widgets
│   ├── registry.ts                    # Widget type → component mapping
│   ├── WidgetRenderer.tsx             # Dynamic widget renderer
│   ├── TextResponseWidget.tsx
│   ├── ActivityCardWidget.tsx
│   ├── DataListWidget.tsx
│   ├── DataTableWidget.tsx
│   ├── CalendarWidget.tsx
│   ├── TimelineWidget.tsx
│   ├── ChartWidget.tsx
│   ├── StatsCardWidget.tsx
│   ├── MediaGalleryWidget.tsx
│   ├── TagCloudWidget.tsx
│   ├── SummaryWidget.tsx
│   ├── ConversationThreadWidget.tsx
│   ├── CodeListWidget.tsx
│   ├── WebsitePreviewWidget.tsx
│   ├── StatusTicketWidget.tsx
│   ├── ConfirmationCardWidget.tsx
│   ├── QuestionCardWidget.tsx
│   ├── DefaultOptionsMenuWidget.tsx
│   └── ErrorCardWidget.tsx
│
├── inline-widgets/                     # Inline input widgets for Q&A
│   ├── registry.ts                    # Inline widget type → component mapping
│   ├── DatePickerInline.tsx
│   ├── FileUploadInline.tsx
│   ├── TagSelectInline.tsx
│   ├── LocationPickerInline.tsx
│   ├── StatusSelectInline.tsx
│   ├── VisibilitySelectInline.tsx
│   └── ColorPickerInline.tsx
│
├── bookmarks/
│   ├── BookmarkButton.tsx             # Bookmark toggle on widgets
│   └── BookmarkListSelector.tsx       # Choose bookmark list
│
├── public-website/                     # Public website components
│   ├── PublicLayout.tsx
│   ├── Banner.tsx
│   ├── ActivityFeed.tsx
│   ├── SidebarWidgets.tsx
│   └── PublicChatInterface.tsx
│
├── auth/
│   ├── LoginForm.tsx
│   ├── OtpVerification.tsx
│   └── CitizenAuthForm.tsx
│
└── ui/                                 # Base UI components (shadcn/ui)
    ├── button.tsx
    ├── card.tsx
    ├── input.tsx
    ├── dialog.tsx
    ├── dropdown-menu.tsx
    ├── scroll-area.tsx
    ├── avatar.tsx
    ├── badge.tsx
    ├── skeleton.tsx
    ├── toast.tsx
    └── ...
```

### 3.4 `src/types/` — TypeScript Types

```
src/types/
├── api.ts                              # SendMessageRequest, ChatMessageResponse, etc.
├── widgets.ts                          # Widget, WidgetType, WidgetAction, etc.
├── options.ts                          # OptionDefinition, SqlTemplate, OptionQuestion
├── pipeline.ts                         # ResolvedOption, RefinedInput, FormattedResponse
├── llm.ts                              # LLMProvider, IntentClassification, etc.
├── database.ts                         # Database row types (auto-generated from Supabase)
├── auth.ts                             # Session, UserContext
└── jobs.ts                             # JobTicket, JobType
```

---

## 4. Supabase Project

```
supabase/
├── config.toml                         # Supabase CLI configuration
├── migrations/                         # Ordered SQL migrations
│   ├── 001_create_enums.sql
│   ├── 002_create_tenants_users.sql
│   ├── 003_create_feature_flags.sql
│   ├── 004_create_option_system.sql
│   ├── 005_create_user_configs.sql
│   ├── 006_create_activities.sql
│   ├── 007_create_tags.sql
│   ├── 008_create_conversations_messages.sql
│   ├── 009_create_bookmarks.sql
│   ├── 010_create_suggestion_box.sql
│   ├── 011_create_website.sql
│   ├── 012_create_team_linking.sql
│   ├── 013_create_jobs.sql
│   ├── 014_create_llm_logs.sql
│   ├── 015_create_rls_policies.sql
│   ├── 016_create_functions_triggers.sql
│   ├── 017_seed_system_tags.sql
│   ├── 018_seed_option_definitions.sql
│   └── 019_seed_user_type_configs.sql
│
└── seed.sql                            # Dev seed data
```

---

## 5. Configuration Files

### 5.1 Environment Variables

```
# .env.example

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
SUPABASE_SECRET_KEY=sb_secret_your-key

# AWS S3
AWS_S3_BUCKET=dhoota-media-dev
AWS_S3_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# CloudFront
CLOUDFRONT_DOMAIN=d1234567.cloudfront.net
CLOUDFRONT_KEY_PAIR_ID=your-key-pair-id
CLOUDFRONT_PRIVATE_KEY=your-private-key

# LLM Providers
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
LLM_PRIMARY_PROVIDER=openai
LLM_FALLBACK_PROVIDER=anthropic

# Zapier
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/...
ZAPIER_WEBHOOK_SECRET=your-webhook-secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 5.2 Next.js Configuration

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.cloudfront.net' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async rewrites() {
    return [
      // Custom domain support for public websites
      {
        source: '/:path*',
        has: [{ type: 'host', value: '(?!localhost)(?!.*\\.dhoota\\.com).*' }],
        destination: '/api/public/resolve-domain?host=:host&path=:path*',
      },
    ];
  },
};

export default nextConfig;
```

### 5.3 Tailwind Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          // ... full brand palette
          900: '#1a365d',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

---

## 6. Key Dependencies

```json
{
  "dependencies": {
    "next": "^14",
    "@supabase/ssr": "latest",
    "@supabase/supabase-js": "^2",
    "react": "^18",
    "react-dom": "^18",
    "openai": "^4",
    "@anthropic-ai/sdk": "latest",
    "@aws-sdk/client-s3": "^3",
    "@aws-sdk/s3-request-presigner": "^3",
    "zod": "^3",
    "recharts": "^2",
    "date-fns": "^3",
    "tailwindcss": "^3",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "lucide-react": "latest",
    "next-intl": "^3",
    "dompurify": "^3"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/react": "^18",
    "@types/node": "^20",
    "eslint": "^8",
    "eslint-config-next": "^14",
    "prettier": "^3",
    "supabase": "latest",
    "vitest": "latest",
    "@testing-library/react": "latest"
  }
}
```

---

## 7. Development Workflow

### 7.1 Local Development

```bash
# 1. Start Supabase local (Docker required)
npx supabase start

# 2. Run migrations
npx supabase db reset

# 3. Start Next.js dev server
npm run dev

# 4. Generate Supabase types (after schema changes)
npx supabase gen types typescript --local > src/types/database.ts
```

### 7.2 Creating a New Option

1. Insert into `option_definitions` table (or add to `018_seed_option_definitions.sql`)
2. Insert into `sql_templates` table (the SQL to execute)
3. Insert into `option_questions` table (Q&A questions, if needed)
4. Update `user_type_configs` to include the new option in relevant user types

No code changes needed. The pipeline picks up the new option automatically.

### 7.3 Creating a New Widget

1. Create `src/components/widgets/NewWidget.tsx`
2. Add to `src/components/widgets/registry.ts`
3. Add the widget type to `src/types/widgets.ts`
4. Update option response prompts to reference the new widget type

### 7.4 Creating a New Inline Widget

1. Create `src/components/inline-widgets/NewInputWidget.tsx`
2. Add to `src/components/inline-widgets/registry.ts`
3. Reference in `option_questions.inline_widget` for relevant questions
