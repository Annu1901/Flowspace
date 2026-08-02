// DOM Helper utilities
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

// Theme Initialization & Preferences
(function() {
  const currentTheme = localStorage.getItem('flowspace_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
})();

function updateThemeUI(theme) {
  const sunPath = `M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z`;
  const moonPath = `M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z`;
  
  $$('.theme-toggle-icon path').forEach(path => {
    path.setAttribute('d', theme === 'dark' ? sunPath : moonPath);
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('flowspace_theme', newTheme);
  updateThemeUI(newTheme);
  toast(`Switched to ${newTheme} mode`);
}

let state, activeTask, dragged, liveSource = null;
let supabaseClient = null;

function getSupabase() {
  if (!supabaseClient && window.supabase && window.supabase.createClient) {
    const url = 'https://ovvbrwqyjdeomzezhacu.supabase.co';
    const key = 'sb_publishable_3UnL1xJOnf9cLMaLTd-zJA_ztW4WeRy';
    supabaseClient = window.supabase.createClient(url, key);
  }
  return supabaseClient;
}

const statuses = [['todo', 'To do', '#9aa4b7'], ['progress', 'In progress', '#7553ed'], ['review', 'In review', '#ef9d27'], ['done', 'Done', '#35a274']];

function normalizeStatus(s) {
  if (!s) return 'todo';
  const str = String(s).toLowerCase().trim();
  if (str === 'todo' || str === 'to_do' || str === 'to do') return 'todo';
  if (str === 'progress' || str === 'in_progress' || str === 'in progress' || str === 'inprogress') return 'progress';
  if (str === 'review' || str === 'in_review' || str === 'in review' || str === 'inreview') return 'review';
  if (str === 'done' || str === 'completed' || str === 'complete') return 'done';
  return 'todo';
}

function getStaticDb() {
  let db = JSON.parse(localStorage.getItem('flowspace_static_db') || 'null');
  if (!db) {
    db = {
      users: [
        { id: 'u-101', name: 'Ayush', email: 'aayu21082005@gmail.com', password: 'Password@123', activeWorkspaceId: 'ws-1' },
        { id: 'u-102', name: 'Annu', email: 'dagarannu40@gmail.com', password: 'Password@123', activeWorkspaceId: 'ws-2' }
      ],
      workspaces: [
        { id: 'ws-1', name: "Ayush's Workspace", description: 'Your default workspace', createdAt: new Date().toISOString() },
        { id: 'ws-2', name: "Annu's Workspace", description: 'Your default workspace', createdAt: new Date().toISOString() }
      ],
      projects: [
        { id: 'proj-1', workspaceId: 'ws-1', name: 'Product launch', description: 'Plan and ship milestone', createdAt: new Date().toISOString() },
        { id: 'proj-2', workspaceId: 'ws-2', name: 'Design System', description: 'Components & Tokens', createdAt: new Date().toISOString() }
      ],
      members: [
        { id: 'm-1', workspaceId: 'ws-1', name: 'Ayush', email: 'aayu21082005@gmail.com', initials: 'AY', color: '#7c3aed', role: 'Workspace admin' },
        { id: 'm-2', workspaceId: 'ws-2', name: 'Annu', email: 'dagarannu40@gmail.com', initials: 'AN', color: '#0ea5e9', role: 'Workspace admin' }
      ],
      tasks: [],
      invites: [],
      activity: [],
      notifications: []
    };
    localStorage.setItem('flowspace_static_db', JSON.stringify(db));
  }
  return db;
}

function saveStaticDb(db) {
  localStorage.setItem('flowspace_static_db', JSON.stringify(db));
}

async function fetchSupabaseState(user) {
  const sb = getSupabase();
  if (!sb || !user || !user.email) return null;

  try {
    const userEmail = user.email.toLowerCase();

    // 1. Get members for this email to find workspaces
    const { data: userMems, error: memErr } = await sb.from('members').select('*').eq('email', userEmail);
    if (memErr) return null;

    let wsIds = (userMems || []).map(m => m.workspace_id || m.workspaceId);

    // 2. Fetch User Workspaces
    let userWorkspaces = [];
    if (wsIds.length > 0) {
      const { data: wsData } = await sb.from('workspaces').select('*').in('id', wsIds);
      userWorkspaces = wsData || [];
    }

    // Default workspace if none exists in DB
    if (userWorkspaces.length === 0) {
      const name = user.name || userEmail.split('@')[0];
      const { data: newWs } = await sb.from('workspaces').insert([{
        name: `${name}'s Workspace`,
        description: 'Default workspace'
      }]).select();

      if (newWs && newWs[0]) {
        const ws = newWs[0];
        userWorkspaces = [ws];
        wsIds = [ws.id];
        await sb.from('members').insert([{
          workspace_id: ws.id,
          name: user.name || name,
          email: userEmail,
          initials: (user.name || name).slice(0, 2).toUpperCase(),
          color: '#7c3aed',
          role: 'Workspace admin'
        }]);
      }
    }

    // 3. Active Workspace Selection
    let activeId = localStorage.getItem('flowspace_active_workspace');
    if (!activeId || !userWorkspaces.some(w => w.id === activeId)) {
      activeId = userWorkspaces[0]?.id || '';
      localStorage.setItem('flowspace_active_workspace', activeId);
    }
    const activeWorkspace = userWorkspaces.find(w => w.id === activeId) || userWorkspaces[0] || null;

    // 4. Fetch Active Workspace Data
    let workspaceMembers = [], workspaceTasks = [], workspaceProjects = [], workspaceInvites = [];
    if (activeId) {
      const { data: mems } = await sb.from('members').select('*').eq('workspace_id', activeId);
      const memMap = new Map();
      (mems || []).forEach(m => {
        const key = (m.email || '').toLowerCase();
        if (!memMap.has(key)) {
          memMap.set(key, { ...m, workspaceId: m.workspace_id || m.workspaceId });
        }
      });
      workspaceMembers = Array.from(memMap.values());

      const { data: tsks } = await sb.from('tasks').select('*').eq('workspace_id', activeId);
      workspaceTasks = (tsks || []).map(t => ({
        ...t,
        workspaceId: t.workspace_id || t.workspaceId,
        projectId: t.project_id || t.projectId,
        assigneeId: t.assignee_id || t.assigneeId,
        createdBy: (t.created_by || t.createdBy || '').toLowerCase(),
        dueDate: t.due_date || t.dueDate,
        status: normalizeStatus(t.status),
        attachments: t.attachments || [],
        comments: t.comments || []
      }));

      const { data: projs } = await sb.from('projects').select('*').eq('workspace_id', activeId);
      workspaceProjects = (projs || []).map(p => ({ ...p, workspaceId: p.workspace_id || p.workspaceId }));

      const { data: invs } = await sb.from('invites').select('*').eq('workspace_id', activeId);
      const invMap = new Map();
      (invs || []).forEach(i => {
        const key = (i.email || '').toLowerCase();
        if (!invMap.has(key)) {
          invMap.set(key, { ...i, workspaceId: i.workspace_id || i.workspaceId });
        }
      });
      workspaceInvites = Array.from(invMap.values());
    }

    if (workspaceProjects.length === 0 && activeWorkspace) {
      const { data: newProj } = await sb.from('projects').insert([{
        workspace_id: activeWorkspace.id,
        name: 'Product launch',
        description: 'Plan and ship milestone'
      }]).select();
      if (newProj && newProj[0]) {
        workspaceProjects = [{ ...newProj[0], workspaceId: newProj[0].workspace_id }];
      }
    }

    // 5. Fetch Activity & Notifications for active workspace and target user
    let workspaceActivity = [], workspaceNotifications = [];
    if (activeId) {
      try {
        const { data: actData } = await sb.from('activity').select('*').eq('workspace_id', activeId).order('at', { ascending: false });
        workspaceActivity = (actData || []).map(a => ({ ...a, workspaceId: a.workspace_id || a.workspaceId }));

        const { data: notifData } = await sb.from('notifications')
          .select('*')
          .or(`workspace_id.eq.${activeId},target_email.eq.${userEmail}`)
          .order('at', { ascending: false });

        workspaceNotifications = (notifData || [])
          .filter(n => {
            const target = (n.target_email || n.targetEmail || '').toLowerCase();
            return !target || target === userEmail;
          })
          .map(n => ({ ...n, workspaceId: n.workspace_id || n.workspaceId, targetEmail: n.target_email || n.targetEmail }));
      } catch (e) {}
    }

    // 6. Fetch Received Invites across all workspaces for this email
    const { data: recInvs } = await sb.from('invites').select('*').eq('email', userEmail);
    let receivedInvites = [];
    if (recInvs && recInvs.length > 0) {
      const allWsIds = recInvs.map(i => i.workspace_id || i.workspaceId);
      const { data: invWs } = await sb.from('workspaces').select('*').in('id', allWsIds);
      const wsMap = new Map((invWs || []).map(w => [w.id, w.name]));
      receivedInvites = recInvs.map(i => ({
        ...i,
        workspaceId: i.workspace_id || i.workspaceId,
        workspaceName: wsMap.get(i.workspace_id || i.workspaceId) || i.workspaceName || 'Unknown Workspace'
      }));
    }

    const pendingUserInvites = receivedInvites.filter(i => i.status === 'Pending');

    return {
      workspace: activeWorkspace,
      workspaces: userWorkspaces,
      activeWorkspaceId: activeId,
      projects: workspaceProjects,
      members: workspaceMembers,
      invites: workspaceInvites,
      tasks: workspaceTasks,
      activity: workspaceActivity,
      notifications: workspaceNotifications,
      pendingInvites: pendingUserInvites,
      receivedInvites: receivedInvites
    };
  } catch (e) {
    console.warn('Supabase DB notice:', e);
    return null;
  }
}

async function handleStaticClientApi(urlStr, opts = {}, user = null) {
  const db = getStaticDb();
  const sb = getSupabase();
  const urlObj = new URL(urlStr, window.location.origin);
  const path = urlObj.pathname;
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? JSON.parse(opts.body) : {};

  // 1. Auth Endpoints
  if (method === 'POST' && path === '/api/auth/login') {
    const cleanEmail = (body.email || '').trim().toLowerCase();
    let u = db.users.find(x => x.email.toLowerCase() === cleanEmail);

    if (!u && sb) {
      try {
        const { data: mems } = await sb.from('members').select('*').eq('email', cleanEmail);
        if (mems && mems.length > 0) {
          const mem = mems[0];
          u = { id: mem.id || ('u-' + Date.now()), name: mem.name || cleanEmail.split('@')[0], email: cleanEmail, password: body.password, activeWorkspaceId: mem.workspace_id };
          db.users.push(u);
          saveStaticDb(db);
        }
      } catch (e) {}
    }

    if (!u) {
      const name = cleanEmail.split('@')[0];
      const ws = { id: 'ws-' + Date.now(), name: `${name}'s Workspace`, description: 'Default workspace', createdAt: new Date().toISOString() };
      u = { id: 'u-' + Date.now(), name: name, email: cleanEmail, password: body.password, activeWorkspaceId: ws.id };
      const m = { id: 'm-' + Date.now(), workspaceId: ws.id, name: name, email: cleanEmail, initials: name.slice(0,2).toUpperCase(), color: '#7c3aed', role: 'Workspace admin' };
      db.users.push(u);
      if (!db.workspaces.some(w => w.id === ws.id)) db.workspaces.push(ws);
      if (!db.members.some(mem => mem.email.toLowerCase() === cleanEmail && mem.workspaceId === ws.id)) db.members.push(m);
      saveStaticDb(db);
    }
    return { id: u.id, name: u.name, email: u.email };
  }

  if (method === 'POST' && path === '/api/auth/signup') {
    const cleanEmail = (body.email || '').trim().toLowerCase();
    let u = db.users.find(x => x.email.toLowerCase() === cleanEmail);
    if (!u) {
      const ws = { id: 'ws-' + Date.now(), name: `${(body.name || '').trim()}'s Workspace`, description: 'Default workspace', createdAt: new Date().toISOString() };
      u = { id: 'u-' + Date.now(), name: (body.name || '').trim(), email: cleanEmail, password: body.password, activeWorkspaceId: ws.id };
      const m = { id: 'm-' + Date.now(), workspaceId: ws.id, name: u.name, email: u.email, initials: u.name.slice(0,2).toUpperCase(), color: '#7c3aed', role: 'Workspace admin' };
      db.users.push(u);
      db.workspaces.push(ws);
      db.members.push(m);
      saveStaticDb(db);

      if (sb) {
        try {
          const { data: newWs } = await sb.from('workspaces').insert([{ name: ws.name, description: ws.description }]).select();
          if (newWs && newWs[0]) {
            await sb.from('members').insert([{ workspace_id: newWs[0].id, name: u.name, email: u.email, initials: u.name.slice(0,2).toUpperCase(), color: '#7c3aed', role: 'Workspace admin' }]);
          }
        } catch (e) {}
      }
    }

    return { id: u.id, name: u.name, email: u.email };
  }

  if (method === 'POST' && path === '/api/auth/reset-password') {
    const u = db.users.find(x => x.email.toLowerCase() === body.email?.toLowerCase());
    if (u) {
      u.password = body.password;
      saveStaticDb(db);
    }
    return { ok: true, message: 'Password updated' };
  }

  // 2. Fetch State
  if (method === 'GET' && path === '/api/state') {
    if (!user) throw new Error('Unauthorized');

    // Attempt Live Supabase PostgreSQL fetch first!
    if (sb) {
      const sbState = await fetchSupabaseState(user);
      if (sbState) return sbState;
    }
    
    db.invites.forEach(inv => {
      if (inv.status === 'Declined' || inv.status === 'Pending') {
        db.members = db.members.filter(m => !(m.workspaceId === inv.workspaceId && m.email.toLowerCase() === inv.email.toLowerCase()));
      }
    });

    const userWorkspaces = db.workspaces.filter(w => 
      db.members.some(m => m.workspaceId === w.id && m.email.toLowerCase() === user.email.toLowerCase())
    );
    const userRecord = db.users.find(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    let activeId = userRecord?.activeWorkspaceId;
    if (!activeId || !userWorkspaces.some(w => w.id === activeId)) {
      activeId = userWorkspaces[0]?.id || '';
      if (userRecord) userRecord.activeWorkspaceId = activeId;
    }
    saveStaticDb(db);

    const activeWorkspace = db.workspaces.find(w => w.id === activeId) || userWorkspaces[0] || null;
    const workspaceMembers = activeId ? db.members.filter(m => m.workspaceId === activeId) : [];
    const workspaceTasks = activeId ? db.tasks.filter(t => t.workspaceId === activeId) : [];
    const workspaceInvites = activeId ? db.invites.filter(i => i.workspaceId === activeId) : [];
    let workspaceProjects = activeId ? db.projects.filter(p => p.workspaceId === activeId) : [];

    if (workspaceProjects.length === 0 && activeWorkspace) {
      const defaultProj = { id: 'p-' + Date.now(), workspaceId: activeId, name: 'Product launch', description: 'Plan and ship milestone', createdAt: new Date().toISOString() };
      db.projects.push(defaultProj);
      workspaceProjects = [defaultProj];
      saveStaticDb(db);
    }

    const receivedInvites = db.invites.filter(i => i.email.toLowerCase() === user.email.toLowerCase()).map(i => {
      const ws = db.workspaces.find(w => w.id === i.workspaceId);
      return { ...i, workspaceName: ws ? ws.name : (i.workspaceName || 'Unknown Workspace') };
    });

    const pendingUserInvites = receivedInvites.filter(i => i.status === 'Pending');

    return {
      workspace: activeWorkspace,
      workspaces: userWorkspaces,
      activeWorkspaceId: activeId,
      projects: workspaceProjects,
      members: workspaceMembers,
      invites: workspaceInvites,
      tasks: workspaceTasks,
      activity: db.activity || [],
      notifications: db.notifications || [],
      pendingInvites: pendingUserInvites,
      receivedInvites: receivedInvites
    };
  }

  // 3. Workspaces
  if (method === 'POST' && path === '/api/workspaces') {
    const ws = { id: 'ws-' + Date.now(), name: body.name?.trim() || 'Untitled Workspace', description: body.description || '', createdAt: new Date().toISOString() };
    const m = { id: 'm-' + Date.now(), workspaceId: ws.id, name: user.name, email: user.email, initials: user.name.slice(0,2).toUpperCase(), color: '#7c3aed', role: 'Workspace admin' };
    db.workspaces.push(ws);
    db.members.push(m);
    const uRecord = db.users.find(x => x.id === user.id || x.email.toLowerCase() === user.email.toLowerCase());
    if (uRecord) uRecord.activeWorkspaceId = ws.id;
    saveStaticDb(db);

    if (sb) {
      try {
        const { data: newWs } = await sb.from('workspaces').insert([{ name: ws.name, description: ws.description }]).select();
        if (newWs && newWs[0]) {
          await sb.from('members').insert([{ workspace_id: newWs[0].id, name: user.name, email: user.email, initials: user.name.slice(0,2).toUpperCase(), color: '#7c3aed', role: 'Workspace admin' }]);
        }
      } catch (e) {}
    }

    return ws;
  }

  if (method === 'POST' && path.includes('/select')) {
    const parts = path.split('/');
    const wsId = parts[3];
    localStorage.setItem('flowspace_active_workspace', wsId);
    const uRecord = db.users.find(x => x.id === user.id || x.email.toLowerCase() === user.email.toLowerCase());
    if (uRecord) uRecord.activeWorkspaceId = wsId;
    saveStaticDb(db);
    return { ok: true };
  }

  if (method === 'PATCH' && path.startsWith('/api/workspaces/')) {
    const wsId = path.split('/')[3];
    let w = db.workspaces.find(x => x.id === wsId);
    if (!w) {
      w = { id: wsId, name: body.name?.trim() || 'Workspace', description: body.description || '' };
      db.workspaces.push(w);
    }
    if (body.name) w.name = body.name.trim();
    if (body.description !== undefined) w.description = body.description.trim();
    saveStaticDb(db);

    if (sb) {
      try {
        const updateObj = {};
        if (body.name) updateObj.name = body.name.trim();
        if (body.description !== undefined) updateObj.description = body.description.trim();
        await sb.from('workspaces').update(updateObj).eq('id', wsId);
      } catch (e) {}
    }
    return w;
  }

  // 3.5 Projects
  if (method === 'POST' && path === '/api/projects') {
    const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
    const proj = {
      id: 'proj-' + Date.now(),
      workspaceId: activeWsId,
      name: body.name.trim(),
      description: body.description || '',
      createdAt: new Date().toISOString()
    };
    if (!db.projects) db.projects = [];
    db.projects.push(proj);

    const actorName = user ? (user.name || user.email.split('@')[0]) : 'Member';
    const actEntry = { id: 'act-' + Date.now(), workspaceId: activeWsId, actor: actorName, action: 'created project', task: proj.name, at: new Date().toISOString() };
    if (!db.activity) db.activity = [];
    db.activity.unshift(actEntry);
    saveStaticDb(db);

    if (sb) {
      try {
        const { data: newDbProj } = await sb.from('projects').insert([{
          workspace_id: activeWsId,
          name: proj.name,
          description: proj.description
        }]).select();
        await sb.from('activity').insert([{ workspace_id: activeWsId, actor: actorName, action: 'created project', task: proj.name }]);
        if (newDbProj && newDbProj[0]) {
          proj.id = newDbProj[0].id;
        }
      } catch (e) {}
    }
    return proj;
  }

  if (method === 'PATCH' && path.startsWith('/api/projects/')) {
    const projId = path.split('/')[3];
    const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
    if (!db.projects) db.projects = [];
    let p = db.projects.find(x => x.id === projId);
    if (!p && typeof state !== 'undefined' && state.projects) {
      p = state.projects.find(x => x.id === projId);
      if (p) db.projects.push(p);
    }
    if (!p) {
      p = { id: projId, workspaceId: activeWsId, name: body.name?.trim() || 'Project', description: body.description || '' };
      db.projects.push(p);
    }
    if (body.name) p.name = body.name.trim();
    if (body.description !== undefined) p.description = body.description;
    
    const actorName = user ? (user.name || user.email.split('@')[0]) : 'Member';
    const actEntry = { id: 'act-' + Date.now(), workspaceId: activeWsId, actor: actorName, action: 'renamed project', task: p.name, at: new Date().toISOString() };
    if (!db.activity) db.activity = [];
    db.activity.unshift(actEntry);
    saveStaticDb(db);

    if (sb) {
      try {
        const updateData = {};
        if (body.name) updateData.name = body.name.trim();
        if (body.description !== undefined) updateData.description = body.description;
        await sb.from('projects').update(updateData).eq('id', projId);
        await sb.from('activity').insert([{ workspace_id: activeWsId, actor: actorName, action: 'renamed project', task: p.name }]);
      } catch (e) {
        console.error('Supabase project patch error:', e);
      }
    }
    return p;
  }

  if (method === 'DELETE' && path.startsWith('/api/projects/')) {
    const projId = path.split('/')[3];
    const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
    if (db.projects) db.projects = db.projects.filter(x => x.id !== projId);
    if (db.tasks) db.tasks = db.tasks.filter(t => t.projectId !== projId);
    if (typeof state !== 'undefined') {
      if (state.projects) state.projects = state.projects.filter(x => x.id !== projId);
      if (state.tasks) state.tasks = state.tasks.filter(t => t.projectId !== projId);
    }
    const actorName = user ? (user.name || user.email.split('@')[0]) : 'Member';
    const actEntry = { id: 'act-' + Date.now(), workspaceId: activeWsId, actor: actorName, action: 'deleted project', task: 'Project', at: new Date().toISOString() };
    if (!db.activity) db.activity = [];
    db.activity.unshift(actEntry);
    saveStaticDb(db);

    if (sb) {
      try {
        await sb.from('projects').delete().eq('id', projId);
        await sb.from('tasks').delete().eq('project_id', projId);
      } catch (e) {}
    }
    return { ok: true };
  }

  // 4. Tasks
  if (method === 'POST' && path === '/api/tasks') {
    const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
    const task = {
      id: 't-' + Date.now(),
      workspaceId: activeWsId,
      projectId: body.projectId || '',
      title: body.title,
      description: body.description || '',
      status: body.status || 'todo',
      priority: body.priority || 'medium',
      assigneeId: body.assigneeId || '',
      createdBy: user ? user.email.toLowerCase() : '',
      dueDate: body.dueDate || '',
      tags: body.tags || [],
      attachments: [],
      comments: [],
      createdAt: new Date().toISOString()
    };
    db.tasks.push(task);
    saveStaticDb(db);

    if (sb) {
      try {
        await sb.from('tasks').insert([{
          workspace_id: activeWsId,
          project_id: body.projectId || null,
          title: body.title,
          description: body.description || '',
          status: body.status || 'todo',
          priority: body.priority || 'medium',
          assignee_id: body.assigneeId || null,
          created_by: user ? user.email.toLowerCase() : null,
          due_date: body.dueDate || null,
          tags: body.tags || []
        }]);
      } catch (e) {}
    }

    // Log Activity
    const actorName = user ? (user.name || user.email.split('@')[0]) : 'Member';
    const actEntry = { id: 'act-' + Date.now(), workspaceId: activeWsId, actor: actorName, action: 'created task', task: task.title, at: new Date().toISOString() };
    if (!db.activity) db.activity = [];
    db.activity.unshift(actEntry);

    // Target notification whenever assigned to a member
    if (task.assigneeId) {
      const mems = (typeof state !== 'undefined' && state.members && state.members.length > 0) ? state.members : db.members;
      let assigneeMem = mems.find(m => m.id === task.assigneeId);
      if (!assigneeMem && sb) {
        try {
          const { data: dbMem } = await sb.from('members').select('*').eq('id', task.assigneeId).single();
          if (dbMem) assigneeMem = { ...dbMem, workspaceId: dbMem.workspace_id };
        } catch (e) {}
      }

      if (assigneeMem && assigneeMem.email) {
        const callerName = user ? (user.name || user.email.split('@')[0]) : 'A teammate';
        const notifText = `${callerName} assigned you this task: "${task.title}".`;
        const notifObj = { id: 'n-' + Date.now(), workspaceId: activeWsId, text: notifText, targetEmail: assigneeMem.email.toLowerCase(), read: false, at: new Date().toISOString() };
        if (!db.notifications) db.notifications = [];
        db.notifications.unshift(notifObj);
        if (sb) {
          try {
            await sb.from('notifications').insert([{ workspace_id: activeWsId, text: notifText, target_email: assigneeMem.email.toLowerCase(), read: false }]);
          } catch (e) {}
        }
      }
    }

    saveStaticDb(db);

    if (sb) {
      try {
        await sb.from('activity').insert([{ workspace_id: activeWsId, actor: actorName, action: 'created task', task: task.title }]);
      } catch (e) {}
    }

    return task;
  }

  if (method === 'PATCH' && path.startsWith('/api/tasks/')) {
    const taskId = path.split('/')[3];
    const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
    const t = db.tasks.find(x => x.id === taskId);
    if (t) {
      Object.assign(t, body);
      
      const actionText = body.status === 'done' ? 'completed task' : (body.status ? `moved task to ${body.status}` : 'updated task');
      const actorName = user ? (user.name || user.email.split('@')[0]) : 'Member';
      const actEntry = { id: 'act-' + Date.now(), workspaceId: activeWsId, actor: actorName, action: actionText, task: t.title, at: new Date().toISOString() };
      if (!db.activity) db.activity = [];
      db.activity.unshift(actEntry);

      // Target notification whenever task is assigned or updated
      const targetAssigneeId = body.assigneeId || t.assigneeId;
      if (targetAssigneeId) {
        const mems = (typeof state !== 'undefined' && state.members && state.members.length > 0) ? state.members : db.members;
        let assigneeMem = mems.find(m => m.id === targetAssigneeId);
        if (!assigneeMem && sb) {
          try {
            const { data: dbMem } = await sb.from('members').select('*').eq('id', targetAssigneeId).single();
            if (dbMem) assigneeMem = { ...dbMem, workspaceId: dbMem.workspace_id };
          } catch (e) {}
        }

        if (assigneeMem && assigneeMem.email) {
          const callerName = user ? (user.name || user.email.split('@')[0]) : 'A teammate';
          const notifText = body.status === 'done'
            ? `🎉 Task "${t.title}" was marked as completed by ${callerName}!`
            : `${callerName} assigned you this task: "${t.title}".`;
          const notifObj = { id: 'n-' + Date.now(), workspaceId: activeWsId, text: notifText, targetEmail: assigneeMem.email.toLowerCase(), read: false, at: new Date().toISOString() };
          if (!db.notifications) db.notifications = [];
          db.notifications.unshift(notifObj);
          if (sb) {
            try {
              await sb.from('notifications').insert([{ workspace_id: activeWsId, text: notifText, target_email: assigneeMem.email.toLowerCase(), read: false }]);
            } catch (e) {}
          }
        }
      }

      saveStaticDb(db);
      if (sb) {
        try {
          await sb.from('activity').insert([{ workspace_id: activeWsId, actor: actorName, action: actionText, task: t.title }]);
        } catch (e) {}
      }
    }
    if (sb) {
      try {
        await sb.from('tasks').update({
          status: body.status,
          title: body.title,
          description: body.description,
          priority: body.priority
        }).eq('id', taskId);
      } catch (e) {}
    }
    return t;
  }

  if (method === 'DELETE' && path.startsWith('/api/tasks/')) {
    const taskId = path.split('/')[3];
    const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
    const t = db.tasks.find(x => x.id === taskId);
    db.tasks = db.tasks.filter(x => x.id !== taskId);

    if (t) {
      const actorName = user ? (user.name || user.email.split('@')[0]) : 'Member';
      const actEntry = { id: 'act-' + Date.now(), workspaceId: activeWsId, actor: actorName, action: 'deleted task', task: t.title, at: new Date().toISOString() };
      if (!db.activity) db.activity = [];
      db.activity.unshift(actEntry);
      if (sb) {
        try {
          await sb.from('activity').insert([{ workspace_id: activeWsId, actor: actorName, action: 'deleted task', task: t.title }]);
        } catch (e) {}
      }
    }
    saveStaticDb(db);

    if (sb) {
      try {
        await sb.from('tasks').delete().eq('id', taskId);
      } catch (e) {}
    }
    return { ok: true };
  }

  if (method === 'POST' && path.includes('/alert')) {
    const taskId = path.split('/')[3];
    const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
    let t = db.tasks.find(x => x.id === taskId) || (typeof state !== 'undefined' && state.tasks ? state.tasks.find(x => x.id === taskId) : null);
    if (!t && sb) {
      try {
        const { data: dbT } = await sb.from('tasks').select('*').eq('id', taskId).single();
        if (dbT) t = { ...dbT, workspaceId: dbT.workspace_id, assigneeId: dbT.assignee_id, createdBy: dbT.created_by, dueDate: dbT.due_date, comments: dbT.comments || [], attachments: dbT.attachments || [] };
      } catch (e) {}
    }

    if (t) {
      const actorName = user ? (user.name || user.email.split('@')[0]) : 'Member';
      const membersList = (typeof state !== 'undefined' && state.members) ? state.members : db.members;
      const assigneeMem = membersList ? membersList.find(m => m.id === t.assigneeId) : null;
      const targetEmail = assigneeMem && assigneeMem.email ? assigneeMem.email.toLowerCase() : (user ? user.email.toLowerCase() : '');

      const notifText = `⏰ Deadline Reminder: Task "${t.title}" is due soon (${date(t.dueDate)})!`;
      const notifObj = { id: 'n-' + Date.now(), workspaceId: activeWsId, text: notifText, targetEmail: targetEmail, read: false, at: new Date().toISOString() };
      if (!db.notifications) db.notifications = [];
      db.notifications.unshift(notifObj);

      const actEntry = { id: 'act-' + Date.now(), workspaceId: activeWsId, actor: actorName, action: 'sent deadline reminder for task', task: t.title, at: new Date().toISOString() };
      if (!db.activity) db.activity = [];
      db.activity.unshift(actEntry);

      saveStaticDb(db);
      if (sb) {
        try {
          if (targetEmail) {
            await sb.from('notifications').insert([{ workspace_id: activeWsId, text: notifText, target_email: targetEmail, read: false }]);
          }
          await sb.from('activity').insert([{ workspace_id: activeWsId, actor: actorName, action: 'sent deadline reminder for task', task: t.title }]);
        } catch (e) {}
      }
    }
    return { ok: true };
  }

  if (method === 'POST' && path.includes('/comments')) {
    const taskId = path.split('/')[3];
    const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
    let t = db.tasks.find(x => x.id === taskId) || (typeof state !== 'undefined' && state.tasks ? state.tasks.find(x => x.id === taskId) : null);
    if (!t && sb) {
      try {
        const { data: dbT } = await sb.from('tasks').select('*').eq('id', taskId).single();
        if (dbT) t = { ...dbT, workspaceId: dbT.workspace_id, assigneeId: dbT.assignee_id, createdBy: dbT.created_by, dueDate: dbT.due_date, comments: dbT.comments || [], attachments: dbT.attachments || [] };
      } catch (e) {}
    }

    if (t) {
      if (!t.comments) t.comments = [];
      const newComment = {
        id: 'c-' + Date.now(),
        author: user ? user.name : 'Member',
        text: body.text,
        at: new Date().toISOString()
      };
      t.comments.push(newComment);
      saveStaticDb(db);

      const actorName = user ? (user.name || user.email.split('@')[0]) : 'Member';
      const actEntry = { id: 'act-' + Date.now(), workspaceId: activeWsId, actor: actorName, action: 'commented on task', task: t.title, at: new Date().toISOString() };
      if (!db.activity) db.activity = [];
      db.activity.unshift(actEntry);
      saveStaticDb(db);

      if (sb) {
        try {
          await sb.from('tasks').update({ comments: t.comments }).eq('id', taskId);
          await sb.from('activity').insert([{ workspace_id: activeWsId, actor: actorName, action: 'commented on task', task: t.title }]);
        } catch (e) {}
      }
    }
    return { ok: true };
  }

  if (method === 'POST' && path.includes('/attachments')) {
    const taskId = path.split('/')[3];
    const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
    const t = db.tasks.find(x => x.id === taskId);
    if (t) {
      if (!t.attachments) t.attachments = [];
      const newAtt = {
        id: 'att-' + Date.now(),
        name: body.name || 'attachment',
        size: body.size || 0,
        type: body.type || '',
        data: body.data || '',
        uploader: user ? user.name : 'Member',
        at: new Date().toISOString()
      };
      t.attachments.push(newAtt);
      saveStaticDb(db);

      const actorName = user ? (user.name || user.email.split('@')[0]) : 'Member';
      const actEntry = { id: 'act-' + Date.now(), workspaceId: activeWsId, actor: actorName, action: 'uploaded file for task', task: t.title, at: new Date().toISOString() };
      if (!db.activity) db.activity = [];
      db.activity.unshift(actEntry);
      saveStaticDb(db);

      if (sb) {
        try {
          await sb.from('tasks').update({ attachments: t.attachments }).eq('id', taskId);
          await sb.from('activity').insert([{ workspace_id: activeWsId, actor: actorName, action: 'uploaded file for task', task: t.title }]);
        } catch (e) {}
      }
    }
    return { ok: true };
  }

  // 4.8 Notifications
  if (method === 'PATCH' && path === '/api/notifications/read') {
    if (db.notifications) {
      const n = db.notifications.find(x => x.id === body.id);
      if (n) n.read = true;
      saveStaticDb(db);
    }
    if (sb) {
      try {
        await sb.from('notifications').update({ read: true }).eq('id', body.id);
      } catch (e) {}
    }
    return { ok: true };
  }

  if (method === 'POST' && path === '/api/notifications/read-all') {
    if (db.notifications) {
      db.notifications.forEach(n => n.read = true);
      saveStaticDb(db);
    }
    if (sb) {
      try {
        const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
        const userEmail = user ? user.email.toLowerCase() : '';
        await sb.from('notifications')
          .update({ read: true })
          .or(`workspace_id.eq.${activeWsId},target_email.eq.${userEmail}`);
      } catch (e) {}
    }
    return { ok: true };
  }

  // 5. Invites
  if (method === 'POST' && path === '/api/invites') {
    const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
    const ws = (typeof state !== 'undefined' && state.workspace) ? state.workspace : (db.workspaces.find(w => w.id === activeWsId) || { name: 'Workspace' });
    const invitedEmail = body.email.trim().toLowerCase();
    const callerName = user ? (user.name || user.email.split('@')[0]) : 'A teammate';
    const notifText = `📩 You were invited by ${callerName} to join workspace "${ws.name}" as ${body.role || 'Workspace member'}.`;

    const invite = {
      id: 'inv-' + Date.now(),
      workspaceId: activeWsId,
      workspaceName: ws.name,
      email: invitedEmail,
      name: body.name || invitedEmail.split('@')[0],
      role: body.role || 'Workspace member',
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    db.invites.push(invite);

    const notifObj = { id: 'n-' + Date.now(), workspaceId: activeWsId, text: notifText, targetEmail: invitedEmail, read: false, at: new Date().toISOString() };
    if (!db.notifications) db.notifications = [];
    db.notifications.unshift(notifObj);

    const actEntry = { id: 'act-' + Date.now(), workspaceId: activeWsId, actor: callerName, action: 'invited member', task: invitedEmail, at: new Date().toISOString() };
    if (!db.activity) db.activity = [];
    db.activity.unshift(actEntry);

    saveStaticDb(db);

    if (sb) {
      try {
        await sb.from('invites').insert([{
          workspace_id: activeWsId,
          email: invitedEmail,
          role: body.role || 'Workspace member',
          status: 'Pending'
        }]);
        await sb.from('notifications').insert([{
          workspace_id: activeWsId,
          text: notifText,
          target_email: invitedEmail,
          read: false
        }]);
        await sb.from('activity').insert([{
          workspace_id: activeWsId,
          actor: callerName,
          action: 'invited member',
          task: invitedEmail
        }]);
      } catch (e) {
        console.error('Supabase invite insert error:', e);
      }
    }

    return invite;
  }

  if (method === 'POST' && path === '/api/invites/join') {
    const invite = db.invites.find(i => i.id === body.id);
    if (invite) {
      invite.status = 'Accepted';
      const m = { id: 'm-' + Date.now(), workspaceId: invite.workspaceId, name: user.name, email: user.email, initials: user.name.slice(0,2).toUpperCase(), color: '#0ea5e9', role: invite.role || 'Workspace member' };
      db.members.push(m);
      localStorage.setItem('flowspace_active_workspace', invite.workspaceId);
      saveStaticDb(db);
    }
    if (sb) {
      try {
        await sb.from('invites').update({ status: 'Accepted' }).eq('id', body.id);
        const { data: targetInv } = await sb.from('invites').select('*').eq('id', body.id).single();
        if (targetInv) {
          const wsId = targetInv.workspace_id;
          await sb.from('members').insert([{
            workspace_id: wsId,
            name: user.name,
            email: user.email.toLowerCase(),
            initials: user.name.slice(0,2).toUpperCase(),
            color: '#0ea5e9',
            role: targetInv.role || 'Workspace member'
          }]);
          localStorage.setItem('flowspace_active_workspace', wsId);

          const joinNotif = `🎉 ${user.name} accepted the invitation and joined the workspace!`;
          await sb.from('notifications').insert([{ workspace_id: wsId, text: joinNotif, read: false }]);
          await sb.from('activity').insert([{ workspace_id: wsId, actor: user.name, action: 'joined workspace', task: '' }]);
        }
      } catch (e) {}
    }
    return { ok: true };
  }

  if (method === 'POST' && path === '/api/invites/decline') {
    const invite = db.invites.find(i => i.id === body.id);
    if (invite) {
      invite.status = 'Declined';
      db.members = db.members.filter(m => !(m.workspaceId === invite.workspaceId && m.email.toLowerCase() === user.email.toLowerCase()));
      saveStaticDb(db);
    }
    if (sb) {
      try {
        await sb.from('invites').update({ status: 'Declined' }).eq('id', body.id);
        const { data: targetInv } = await sb.from('invites').select('*').eq('id', body.id).single();
        if (targetInv) {
          await sb.from('members').delete().eq('workspace_id', targetInv.workspace_id).eq('email', user.email.toLowerCase());
        }
      } catch (e) {}
    }
    return { ok: true };
  }

  if (method === 'DELETE' && path.startsWith('/api/invites/')) {
    const inviteId = path.split('/')[3];
    const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
    const inv = db.invites.find(i => i.id === inviteId);
    const targetEmail = inv ? inv.email.toLowerCase() : null;

    db.invites = db.invites.filter(i => i.id !== inviteId && (targetEmail ? i.email.toLowerCase() !== targetEmail : true));
    saveStaticDb(db);

    if (sb) {
      try {
        await sb.from('invites').delete().eq('id', inviteId);
        if (targetEmail) {
          await sb.from('invites').delete().eq('workspace_id', activeWsId).eq('email', targetEmail);
        }
      } catch (e) {}
    }
    return { ok: true };
  }

  if (method === 'DELETE' && path.startsWith('/api/members/')) {
    const memberId = path.split('/')[3];
    const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
    const member = db.members.find(m => m.id === memberId);
    const targetEmail = member ? member.email.toLowerCase() : null;

    if (member && member.email.toLowerCase() === user.email.toLowerCase()) {
      throw new Error('You cannot remove yourself from the workspace');
    }

    db.members = db.members.filter(m => m.id !== memberId && (targetEmail ? m.email.toLowerCase() !== targetEmail : true));
    saveStaticDb(db);

    if (sb) {
      try {
        await sb.from('members').delete().eq('id', memberId);
        if (targetEmail) {
          await sb.from('members').delete().eq('workspace_id', activeWsId).eq('email', targetEmail);
          await sb.from('invites').delete().eq('workspace_id', activeWsId).eq('email', targetEmail);
        }
      } catch (e) {}
    }
    return { ok: true };
  }

  if (path.includes('/api/notifications/read')) {
    const userEmail = user ? user.email.toLowerCase() : '';
    if (db.notifications) {
      db.notifications.forEach(n => {
        if (!n.targetEmail || n.targetEmail.toLowerCase() === userEmail) {
          n.read = true;
        }
      });
      saveStaticDb(db);
    }
    if (sb && userEmail) {
      try {
        const activeWsId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
        await sb.from('notifications').update({ read: true }).eq('workspace_id', activeWsId).eq('target_email', userEmail);
      } catch (e) {}
    }
    return { ok: true };
  }

  if (method === 'PATCH' && path === '/api/account') {
    const uRecord = db.users.find(x => x.id === user.id || x.email.toLowerCase() === user.email.toLowerCase());
    const newName = body.name ? body.name.trim() : (uRecord ? uRecord.name : user.name);
    const newEmail = body.email ? body.email.trim().toLowerCase() : (uRecord ? uRecord.email : user.email);

    if (uRecord) {
      if (body.name) uRecord.name = newName;
      if (body.email) uRecord.email = newEmail;
      if (body.password) uRecord.password = body.password;
    }

    db.members.forEach(m => {
      if (m.email.toLowerCase() === user.email.toLowerCase()) {
        m.name = newName;
        m.email = newEmail;
        m.initials = newName.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2);
        if (body.color) m.color = body.color;
        if (body.role) m.role = body.role;
      }
    });

    saveStaticDb(db);

    if (sb) {
      try {
        const newInitials = newName.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2);
        const updateFields = { name: newName, email: newEmail, initials: newInitials };
        if (body.color) updateFields.color = body.color;
        if (body.role) updateFields.role = body.role;
        await sb.from('members').update(updateFields).eq('email', user.email.toLowerCase());
      } catch (e) {}
    }

    return { id: user.id, name: newName, email: newEmail };
  }

  // 6. Workspace endpoints
  if (method === 'POST' && path.startsWith('/api/workspaces/') && path.endsWith('/select')) {
    const wsId = path.split('/')[3];
    localStorage.setItem('flowspace_active_workspace', wsId);
    state.activeWorkspaceId = wsId;
    return { ok: true, activeWorkspaceId: wsId };
  }

  if (method === 'POST' && path === '/api/workspaces') {
    const activeWsId = localStorage.getItem('flowspace_active_workspace') || '';
    const newWsName = body.name ? body.name.trim() : 'New Workspace';
    const newWsDesc = body.description ? body.description.trim() : '';

    let createdWs = { id: 'ws-' + Date.now(), name: newWsName, description: newWsDesc };
    db.workspaces.push(createdWs);

    const newMem = {
      id: 'm-' + Date.now(),
      workspaceId: createdWs.id,
      name: user ? user.name : 'Admin',
      email: user ? user.email.toLowerCase() : '',
      initials: user ? user.name.slice(0, 2).toUpperCase() : 'AD',
      color: '#7c3aed',
      role: 'Workspace admin'
    };
    db.members.push(newMem);
    saveStaticDb(db);

    if (sb) {
      try {
        const { data: wsRes } = await sb.from('workspaces').insert([{ name: newWsName, description: newWsDesc }]).select();
        if (wsRes && wsRes[0]) {
          createdWs = wsRes[0];
          await sb.from('members').insert([{
            workspace_id: createdWs.id,
            name: user ? user.name : 'Admin',
            email: user ? user.email.toLowerCase() : '',
            initials: user ? (user.name || '').slice(0, 2).toUpperCase() : 'AD',
            color: '#7c3aed',
            role: 'Workspace admin'
          }]);
        }
      } catch (e) {}
    }

    localStorage.setItem('flowspace_active_workspace', createdWs.id);
    state.activeWorkspaceId = createdWs.id;
    return createdWs;
  }

  if (method === 'PATCH' && path.startsWith('/api/workspaces/')) {
    const wsId = path.split('/')[3];
    const ws = db.workspaces.find(w => w.id === wsId);
    if (ws) {
      if (body.name) ws.name = body.name.trim();
      if (body.description) ws.description = body.description.trim();
      saveStaticDb(db);
    }
    if (sb) {
      try {
        const updates = {};
        if (body.name) updates.name = body.name.trim();
        if (body.description) updates.description = body.description.trim();
        await sb.from('workspaces').update(updates).eq('id', wsId);
      } catch (e) {}
    }
    return { ok: true };
  }

  return { ok: true };
}

const RENDER_BACKEND_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? ''
  : (localStorage.getItem('flowspace_backend_url') || 'https://flowspace-backend-ajcn.onrender.com');

async function api(url, opts = {}) {
  const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
  const headers = { 'Content-Type': 'application/json' };
  if (user && user.id) {
    headers['x-user-id'] = user.id;
  }
  const targetUrl = (RENDER_BACKEND_URL && url.startsWith('/api')) ? RENDER_BACKEND_URL + url : url;
  try {
    const r = await fetch(targetUrl, { headers: { ...headers, ...(opts.headers || {}) }, ...opts });
    const text = await r.text();
    if (text.trim().startsWith('<')) {
      return handleStaticClientApi(url, opts, user);
    }
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      return handleStaticClientApi(url, opts, user);
    }
    if (!r.ok) throw Error(d.error || 'Request failed');
    return d;
  } catch (err) {
    if (err.message && !err.message.includes('A user with this email') && !err.message.includes('Password') && !err.message.includes('Invalid')) {
      return handleStaticClientApi(url, opts, user);
    }
    throw err;
  }
}

let currentSelectedProjectId = localStorage.getItem('flowspace_active_project') || '';

function getActiveProject() {
  const projects = state.projects || [];
  if (!projects.length) return null;
  if (currentSelectedProjectId === 'all') return null;
  const found = projects.find(p => p.id === currentSelectedProjectId);
  if (found) return found;
  return projects[0];
}

const esc = s => String(s || '').replace(/[&<>'"]/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[x]));
const member = id => state.members.find(m => m.id === id);
const date = v => v ? new Date(v + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' }) : 'No due date';
const activeWorkspace = () => state.activeWorkspaceId || state.workspace?.id;
const currentTasks = () => {
  const wsTasks = state.tasks.filter(t => (t.workspaceId || state.workspace?.id) === activeWorkspace());
  if (currentSelectedProjectId === 'all') return wsTasks;
  const activeProj = getActiveProject();
  if (!activeProj) return wsTasks;
  return wsTasks.filter(t => t.projectId === activeProj.id || !t.projectId || t.projectId === state.projects?.[0]?.id);
};

function timeUI() {
  const n = new Date(), h = n.getHours(), g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  $('#page-kicker').textContent = n.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + ' · ' + n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
  const firstName = user ? user.name.split(' ')[0] : 'User';
  if ($('#overview').classList.contains('active')) {
    $('#page-title').innerHTML = `${g}, ${esc(firstName)} <span>✦</span>`;
  }
}

function ago(v) {
  const h = Math.floor((Date.now() - new Date(v)) / 36e5);
  return h < 1 ? 'Just now' : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function formatNotifyTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const timeStr = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) + ' at ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const agoStr = ago(v);
  return `${timeStr} · ${agoStr}`;
}

function toast(t) {
  const x = $('#toast');
  x.textContent = t;
  x.classList.add('show');
  gsap.fromTo(x, 
    { y: 80, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.5)', overwrite: 'auto' }
  );
  clearTimeout(toast.x);
  toast.x = setTimeout(() => {
    gsap.to(x, { 
      y: 80, 
      opacity: 0, 
      duration: 0.3, 
      ease: 'power2.in', 
      onComplete: () => x.classList.remove('show') 
    });
  }, 2600);
}

function toggleAuthShell(isLoggedIn) {
  if (isLoggedIn) {
    $('#landing-view').style.display = 'none';
    $('#app-shell').style.display = 'flex';
  } else {
    $('#landing-view').style.display = 'flex';
    $('#app-shell').style.display = 'none';
    $('#auth-backdrop').classList.remove('show');
  }
}

function renderNotifications() {
  const notifications = state.notifications || [];
  const unreadCount = notifications.filter(n => !n.read).length;
  
  const badge = $('#notice-dot');
  if (badge) {
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  const unreadBadge = $('#notify-unread-badge');
  if (unreadBadge) {
    unreadBadge.textContent = `${unreadCount} unread`;
  }

  if ($('#mark-all-read')) {
    $('#mark-all-read').onclick = async () => {
      try {
        await api('/api/notifications/read-all', { method: 'POST' });
        if (state && state.notifications) {
          state.notifications.forEach(n => n.read = true);
        }
        renderNotifications();
        toast('All notifications marked as read');
      } catch (e) {
        toast('Failed to mark notifications as read');
      }
    };
  }

  const list = $('#notify-list');
  if (!list) return;

  if (notifications.length === 0) {
    list.innerHTML = `
      <div class="notify-empty">
        <span class="notify-empty-icon">🔔</span>
        <b>All caught up!</b>
        <p>No notifications at this time.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = notifications.map(n => `
    <div class="notify-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
      <span class="notify-item-dot"></span>
      <div class="notify-item-content">
        <p class="notify-item-text">${esc(n.text)}</p>
        <span class="notify-item-time">${formatNotifyTime(n.at)}</span>
      </div>
    </div>
  `).join('');

  $$('.notify-item').forEach(item => {
    item.onclick = async (e) => {
      const id = item.dataset.id;
      const target = notifications.find(n => n.id === id);
      if (target && !target.read) {
        target.read = true;
        renderNotifications();
        try {
          await api('/api/notifications/read', { method: 'PATCH', body: JSON.stringify({ id }) });
          await refresh();
        } catch (err) {}
      }
    };
  });
}

function getCurrentRole() {
  const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
  if (!user) return 'Viewer';
  const m = state.members.find(x => x.email.toLowerCase() === user.email.toLowerCase());
  return m?.role || 'Workspace member';
}

function canUserModifyTask(t) {
  if (!t) return false;
  const role = getCurrentRole();
  if (role === 'Viewer') return false;
  return true;
}

function render() {
  const role = getCurrentRole();
  const isAdmin = role === 'Workspace admin';
  const isViewer = role === 'Viewer';

  if ($('#new-task-btn')) $('#new-task-btn').style.display = isViewer ? 'none' : 'inline-flex';
  if ($('#invite-btn')) $('#invite-btn').style.display = isAdmin ? 'inline-flex' : 'none';
  if ($('#team-invite')) $('#team-invite').style.display = isAdmin ? 'inline-flex' : 'none';

  renderWorkspace();
  renderOverview();
  renderBoard();
  renderActivity();
  renderTeam();
  renderProfile();
  renderAccountView();
  renderNotifications();
  timeUI();
}

function renderWorkspace() {
  const w = state.workspace;
  if (!w) return;
  $('#workspace-name').textContent = w.name;
  $('#workspace-desc').textContent = w.description || 'Workspace';
  $('#workspace-initial').textContent = w.name.slice(0, 1).toUpperCase();
}

function renderOverview() {
  const ts = currentTasks();
  const total = ts.length;
  const done = ts.filter(t => normalizeStatus(t.status) === 'done').length;
  const progress = ts.filter(t => normalizeStatus(t.status) === 'progress').length;
  const todo = ts.filter(t => normalizeStatus(t.status) === 'todo').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  if ($('#completed-count')) $('#completed-count').textContent = done;
  if ($('#progress-count')) $('#progress-count').textContent = progress;
  if ($('#todo-count')) $('#todo-count').textContent = todo;
  if ($('#member-count')) $('#member-count').textContent = state.members.length;
  if ($('#completion-note')) $('#completion-note').textContent = `${done} of ${total} tasks completed`;
  if ($('.orbit-core')) $('.orbit-core').innerHTML = `${pct}%<small>complete</small>`;

  let cursor = 0;
  const segments = [];
  statuses.forEach(([k, , color]) => {
    const count = ts.filter(t => normalizeStatus(t.status) === k).length;
    const share = total ? ((count / total) * 100) : 0;
    if (share > 0) {
      const end = cursor + share;
      segments.push(`${color} ${cursor}% ${end}%`);
      cursor = end;
    }
  });

  const liveGradient = segments.length ? `conic-gradient(${segments.join(',')})` : '#edf0f5';
  if ($('#donut')) $('#donut').style.background = liveGradient;
  const heroRing = $('.orbit-core');
  if (heroRing) {
    heroRing.style.border = '0';
    heroRing.style.background = `conic-gradient(var(--primary) 0%, var(--primary) ${pct}%, var(--line) ${pct}%, var(--line) 100%)`;
  }
  if ($('#donut-value')) $('#donut-value').textContent = pct + '%';
  if ($('#status-breakdown')) {
    $('#status-breakdown').innerHTML = statuses.map(([k, n, c]) => 
      `<div class="break-item"><i style="background:${c}"></i><span>${n}</span><b>${ts.filter(t => normalizeStatus(t.status) === k).length}</b></div>`
    ).join('');
  }
  if ($('#activity-list')) $('#activity-list').innerHTML = activityMarkup(state.activity.slice(0, 4));
}

function activityMarkup(rows) {
  return rows.map(a => `<div class="activity-row"><span class="activity-dot">${esc(a.actor.split(' ').map(x => x[0]).join('').slice(0, 2))}</span><div><p><b>${esc(a.actor)}</b> <span>${esc(a.action)}</span>${a.task ? ` <b>${esc(a.task)}</b>` : ''}</p><time>${ago(a.at)}</time></div></div>`).join('') || '<p class="empty">No activity yet.</p>';
}

function renderActivity() {
  $('#full-activity').innerHTML = activityMarkup(state.activity);
}

function renderProjectsHeader() {
  const projects = state.projects || [];
  const activeProj = getActiveProject();
  const selector = $('#project-selector');
  if (selector) {
    const options = [
      `<option value="all" ${currentSelectedProjectId === 'all' ? 'selected' : ''}>📁 All Projects (Overview Directory)</option>`,
      ...projects.map(p => `<option value="${p.id}" ${(!activeProj && currentSelectedProjectId !== 'all' && projects[0]?.id === p.id) || (activeProj && activeProj.id === p.id) ? 'selected' : ''}>${esc(p.name)}</option>`)
    ];
    selector.innerHTML = options.join('');
    selector.onchange = e => {
      currentSelectedProjectId = e.target.value;
      localStorage.setItem('flowspace_active_project', currentSelectedProjectId);
      renderBoard();
    };
  }

  const role = getCurrentRole();
  const isViewer = role === 'Viewer';

  const createBtn = $('#create-project-btn');
  if (createBtn) {
    createBtn.style.display = isViewer ? 'none' : 'inline-flex';
    createBtn.onclick = () => openProjectModal();
  }

  const renameBtn = $('#rename-project-btn');
  if (renameBtn) {
    renameBtn.style.display = (!isViewer && activeProj) ? 'inline-flex' : 'none';
    renameBtn.onclick = () => openProjectModal(activeProj);
  }

  if (currentSelectedProjectId === 'all') {
    if ($('#project-title')) $('#project-title').textContent = 'All Projects Directory';
    if ($('#project-desc')) $('#project-desc').textContent = 'Browse, manage, and switch across all projects in this workspace.';
  } else if (activeProj) {
    if ($('#project-title')) $('#project-title').textContent = activeProj.name;
    if ($('#project-desc')) $('#project-desc').textContent = activeProj.description || 'Project board';
  }
}

function renderProjectsGrid() {
  const projects = state.projects || [];
  const isViewer = getCurrentRole() === 'Viewer';
  const grid = $('#projects-grid');
  if (!grid) return;

  const cards = projects.map(p => {
    const pTasks = state.tasks.filter(t => (t.workspaceId || state.workspace?.id) === activeWorkspace() && t.projectId === p.id);
    const doneCount = pTasks.filter(t => t.status === 'done').length;
    const pct = pTasks.length ? Math.round((doneCount / pTasks.length) * 100) : 0;

    return `
      <article class="project-card">
        <div>
          <div class="project-card-head">
            <h3>${esc(p.name)}</h3>
            <span class="tag">${pct}% complete</span>
          </div>
          <p>${esc(p.description || 'No description provided.')}</p>
        </div>
        <div>
          <div class="project-meta-bar">
            <span>${pTasks.length} tasks</span>
            <span>${doneCount} completed</span>
          </div>
          <div class="project-card-actions">
            <button class="primary open-proj-btn" data-id="${p.id}" style="font-size:12px">Open Board →</button>
            ${!isViewer ? `<button class="secondary rename-proj-btn" data-id="${p.id}" style="font-size:12px">✏ Rename</button>` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');

  const addCard = !isViewer ? `
    <article class="project-card" style="border:2px dashed var(--line);background:transparent;display:grid;place-items:center;cursor:pointer" id="grid-create-proj">
      <div style="text-align:center">
        <span style="font-size:24px;color:var(--primary)">＋</span>
        <h3 style="font-size:15px;margin-top:6px">Create New Project</h3>
        <p style="font-size:12px">Organize team tasks in a new project</p>
      </div>
    </article>
  ` : '';

  grid.innerHTML = cards + addCard;

  $$('.open-proj-btn').forEach(btn => {
    btn.onclick = () => {
      currentSelectedProjectId = btn.dataset.id;
      localStorage.setItem('flowspace_active_project', currentSelectedProjectId);
      renderBoard();
    };
  });

  $$('.rename-proj-btn').forEach(btn => {
    btn.onclick = () => {
      const p = projects.find(x => x.id === btn.dataset.id);
      if (p) openProjectModal(p);
    };
  });

  if ($('#grid-create-proj')) {
    $('#grid-create-proj').onclick = () => openProjectModal();
  }
}

function openProjectModal(p = null) {
  const isEdit = !!p;
  modal(`
    <div class="modal">
      <div class="modal-head">
        <h2>${isEdit ? 'Rename project' : 'Create a new project'}</h2>
        <button class="close">×</button>
      </div>
      <form id="project-modal-form">
        <div class="form-grid">
          <div class="field full">
            <label>PROJECT NAME</label>
            <input required name="name" value="${esc(p?.name || '')}" placeholder="e.g. Mobile App Redesign">
          </div>
          <div class="field full">
            <label>DESCRIPTION</label>
            <textarea name="description" placeholder="Short summary of project goals">${esc(p?.description || '')}</textarea>
          </div>
        </div>
        <div class="modal-foot" style="justify-content: space-between;">
          ${isEdit ? `<button type="button" id="delete-proj-modal-btn" class="secondary" style="color:#ef4444;border-color:rgba(239,68,68,0.3)">Delete project</button>` : '<div></div>'}
          <div style="display:flex;gap:8px">
            <button type="button" class="secondary cancel">Cancel</button>
            <button class="primary">${isEdit ? 'Save changes' : 'Create project'}</button>
          </div>
        </div>
      </form>
    </div>
  `);

  if (isEdit && $('#delete-proj-modal-btn')) {
    $('#delete-proj-modal-btn').onclick = async () => {
      if (confirm(`Are you sure you want to delete the project "${p.name}"? All associated tasks will be removed.`)) {
        try {
          await api(`/api/projects/${p.id}`, { method: 'DELETE' });
          if (currentSelectedProjectId === p.id) {
            currentSelectedProjectId = 'all';
            localStorage.setItem('flowspace_active_project', 'all');
          }
          await refresh();
          close();
          toast('Project deleted successfully');
        } catch (err) {
          toast(err.message || 'Failed to delete project');
        }
      }
    };
  }

  $('#project-modal-form').onsubmit = async e => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button.primary');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }
    const payload = Object.fromEntries(new FormData(e.target));
    try {
      if (isEdit) {
        await api(`/api/projects/${p.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast('Project updated');
      } else {
        const newP = await api('/api/projects', { method: 'POST', body: JSON.stringify(payload) });
        if (newP && newP.id) {
          currentSelectedProjectId = newP.id;
          localStorage.setItem('flowspace_active_project', currentSelectedProjectId);
        }
        toast('Project created successfully');
      }
      await refresh();
      close();
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Save changes' : 'Create project';
      }
      toast(err.message || 'Operation failed');
    }
  };
}

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
  $$('.task-card').forEach(e => {
    const t = state.tasks.find(x => x.id === e.dataset.id);
    if (canUserModifyTask(t)) {
      e.ondragstart = () => {
        dragged = e.dataset.id;
        e.classList.add('dragging');
      };
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
      } else if (t && !canUserModifyTask(t)) {
        toast('Workspace members can only update tasks assigned to them');
      }
    };
  });
}

function taskMarkup(t) {
  const canModify = canUserModifyTask(t);
  const m = member(t.assigneeId), late = t.dueDate && new Date(t.dueDate + 'T23:59:59') < Date.now() && t.status !== 'done';
  const assigneeBadge = m 
    ? `<span class="assignee-pill" title="Assigned to ${esc(m.name)}"><span class="mini-avatar" style="background:${m.color}">${m.initials}</span>${esc(m.name)}</span>`
    : `<span class="assignee-pill unassigned">Unassigned</span>`;
  return `<article class="task-card" ${canModify ? 'draggable="true"' : 'draggable="false"'} data-id="${t.id}"><span class="tag">${esc(t.tags[0] || 'General')}</span><span class="priority ${t.priority}">${t.priority}</span><h4>${esc(t.title)}</h4><p>${esc(t.description)}</p><div class="task-meta">${assigneeBadge}<span class="due ${late?'late':''}">◷ ${date(t.dueDate)}</span></div></article>`;
}

function renderTeam() {
  const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
  const currentMember = user ? state.members.find(x => x.email.toLowerCase() === user.email.toLowerCase()) : null;
  const isAdmin = currentMember ? currentMember.role === 'Workspace admin' : true;

  const inv = state.invites.filter(i => (i.workspaceId || state.workspace.id) === activeWorkspace());
  
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

  $$('.role-select').forEach(sel => {
    sel.onchange = async () => {
      const memberId = sel.dataset.id;
      const newRole = sel.value;
      try {
        const targetMem = state.members.find(x => x.id === memberId);
        await api(`/api/members/${memberId}`, {
          method: 'PATCH',
          body: JSON.stringify({ role: newRole })
        });
        toast(`Updated ${targetMem ? targetMem.name : 'member'}'s role to ${newRole}`);
        await refresh();
      } catch (err) {
        toast(err.message || 'Failed to update role');
      }
    };
  });

  $$('.remove-member-btn').forEach(btn => {
    btn.onclick = async () => {
      if (confirm(`Are you sure you want to remove ${btn.dataset.name} from this workspace?`)) {
        try {
          await api(`/api/members/${btn.dataset.id}`, { method: 'DELETE' });
          toast(`Removed ${btn.dataset.name} from workspace`);
          await refresh();
        } catch (err) {
          toast(err.message || 'Failed to remove member');
        }
      }
    };
  });

  // Render Received Invitations in Team view
  const receivedListEl = $('#received-invites-list');
  if (receivedListEl) {
    const received = state.receivedInvites || [];
    if (received && received.length > 0) {
      receivedListEl.innerHTML = received.map(i => {
        const isPending = i.status === 'Pending';
        const isAccepted = i.status === 'Accepted';
        const isDeclined = i.status === 'Declined';

        const statusTag = isAccepted 
          ? `<span class="tag" style="background:rgba(53,162,116,0.15);color:#10b981">Joined & Accepted</span>`
          : isDeclined 
          ? `<span class="tag" style="background:rgba(239,68,68,0.15);color:#ef4444">Declined (No Access)</span>`
          : `<span class="tag" style="background:rgba(245,158,11,0.15);color:#f59e0b">Pending Approval</span>`;

        const actions = isPending ? `
          <div class="invite-card-actions" style="margin-top:8px;display:flex;gap:8px">
            <button class="btn-received-accept primary" data-id="${i.id}" style="padding:6px 12px;font-size:12px">Join Workspace →</button>
            <button class="btn-received-decline secondary" data-id="${i.id}" style="padding:6px 12px;font-size:12px">Decline</button>
          </div>
        ` : '';

        return `
          <div class="invite-row" style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:var(--card);border:1px solid var(--line);border-radius:10px;margin-bottom:8px">
            <div>
              <b>${esc(i.workspaceName)}</b>
              <small style="display:block;color:var(--muted);margin-top:2px">Assigned Role: ${esc(i.role)}</small>
              ${actions}
            </div>
            ${statusTag}
          </div>
        `;
      }).join('');

      $$('.btn-received-accept').forEach(btn => btn.onclick = async () => {
        try {
          await api('/api/invites/join', { method: 'POST', body: JSON.stringify({ id: btn.dataset.id }) });
          toast('Joined workspace!');
          await refresh();
          setView('overview');
        } catch (e) {
          toast(e.message);
        }
      });

      $$('.btn-received-decline').forEach(btn => btn.onclick = async () => {
        try {
          await api('/api/invites/decline', { method: 'POST', body: JSON.stringify({ id: btn.dataset.id }) });
          toast('Invitation declined');
          await refresh();
        } catch (e) {
          toast(e.message);
        }
      });
    } else {
      receivedListEl.innerHTML = '<p class="empty" style="font-size:13px;color:var(--muted)">No workspace invitations received for your email.</p>';
    }
  }

  $('#invites-list').innerHTML = inv.map(i => {
    const isDeclined = i.status === 'Declined';
    const tagBg = isDeclined ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
    const tagColor = isDeclined ? '#ef4444' : '#f59e0b';
    return `
      <div class="invite-row" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--card);border:1px solid var(--line);border-radius:10px;margin-bottom:8px">
        <div>
          <b>${esc(i.name || i.email)}</b>
          <small style="display:block;color:var(--muted);margin-top:2px">${esc(i.email)} · ${esc(i.role)}</small>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="tag" style="background:${tagBg};color:${tagColor}">${esc(i.status.toUpperCase())}</span>
          ${isAdmin ? `<button class="secondary revoke-invite-btn" data-id="${i.id}" style="padding:4px 10px;font-size:12px">Revoke</button>` : ''}
        </div>
      </div>
    `;
  }).join('') || '<p class="empty">No workspace invitations sent.</p>';

  $$('.revoke-invite-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        await api(`/api/invites/${btn.dataset.id}`, { method: 'DELETE' });
        toast('Invitation revoked');
        await refresh();
      } catch (err) {
        toast(err.message || 'Failed to revoke');
      }
    };
  });
}

function renderProfile() {
  const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
  if (!user) return;
  const m = state.members.find(x => x.email.toLowerCase() === user.email.toLowerCase());
  const displayName = user.name || (m ? m.name : user.email.split('@')[0]);
  const initials = displayName.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2);

  $('#user-name').textContent = displayName;
  $('#user-role').textContent = m ? (m.role || 'Workspace admin') : 'Workspace admin';
  $('#user-avatar').textContent = initials;
  $('#user-avatar').style.background = m ? (m.color || '#7c3aed') : '#7c3aed';
}

function renderAccountView() {
  const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
  if (!user) return;
  
  const m = state.members.find(x => x.email.toLowerCase() === user.email.toLowerCase()) || {
    name: user.name,
    role: 'Workspace admin',
    color: '#7c3aed'
  };
  
  // Set inputs
  if (document.activeElement !== $('#acc-name')) $('#acc-name').value = user.name || '';
  if (document.activeElement !== $('#acc-email')) $('#acc-email').value = user.email || '';
  $('#acc-role').value = m.role || 'Workspace admin';

  // Wire Account Form Submission Handler
  const accForm = $('#account-form');
  if (accForm && !accForm.dataset.bound) {
    accForm.dataset.bound = 'true';
    accForm.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const payload = Object.fromEntries(new FormData(accForm));
        const updated = await api('/api/account', { method: 'PATCH', body: JSON.stringify(payload) });
        
        const currentUser = JSON.parse(localStorage.getItem('flowspace_user') || '{}');
        const newUser = { ...currentUser, name: updated.name || payload.name, email: updated.email || payload.email };
        localStorage.setItem('flowspace_user', JSON.stringify(newUser));
        
        toast('Account settings updated successfully!');
        await refresh();
        renderProfile();
      } catch (err) {
        toast(err.message || 'Failed to update account settings');
      }
    };
  }
  
  // Render color swatches
  const colors = ['#7c3aed', '#0ea5e9', '#f97316', '#3b82f6', '#10b981', '#ef4444', '#ec4899', '#14b8a6'];
  const activeColor = m.color || '#7c3aed';
  $('#color-palette').innerHTML = colors.map(c => 
    `<span class="color-circle ${c === activeColor ? 'active' : ''}" style="background:${c}" data-color="${c}"></span>`
  ).join('');
  $('#acc-color').value = activeColor;
  
  $$('.color-circle').forEach(el => el.onclick = () => {
    $$('.color-circle').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    $('#acc-color').value = el.dataset.color;
  });
  
  // Render invitations inbox
  const pendingList = $('#pending-invitations-list');
  const received = state.receivedInvites || [];
  
  if (received && received.length > 0) {
    pendingList.innerHTML = received.map(i => {
      const isPending = i.status === 'Pending';
      const isAccepted = i.status === 'Accepted';
      const isDeclined = i.status === 'Declined';

      const statusTag = isAccepted 
        ? `<span class="tag" style="background:rgba(53,162,116,0.15);color:#10b981">Joined & Accepted</span>`
        : isDeclined 
        ? `<span class="tag" style="background:rgba(239,68,68,0.15);color:#ef4444">Declined (No Access)</span>`
        : `<span class="tag" style="background:rgba(245,158,11,0.15);color:#f59e0b">Pending Approval</span>`;

      const actions = isPending ? `
        <div class="invite-card-actions" style="margin-top:10px">
          <button class="btn-accept primary" data-id="${i.id}">Join Workspace →</button>
          <button class="btn-decline secondary" data-id="${i.id}">Decline</button>
        </div>
      ` : '';

      return `
        <div class="invite-card" style="margin-bottom:12px">
          <div class="invite-card-info" style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <b>${esc(i.workspaceName)}</b>
              <small style="margin-top:4px;display:block">Assigned Role: ${esc(i.role)}</small>
            </div>
            ${statusTag}
          </div>
          ${actions}
        </div>
      `;
    }).join('');

    $$('.btn-accept').forEach(btn => btn.onclick = async () => {
      try {
        await api('/api/invites/join', { method: 'POST', body: JSON.stringify({ id: btn.dataset.id }) });
        toast('Joined workspace!');
        await refresh();
        setView('overview');
      } catch (e) {
        toast(e.message);
      }
    });

    $$('.btn-decline').forEach(btn => btn.onclick = async () => {
      try {
        await api('/api/invites/decline', { method: 'POST', body: JSON.stringify({ id: btn.dataset.id }) });
        toast('Invitation declined - access revoked');
        await refresh();
      } catch (e) {
        toast(e.message);
      }
    });
  } else {
    pendingList.innerHTML = '<p class="empty" style="text-align:center; font-size:12px; margin-top:20px">No workspace invitations received.</p>';
  }
}

