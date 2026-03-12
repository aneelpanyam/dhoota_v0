# Dhoota — Product Requirements Document

**Version**: 2.0
**Date**: March 11, 2026
**Status**: Draft

---

## 1. Product Vision

Dhoota is a single, unified platform that empowers political workers, aspiring candidates, and elected representatives to plan, capture, and showcase their activities — while maintaining direct communication channels with citizens.

The platform's defining characteristic is its **fully chat-driven interaction model**. Every feature is an "option" accessed through conversation. Users don't fill forms — they talk to the system, which guides them through adaptive questions, refines their informal or broken-language input into structured data, and executes operations seamlessly. The same conversational engine powers the activity tracker, the public website, the suggestion box, and the admin panel — all within a single application, differentiated only by user type and configuration.

---

## 2. Target Users & Personas

### 2.1 Primary Personas

| Persona | User Type | Description |
|---------|-----------|-------------|
| **Political Worker** | `worker` | Ground-level party worker performing daily activities in their constituency |
| **Aspiring Candidate** | `candidate` | Person preparing to contest elections, building a public profile, managing a team of workers |
| **Elected Representative** | `representative` | Serving MLA/MP/Corporator with active governance responsibilities and team management |

### 2.2 Secondary Personas

| Persona | User Type | Description |
|---------|-----------|-------------|
| **Team Worker** | `team_worker` | Worker operating under a candidate/representative, linked to their team |
| **Citizen (Authenticated)** | `citizen` | Member of the public who has authenticated via invite code + mobile, can access suggestion boxes |
| **Citizen (Anonymous)** | `anonymous` | Unauthenticated visitor viewing a user's public website |
| **System Admin** | `system_admin` | Dhoota operations team managing tenants, subscriptions, and system configuration |

---

## 3. Single App, Multiple Experiences

Dhoota is **one application** that serves different experiences based on user type and configuration. There are no separate apps — instead, route groups and configuration determine what each user sees and can do.

### 3.1 Experience Model

```
Single App
├── (app) — Authenticated user experience
│   ├── Workers / Candidates / Representatives → Activity tracker options
│   ├── System Admins → Admin management options
│   └── All → Chat UI with options filtered by user_type + config
│
└── (public) — Public website experience
    ├── Anonymous visitors → SSR pages + limited chat with read-only options
    ├── Authenticated citizens → Chat with suggestion box options
    └── All → Same option engine, different config
```

### 3.2 Configuration-Driven Experience

Every user type has a **default configuration** that defines:
- **Init options**: Batch of options executed when the user first loads the app (determines what they see on the welcome screen)
- **Default options**: Options shown in the default menu (quick-access reads and common actions)
- **Available options**: The full set of options accessible to this user type
- **Theme/layout**: Visual configuration specific to the experience

Configuration can be **overridden at the user level** — enabling per-user feature customization without code changes.

### 3.3 Subscription & Feature Toggles

Not all users have access to all capabilities. Access is controlled via feature toggles managed by the admin team:

| Toggle | Description |
|--------|-------------|
| `activity_tracker` | Core activity tracking options |
| `public_website` | Public website and its associated options |
| `suggestion_box` | Suggestion box options (invite codes, citizen conversations) |
| `ai_features` | AI summaries, tag suggestions, activity planning |
| `ai_social_posts` | Generate social media posts from activities |
| `team_management` | Manage linked workers |
| `custom_domain` | Custom domain for public website |

Toggles filter the available options — if `suggestion_box` is disabled, the user simply never sees SB-related options in their menu or chat.

---

## 4. The Chat-Driven Interaction Model

### 4.1 Core Principle: Everything is a Conversation

Every interaction in Dhoota — viewing activities, creating a report, managing invite codes, configuring a website — is a conversation between the user and the system. There are no standalone pages, no separate CRUD screens, no isolated forms. The chat is the app.

### 4.2 How It Works

