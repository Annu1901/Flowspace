# Pages & Code Snippets Reference - Flowspace

This document provides exact, comprehensive code snippets for all pages, modals, and major features in **Flowspace**.

---

## 1. Authentication Pages & Modals

### 1.1 Sign Up Page / Modal Snippet
Enforces RFC email format, minimum 8 character password rule (min 1 number, 1 uppercase, 1 special char), and show/hide eye toggles.

```javascript
// public/app.js - Sign Up Handler & Validation
function showSignup() {
  $('#auth-backdrop').innerHTML = `
    <div class="auth-modal">
      <h2>Create account</h2>
      <p>Get started with Flowspace for free.</p>
      <form id="signup-form">
        <div class="field full">
          <label>YOUR NAME</label>
          <input required name="name" placeholder="John Doe">
        </div>
        <div class="field full">
          <label>EMAIL ADDRESS</label>
          <input required type="email" name="email" placeholder="name@company.com">
        </div>
        <div class="field full">
          <label>PASSWORD</label>
          <div class="password-input-wrapper">
            <input required type="password" name="password" placeholder="••••••••" minlength="8">
            ${eyeBtnMarkup}
          </div>
          <small style="font-size:11px;color:var(--muted);margin-top:4px">Min 8 chars, 1 number, 1 uppercase & 1 special character</small>
        </div>
        <button class="primary" style="margin-top:10px; padding:12px">Sign up</button>
      </form>
      <div class="auth-modal-footer">
        Already have an account? <a id="goto-signup-login">Log in</a>
      </div>
      <button class="close" style="position:absolute; top:15px; right:15px">×</button>
    </div>
  `;
  $('#auth-backdrop').classList.add('show');

  $('#signup-form').onsubmit = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    if (!validateEmail(payload.email)) return toast('Please enter a valid email address.');
    const pwdErr = validatePassword(payload.password);
    if (pwdErr) return toast(pwdErr);

    try {
      const sb = getSupabase();
      if (sb) {
        await sb.auth.signUp({ email: payload.email, password: payload.password, options: { data: { name: payload.name } } });
      }
      const user = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem('flowspace_user', JSON.stringify(user));
      $('#auth-backdrop').classList.remove('show');
      toggleAuthShell(true);
      await refresh();
      setView('overview');
      toast('Account created successfully!');
    } catch (err) {
      toast(err.message || 'Signup failed');
    }
  };
  wirePasswordToggles($('#auth-backdrop'));
}
```

---

### 1.2 Log In Page / Modal Snippet

```javascript
// public/app.js - Log In Handler
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
        Don't have an account? <a id="goto-signup">Sign up</a>
      </div>
      <button class="close" style="position:absolute; top:15px; right:15px">×</button>
    </div>
  `;
  $('#auth-backdrop').classList.add('show');

  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(e.target));
      const user = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem('flowspace_user', JSON.stringify(user));
      $('#auth-backdrop').classList.remove('show');
      toggleAuthShell(true);
      await refresh();
      setView('overview');
      toast('Logged in successfully!');
    } catch (err) {
      toast(err.message || 'Login failed');
    }
  };
  if ($('#forgot-password-link')) $('#forgot-password-link').onclick = showForgotPasswordModal;
  wirePasswordToggles($('#auth-backdrop'));
}
```

---

### 1.3 Forgot Password & Recovery Token Snippet

```javascript
// public/app.js - Forgot Password Modal & Token Recovery
function showForgotPasswordModal() {
  $('#auth-backdrop').innerHTML = `
    <div class="auth-modal">
      <h2>Reset password</h2>
      <p>Enter your account email address to receive a secure password reset link.</p>
      <form id="forgot-password-form">
        <div class="field full">
          <label>EMAIL ADDRESS</label>
          <input required type="email" name="email" placeholder="name@company.com">
        </div>
        <button class="primary" style="margin-top:10px; padding:12px">Send reset link</button>
      </form>
    </div>
  `;
  $('#auth-backdrop').classList.add('show');

  $('#forgot-password-form').onsubmit = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    if (!validateEmail(payload.email)) return toast('Please enter a valid email address.');
    
    const sb = getSupabase();
    if (sb) {
      await sb.auth.resetPasswordForEmail(payload.email, {
        redirectTo: `${window.location.origin}/#type=recovery`
      });
    }
    toast('Reset request processed! Check your email inbox & spam folder.');
    setTimeout(() => showSetNewPasswordModal(), 1500);
  };
}