const eyeBtnMarkup = `
  <button type="button" class="password-toggle-btn" aria-label="Toggle Password Visibility">
    <svg class="eye-open" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 18px; height: 18px;"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    <svg class="eye-closed" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 18px; height: 18px; display: none;"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
  </button>
`;

function wirePasswordToggles(container = document) {
  container.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wrapper = btn.closest('.password-input-wrapper');
      if (!wrapper) return;
      const input = wrapper.querySelector('input');
      const openIcon = btn.querySelector('.eye-open');
      const closedIcon = btn.querySelector('.eye-closed');
      if (!input) return;
      
      if (input.type === 'password') {
        input.type = 'text';
        if (openIcon) openIcon.style.display = 'none';
        if (closedIcon) closedIcon.style.display = 'block';
      } else {
        input.type = 'password';
        if (openIcon) openIcon.style.display = 'block';
        if (closedIcon) closedIcon.style.display = 'none';
      }
    };
  });
}

function showLogin() {
  $('#auth-backdrop').innerHTML = `
    <div class="auth-modal">
      <h2>Welcome back</h2>
      <p>Log in to access your Flowspace workspaces.</p>
      <form id="login-form">
        <div class="field full">
          <label>EMAIL ADDRESS</label>
          <input required type="email" name="email" placeholder="name@company.com">
        </div>
        <div class="field full">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <label style="margin-bottom:0">PASSWORD</label>
            <a id="forgot-password-link" style="font-size:12px;color:var(--primary);cursor:pointer;font-weight:600">Forgot password?</a>
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
  gsap.from('#auth-backdrop .auth-modal', {
    opacity: 0,
    y: 35,
    duration: 0.4,
    ease: 'power2.out',
    clearProps: 'transform'
  });
  
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(e.target));
      const sb = getSupabase();
      if (sb) {
        const { data: sbData, error: sbErr } = await sb.auth.signInWithPassword({
          email: payload.email,
          password: payload.password
        });
        if (sbErr && !sbErr.message.includes('Invalid login credentials')) {
          console.warn('Supabase Auth Notice:', sbErr.message);
        }
      }
      const user = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem('flowspace_user', JSON.stringify(user));
      localStorage.removeItem('flowspace_active_workspace');
      localStorage.removeItem('flowspace_active_project');
      localStorage.removeItem('flowspace_static_db');
      $('#auth-backdrop').classList.remove('show');
      state = null;
      activeTask = null;
      await refresh();
      toggleAuthShell(true);
      connectLive();
      setView('overview');
      toast('Logged in successfully!');
    } catch (err) {
      toast(err.message || 'Login failed');
    }
  };
  if ($('#forgot-password-link')) $('#forgot-password-link').onclick = showForgotPasswordModal;
  $('#goto-signup').onclick = showSignup;
  $$('#auth-backdrop .close').forEach(x => x.onclick = () => $('#auth-backdrop').classList.remove('show'));
  wirePasswordToggles($('#auth-backdrop'));
}

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
      <div class="auth-modal-footer">
        Remembered password? <a id="back-to-login">Log in</a>
      </div>
      <button class="close" style="position:absolute; top:15px; right:15px">×</button>
    </div>
  `;
  $('#auth-backdrop').classList.add('show');
  gsap.from('#auth-backdrop .auth-modal', {
    opacity: 0,
    y: 35,
    duration: 0.4,
    ease: 'power2.out',
    clearProps: 'transform'
  });

  $('#forgot-password-form').onsubmit = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    if (!validateEmail(payload.email)) {
      return toast('Please enter a valid email address.');
    }
    try {
      window.lastResetEmail = payload.email;
      const sb = getSupabase();
      let supabaseError = null;
      if (sb) {
        const { error } = await sb.auth.resetPasswordForEmail(payload.email, {
          redirectTo: `${window.location.origin}/#type=recovery`
        });
        if (error) {
          supabaseError = error.message;
        }
      }
      
      if (supabaseError) {
        toast(`Supabase Auth: ${supabaseError}. Opening direct password reset...`);
      } else {
        toast('Reset request processed! Check your email inbox & spam folder.');
      }

      // Automatically transition to New Password modal so user is never stuck
      setTimeout(() => {
        showSetNewPasswordModal();
      }, 1500);

    } catch (err) {
      toast(err.message || 'Failed to process reset request');
    }
  };

  if ($('#back-to-login')) $('#back-to-login').onclick = showLogin;
  $$('#auth-backdrop .close').forEach(x => x.onclick = () => $('#auth-backdrop').classList.remove('show'));
}