1. **User opens the app** → Init config executes a batch of options → Results render as rich widgets in the chat
2. **User sees default options** → Clickable cards for common actions (View Activities, Calendar, Add Activity, etc.)
3. **User selects an option** → System starts a guided Q&A conversation
4. **System asks adaptive questions** → One at a time or grouped, with inline widgets (date pickers, file uploaders, tag selectors) embedded in the chat
5. **User responds naturally** → Keywords, broken sentences, informal language — AI refines everything
6. **System shows refined input** → "Here's what I understood: [polished version]. Should I proceed?"
7. **User confirms** → System executes the option (SQL operations)
8. **System renders results** → Rich widgets (charts, cards, tables, galleries) with inline action buttons
9. **System suggests follow-ups** → Related options and default options always available
10. **User acts on displayed data** → Clicks action buttons on widgets → Triggers new options with pre-filled context

### 4.3 Conversational Input — No Forms

Instead of presenting form fields, every option defines a set of **questions** that the system asks conversationally:

**Example — Adding an Activity**:
```
User: clicks "Add Activity"

System: "What did you do? Just describe it in your own words."
User: "went to school opening ceremony in ward 5 today morning"

System: "Got it! Any photos or videos from the event?"
User: [uploads 2 photos via inline file picker]

System: "Here's what I've prepared:
  Title: School Opening Ceremony - Ward 5
  Description: Attended the school opening ceremony in Ward 5.
  Date: March 11, 2026 (today morning)
  Location: Ward 5
  Tags: Education, Community, Ceremony
  Media: 2 photos attached

  Should I save this? Or would you like to change anything?"
User: "looks good, save it"

System: [Renders activity card with the created activity]
  "Your activity has been saved! Here are some things you can do next:"
  [Add Note] [Share on Website] [View Timeline] [Add Another Activity]
```

**Key behaviors**:
- LLM adapts question grouping based on option complexity and user behavior
- Individual questions can render inline widgets (date picker, file upload, tag selector, location picker) within the chat
- LLM refines broken/informal input into clean, well-structured data
- User always sees the refined version and confirms before execution
- Works for users with limited English proficiency

### 4.4 Free-Text Input

Users can also bypass the guided Q&A by typing naturally:

- "I visited a school opening in ward 5 today, here are some photos" → System auto-detects this maps to "Add Activity", extracts all parameters, shows refined version for confirmation
- "Show my activities this month" → System detects this is a read query, executes directly
- "How many activities did I do last week by tag?" → No predefined option matches → LLM generates a dynamic read-only SQL query → Renders a chart

### 4.5 Dynamic Queries

When no predefined option matches the user's free-text input, the LLM understands the intent and generates a **read-only SQL query** dynamically:

- All dynamic queries are strictly SELECT — no INSERT, UPDATE, or DELETE
- All dynamic queries are tenant-scoped (tenant_id filter enforced)
- Results are formatted using the rich widget system (tables, charts, etc.)

### 4.6 Chat History & Bookmarks

**Conversation History**:
- All conversations are persisted and browsable
- Full-text search across conversation content
- Users can archive or resume past conversations
- AI uses recent conversation context for continuity

**Bookmarks**:
- Users can bookmark an entire assistant response OR individual widgets within a response
- Each widget in a response has a unique addressable ID for selective bookmarking
- Bookmarks are organized into lists (default "Saved Items" + user-created custom lists)
- Bookmarks are accessible via a dedicated option ("Show my bookmarks")

### 4.7 Rich Response Widgets

The response rendering layer supports a comprehensive set of widgets:

