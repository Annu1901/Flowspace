# Product Requirements Document (PRD) - Flowspace

## 1. Project Overview & Vision
**Flowspace** is a modern, high-performance, real-time workspace and project management application built with high design standards, robust Role-Based Access Control (RBAC), multi-tenant project isolation, real email authentication via Supabase Auth & Resend SMTP, and Netlify cloud deployment readiness.

---

## 2. Core Value Proposition
- **Modern UI & Motion Design**: Dynamic glassmorphic UI, responsive layouts, theme toggle, micro-animations (GSAP).
- **Multi-Tenant Workspaces & Multi-Project Isolation**: Create and switch between workspaces, manage projects within workspaces, and filter task boards by project.
- **Strict Password & Email Security**: RFC 5322 email validation, 8+ character password rule (min 1 number, 1 uppercase letter, 1 special character), show/hide eye toggles, and current password verification.
- **Real Email Authentication & Recovery**: Integrated with Supabase Auth (`@supabase/supabase-js`) and Resend Custom SMTP for password resets and team invitations.
- **Guaranteed One-Time Invitations Inbox**: Email invitations sent directly to users, one-time popup dismissal with persistence in LocalStorage, and a dedicated **Invitations Management Inbox** (Received & Sent) with explicit **Join Workspace** / **Decline** actions.
- **Granular RBAC**: 3 Role tiers (`Workspace admin`, `Workspace member`, `Viewer`) enforcing read/write boundaries across tasks, comments, file attachments, and workspace settings.

---

## 3. Target User Personas
1. **Workspace Admin**: Creates workspaces, manages team roles, sends and revokes invitations, creates and renames projects, and deletes tasks.
2. **Workspace Member**: Collaborates on projects, creates/edits assigned tasks, leaves comments, and uploads attachments.
3. **Viewer**: Read-only stakeholder who monitors progress, views board status, and receives notifications without editing capability.

---

## 4. Key Functional Requirements

### 4.1 Authentication & Security
- Sign Up & Log In with real email validation.
- Password rules: Minimum 8 characters, at least 1 number, 1 uppercase letter, 1 special character.
- Show/Hide Password Eye toggles on all password inputs.
- Forgot Password workflow with Resend SMTP email delivery & recovery token URL handling (`/#type=recovery`).
- Account Settings security: Current password verification required to update passwords.

### 4.2 Workspace & Multi-Project Management
- Workspace creation, selection, and renaming.
- Projects within workspaces with dedicated board filters.
- Real-time project activity timeline and user-targeted notifications.

### 4.3 Workspace Invitations & Access Control
- Workspace Admins invite members by email with role assignment (`Workspace member`, `Workspace admin`, `Viewer`).
- Real invitation links sent via email (`/#invite=ID`).
- One-Time Invitation Popup: Appears once per invite; if closed, persists in **Invitations Management System** without repeatedly blocking the UI.
- Strict Access Guard: Declined or unaccepted users are forbidden (`403`) from accessing or selecting the workspace until they click **Join Workspace**.

---

## 5. Non-Functional Requirements
- **Performance**: Instant page load (<1s), micro-animations running at 60fps.
- **Deployment**: Netlify SPA host configuration (`netlify.toml`), Supabase PostgreSQL database, and GitHub repository integration.