function showSetNewPasswordModal() {
  $('#auth-backdrop').innerHTML = `
    <div class="auth-modal">
      <h2>Create new password</h2>
      <p>Set a new password for your account.</p>
      <form id="new-password-form">
        <div class="field full">
          <label>NEW PASSWORD</label>
          <div class="password-input-wrapper">
            <input required type="password" name="password" id="reset-new-password" placeholder="••••••••" minlength="8">
            ${eyeBtnMarkup}
          </div>
          <small style="font-size:11px;color:var(--muted);margin-top:4px">Min 8 chars, 1 number, 1 uppercase & 1 special character</small>
        </div>
        <button class="primary" style="margin-top:10px; padding:12px">Update password & Log in</button>
      </form>
    </div>
  `;
  $('#auth-backdrop').classList.add('show');
  wirePasswordToggles($('#auth-backdrop'));

  $('#new-password-form').onsubmit = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    const pwdErr = validatePassword(payload.password);
    if (pwdErr) return toast(pwdErr);

    try {
      const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
      const email = payload.email || user?.email || window.lastResetEmail || '';
      
      const sb = getSupabase();
      if (sb) {
        try {
          await sb.auth.updateUser({ password: payload.password });
        } catch (e) {
          console.warn('Supabase password update note:', e.message);
        }
      }
      if (email) {
        await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, password: payload.password }) });
      }
      toast('Password updated successfully! Please log in with your new password.');
      window.location.hash = '';
      showLogin();
    } catch (err) {
      toast(err.message || 'Failed to update password');
    }
  };
}