| Widget Type | Description | Use Case |
|-------------|-------------|----------|
| **ActivityCard** | Single activity display with inline actions | Activity CRUD results |
| **DataList** | Paginated list with sorting/filtering | Activity lists, code lists, conversation lists |
| **Calendar** | Month/week/day view with items plotted | Activity calendar, planned activities |
| **Chart** | Bar, line, pie, area charts | Tag breakdowns, activity trends, stats |
| **DataTable** | Sortable, filterable table with pagination | Reports, bulk data views |
| **MediaGallery** | Image/video grid with lightbox | Activity media, uploads |
| **Timeline** | Chronological event timeline | Activity history, milestones |
| **Summary** | AI-generated text summary with highlights | Weekly/monthly summaries |
| **StatusTicket** | Async job tracking with progress | Report generation, bulk operations |
| **TagCloud** | Tag visualization | Tag management, distribution |
| **ConversationThread** | Real-time message thread | Suggestion box conversations |
| **CodeList** | Invite code display with copy actions | Suggestion box code management |
| **WebsitePreview** | Embedded website preview | Website configuration |
| **StatsCard** | Key metrics with trend indicators | Dashboard stats |
| **ConfirmationCard** | Refined input preview with confirm/edit | Pre-execution confirmation |
| **QuestionCard** | Guided Q&A question with optional inline widget | Conversational input |
| **DefaultOptionsMenu** | Clickable option cards | Welcome screen, post-action menu |
| **ErrorCard** | Error display with retry | Error handling |
| **TextResponse** | Plain text with markdown | Simple responses |

Every widget supports:
- **Inline actions**: Buttons that trigger other options with pre-filled parameters
- **Bookmarkability**: Each widget can be individually bookmarked
- **Responsive design**: Works on mobile and desktop

---

## 5. Activity Tracker

### 5.1 Activity Model

Each activity is conceptually similar to a social media post:

| Field | Type | Description |
|-------|------|-------------|
| Title | Text | Short headline (AI-refined from user input) |
| Description | Rich Text | Detailed description (AI-refined) |
| Media | Files[] | Photos, videos, documents |
| Date/Time | Timestamp | When the activity occurred |
| Location | Text | Where it took place |
| Tags | Tag[] | System + custom + AI-suggested labels |
| Status | Enum | Planned / In Progress / Completed / Cancelled |
| Visibility | Enum | Private / Team / Public |

#### Activity Notes

Each activity supports follow-up notes (like a discussion thread):
- Additional context, updates, or reflections
- Each note can include text and media
- Chronological thread beneath the activity

### 5.2 Tagging System

**System Tags**: Predefined taxonomy (Governance, Infrastructure, Healthcare, Education, Community, Rally, Meeting, Campaign, etc.)

**Custom Tags**: Users create their own tags with name and optional color.

**AI-Suggested Tags**: When creating/editing an activity, AI suggests relevant tags based on content. Suggestions improve over time.

### 5.3 Activity Views (as Options)

All views are options that render data using appropriate widgets:

| Option | Widget | Description |
|--------|--------|-------------|
| View Activities | DataList | Paginated list with filters and inline actions |
| Activity Timeline | Timeline | Chronological timeline of activities |
| Activity Calendar | Calendar | Month/week/day calendar view |
| Activity Stats | Chart + StatsCard | Tag breakdown, completion rates, trends |
| Channel View | ConversationThread | WhatsApp-style view where tags/activities become channels |

### 5.4 Reporting

**Report Library**: Pre-built report options that generate rich widget responses:
- Weekly/Monthly Activity Summary (Summary widget)
- Tag-wise Activity Breakdown (Chart widget)
- Activity Completion Rate (StatsCard widget)
- Media Gallery Report (MediaGallery widget)
- Team Activity Rollup (DataTable widget)

**Ad-Hoc Reports**: Users describe what they need → LLM generates a dynamic read-only query → Results rendered as appropriate widgets (charts, tables, etc.)

**Background Reports**: Complex reports that take time are handled as async jobs → StatusTicket widget tracks progress → Result delivered when ready.

### 5.5 AI Integration

| Feature | Description | Toggle |
|---------|-------------|--------|
| Input Refinement | Polish broken/informal input into clean structured data | Always on |
| Tag Suggestions | Recommend tags based on activity content | `ai_features` |
| Activity Summaries | Generate narrative summaries for time periods | `ai_features` |
| Activity Planning | Suggest activities based on patterns and goals | `ai_features` |
| Social Media Posts | Generate platform-specific posts from activities | `ai_social_posts` |
| Guidance | Contextual recommendations ("What should I do this week?") | `ai_features` |

