# Pages & Code Snippets Reference - Flowspace

This document provides exact file locations, structural summaries, and comprehensive code snippets for all primary pages, views, and core components in **Flowspace**.

---

## 1. Home Page (Guest Landing Page)

- **File Locations**:
  - HTML Layout: `public/index.html` (Lines 9 – 47)
  - JS Shell & Entrance Animation: `public/app.js` (Lines 1200 – 1210 & 2912 – 2923)
  - CSS Styling: `public/styles.css` (Lines 1680 – 1760)

### Code Snippet:
```html
<!-- public/index.html (Lines 9 - 47) -->
<div id="landing-view" class="landing-shell">
  <header class="landing-header">
    <div class="brand"><span class="brand-mark">✦</span><span>flowspace</span></div>
    <div class="landing-actions" style="display: flex; align-items: center; gap: 12px;">
      <button aria-label="Toggle Theme" class="theme-toggle">
        <svg class="theme-toggle-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 18px; height: 18px;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      </button>
      <button class="secondary" id="landing-login-btn">Log in</button>
      <button class="primary" id="landing-signup-btn">Get started for free</button>
    </div>
  </header>
  <main class="landing-main">
    <div class="landing-hero">
      <span class="pill">INTRODUCING FLOWSPACE</span>
      <h1>Make progress feel effortless.</h1>
      <p>A beautiful collaboration workspace built for modern product teams. Plan, track, and ship projects with real-time kanban boards, activity feeds, team invites, and seamless workspace switching.</p>
      <div class="landing-cta">
        <button class="primary btn-large" id="hero-get-started-btn">Get started for free</button>
      </div>
    </div>
    <div class="features-grid">
      <div class="feature-card">
        <h3>▦ Real-time Boards</h3>
        <p>Drag and drop tasks seamlessly. Everyone on your team sees updates instantly as they happen.</p>
      </div>
      <div class="feature-card">
        <h3>◷ Activity Timeline</h3>
        <p>Follow a complete history of progress, updates, and comments from team members across the studio.</p>
      </div>
      <div class="feature-card">
        <h3>✦ Workspaces</h3>
        <p>Switch between projects, clients, or product teams easily using the secure workspace selector.</p>
      </div>
    </div>
  </main>
</div>
```

---

## 2. Login Page / Modal

- **File Locations**:
  - Modal Generator & Form Submit Handler: `public/app.js` (Lines 79 – 119)
  - Backend Authentication Route: `server.js` (Lines 120 – 145)

### Code Snippet:
```javascript
// public/app.js (Lines 79 - 119) - Log In Handler
function showLogin() {
  $('#auth-backdrop').innerHTML = `
    <div class="auth-modal">
      <h2>Welcome back</h2>
      <p>Enter your credentials to access your workspace.</p>
      <form id="login-form">
        <div class="field full">
          <label>EMAIL ADDRESS</label>
          <input required type="email" name="email" placeholder="name@company.com">
        </div>
        <div class="field full">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <label style="margin:0">PASSWORD</label>
            <a id="forgot-password-link" style="font-size:11px;color:var(--accent);cursor:pointer">Forgot password?</a>
          </div>
          <div class="password-input-wrapper">
            <input required type="password" name="password" placeholder="••••••••">
            ${eyeBtnMarkup}
          </div>
        </div>
        <button class="primary" style="margin-top:10px; padding:12px">Log in</button>
      </form>
      <div class="auth-modal-footer">
        Don't have an account? <a id="goto-login-signup">Sign up</a>
      </div>
      <button class="close" style="position:absolute; top:15px; right:15px">×</button>
    </div>
  `;
  $('#auth-backdrop').classList.add('show');

  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    if (!validateEmail(payload.email)) return toast('Please enter a valid email address.');

    try {
      const user = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem('flowspace_user', JSON.stringify(user));
      $('#auth-backdrop').classList.remove('show');
      toggleAuthShell(true);
      await refresh();
      setView('overview');
      toast(`Welcome back, ${user.name}!`);
    } catch (err) {
      toast(err.message || 'Invalid email or password');
    }
  };
  wirePasswordToggles($('#auth-backdrop'));
}
```

---

## 3. Overview Page

- **File Locations**:
  - HTML Container: `public/index.html` (Lines 184 – 266)
  - JS Render Engine: `public/app.js` (Lines 1300 – 1360)