function handlePasswordResetToken() {
  const hash = window.location.hash || '';
  if (hash.includes('type=recovery') || hash.includes('access_token=')) {
    showSetNewPasswordModal();
  }
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validatePassword(p) {
  if (!p || p.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[0-9]/.test(p)) {
    return 'Password must contain at least 1 number.';
  }
  if (!/[A-Z]/.test(p)) {
    return 'Password must contain at least 1 uppercase letter.';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p)) {
    return 'Password must contain at least 1 special character.';
  }
  return null;
}

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
  gsap.from('#auth-backdrop .auth-modal', {
    opacity: 0,
    y: 35,
    duration: 0.4,
    ease: 'power2.out',
    clearProps: 'transform'
  });
  
  $('#signup-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = Object.fromEntries(new FormData(e.target));
      if (!validateEmail(payload.email)) {
        return toast('Please enter a valid email address.');
      }
      const pwdErr = validatePassword(payload.password);
      if (pwdErr) {
        return toast(pwdErr);
      }
      const sb = getSupabase();
      if (sb) {
        const { data: sbData, error: sbErr } = await sb.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: {
            data: { name: payload.name }
          }
        });
        if (sbErr && !sbErr.message.includes('already registered')) {
          console.warn('Supabase Auth Notice:', sbErr.message);
        }
      }
      const user = await api('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
      localStorage.setItem('flowspace_user', JSON.stringify(user));
      localStorage.removeItem('flowspace_active_workspace');
      localStorage.removeItem('flowspace_active_project');
      localStorage.removeItem('flowspace_static_db');
      $('#auth-backdrop').classList.remove('show');
      state = null;
      activeTask = null;
      await refresh();
      toggleAuthShell(true);
      connectLive();
      setView('overview');
      toast('Account created successfully!');
    } catch (err) {
      toast(err.message || 'Signup failed');
    }
  };
  if ($('#goto-signup-login')) $('#goto-signup-login').onclick = showLogin;
  $$('#auth-backdrop .close').forEach(x => x.onclick = () => $('#auth-backdrop').classList.remove('show'));
  wirePasswordToggles($('#auth-backdrop'));
}

