# Options User Guide

This guide documents all available options in the application—the actions you can perform via chat or the UI. Options appear in different places: the default menu (the initial button grid), as follow-up buttons after a response, or as per-item actions on list entries.

Some options require **feature flags** to be enabled for your tenant. If an option is not visible, your administrator may need to enable the relevant feature.

---

## User Types

| User Type | Description |
|-----------|-------------|
| **Worker / Candidate / Representative** | Internal tenant members who log in to manage activities, announcements, and more. All three share the same option set. |
| **System Admin** | Platform administrators who manage tenants, users, and system configuration. |
| **Citizen** | Public site visitors who view a representative's public content (activities, announcements, etc.) without logging in. |

---

## Worker / Candidate / Representative

Options for internal tenant members.

### Activities

| Option ID | Name | Purpose |
|-----------|------|---------|
| `activity.create` | Add Activity | Create a new activity to track something you did or plan to do. Captures title, description, date, location, tags, media, and visibility. |
| `activity.create_bulk` | Add Activities in Bulk | Add multiple activities at once. Each row can include description, date, location, visibility, and optional photos. |
| `activity.list` | View Activities | Show a list of your recent activities with filtering and sorting options. |
| `activity.view` | View Activity Details | View the full details of a specific activity including notes and media. |
| `activity.edit` | Edit Activity | Edit an existing activity—change title, description, date, location, status, visibility, or tags. |
| `activity.delete` | Delete Activity | Soft-delete an activity. It can be recovered later. |
| `activity.add_note` | Add Note | Add a follow-up note or update to an existing activity. |
| `activity.add_media` | Add Media | Attach photos, videos, or documents to an existing activity. |
| `activity.social_post` | Generate Social Post | Generate a social media post for this activity, with suggested images. Available as a per-item action on activity lists and cards. |
| `activity.manage_tags` | Manage Tags | Add or remove tags for an activity. Available as a per-item action on activity lists and cards. |

### Tags

| Option ID | Name | Purpose |
|-----------|------|---------|
| `tag.manage` | Manage Tags | View, create, and manage your custom tags for categorizing activities. |
| `tag.create` | Create Tag | Create a new custom tag for organizing activities. |

### Stats

| Option ID | Name | Purpose |
|-----------|------|---------|
| `view.stats` | Activity Stats | Show statistics about your activities—counts, breakdowns by tag, status trends, and more. |

### Announcements

*Requires `public_site_enabled` feature flag.*

| Option ID | Name | Purpose |
|-----------|------|---------|
| `announcement.create` | Create Announcement | Create a new announcement. Set visibility to public to share with citizens. |
| `announcement.list` | View Announcements | View your announcements with filtering by visibility. |
| `announcement.view` | View Announcement | View full announcement details. |
| `announcement.edit` | Edit Announcement | Edit an existing announcement title, content, visibility, or pin status. |
| `announcement.delete` | Delete Announcement | Soft-delete an announcement. |

### Info Cards

*Requires `public_site_enabled` feature flag.*

| Option ID | Name | Purpose |
|-----------|------|---------|
| `info_card.create` | Create Info Card | Create an info card (about, contact, service, custom). Set visibility to public to show on citizen site. |
| `info_card.list` | View Info Cards | View your info cards with filtering by type. |
| `info_card.view` | View Info Card | View full info card details. |
| `info_card.edit` | Edit Info Card | Edit an info card title, content, type, visibility, or display order. |
| `info_card.delete` | Delete Info Card | Soft-delete an info card. |

### Reports

*Requires `reports_enabled` feature flag.*

| Option ID | Name | Purpose |
|-----------|------|---------|
| `report.request` | Request Report | Request a report to be generated for your activities. |
| `report.list` | View My Reports | View your report requests and their status. |

### Bookmarks

*Requires `bookmarks_enabled` feature flag.*

| Option ID | Name | Purpose |
|-----------|------|---------|
| `bookmark.add` | Bookmark Item | Save an activity, conversation, or report to your bookmarks for quick access. |
| `bookmark.list` | View Bookmarks | View your saved bookmarks. |
| `bookmark.remove` | Remove Bookmark | Remove an item from your bookmarks. |

### Programs

*Requires `programs_enabled` feature flag.*

