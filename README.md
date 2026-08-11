# ✦ Flowspace

A high-performance, real-time team collaboration workspace and project management platform. Flowspace enables modern product teams to organize projects, manage Kanban task boards, track activity feeds, invite teammates, and manage multi-tenant workspaces with granular Role-Based Access Control (RBAC).

---

## 🚀 Live Demo & Deployment

- **Vercel Live Web App**: [https://flowspace20.vercel.app/](https://flowspace20.vercel.app/)
- **Backend API (Render)**: Hosted Node.js HTTP Service & Supabase PostgreSQL Database

---

## ✨ Key Features & Functionality

### 1. ✦ Multi-Tenant Workspaces
- **Workspace Switcher**: Create new workspaces, rename workspaces, and switch between active workspaces instantly.
- **Data Isolation**: All projects, tasks, activities, members, and notifications are isolated per workspace.

### 2. 📁 Project Management & Directory
- **Project Directory**: Create, select, rename, and delete projects.
- **All Projects Mode**: Toggle "All Projects" view to browse and filter tasks across every project in the active workspace.
- **Cascade Deletion**: Deleting a project cleanly removes all associated tasks without leaving orphaned data.

### 3. ▦ Real-Time Drag-and-Drop Kanban Board
- **Status Columns**: Move tasks seamlessly between `To Do`, `In Progress`, `In Review`, and `Done`.
- **Interactive Drag-and-Drop**: HTML5 native drag-and-drop with real-time state persistence to Supabase PostgreSQL and local storage fallback.
- **Task Filters**: Filter task boards by Assignee (`Everyone` / individual member) and Priority (`Urgent`, `High`, `Medium`, `Low`).

### 4. 🛡️ Role-Based Access Control (RBAC)
- **Workspace Admin**: Full privileges to create/rename/delete projects, manage workspace settings, assign member roles, and invite/remove members.
- **Workspace Member**: Can create tasks, edit details, upload attachments, add comments, and move assigned tasks.
- **Viewer (Read-Only)**: View-only access. Write buttons and drag-and-drop handles are automatically hidden.

### 5. 📝 Tasks, Attachments & Discussion
- **Task Details Modal**: Edit title, description, priority, assignee, due date, and tags.
- **File Attachments**: Upload and preview file attachments per task.
- **Task Discussion**: Add timestamped comments and collaborate in real-time.
- **Overdue Badges**: Visual indicators (`◷ Late`) for tasks past their due date.

### 6. 🔔 Real-Time Notification Engine
- **Targeted Notifications**: In-app Notification Bell 🔔 with unread badge counter.
- **Mark as Read**: Mark individual notifications or click **Mark all read** with live SQL state updates.
- **Invite Notifications**: Real-time delivery of workspace invitations (`📩 You were invited by...`) and acceptance alerts (`🎉 User accepted invitation`).

### 7. ⏰ Workspace Activity Audit Trail
- **Activity Feed**: Timeline recording task creations, status moves, project updates, member role changes, and file uploads.

### 8. 📊 Dashboard Analytics & Progress Tracking
- **Interactive Metrics**: Dynamic task completion percentage ring, status breakdown bars, and summary count cards.

### 9. 📱 100% Mobile Responsive Design
- **Mobile Bottom Navigation Bar**: Fixed glassmorphism bottom bar on screens `< 768px` for single-tap view navigation (`Overview`, `Board`, `Activity`, `Team`, `Settings`).
- **Adaptive Touch Layouts**: Responsive 1, 2, and 4-column grids with touch-optimized modals (`94vw`).

---

## 🛠️ Technology Stack & System Architecture

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, Vanilla CSS3 (Custom Glassmorphism Design System, CSS Variables, Flexbox/Grid), GSAP Animations
- **Backend**: Node.js HTTP Server (`server.js`)
- **Database & Cloud**: Supabase Client JS (`@supabase/supabase-js`) & PostgreSQL Database
- **Dual Persistence Model**: Automatically syncs with Supabase PostgreSQL DB when connected, with a fast local JSON (`data.json`) fallback for offline/standalone execution.

---

## ⚙️ Local Setup & Development

### Prerequisites
- Node.js 20+ installed


---

## 📄 License

Built for Flowspace collaboration workspace. All rights reserved.