### Code Snippet:
```javascript
// public/app.js (Lines 1300 - 1360) - Overview Renderer
function renderOverview() {
  const ts = currentTasks();
  const total = ts.length;
  const done = ts.filter(t => t.status === 'done').length;
  const inProgress = ts.filter(t => t.status === 'in-progress').length;
  const todo = ts.filter(t => t.status === 'todo').length;

  if ($('#completed-count')) $('#completed-count').textContent = done;
  if ($('#progress-count')) $('#progress-count').textContent = inProgress;
  if ($('#todo-count')) $('#todo-count').textContent = todo;
  if ($('#member-count')) $('#member-count').textContent = state.members.length;

  const pct = total ? Math.round(done / total * 100) : 0;
  if ($('#donut-value')) $('#donut-value').textContent = `${pct}%`;

  // Render recent activity preview
  const recent = (state.activity || []).slice(0, 5);
  const actList = $('#activity-list');
  if (actList) {
    actList.innerHTML = recent.map(a => `
      <div class="activity-row">
        <span class="dot"></span>
        <div>
          <p><b>${esc(a.actor)}</b> ${esc(a.action)} <span>${esc(a.task)}</span></p>
          <small>${ago(a.at)}</small>
        </div>
      </div>
    `).join('') || '<p class="empty">No recent activity.</p>';
  }
}
```

---

## 4. Project Report & Board Page

- **File Locations**:
  - HTML Container & Controls: `public/index.html` (Lines 268 – 293)
  - JS Header & Selector Renderer: `public/app.js` (Lines 1340 – 1450)
  - JS Board & Drag-and-Drop Renderer: `public/app.js` (Lines 1547 – 1597)