| Option ID | Name | Purpose |
|-----------|------|---------|
| `program.create` | Create Program | Create a program with a date range and planned activities. |
| `program.list` | View Programs | View your programs with progress tracking. |
| `program.view` | View Program Details | View a program with its activity calendar and progress. |
| `program.edit` | Edit Program | Update program title, dates, description, status, or visibility. |
| `program.add_activity` | Add Activity to Program | Create a new activity inside a program or link an existing one. |
| `program.remove_activity` | Remove Activity from Program | Remove an activity from a program. |
| `program.delete` | Delete Program | Delete a program. Requires confirmation. |

### Profile

| Option ID | Name | Purpose |
|-----------|------|---------|
| `profile.view` | View Profile | View your profile and account details. |
| `profile.edit` | Edit Profile | Update your display name or preferences. |

### Public Site

*Requires `public_site_enabled` feature flag.*

| Option ID | Name | Purpose |
|-----------|------|---------|
| `public_site.configure` | Configure Public Site | Set up your public site welcome message, side panel content, theme, and which options citizens can access. |
| `public_site.preview` | Preview Public Site | Preview how your public site looks to citizens. |

### Suggestion Box

*Requires `suggestion_box_enabled` feature flag.*

| Option ID | Name | Purpose |
|-----------|------|---------|
| `citizen.access.create` | Create Access Code | Generate a new citizen access code for the suggestion box. |
| `citizen.access.assign` | Assign Mobile Number | Assign a mobile number to an existing access code to activate it. |
| `citizen.access.list` | View Access Codes | List all citizen access codes with assignment status and group memberships. |
| `citizen.access.revoke` | Revoke Access | Deactivate a citizen access code. |
| `citizen.access.regenerate` | Regenerate Access Code | Generate a new code for a citizen, invalidating the old one. |
| `citizen.group.create` | Create Citizen Group | Create a group to organize suggestors (e.g., "Ward 5 Residents"). |
| `citizen.group.list` | View Citizen Groups | List groups with member counts. |
| `citizen.group.edit` | Edit Citizen Group | Rename group, add or remove members. |
| `suggestion_box.create` | Create Suggestion Box | Create a suggestion box, optionally restrict to specific citizen groups. |
| `suggestion_box.list` | View Suggestion Boxes | List suggestion boxes with suggestion counts. |
| `suggestion_box.edit` | Edit Suggestion Box | Update title, description, allowed groups, or activate/deactivate. |
| `suggestion.list` | View Suggestions | View suggestions from citizens, filterable by box, status, or citizen. |
| `suggestion.respond` | Respond to Suggestion | Add a note to a suggestion and update its status. |

### Analysis

*Requires `analysis_enabled` feature flag.*

| Option ID | Name | Purpose |
|-----------|------|---------|
| `analysis.activities` | Search Activities | Search, filter, and browse across all your activities. |
| `analysis.tags` | Tags & Categories | View tag usage, distribution, and activity counts per tag. |
| `analysis.timeline` | Activity Timeline | View trends, patterns, and time-based analysis of activities. |
| `analysis.notes` | Search Notes | Search across all activity notes and follow-ups. |
| `analysis.specific_activity` | Find an Activity | Look up a specific activity by title, date, or other criteria. |

---

## System Admin

Options for platform administrators.

### Tenants

| Option ID | Name | Purpose |
|-----------|------|---------|
| `admin.tenant.create` | Create Tenant | Provision a new tenant with name, slug, and subscription level. |
| `admin.tenant.list` | List Tenants | View all tenants with subscription info and user counts. |
| `admin.tenant.view` | View Tenant | View tenant details including users and configuration. |
| `admin.tenant.edit` | Edit Tenant | Update tenant name, subscription level, or custom domain. |
| `admin.tenant.delete` | Delete Tenant | Soft-delete a tenant. |

### Users

| Option ID | Name | Purpose |
|-----------|------|---------|
| `admin.user.provision` | Provision User | Create a user for a tenant with email, user type, and display name. Generates an access code for login. |
| `admin.user.provision_bulk` | Provision Multiple Users | Add multiple users to a tenant at once. Each row: email, display name, user type. |
| `admin.user.list` | List Users | View users filtered by tenant or user type. |
| `admin.user.view` | View User | View user details including access code and activity. |
| `admin.user.edit` | Edit User | Change user type, display name, regenerate access code, or deactivate a user. |

### Feature Flags

| Option ID | Name | Purpose |
|-----------|------|---------|
| `admin.feature_flag.manage` | Manage Feature Flags | Enable or disable feature flags per tenant (e.g., dynamic_queries, chat_history, reports_enabled, public_site_enabled, suggestion_box_enabled). |

