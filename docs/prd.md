# Product Requirements Document (PRD) - Flowspace

## 1. Project Overview & Vision
**Flowspace** is a modern, high-performance, real-time workspace and project management application built with high design standards, robust Role-Based Access Control (RBAC), multi-tenant project isolation, real email authentication via Supabase Auth & Resend SMTP, 100% mobile responsiveness, and production deployment on Vercel (`flowspace26.vercel.app`) & Render.

---

## 2. Core Value Proposition
- **Modern UI & Responsive Design**: Dynamic glassmorphic UI, theme toggle, GSAP micro-animations, and a fixed Mobile Bottom Navigation Bar (`< 768px`) for single-tap navigation.
- **Multi-Tenant Workspaces & Project Directory**: Create, rename, and switch between workspaces; create, rename, and delete projects with automatic task cascade deletion.
- **Strict Password & Email Security**: RFC 5322 email validation, 8+ character password rule (min 1 number, 1 uppercase letter, 1 special character), show/hide eye toggles, and current password verification.
- **Real Email Authentication & Recovery**: Integrated with Supabase Auth (`@supabase/supabase-js`) and Resend Custom SMTP for password resets and team invitations.
- **Targeted Notification Engine**: Non-disruptive in-app invitation delivery (`target_email`), Notification Bell 🔔 popover with unread counter, and live **Mark as Read** / **Mark All Read** SQL persistence.
- **Granular RBAC**: 3 Role tiers (`Workspace admin`, `Workspace member`, `Viewer`) enforcing read/write boundaries across tasks, comments, file attachments, and workspace settings.

---

## 3. Target User Personas
1. **Workspace Admin**: Creates workspaces, manages team roles, sends and revokes invitations, creates/renames/deletes projects, and manages workspace settings.
2. **Workspace Member**: Collaborates on projects, creates/edits assigned tasks, leaves comments, and uploads attachments.
3. **Viewer**: Read-only stakeholder who monitors progress, views board status, and receives notifications without editing capability.

---

## 4. Key Functional Requirements

### 4.1 Authentication & Security
- Sign Up & Log In with real email validation.
- Password complexity: Minimum 8 characters, at least 1 number, 1 uppercase letter, 1 special character.
- Show/Hide Password Eye toggles on all password inputs.
- Forgot Password workflow with Resend SMTP email delivery & recovery token URL handling (`/#type=recovery`).
- Account Settings security: Current password verification required to update passwords.

### 4.2 Workspace & Multi-Project Management
- Workspace creation, selection, and renaming.
- Projects within workspaces with dedicated board filters and "All Projects Directory".
- Dynamic project rename & cascade deletion without leaving orphaned records.
- Real-time project activity timeline and targeted user notifications.

### 4.3 Workspace Invitations & Access Control
- Workspace Admins invite members by email with role assignment (`Workspace member`, `Workspace admin`, `Viewer`).
- Non-disruptive in-app notification delivery to recipient's notification bell.
- Dedicated **Workspace Invitations Received** and **Sent Workspace Invitations** inboxes with explicit **Join Workspace** / **Decline** actions.
- Strict Access Guard: Unaccepted users are forbidden (`403`) from accessing or selecting the workspace until they click **Join Workspace**.

---

## 5. Non-Functional Requirements
- **Performance**: Instant page load (<1s), micro-animations running at 60fps.
- **Responsiveness**: Mobile bottom navigation bar, touch-optimized modals (`94vw`), adaptive 1/2/4-column grids across mobile, tablet, laptop, and desktop.
- **Deployment**: Deployed live on Vercel (`flowspace26.vercel.app`), Render Node.js backend, Supabase PostgreSQL database, and GitHub repository integration.