async function refresh() {
  try {
    const res = await api('/api/state');
    if (res) {
      state = res;
    }
  } catch (e) {
    console.warn('Sync notice:', e);
  }
  if (!state) {
    const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
    const sbData = user ? await fetchSupabaseState(user) : null;
    if (sbData) {
      state = sbData;
    } else {
      const db = getStaticDb();
      const activeId = localStorage.getItem('flowspace_active_workspace') || 'ws-1';
      const ws = (db.workspaces || []).find(w => w.id === activeId) || (db.workspaces || [])[0] || { id: 'ws-1', name: 'Workspace' };
      state = {
        workspace: ws,
        workspaces: db.workspaces || [],
        activeWorkspaceId: ws.id,
        projects: db.projects || [],
        members: db.members || [],
        invites: db.invites || [],
        tasks: db.tasks || [],
        activity: db.activity || [],
        notifications: db.notifications || [],
        pendingInvites: [],
        receivedInvites: []
      };
    }
  }
  render();
  try {
    checkPendingInvitePrompt();
  } catch (e) {}
}

async function saveTask(id, data) {
  await api('/api/tasks/' + id, { method: 'PATCH', body: JSON.stringify(data) });
  await refresh();
}

function modal(html) {
  $('#modal-backdrop').innerHTML = html;
  $('#modal-backdrop').classList.add('show');
  $$('.close,.cancel').forEach(x => x.onclick = close);
}

