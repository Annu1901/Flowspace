# API Reference - Flowspace REST Endpoints

Comprehensive reference of all HTTP REST API endpoints supported by **Flowspace** Node.js backend server (`server.js`) and static client API handler (`public/app.js`).

---

## 1. Authentication & Account Endpoints

### `GET /api/auth/config`
- **Description**: Returns client Supabase URL & Anon Key.
- **Response**: `{ "supabaseUrl": "...", "supabaseAnonKey": "..." }`

### `POST /api/auth/login`
- **Description**: Authenticates user credentials.
- **Body**: `{ "email": "...", "password": "..." }`
- **Response**: `{ "id": "...", "name": "...", "email": "..." }`

### `POST /api/auth/signup`
- **Description**: Registers new user with strict RFC email validation and password complexity rules (min 8 chars, 1 uppercase, 1 number, 1 special char).
- **Body**: `{ "name": "...", "email": "...", "password": "..." }`

### `POST /api/auth/reset-password`
- **Description**: Resets user password securely via email token.
- **Body**: `{ "email": "...", "password": "..." }`

### `PATCH /api/account`
- **Description**: Updates user profile details or changes password with current password verification.
- **Body**: `{ "name": "...", "email": "...", "currentPassword": "...", "password": "..." }`
- **Response**: `{ "id": "...", "name": "...", "email": "..." }`

---

## 2. Multi-Tenant State & Workspaces

### `GET /api/state`
- **Description**: Fetches multi-tenant state for the logged-in user (active workspace, workspaces list, projects, tasks, members, activity, notifications, received & sent invites).

### `POST /api/workspaces`
- **Description**: Creates a new workspace and assigns creator as Workspace Admin.
- **Body**: `{ "name": "...", "description": "..." }`

### `PATCH /api/workspaces/:id`
- **Description**: Renames or updates workspace settings (Admins only).
- **Body**: `{ "name": "...", "description": "..." }`

### `POST /api/workspaces/:id/select`
- **Description**: Switches the user's active workspace (enforces accepted membership check).

---

## 3. Project Management Endpoints

### `POST /api/projects`
- **Description**: Creates a new project in the active workspace.
- **Body**: `{ "name": "...", "description": "..." }`

### `PATCH /api/projects/:id`
- **Description**: Renames or updates project details. Dynamically reconciles in-memory state with Supabase PostgreSQL DB.
- **Body**: `{ "name": "...", "description": "..." }`

### `DELETE /api/projects/:id`
- **Description**: Deletes a project and cleanly cascades task deletion in the active workspace.

---

## 4. Task Management Endpoints

### `POST /api/tasks`
- **Description**: Creates a new task in a project.
- **Body**: `{ "title": "...", "description": "...", "projectId": "...", "priority": "...", "assigneeId": "...", "dueDate": "...", "tags": [] }`

### `PATCH /api/tasks/:id`
- **Description**: Updates task details, Kanban column status (`todo`, `in-progress`, `in-review`, `done`), assignee, priority, or tags. Enforces RBAC permissions.

### `DELETE /api/tasks/:id`
- **Description**: Deletes a task (Workspace Admins only).

### `POST /api/tasks/:id/comments`
- **Description**: Adds a comment to a task discussion.

### `POST /api/tasks/:id/attachments`
- **Description**: Uploads a file attachment record to a task.

---

## 5. Team & Member Management

### `PATCH /api/members/:id`
- **Description**: Updates a member's workspace role (`Workspace admin`, `Workspace member`, `Viewer`) (Admins only).
- **Body**: `{ "role": "..." }`

### `DELETE /api/members/:id`
- **Description**: Removes a member from the workspace (Admins only; self-removal forbidden).

### `POST /api/invites`
- **Description**: Sends a workspace invitation to an email address and creates a real-time notification (`target_email`).

### `POST /api/invites/join`
- **Description**: Accepts a received invitation, grants workspace membership, and switches active workspace.

### `POST /api/invites/decline`
- **Description**: Declines a received workspace invitation and purges pending access.

### `DELETE /api/invites/:id`
- **Description**: Revokes a sent workspace invitation (Admins only).

---

## 6. Real-Time Notifications API

### `PATCH /api/notifications/read`
- **Description**: Marks a specific notification as read and updates Supabase PostgreSQL DB (`read: true`).
- **Body**: `{ "id": "..." }`

### `POST /api/notifications/read-all`
- **Description**: Marks all notifications targeted to the logged-in user or active workspace as read (`read: true`).