---

## 6. Public Website

### 6.1 Overview

The public website is a **route group within the same app** that showcases a user's activities. It has its own chat interface with limited options available to visitors.

### 6.2 Access

- **Default**: `username.dhoota.com` (subdomain)
- **Custom Domain**: Users with `custom_domain` toggle can map their own domain
- **Anonymous access**: Visitors see SSR-rendered activity feed and can use the public chat with read-only options
- **Authenticated access**: Citizens who log in (via invite code + mobile) see additional options (suggestion box)

### 6.3 Website Configuration (as Options)

Website management is done through the tracker chat interface:
- "Update my website banner" → Guided Q&A for banner upload and configuration
- "Change my website theme" → Shows available themes as a selection widget
- "Add a bio widget" → Conversational flow to create/edit widgets
- "Preview my website" → Renders WebsitePreview widget

### 6.4 Website Content

- Activities with `visibility: Public` automatically appear on the website
- Users can pin/feature specific activities
- Near-real-time updates via ISR (Incremental Static Regeneration)

### 6.5 Public Chat

The public website includes a chat interface for visitors:

**Anonymous visitors** get options like:
- View recent activities
- View by tag/category
- View activity calendar
- Contact info

**Authenticated citizens** additionally get:
- Access to suggestion box conversations
- Ability to send suggestions

### 6.6 Website Customization

| Element | Description |
|---------|-------------|
| Banner | Hero image, name, title, constituency |
| Widgets | Bio, contact info, social links, key stats, upcoming events, custom text |
| Theme | Color scheme, typography, layout pattern selection |
| Layout | Feed-left/widgets-right, full-width, grid, magazine-style |
| Footer | Contact info, social links, legal text |

---

## 7. Suggestion Box

### 7.1 Overview

The suggestion box is a private communication channel between a user and citizens. It is accessed through the **public website's chat interface** — citizens authenticate and get suggestion box options.

### 7.2 Invite Code System

1. **Code Buckets**: User creates named buckets (Women, Youth, VIPs, etc.) — internal categorization only
2. **Code Generation**: Generate codes in batches within each bucket
3. **Code Assignment**: Each code is assigned to a mobile number when inviting a citizen
4. **Citizen Access**: Citizen enters mobile + code on the public website → OTP verification → Gets suggestion box options
5. **Multi-Worker**: A citizen invited by multiple workers sees all their suggestion boxes

All of the above is managed through options in the tracker chat:
- "Create a code bucket called Youth Leaders" → Guided Q&A
- "Generate 50 codes for the Women bucket" → Direct execution
- "Show my invite codes" → CodeList widget

### 7.3 Conversations

Once a citizen authenticates:
- They see suggestion box options in the public website chat
- Real-time messaging via Supabase Realtime
- Both citizen and worker can send text and media
- Worker sees all conversations in their tracker chat via the "Suggestion Inbox" option

### 7.4 Conversation Management

Through the tracker chat, workers manage suggestion box conversations:
- "Show unread suggestions" → DataList with conversation threads
- "Summarize this week's suggestions" → AI-generated Summary widget
- Mark conversations as resolved, starred, archived via inline actions

---

## 8. Team Model

### 8.1 Hybrid Linking

- Every user has their own independent account and tenant
- Candidates/representatives can "link" workers to their team
- Workers select which activities to share with linked leaders
- A worker can be linked to multiple candidates
- Leaders get a team dashboard option showing aggregated shared activities

### 8.2 Team Options

| Option | Description |
|--------|-------------|
| Invite Worker | Send team link invitation |
| Team Dashboard | View aggregated activities from linked workers |
| Manage Sharing | Configure what activities are shared with which leader |
| Team Stats | Charts and summaries of team activity |