function close() {
  $('#modal-backdrop').classList.remove('show');
  activeTask = null;
}

function getMemberDisplayName(m) {
  if (!m) return 'Unassigned';
  const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
  if (user && user.email && m.email && m.email.toLowerCase() === user.email.toLowerCase()) {
    return user.name || m.name || m.email.split('@')[0];
  }
  return m.name || m.email.split('@')[0];
}

function taskForm(t = { status: 'todo', priority: 'medium', tags: [] }) {
  const isAdmin = getCurrentRole() === 'Workspace admin';
  const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
  const userMember = user ? state.members.find(x => x.email.toLowerCase() === user.email.toLowerCase()) : null;
  const isCreatorOrAssignee = user && (
    (t.createdBy && t.createdBy.toLowerCase() === user.email.toLowerCase()) || 
    (t.assigneeId === user.id) || 
    (userMember && t.assigneeId === userMember.id)
  );
  const canDeleteTask = isAdmin || isCreatorOrAssignee;

  const projects = state.projects || [];
  const activeProj = getActiveProject();
  const selectedProjId = t.projectId || activeProj?.id || projects[0]?.id || '';

  const projSelectMarkup = `<div class="field"><label>PROJECT</label><select name="projectId">${projects.map(p => `<option value="${p.id}" ${p.id === selectedProjId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`;

  return `<div class="modal"><div class="modal-head"><h2>${t.id ? 'Edit task' : 'Create a task'}</h2><button class="close">×</button></div><form id="task-form"><div class="form-grid"><div class="field full"><label>TASK TITLE</label><input required name="title" value="${esc(t.title || '')}" placeholder="What needs to happen?"></div><div class="field full"><label>DESCRIPTION</label><textarea name="description">${esc(t.description || '')}</textarea></div>${projSelectMarkup}<div class="field"><label>ASSIGNEE</label><select name="assigneeId"><option value="">Unassigned</option>${state.members.map(m => `<option value="${m.id}" ${m.id === t.assigneeId ? 'selected' : ''}>${esc(getMemberDisplayName(m))}</option>`).join('')}</select></div><div class="field"><label>DUE DATE</label><input type="date" name="dueDate" value="${t.dueDate || ''}"></div><div class="field"><label>STATUS</label><select name="status">${statuses.map(([k, n]) => `<option value="${k}" ${t.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div><div class="field"><label>PRIORITY</label><select name="priority">${['urgent', 'high', 'medium', 'low'].map(p => `<option ${t.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div><div class="field full"><label>TAG</label><input name="tag" value="${esc(t.tags?.[0] || '')}" placeholder="e.g. Design"></div></div><div class="modal-foot">${t.id && canDeleteTask ? '<button type="button" class="danger" id="delete-task">🗑️ Delete task</button>' : ''}<button type="button" class="secondary cancel">Cancel</button><button class="primary">${t.id ? 'Save task' : 'Create task'}</button></div></form></div>`;
}

function wireTaskForm(t) {
  $('#task-form').onsubmit = async e => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button.primary');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }
    try {
      const f = Object.fromEntries(new FormData(e.target));
      f.tags = f.tag ? [f.tag] : [];
      delete f.tag;
      if (t.id) {
        await saveTask(t.id, f);
      } else {
        await api('/api/tasks', { method: 'POST', body: JSON.stringify(f) });
        await refresh();
      }
      close();
      toast(t.id ? 'Task updated - progress refreshed' : 'Task created successfully');
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = t.id ? 'Save task' : 'Create task';
      }
      toast(err.message || 'Failed to save task');
    }
  };
  if (t.id && $('#delete-task')) {
    $('#delete-task').onclick = async () => {
      if (confirm('Are you sure you want to delete this task?')) {
        try {
          await api('/api/tasks/' + t.id, { method: 'DELETE' });
          await refresh();
          close();
          toast('Task deleted successfully');
        } catch (err) {
          toast(err.message || 'Failed to delete task');
        }
      }
    };
  }
}

function openNew() {
  if (getCurrentRole() === 'Viewer') return toast('Viewers have read-only access');
  modal(taskForm());
  wireTaskForm({});
}

function openTask(id) {
  const t = state.tasks.find(x => x.id === id);
  activeTask = t;
  const role = getCurrentRole();
  const isViewer = role === 'Viewer';
  const isAdmin = role === 'Workspace admin';
  const canModify = canUserModifyTask(t);
  const isNear = t.dueDate && t.status !== 'done' && new Date(t.dueDate + 'T23:59:59') - Date.now() < 7 * 864e5;

  const commentFormMarkup = isViewer
    ? ''
    : `<form id="comment-form" class="field"><textarea required name="text" placeholder="Write a comment…"></textarea><button class="primary" style="align-self:flex-end">Add comment</button></form>`;

  const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
  const userMember = user ? state.members.find(x => x.email.toLowerCase() === user.email.toLowerCase()) : null;
  const isCreatorOrAssignee = user && (
    (t.createdBy && t.createdBy.toLowerCase() === user.email.toLowerCase()) || 
    (t.assigneeId === user.id) || 
    (userMember && t.assigneeId === userMember.id)
  );
  const canDeleteTask = isAdmin || isCreatorOrAssignee;
  const deleteBtnMarkup = canDeleteTask ? `<button type="button" class="danger" id="delete-task-detail-btn" style="background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer">🗑️ Delete task</button>` : '';

  const footActions = canModify
    ? `<button class="secondary" id="edit-task">Edit task</button>${t.status !== 'done' ? '<button class="primary" id="complete-task">Mark completed</button>' : ''}${deleteBtnMarkup}${isNear && isAdmin ? '<button class="secondary" id="alert-task">Send reminder</button>' : ''}`
    : (canDeleteTask ? deleteBtnMarkup : (role === 'Workspace member' ? '<p style="font-size:12px;color:var(--muted);padding:8px 0">Assigned to another member (Read-only view)</p>' : ''));

  const m = member(t.assigneeId);
  const mName = getMemberDisplayName(m);
  const assigneeBox = `
    <div class="task-assignee-box" style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--violet);border:1px solid var(--line);border-radius:10px;margin-top:16px">
      <span class="avatar" style="background:${m ? m.color : '#94a3b8'};width:38px;height:38px;font-size:12px">${m ? m.initials : '?'}</span>
      <div>
        <div style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px">ASSIGNED TO</div>
        <div style="font-size:14px;font-weight:700;color:var(--ink);margin-top:2px">${esc(mName)} ${m ? `<span style="font-size:12px;font-weight:500;color:var(--muted)">(${esc(m.email)})</span>` : ''}</div>
      </div>
    </div>
  `;

  modal(`
    <div class="modal">
      <div class="modal-head">
        <h2>${esc(t.title)}</h2>
        <button class="close">×</button>
      </div>
      <div class="task-detail">
        ${esc(t.description || 'No description added.')}<br><br>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="tag">${esc(t.tags[0] || 'General')}</span> 
          <span class="priority ${t.priority}">${t.priority}</span>
          <span style="font-size:12px;color:var(--muted)">Due ${date(t.dueDate)}</span>
        </div>
        ${assigneeBox}
        ${isViewer ? '<div style="margin-top:10px"><span class="tag" style="background:rgba(148,163,184,0.15);color:var(--muted)">Read-only Viewer Mode</span></div>' : (!canModify && role === 'Workspace member' ? `<div style="margin-top:10px"><span class="tag" style="background:rgba(245,158,11,0.12);color:#b45309">Assigned to ${m ? esc(m.name) : 'another member'} (Read-only view)</span></div>` : '')}
      </div>
      ${isNear ? '<p style="font-size:12px;color:#d15c32;margin-top:14px">This deadline is near.</p>' : ''}
      <div class="detail-section">
        <h3>Comments (${t.comments.length})</h3>
        <div>${t.comments.map(c => `<div class="comment"><b>${esc(c.author)}</b><p>${esc(c.text)}</p></div>`).join('') || '<p class="empty">Start the conversation.</p>'}</div>
        ${commentFormMarkup}
      </div>
      <div class="modal-foot">
        ${footActions}
      </div>
    </div>
  `);

  if ($('#delete-task-detail-btn')) {
    $('#delete-task-detail-btn').onclick = async () => {
      if (confirm('Are you sure you want to delete this task?')) {
        try {
          await api(`/api/tasks/${t.id}`, { method: 'DELETE' });
          await refresh();
          close();
          toast('Task deleted successfully');
        } catch (e) {
          toast(e.message || 'Failed to delete task');
        }
      }
    };
  }

  if (canModify) {
    if ($('#edit-task')) $('#edit-task').onclick = () => {
      modal(taskForm(t));
      wireTaskForm(t);
    };
    if ($('#complete-task')) $('#complete-task').onclick = async () => {
      await saveTask(t.id, { status: 'done' });
      close();
      toast('Task completed - progress updated live');
    };
    if ($('#alert-task')) $('#alert-task').onclick = async () => {
      try {
        await api(`/api/tasks/${t.id}/alert`, { method: 'POST' });
        await refresh();
        close();
        toast('Deadline reminder sent');
      } catch (e) {
        toast(e.message);
      }
    };
  }
  if (!isViewer) {
    if ($('#comment-form')) $('#comment-form').onsubmit = async e => {
      e.preventDefault();
      const textarea = e.target.querySelector('textarea');
      const text = textarea ? textarea.value.trim() : '';
      if (!text) return toast('Please enter a comment before submitting.');

      const submitBtn = e.target.querySelector('button.primary');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';
      }
      try {
        await api(`/api/tasks/${t.id}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
        await refresh();
        openTask(id);
        toast('Comment added successfully!');
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Add comment';
        }
        toast(err.message || 'Failed to post comment');
      }
    };
  }
}