function handlePasswordResetToken() {
  const hash = window.location.hash || '';
  if (hash.includes('type=recovery') || hash.includes('access_token=')) {
    showSetNewPasswordModal();
  }
}
```

---

## 2. Dashboard & Multi-Project Board Snippets

### 2.1 Project Board Filtering Snippet

```javascript
// public/app.js - Kanban Board Rendering with Project Filter
function renderBoard() {
  const activeProj = getActiveProject();
  let tasks = state.tasks || [];
  if (activeProj) {
    tasks = tasks.filter(t => t.projectId === activeProj.id);
  }

  const assigneeFilter = $('#assignee-filter')?.value || '';
  const priorityFilter = $('#priority-filter')?.value || '';

  if (assigneeFilter) tasks = tasks.filter(t => t.assigneeId === assigneeFilter);
  if (priorityFilter) tasks = tasks.filter(t => t.priority === priorityFilter);

  statuses.forEach(([k, n]) => {
    const col = $(`[data-column="${k}"]`);
    if (!col) return;
    const colTasks = tasks.filter(x => x.status === k);
    col.innerHTML = colTasks.map(taskMarkup).join('');
  });
}
```

---

## 3. Team & Invitations Center Snippets

### 3.1 Send Invitation Modal & Route Snippet

```javascript
// public/app.js - Send Invitation Function
function invite() {
  modal(`
    <div class="modal">
      <div class="modal-head">
        <h2>Invite teammate to ${esc(state.workspace.name)}</h2>
        <button class="close">×</button>
      </div>
      <form id="invite-form">
        <div class="field"><label>TEAMMATE NAME</label><input name="name" placeholder="John Doe"></div>
        <div class="field"><label>EMAIL ADDRESS</label><input required type="email" name="email" placeholder="name@company.com"></div>
        <div class="field">
          <label>ROLE ASSIGNED</label>
          <select name="role">
            <option value="Workspace member">Workspace member</option>
            <option value="Workspace admin">Workspace admin</option>
            <option value="Viewer">Viewer</option>
          </select>
        </div>
        <div class="modal-foot">
          <button type="button" class="secondary cancel">Cancel</button>
          <button class="primary">Send invitation</button>
        </div>
      </form>
    </div>
  `);

  $('#invite-form').onsubmit = async e => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    if (!validateEmail(payload.email)) return toast('Please enter a valid email address.');
    await api('/api/invites', { method: 'POST', body: JSON.stringify(payload) });
    await refresh();
    close();
    toast(`Invitation sent to ${payload.email}!`);
  };
}
```

---

### 3.2 One-Time Popup Dismissal Snippet

```javascript
// public/app.js - One-Time Invitation Popup Handler
function checkPendingInvitePrompt() {
  const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
  if (!user || !state || !state.pendingInvites || !state.pendingInvites.length) return;

  const dismissedInvites = JSON.parse(localStorage.getItem('flowspace_dismissed_invites') || '[]');
  const targetInvite = state.pendingInvites.find(i => !dismissedInvites.includes(i.id));

  if (targetInvite && !dismissedInvites.includes(targetInvite.id)) {
    dismissedInvites.push(targetInvite.id);
    localStorage.setItem('flowspace_dismissed_invites', JSON.stringify([...new Set(dismissedInvites)]));

    modal(`
      <div class="modal">
        <div class="modal-head">
          <h2>Workspace Invitation</h2>
          <button class="close">×</button>
        </div>
        <div style="padding:24px 10px;text-align:center">
          <div style="font-size:42px;margin-bottom:12px">✉️</div>
          <h3 style="font-size:18px;margin-bottom:8px">You have been invited to join <b>${esc(targetInvite.workspaceName)}</b></h3>
          <p style="color:var(--muted);font-size:13px">Assigned Role: <b>${esc(targetInvite.role)}</b></p>
        </div>
        <div class="modal-foot" style="justify-content:center;gap:12px">
          <button class="secondary btn-decline-prompt">Decline</button>
          <button class="primary btn-accept-prompt">Join ${esc(targetInvite.workspaceName)} →</button>
        </div>
      </div>
    `);
  }
}
```

---

## 4. Account Settings Security Snippet

```javascript
// public/app.js - Account Form Submission with Current Password Check
$('#account-form').onsubmit = async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  
  if (data.password || $('#acc-confirm-password').value || data.currentPassword) {
    if (!data.currentPassword) return toast('Please enter your current password to update your password.');
    if (!data.password) return toast('Please enter a new password.');
    if (data.password !== $('#acc-confirm-password').value) return toast('New password and confirmation do not match.');
    const pwdErr = validatePassword(data.password);
    if (pwdErr) return toast(pwdErr);
  } else {
    delete data.password;
    delete data.currentPassword;
  }

  const updated = await api('/api/account', { method: 'PATCH', body: JSON.stringify(data) });
  toast('Profile & Security settings updated successfully!');
  await refresh();
};
```