### Code Snippet:
```javascript
// public/app.js (Lines 1547 - 1597) - Board & Drag-and-Drop Renderer
function renderBoard() {
  renderProjectsHeader();
  const isAllProjects = currentSelectedProjectId === 'all';
  const grid = $('#projects-grid');
  const boardCols = $('#board-columns');
  const filters = $('.filters');

  if (isAllProjects) {
    if (grid) grid.style.display = 'grid';
    if (boardCols) boardCols.style.display = 'none';
    if (filters) filters.style.display = 'none';
    renderProjectsGrid();
    return;
  }

  if (grid) grid.style.display = 'none';
  if (boardCols) boardCols.style.display = 'grid';
  if (filters) filters.style.display = 'flex';

  const assignee = $('#assignee-filter').value, priority = $('#priority-filter').value;
  $('#assignee-filter').innerHTML = '<option value="">Everyone</option>' + state.members.map(m => `<option value="${m.id}" ${m.id === assignee ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  const ts = currentTasks();
  $('#board-columns').innerHTML = statuses.map(([status, label, color]) => {
    const tasks = ts.filter(t => normalizeStatus(t.status) === status && (!assignee || t.assigneeId === assignee) && (!priority || t.priority === priority));
    return `<div class="column" data-status="${status}"><div class="column-head"><span><i style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};margin-right:7px"></i>${label}</span><span class="column-count">${tasks.length}</span></div><div class="dropzone">${tasks.map(taskMarkup).join('')}</div></div>`;
  }).join('');

  // Drag and drop event wiring
  $$('.task-card').forEach(e => {
    const t = state.tasks.find(x => x.id === e.dataset.id);
    if (canUserModifyTask(t)) {
      e.ondragstart = () => { dragged = e.dataset.id; e.classList.add('dragging'); };
      e.ondragend = () => e.classList.remove('dragging');
    }
    e.onclick = () => openTask(e.dataset.id);
  });
  $$('.column').forEach(c => {
    c.ondragover = e => e.preventDefault();
    c.ondrop = async e => {
      e.preventDefault();
      const t = state.tasks.find(x => x.id === dragged);
      if (t && canUserModifyTask(t) && t.status !== c.dataset.status) {
        await saveTask(t.id, { status: c.dataset.status });
        toast('Task moved and progress updated');
      }
    };
  });
}
```

---

## 5. Activity Page

- **File Locations**:
  - HTML Container: `public/index.html` (Lines 295 – 303)
  - JS Activity Timeline Renderer: `public/app.js` (Lines 1600 – 1640)

### Code Snippet:
```javascript
// public/app.js (Lines 1600 - 1640) - Activity Timeline Renderer
function renderActivity() {
  const fullAct = $('#full-activity');
  if (!fullAct) return;
  const acts = state.activity || [];
  if (acts.length === 0) {
    fullAct.innerHTML = '<p class="empty" style="padding:24px;text-align:center;color:var(--muted)">No activity recorded in this workspace yet.</p>';
    return;
  }
  fullAct.innerHTML = acts.map(a => `
    <div class="activity-row" style="padding:16px 20px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:14px">
      <span class="dot" style="width:8px;height:8px;border-radius:50%;background:var(--primary);flex-shrink:0"></span>
      <div>
        <p style="margin:0;font-size:13px;color:var(--ink)">
          <b>${esc(a.actor)}</b> ${esc(a.action)} <span style="font-weight:600;color:var(--primary)">${esc(a.task || '')}</span>
        </p>
        <small style="font-size:11px;color:var(--muted);margin-top:2px;display:block">${formatNotifyTime(a.at)}</small>
      </div>
    </div>
  `).join('');
}
```

---

## 6. Team Members Page

- **File Locations**:
  - HTML Layout & Invite Sections: `public/index.html` (Lines 305 – 334)
  - JS Team Grid & Invite Manager Renderer: `public/app.js` (Lines 1608 – 1764)

### Code Snippet:
```javascript
// public/app.js (Lines 1608 - 1764) - Team & Role Management Renderer
function renderTeam() {
  const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
  const currentMember = user ? state.members.find(x => x.email.toLowerCase() === user.email.toLowerCase()) : null;
  const isAdmin = currentMember ? currentMember.role === 'Workspace admin' : true;

  const roles = ['Workspace admin', 'Workspace member', 'Viewer'];

  $('#team-grid').innerHTML = state.members.map(m => {
    const roleVal = m.role || 'Workspace member';
    const isAdminRole = roleVal === 'Workspace admin';
    const isSelf = user && m.email.toLowerCase() === user.email.toLowerCase();

    const roleControl = isAdmin ? `
      <select class="role-select" data-id="${m.id}" title="Assign member role">
        ${roles.map(r => `<option value="${r}" ${roleVal === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
    ` : `<small class="member-role-badge ${isAdminRole ? 'admin' : ''}">${esc(roleVal)}</small>`;

    const removeBtn = (isAdmin && !isSelf) ? `
      <button class="secondary remove-member-btn" data-id="${m.id}" data-name="${esc(m.name)}" style="margin-top:10px;padding:5px 12px;font-size:12px;color:#ef4444;border-color:rgba(239,68,68,0.3)">Remove member</button>
    ` : '';

    return `
      <article class="member-card">
        <span class="avatar" style="background:${m.color}">${m.initials}</span>
        <h3>${esc(m.name)}</h3>
        <p>${esc(m.email)}</p>
        ${roleControl}
        ${removeBtn}
      </article>
    `;
  }).join('');

  // Handle role updates
  $$('.role-select').forEach(sel => {
    sel.onchange = async () => {
      const memberId = sel.dataset.id;
      const newRole = sel.value;
      await api(`/api/members/${memberId}`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) });
      toast('Member role updated!');
      await refresh();
    };
  });
}
```

---

## 7. Account Settings & Security Page

- **File Locations**:
  - HTML Account Form: `public/index.html` (Lines 337 – 370)
  - JS Profile & Password Update Handler: `public/app.js` (Lines 1779 – 1820)

### Code Snippet:
```javascript
// public/app.js (Lines 1779 - 1820) - Account Form Handler
function renderAccountView() {
  const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
  if (!user) return;

  if (document.activeElement !== $('#acc-name')) $('#acc-name').value = user.name || '';
  if (document.activeElement !== $('#acc-email')) $('#acc-email').value = user.email || '';

  const accForm = $('#account-form');
  if (accForm && !accForm.dataset.bound) {
    accForm.dataset.bound = 'true';
    accForm.onsubmit = async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target));
      if (payload.password || $('#acc-confirm-password').value || payload.currentPassword) {
        if (!payload.currentPassword) return toast('Please enter your current password.');
        if (!payload.password) return toast('Please enter a new password.');
        if (payload.password !== $('#acc-confirm-password').value) return toast('Passwords do not match.');
        const pwdErr = validatePassword(payload.password);
        if (pwdErr) return toast(pwdErr);
      } else {
        delete payload.password;
        delete payload.currentPassword;
      }
      try {
        const updated = await api('/api/account', { method: 'PATCH', body: JSON.stringify(payload) });
        localStorage.setItem('flowspace_user', JSON.stringify(updated));
        toast('Account details updated successfully!');
        await refresh();
      } catch (err) {
        toast(err.message || 'Failed to update account');
      }
    };
  }
}
```