function invite() {
  modal(`<div class="modal"><div class="modal-head"><h2>Invite teammate to ${esc(state.workspace.name)}</h2><button class="close">×</button></div><form id="invite-form"><div class="field"><label>TEAMMATE NAME</label><input name="name" placeholder="John Doe"></div><div class="field"><label>EMAIL ADDRESS</label><input required type="email" name="email" placeholder="name@company.com"></div><div class="field"><label>ROLE ASSIGNED</label><select name="role"><option value="Workspace member">Workspace member</option><option value="Workspace admin">Workspace admin</option><option value="Viewer">Viewer</option></select></div><div class="modal-foot"><button type="button" class="secondary cancel">Cancel</button><button class="primary">Send invitation</button></div></form></div>`);
  $('#invite-form').onsubmit = async e => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target));
    if (!validateEmail(payload.email)) {
      return toast('Please enter a valid email address.');
    }
    const targetEmail = payload.email.trim().toLowerCase();
    
    if (state.members && state.members.some(m => m.email.toLowerCase() === targetEmail)) {
      return toast('This user is already a member of this workspace!');
    }
    
    if (state.invites && state.invites.some(i => i.email.toLowerCase() === targetEmail && i.status === 'Pending')) {
      return toast('An invitation has already been sent to this email address!');
    }

    try {
      await api('/api/invites', { method: 'POST', body: JSON.stringify(payload) });
      await refresh();
      close();
      toast(`Invitation sent to ${payload.email}!`);
    } catch (err) {
      toast(err.message || 'Failed to send invitation');
    }
  };
}

function checkPendingInvitePrompt() {
  const user = JSON.parse(localStorage.getItem('flowspace_user') || 'null');
  if (!user || !state || !state.pendingInvites || !state.pendingInvites.length) return;

  const dismissedInvites = JSON.parse(localStorage.getItem('flowspace_dismissed_invites') || '[]');
  
  const hash = window.location.hash || '';
  const inviteIdMatch = hash.match(/#invite=([^&]+)/);
  
  let targetInvite = inviteIdMatch 
    ? state.pendingInvites.find(i => i.id === inviteIdMatch[1])
    : null;

  if (!targetInvite) {
    targetInvite = state.pendingInvites.find(i => !dismissedInvites.includes(i.id));
  }

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
          <small style="display:block;color:var(--muted);font-size:11px;margin-top:8px">If closed, you can manage this invitation anytime in Account Settings.</small>
        </div>
        <div class="modal-foot" style="justify-content:center;gap:12px">
          <button class="secondary btn-decline-prompt">Decline</button>
          <button class="primary btn-accept-prompt">Join ${esc(targetInvite.workspaceName)} →</button>
        </div>
      </div>
    `);

    $('.btn-accept-prompt').onclick = async () => {
      try {
        await api('/api/invites/join', { method: 'POST', body: JSON.stringify({ id: targetInvite.id }) });
        toast(`Joined ${targetInvite.workspaceName}!`);
        window.location.hash = '';
        close();
        await refresh();
        setView('overview');
      } catch (err) {
        toast(err.message || 'Failed to join workspace');
      }
    };

    $('.btn-decline-prompt').onclick = async () => {
      try {
        await api('/api/invites/decline', { method: 'POST', body: JSON.stringify({ id: targetInvite.id }) });
        toast('Invitation declined');
        window.location.hash = '';
        close();
        await refresh();
      } catch (err) {
        toast(err.message || 'Failed to decline');
      }
    };
  }
}

function manageWorkspace() {
  modal(`<div class="modal"><div class="modal-head"><h2>Manage workspaces</h2><button class="close">×</button></div><div id="workspace-list">${state.workspaces.map(w => `<div class="invite-row"><div><b>${esc(w.name)}</b><small>${esc(w.description || 'No description')}</small></div>${w.id === state.activeWorkspaceId ? '<span class="tag">Current</span>' : `<button class="secondary select-workspace" data-id="${w.id}">Open</button>`}</div>`).join('')}</div><hr style="border:0;border-top:1px solid #e8ebf2;margin:18px 0"><form id="workspace-form"><div class="field"><label>WORKSPACE NAME</label><input required name="name" value="${esc(state.workspace.name)}"></div><div class="field"><label>DESCRIPTION</label><input name="description" value="${esc(state.workspace.description || '')}"></div><div class="modal-foot"><button class="primary">Rename current workspace</button></div></form><hr style="border:0;border-top:1px solid #e8ebf2;margin:18px 0"><form id="create-workspace"><div class="field"><label>NEW WORKSPACE NAME</label><input required name="name" placeholder="e.g. Client portal"></div><div class="field"><label>DESCRIPTION</label><input name="description" placeholder="What is this workspace for?"></div><div class="modal-foot"><button class="secondary">Create workspace</button></div></form></div>`);
  $$('.select-workspace').forEach(b => b.onclick = async () => {
    await api(`/api/workspaces/${b.dataset.id}/select`, { method: 'POST' });
    await refresh();
    close();
    toast('Workspace switched');
  });
  $('#workspace-form').onsubmit = async e => {
    e.preventDefault();
    await api(`/api/workspaces/${state.workspace.id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    await refresh();
    close();
    toast('Workspace renamed');
  };
  $('#create-workspace').onsubmit = async e => {
    e.preventDefault();
    const newWs = await api('/api/workspaces', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
    if (newWs && (newWs.id || newWs.workspaceId)) {
      const newId = newWs.id || newWs.workspaceId;
      localStorage.setItem('flowspace_active_workspace', newId);
    }
    await refresh();
    close();
    toast('New workspace created');
  };
}

function setView(v) {
  const currentActive = $('.view.active');
  const targetView = $('#' + v);
  
  if (!currentActive || currentActive.id === v) {
    $$('.view').forEach(x => x.classList.toggle('active', x.id === v));
    $$('.nav').forEach(x => x.classList.toggle('active', x.dataset.view === v));
    updateHeaderText(v);
    const activeNavLink = $(`.nav[data-view="${v}"]`);
    if (activeNavLink) setTimeout(() => updateNavIndicator(activeNavLink, true), 50);
    triggerViewEntrance(v);
    return;
  }

  // Fade out current active view content
  gsap.to(currentActive, {
    opacity: 0,
    y: -8,
    duration: 0.15,
    ease: 'power2.in',
    onComplete: () => {
      currentActive.classList.remove('active');
      targetView.classList.add('active');
      $$('.nav').forEach(x => x.classList.toggle('active', x.dataset.view === v));
      updateHeaderText(v);
      const activeNavLink = $(`.nav[data-view="${v}"]`);
      if (activeNavLink) updateNavIndicator(activeNavLink);
      
      // Fade in & slide up target view content
      gsap.fromTo(targetView, 
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'all' }
      );
      
      triggerViewEntrance(v);
    }
  });
}

function updateHeaderText(v) {
  if (v !== 'overview') {
    $('#page-title').textContent = v === 'board' ? 'Project board' : v === 'activity' ? 'Workspace activity' : v === 'team' ? 'Your team' : 'Account settings';
    $('#page-kicker').textContent = state.workspace ? state.workspace.name : 'Flowspace';
  } else {
    timeUI();
  }
}

function updateNavIndicator(target, instant = false) {
  const indicator = $('.nav-indicator');
  const navContainer = $('nav');
  if (!indicator || !target || !navContainer) return;
  
  indicator.style.display = 'block';
  const navBox = navContainer.getBoundingClientRect();
  const targetBox = target.getBoundingClientRect();
  const topOffset = targetBox.top - navBox.top;
  
  gsap.to(indicator, {
    y: topOffset,
    height: targetBox.height,
    duration: instant ? 0 : 0.24,
    ease: 'power2.out',
    overwrite: 'auto'
  });
}

function triggerViewEntrance(v) {
  if (v === 'overview') {
    gsap.fromTo('.stat-grid article', 
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
    );
    gsap.fromTo('.dashboard-grid .card', 
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out', delay: 0.1, clearProps: 'all' }
    );
    animateDonut();
  } else if (v === 'board') {
    gsap.fromTo('#board-columns .column', 
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out', clearProps: 'all' }
    );
    gsap.fromTo('.task-card', 
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.02, ease: 'power1.out', delay: 0.15, clearProps: 'all' }
    );
  } else if (v === 'team') {
    gsap.fromTo('.member-card', 
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
    );
    gsap.fromTo('.invites', 
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', delay: 0.2, clearProps: 'all' }
    );
  } else if (v === 'activity') {
    gsap.fromTo('#full-activity .activity-row', 
      { opacity: 0, x: -10 },
      { opacity: 1, x: 0, duration: 0.35, stagger: 0.03, ease: 'power1.out', clearProps: 'all' }
    );
  } else if (v === 'account') {
    gsap.fromTo('.account-card, .invitations-card', 
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out', clearProps: 'all' }
    );
  }
}