---

## 9. Admin System

### 9.1 Overview

The admin panel is the same app with `system_admin` user type. Admin users get admin-specific options in their chat.

### 9.2 Admin Options

| Option | Description |
|--------|-------------|
| Create Tenant | Provision a new tenant with subscription level |
| Manage Feature Toggles | Enable/disable features per tenant |
| View Users | List and search user accounts |
| Fulfill Report | View and fulfill ad-hoc report requests |
| System Health | View usage metrics, error rates |
| AI Usage | Monitor AI provider usage and costs |

---

## 10. Authentication

### 10.1 User Authentication (Workers, Candidates, Representatives, Admins)

- **Method**: Email + OTP via Supabase Auth
- **Flow**: Enter email → Receive OTP → Enter OTP → Session established

### 10.2 Citizen Authentication (Suggestion Box)

- **Method**: Mobile number + Invite Code + OTP
- **Flow**: Enter mobile + invite code → Validate pairing → Send OTP to mobile → Enter OTP → Access granted
- **Where**: On the public website

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Metric | Target |
|--------|--------|
| Guided Q&A response | < 2 seconds per question |
| AI input refinement | < 3 seconds |
| Option execution (SQL) | < 500ms |
| Full pipeline (question → answer → refine → execute → render) | < 5 seconds |
| Real-time suggestion box messages | < 500ms |
| Public website page load (SSR) | < 2 seconds |

### 11.2 Security

- Row-Level Security for tenant isolation
- Dynamic SQL queries are read-only and tenant-scoped
- Invite codes are hashed at rest
- Mobile numbers are stored encrypted
- All media served via signed URLs with expiration
- Rate limiting on OTP requests and chat API calls

### 11.3 Internationalization

- i18n-ready architecture (externalized strings)
- Launch language: English only
- AI input refinement helps bridge language proficiency gaps

---

## 12. Feature Phasing

### Phase 1 — MVP

- Single app with `(app)` route group
- Email OTP authentication
- Core activity options: create, list, view, edit, delete, add note, add media
- Conversational Q&A input with AI refinement
- System tags + custom tags + AI tag suggestions
- Timeline and list views
- Chat history and bookmarks
- Default options menu
- Admin options: tenant provisioning, feature toggles
- Multi-tenancy with RLS
- Media upload to S3

### Phase 2 — Website & Advanced Views

- `(public)` route group for public website
- Website configuration options (theme, banner, widgets)
- Subdomain routing + custom domain support
- Calendar view
- Channel view
- Chart widgets for activity stats
- Report library options

### Phase 3 — Suggestion Box & Teams

- Citizen authentication (mobile + invite code)
- Suggestion box options (buckets, codes, conversations)
- Real-time messaging via Supabase Realtime
- Team linking and team dashboard options
- Team activity reports

### Phase 4 — Advanced AI & Polish

- AI activity planning and calendar generation
- Social media post generation
- AI-generated suggestion report cards
- Dynamic query improvements
- Additional chart types and dashboard widgets
- i18n: first regional language

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **Option** | A self-contained feature/action in the system. Every user interaction is an option execution. |
| **Init Config** | The batch of options executed when a user first loads the app, determining their welcome screen. |
| **User Type** | A role category (worker, candidate, citizen, admin, etc.) that determines available options and default config. |
| **Guided Q&A** | The conversational flow where the system asks adaptive questions to gather input for an option. |
| **Inline Widget** | A UI element (date picker, file upload, etc.) rendered within the chat conversation. |
| **Response Widget** | A rich UI component (chart, table, card, etc.) that renders option results in the chat. |
| **Dynamic Query** | An LLM-generated read-only SQL query for ad-hoc data requests that don't match predefined options. |
| **Tenant** | An isolated account boundary — one per subscribing user. |
| **Feature Toggle** | A per-tenant flag controlling access to specific options and capabilities. |
| **Code Bucket** | A named group of invite codes for internal citizen categorization. |
