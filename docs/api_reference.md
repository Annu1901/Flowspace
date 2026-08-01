# API Reference - Flowspace REST Endpoints

## 1. Authentication Endpoints

### `GET /api/auth/config`
- **Description**: Returns client Supabase URL & Anon Key.
- **Response**: `{ "supabaseUrl": "...", "supabaseAnonKey": "..." }`

### `POST /api/auth/login`
- **Description**: Authenticates user credentials.
- **Body**: `{ "email": "...", "password": "..." }`
- **Response**: `{ "id": "...", "name": "...", "email": "..." }`

### `POST /api/auth/signup`
- **Description**: Registers new user with strict RFC email and password rules.
- **Body**: `{ "name": "...", "email": "...", "password": "..." }`

### `POST /api/auth/reset-password`
- **Description**: Resets user password securely.
- **Body**: `{ "email": "...", "password": "..." }`

---

## 2. State & Workspace Endpoints

### `GET /api/state`
- **Description**: Fetches multi-tenant state for logged in user (active workspace, user workspaces, projects, tasks, received & sent invites).

### `POST /api/workspaces`
- **Description**: Creates a new workspace.

### `POST /api/workspaces/:id/select`
- **Description**: Switches active workspace (enforces accepted membership check).

---

## 3. Project & Task Endpoints

### `POST /api/projects`
- **Description**: Creates a new project in active workspace.

### `POST /api/tasks`
- **Description**: Creates a new task.

### `PATCH /api/tasks/:id`
- **Description**: Updates task status, assignee, priority, due date.

### `DELETE /api/tasks/:id`
- **Description**: Deletes a task (Admins only).

---

## 4. Team & Invitations Endpoints

### `POST /api/invites`
- **Description**: Sends workspace invitation (triggers Supabase Auth & Resend email).

### `POST /api/invites/join`
- **Description**: Accepts invitation, grants workspace membership & switches workspace.

### `POST /api/invites/decline`
- **Description**: Declines invitation, revokes membership & purges access.

### `DELETE /api/invites/:id`
- **Description**: Revokes a sent invitation (Admins only).