function animateDonut() {
  const ts = currentTasks(), total = ts.length, done = ts.filter(t => t.status === 'done').length, pct = total ? Math.round(done / total * 100) : 0;
  
  const obj = { factor: 0 };
  const donutVal = $('#donut-value');
  const donutEl = $('#donut');
  const heroRing = $('.orbit-core');
  
  gsap.to(obj, {
    factor: 1,
    duration: 1.2,
    ease: 'power2.out',
    onUpdate: () => {
      const f = obj.factor;
      if (donutVal) donutVal.textContent = Math.round(pct * f) + '%';
      
      let cursor = 0;
      const segments = [];
      statuses.forEach(([k, , color]) => {
        const share = total ? (ts.filter(t => t.status === k).length / total * 100) : 0;
        if (share > 0) {
          const end = cursor + share * f;
          segments.push(`${color} ${cursor}% ${end}%`);
          cursor = end;
        }
      });
      
      const trailingSegment = `#e2e8f0 ${cursor}% 100%`;
      const liveGradient = segments.length ? `conic-gradient(${segments.join(',')}, ${trailingSegment})` : '#e2e8f0';
      
      if (donutEl) donutEl.style.background = liveGradient;
      
      if (heroRing) {
        const currentDonePct = pct * f;
        heroRing.style.background = `radial-gradient(circle at center, #ffffff 0 56%, transparent 57%), conic-gradient(#10b981 0 ${currentDonePct}%, #e2e8f0 ${currentDonePct}% 100%)`;
        heroRing.innerHTML = `${Math.round(currentDonePct)}%<small>complete</small>`;
      }
    }
  });
}

function connectLive() {
  if (window.location.hostname.includes('netlify') || window.location.protocol === 'file:') return;
  if (liveSource) {
    try { liveSource.close(); } catch(e) {}
    liveSource = null;
  }
  try {
    liveSource = new EventSource('/api/live');
    liveSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'state') {
          await refresh();
          if (activeTask && $('#modal-backdrop').classList.contains('show') && $('.task-detail') !== null) {
            const updatedTask = state.tasks.find(t => t.id === activeTask.id);
            if (updatedTask) {
              const commentTextarea = $('#comment-form textarea');
              const commentFocused = commentTextarea && document.activeElement === commentTextarea;
              let currentCommentText = commentTextarea ? commentTextarea.value : '';
              openTask(updatedTask.id);
              const newCommentTextarea = $('#comment-form textarea');
              if (newCommentTextarea) {
                newCommentTextarea.value = currentCommentText;
                if (commentFocused) newCommentTextarea.focus();
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse live state:', e);
      }
    };
    liveSource.onerror = () => {
      try { liveSource.close(); } catch(e) {}
      liveSource = null;
    };
  } catch (e) {}
}

async function init() {
  // Wire theme switcher controls
  $$('.theme-toggle').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation(); // Prevent bubble to profile parent click
      const icon = btn.querySelector('.theme-toggle-icon');
      if (icon) gsap.to(icon, { rotation: '+=180', duration: 0.35, ease: 'power2.out' });
      toggleTheme();
    };
  });
  updateThemeUI(localStorage.getItem('flowspace_theme') || 'dark');

  // Auth logic check
  const loggedInUser = localStorage.getItem('flowspace_user');
  if (loggedInUser) {
    state = null;
    activeTask = null;
    await refresh();
    toggleAuthShell(true);
    connectLive();
    
    // Live auto-refresh polling with non-overlapping execution lock
    let isPolling = false;
    setInterval(async () => {
      const u = localStorage.getItem('flowspace_user');
      if (u && !document.hidden && !isPolling && !$('#modal-backdrop').classList.contains('show') && !$('#auth-backdrop').classList.contains('show')) {
        isPolling = true;
        try {
          const fresh = await api('/api/state');
          if (fresh && (
              JSON.stringify(fresh.members) !== JSON.stringify(state.members) ||
              JSON.stringify(fresh.invites) !== JSON.stringify(state.invites) ||
              JSON.stringify(fresh.tasks) !== JSON.stringify(state.tasks) ||
              JSON.stringify(fresh.activity) !== JSON.stringify(state.activity) ||
              JSON.stringify(fresh.notifications) !== JSON.stringify(state.notifications) ||
              JSON.stringify(fresh.receivedInvites) !== JSON.stringify(state.receivedInvites))) {
            state = fresh;
            render();
          }
        } catch (e) {} finally {
          isPolling = false;
        }
      }
    }, 4500);
    // Entrance animations for authenticated view
    gsap.fromTo('.sidebar', 
      { x: -270 },
      { x: 0, duration: 0.65, ease: 'power3.out', clearProps: 'all' }
    );
    gsap.fromTo('main header', 
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', delay: 0.1, clearProps: 'all' }
    );
    setView('overview');
  } else {
    toggleAuthShell(false);
    // Entrance animations for guest view
    gsap.fromTo('.landing-hero > *', 
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out', clearProps: 'all' }
    );
    gsap.fromTo('.feature-card', 
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'power2.out', delay: 0.3, clearProps: 'all' }
    );
  }

  // Check if URL hash contains password recovery token
  handlePasswordResetToken();

  // Auth button wiring
  $('#landing-login-btn').onclick = showLogin;
  $('#landing-signup-btn').onclick = showSignup;
  $('#hero-get-started-btn').onclick = showSignup;

  // Sidebar controls
  $$('.nav').forEach(n => n.onclick = () => setView(n.dataset.view));
  $$('[data-go]').forEach(b => b.onclick = () => setView(b.dataset.go));
  $('.brand').onclick = () => {
    const user = localStorage.getItem('flowspace_user');
    if (user) setView('overview');
  };
  $('.brand').style.cursor = 'pointer';
  
  $('#new-task-btn').onclick = openNew;
  $('#invite-btn').onclick = invite;
  $('#team-invite').onclick = invite;
  $('#workspace-btn').onclick = manageWorkspace;
  $('#manage-workspace').onclick = manageWorkspace;
  $('#assignee-filter').onchange = renderBoard;
  $('#priority-filter').onchange = renderBoard;
  
  $('#notify-btn').onclick = (e) => {
    e.stopPropagation();
    const popover = $('#notification-popover');
    if (!popover) return;
    const isHidden = popover.style.display === 'none';
    popover.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      renderNotifications();
    }
  };

  const closeBtn = $('#close-notify-btn');
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      const popover = $('#notification-popover');
      if (popover) popover.style.display = 'none';
    };
  }

  const markAllBtn = $('#mark-all-read-btn');
  if (markAllBtn) {
    markAllBtn.onclick = async (e) => {
      e.stopPropagation();
      await api('/api/notifications/read', { method: 'PATCH' });
      await refresh();
      toast('Notifications marked as read');
    };
  }

  document.addEventListener('click', (e) => {
    const popover = $('#notification-popover');
    if (popover && popover.style.display !== 'none') {
      if (!e.target.closest('.notification-wrapper')) {
        popover.style.display = 'none';
      }
    }
  });

  // Profile triggers account view
  $('#user-profile').onclick = () => setView('account');
  const settingsBtn = $('#settings-btn');
  if (settingsBtn) {
    settingsBtn.onclick = (e) => {
      e.stopPropagation();
      setView('account');
    };
  }

  // Wire all password show/hide eye toggles globally
  wirePasswordToggles();

  if ($('#acc-forgot-password-link')) {
    $('#acc-forgot-password-link').onclick = () => {
      showForgotPasswordModal();
    };
  }

  // Form submit for account details
  $('#account-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    
    if (data.password || $('#acc-confirm-password').value || data.currentPassword) {
      if (!data.currentPassword) {
        return toast('Please enter your current password to update your password.');
      }
      if (!data.password) {
        return toast('Please enter a new password.');
      }
      if (data.password !== $('#acc-confirm-password').value) {
        return toast('New password and confirmation do not match.');
      }
      const pwdErr = validatePassword(data.password);
      if (pwdErr) {
        return toast(pwdErr);
      }
    } else {
      delete data.password;
      delete data.currentPassword;
    }

    try {
      const updated = await api('/api/account', { method: 'PATCH', body: JSON.stringify(data) });
      const cur = JSON.parse(localStorage.getItem('flowspace_user'));
      cur.name = updated.name;
      cur.email = updated.email;
      localStorage.setItem('flowspace_user', JSON.stringify(cur));
      if ($('#acc-current-password')) $('#acc-current-password').value = '';
      if ($('#acc-password')) $('#acc-password').value = '';
      if ($('#acc-confirm-password')) $('#acc-confirm-password').value = '';
      toast('Profile & Security settings updated successfully!');
      await refresh();
    } catch (err) {
      toast(err.message || 'Failed to update profile');
    }
  };

  // Logout wiring
  $('#logout-btn').onclick = () => {
    localStorage.removeItem('flowspace_user');
    localStorage.removeItem('flowspace_active_workspace');
    localStorage.removeItem('flowspace_active_project');
    localStorage.removeItem('flowspace_static_db');
    state = null;
    activeTask = null;

    if ($('#board-columns')) $('#board-columns').innerHTML = '';
    if ($('#team-grid')) $('#team-grid').innerHTML = '';
    if ($('#full-activity')) $('#full-activity').innerHTML = '';
    if ($('#notifications-list')) $('#notifications-list').innerHTML = '';

    if (liveSource) {
      try { liveSource.close(); } catch(e) {}
      liveSource = null;
    }
    toggleAuthShell(false);
    toast('Logged out successfully');
  };

  // Backdrop actions
  $('#modal-backdrop').onclick = e => {
    if (e.target.id === 'modal-backdrop') close();
  };
  $('#auth-backdrop').onclick = e => {
    if (e.target.id === 'auth-backdrop') $('#auth-backdrop').classList.remove('show');
  };

  // Dynamic delegation hover animations for cards
  document.addEventListener('mouseover', e => {
    const card = e.target.closest('.task-card, .feature-card, .member-card');
    if (card) {
      gsap.to(card, {
        y: -4,
        boxShadow: '0 12px 24px rgba(49, 46, 129, 0.08)',
        borderColor: 'rgba(99, 102, 241, 0.25)',
        duration: 0.2,
        overwrite: 'auto'
      });
    }
  });

  document.addEventListener('mouseout', e => {
    const card = e.target.closest('.task-card, .feature-card, .member-card');
    if (card) {
      gsap.to(card, {
        y: 0,
        boxShadow: '0 4px 10px rgba(49, 46, 129, 0.02)',
        borderColor: 'rgba(226, 232, 240, 0.9)',
        duration: 0.2,
        overwrite: 'auto',
        clearProps: 'transform'
      });
    }
  });

  // Sidebar specific hover effects
  const brand = $('.brand');
  if (brand) {
    brand.addEventListener('mouseenter', () => {
      gsap.to('.brand-mark', { rotation: 180, scale: 1.12, duration: 0.5, ease: 'back.out(1.5)' });
      gsap.to(brand, { color: 'var(--primary)', duration: 0.2 });
    });
    brand.addEventListener('mouseleave', () => {
      gsap.to('.brand-mark', { rotation: 0, scale: 1, duration: 0.4, ease: 'power2.out' });
      gsap.to(brand, { color: 'var(--ink)', duration: 0.2 });
    });
  }

  const wsBtn = $('#workspace-btn');
  if (wsBtn) {
    wsBtn.addEventListener('mouseenter', () => {
      gsap.to('#workspace-btn .chevron', { rotate: 180, duration: 0.25, ease: 'power2.out' });
    });
    wsBtn.addEventListener('mouseleave', () => {
      gsap.to('#workspace-btn .chevron', { rotate: 0, duration: 0.25, ease: 'power2.out' });
    });
  }

  const profile = $('#user-profile');
  if (profile) {
    profile.addEventListener('mouseenter', () => {
      gsap.to('#profile-settings-gear', { rotation: 90, duration: 0.4, ease: 'power2.out' });
    });
    profile.addEventListener('mouseleave', () => {
      gsap.to('#profile-settings-gear', { rotation: 0, duration: 0.4, ease: 'power2.out' });
    });
  }

  const navContainer = $('nav');
  if (navContainer) {
    navContainer.addEventListener('mouseover', e => {
      const navItem = e.target.closest('.nav');
      if (navItem) updateNavIndicator(navItem);
    });
    navContainer.addEventListener('mouseleave', () => {
      const activeNav = $('.nav.active');
      if (activeNav) updateNavIndicator(activeNav);
    });
  }

  setInterval(timeUI, 30000);
}

init().catch(e => {
  console.warn('Initialization notice:', e);
});
