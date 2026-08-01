# MVP Scope & Feature Roadmap - Flowspace

## 1. Current MVP Scope (Fully Built)

| Feature Area | Included Capabilities | Status |
| :--- | :--- | :--- |
| **Authentication** | Real email signup/login, RFC 5322 validation, 8+ char strict password rule, eye toggles, forgot password email reset via Resend. | ✅ Complete |
| **Workspace Management** | Multi-workspace creation, switching, renaming, workspace-isolated state. | ✅ Complete |
| **Multi-Project System** | Project grid, project creation, filtering task boards by project. | ✅ Complete |
| **Team & RBAC** | Admin, Member, Viewer roles with UI and API permission enforcement. | ✅ Complete |
| **Team Invitations** | Real email invitations, 1-time popup dismissal with LocalStorage persistence, Received & Sent Invitations Inbox. | ✅ Complete |
| **Task Management** | Kanban board (Todo, In Progress, Review, Done), drag & drop, due dates, priority tags, file attachments, comments. | ✅ Complete |
| **Notifications & Activity**| Real-time activity log, user-targeted notifications popover with mark-as-read. | ✅ Complete |
| **Deployment Setup** | Netlify SPA build setup (`netlify.toml`), Supabase PostgreSQL DB schema (`schema.sql`), environment variable config. | ✅ Complete |

---

## 2. Feature Roadmap (Post-MVP Enhancements)

### Phase 2: Advanced Collaboration
- Live WebSocket multi-cursor collaboration.
- Rich text task description editor (Markdown/WYSIWYG).
- @mentions in comments with email push notifications.

### Phase 3: Analytics & Integrations
- Workspace productivity charts & burn-down charts (Chart.js).
- GitHub / GitLab pull request webhook integration.
- Custom webhook triggers for Slack & Discord notifications.
