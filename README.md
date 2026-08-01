# Flowspace

A complete collaboration workspace built for the internship project brief. It includes a persistent Node.js backend and a responsive browser UI.

## Run locally

Requires Node.js 20+.

```bash
npm start
```

Open `http://localhost:3000`.

## Features

- Drag-and-drop Kanban board with backend-persisted moves
- Create, edit, delete, assign, and prioritize tasks with due dates and tags
- Task comments and file attachments (stored locally in `data.json`)
- Activity timeline, dashboard analytics, completion tracking, and deadline alerts
- Team member invite flow and notification inbox
- No external dependency or database setup required; `data.json` acts as the local persistence layer. Replace the `load`/`save` functions in `server.js` with MongoDB calls for production deployment.