### Options & Questions

| Option ID | Name | Purpose |
|-----------|------|---------|
| `admin.option.list` | List Options | View all option definitions with their current config per tenant. |
| `admin.option.configure` | Configure Option | Enable/disable an option for a tenant, override display text, set priority. |
| `admin.option.view` | View Option Details | See full option definition including SQL templates, questions, and follow-ups. |
| `admin.question.list` | List Questions | View questions for an option. |
| `admin.question.configure` | Configure Question | Override question text, widget config, or required status per tenant. |

### Conversations & Debug

| Option ID | Name | Purpose |
|-----------|------|---------|
| `admin.conversation.list` | List Conversations | View conversations for any user or tenant, searchable by email, tenant, or date range. |
| `admin.conversation.view` | View Conversation | Load a specific conversation with full messages and debug traces. |
| `admin.trace.lookup` | Lookup Trace | Search by trace ID to find the message, conversation, user, and full pipeline trace. |

### Subscription & Usage

| Option ID | Name | Purpose |
|-----------|------|---------|
| `admin.subscription.manage` | Manage Subscription | Change tenant subscription level and view limits. |
| `admin.usage.view` | View Usage | Track option executions, LLM token usage, costs, and storage per tenant. |

### Reports

| Option ID | Name | Purpose |
|-----------|------|---------|
| `admin.report.list` | View Report Requests | List all report requests across tenants with status. |
| `admin.report.process` | Process Report | Update report request status and attach result URL. |

### Public Site (Admin)

| Option ID | Name | Purpose |
|-----------|------|---------|
| `admin.public_site.configure` | Configure Public Site | Set welcome message and site title for a tenant's public site. Admin can configure for any tenant and any representative. |

### Announcements (Admin)

| Option ID | Name | Purpose |
|-----------|------|---------|
| `admin.announcement.list` | List Tenant Announcements | View announcements for a tenant. Filter by visibility or user. |
| `admin.announcement.view` | View Announcement | View full announcement details. Admin can view any tenant announcement. |
| `admin.announcement.delete` | Delete Announcement | Soft-delete an announcement. Admin can delete any tenant announcement. |

### Info Cards (Admin)

| Option ID | Name | Purpose |
|-----------|------|---------|
| `admin.info_card.list` | List Tenant Info Cards | View info cards for a tenant. |
| `admin.info_card.view` | View Info Card | View full info card details. |
| `admin.info_card.delete` | Delete Info Card | Soft-delete an info card. Admin can delete any tenant info card. |

---

## Citizen

Read-only options for public site visitors. Content is scoped to the representative whose public site you are viewing.

| Option ID | Name | Purpose |
|-----------|------|---------|
| `public.activities` | View Activities | Browse public activities from this representative. |
| `public.stats` | View Stats | See public activity statistics for this representative. |
| `public.announcements` | Announcements | View published announcements from this representative. |
| `public.info_cards` | Information | View public info cards (about, contact, services) from this representative. |
| `public.about` | About | View the representative's public profile. |
| `public.programs` | View Programs | View public programs for this representative. *Requires `programs_enabled`.* |
| `public.suggestion.submit` | Submit Suggestion | Submit a suggestion to a suggestion box. Requires mobile number and access code. *Requires `suggestion_box_enabled`.* |
| `public.suggestion.list` | View My Suggestions | View your submitted suggestions and responses. Requires mobile number and access code. *Requires `suggestion_box_enabled`.* |

---

## Appendix: Feature Flags

Some options are only available when specific feature flags are enabled for your tenant. System admins can manage these via `admin.feature_flag.manage`.

| Flag | Required By |
|------|-------------|
| `public_site_enabled` | Announcements, Info Cards, Public Site config, Citizen public options |
| `suggestion_box_enabled` | Suggestion box management (citizen.access.*, citizen.group.*, suggestion_box.*, suggestion.*), public.suggestion.submit, public.suggestion.list |
| `reports_enabled` | report.request, report.list |
| `bookmarks_enabled` | bookmark.add, bookmark.list, bookmark.remove |
| `analysis_enabled` | analysis.activities, analysis.tags, analysis.timeline, analysis.notes, analysis.specific_activity |
| `programs_enabled` | program.* (create, list, view, edit, add_activity, remove_activity, delete), public.programs |
