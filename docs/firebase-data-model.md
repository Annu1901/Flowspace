# Data Model & JSON Document Specification - Flowspace

## 1. Overview
Flowspace utilizes a decoupled data storage model that seamlessly maps to relational PostgreSQL (Supabase) as well as document JSON format (`data.json`).

---

## 2. JSON State Schema Structure (`data.json`)

```json
{
  "users": [
    {
      "id": "u-101",
      "name": "Ayush",
      "email": "aayu21082005@gmail.com",
      "password": "Password@123",
      "activeWorkspaceId": "ws-1"
    }
  ],
  "workspaces": [
    {
      "id": "ws-1",
      "name": "Ayush's Workspace",
      "description": "Your primary team workspace",
      "createdAt": "2026-08-01T12:00:00Z"
    }
  ],
  "projects": [
    {
      "id": "proj-1",
      "workspaceId": "ws-1",
      "name": "Product Launch",
      "description": "Ship the next major release",
      "createdAt": "2026-08-01T12:00:00Z"
    }
  ],
  "members": [
    {
      "id": "m-1",
      "workspaceId": "ws-1",
      "name": "Ayush",
      "email": "aayu21082005@gmail.com",
      "role": "Workspace admin",
      "color": "#7c3aed"
    }
  ],
  "invites": [
    {
      "id": "inv-1",
      "workspaceId": "ws-1",
      "workspaceName": "Ayush's Workspace",
      "email": "dagarannu40@gmail.com",
      "name": "Annu",
      "role": "Workspace member",
      "status": "Pending",
      "createdAt": "2026-08-01T12:30:00Z"
    }
  ],
  "notifications": [
    {
      "id": "n-1",
      "workspaceId": "ws-1",
      "text": "📩 You were invited by Ayush to join workspace \"Ayush's Workspace\" as Workspace member.",
      "targetEmail": "dagarannu40@gmail.com",
      "read": false,
      "at": "2026-08-01T12:30:00Z"
    }
  ],
  "activity": [
    {
      "id": "act-1",
      "workspaceId": "ws-1",
      "actor": "Ayush",
      "action": "invited member",
      "task": "dagarannu40@gmail.com",
      "at": "2026-08-01T12:30:00Z"
    }
  ],
  "tasks": [
    {
      "id": "t-1",
      "workspaceId": "ws-1",
      "projectId": "proj-1",
      "title": "Design Landing Page",
      "description": "Build high-converting UI layout",
      "status": "todo",
      "priority": "high",
      "assigneeId": "m-1",
      "dueDate": "2026-08-05",
      "tags": ["Design"],
      "comments": [],
      "attachments": []
    }
  ]
}
```
