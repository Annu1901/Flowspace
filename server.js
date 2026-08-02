const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'data.json');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ovvbrwqyjdeomzezhacu.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_3UnL1xJOnf9cLMaLTd-zJA_ztW4WeRy';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const seed = () => ({
  workspace: { id: 'workspace-1', name: 'Northstar Studio', description: 'The product team workspace', createdAt: now() },
  workspaces: [{ id: 'workspace-1', name: 'Northstar Studio', description: 'The product team workspace', createdAt: now() }],
  activeWorkspaceId: 'workspace-1',
  members: [
    { id: 'm1', name: 'Annu Dagar', email: 'annu@northstar.dev', initials: 'AD', color: '#7c3aed' },
    { id: 'm2', name: 'Ayush Mishra', email: 'ayush@northstar.dev', initials: 'AM', color: '#0ea5e9' },
    { id: 'm3', name: 'Maya Chen', email: 'maya@northstar.dev', initials: 'MC', color: '#f97316' }
  ],
  invites: [],
  tasks: [
    { id: 't1', title: 'Design the onboarding flow', description: 'Map first-run screens and handoff states.', status: 'todo', priority: 'high', assigneeId: 'm1', dueDate: '2026-07-18', tags: ['Design'], comments: [], attachments: [], createdAt: now(), updatedAt: now() },
    { id: 't2', title: 'Set up authentication endpoints', description: 'Create secure sign-in and workspace access APIs.', status: 'progress', priority: 'urgent', assigneeId: 'm2', dueDate: '2026-07-16', tags: ['Backend'], comments: [], attachments: [], createdAt: now(), updatedAt: now() },
    { id: 't3', title: 'Write launch announcement', description: 'Draft concise copy for the public release.', status: 'review', priority: 'medium', assigneeId: 'm3', dueDate: '2026-07-21', tags: ['Content'], comments: [], attachments: [], createdAt: now(), updatedAt: now() },
    { id: 't4', title: 'Audit dashboard accessibility', description: 'Review keyboard paths and contrast.', status: 'done', priority: 'low', assigneeId: 'm1', dueDate: '2026-07-12', tags: ['Quality'], comments: [], attachments: [], createdAt: now(), updatedAt: now() }
  ],
  activity: [
    { id: id(), actor: 'Ayush Mishra', action: 'created the workspace', task: '', at: now() },
    { id: id(), actor: 'Annu Dagar', action: 'completed', task: 'Audit dashboard accessibility', at: now() }
  ],
  notifications: [ { id: id(), text: 'Authentication endpoints are due in 2 days.', read: false, at: now() } ]
});
let clients = [];
function broadcast(data) {
  const payload = JSON.stringify({ type: 'state', state: data });
  clients.forEach(c => {
    try {
      c.write(`data: ${payload}\n\n`);
    } catch (e) {
      // client connection might be dead
    }
  });
}
function load() { try { const d=JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); if(!d.workspaces){d.workspaces=[d.workspace];d.activeWorkspaceId=d.workspace.id;d.tasks.forEach(t=>t.workspaceId=d.workspace.id);d.invites.forEach(i=>i.workspaceId=d.workspace.id);save(d)} d.workspace=d.workspaces.find(w=>w.id===d.activeWorkspaceId)||d.workspaces[0]; if (d.members) { d.members.forEach(m => { if (!m.workspaceId) m.workspaceId = 'workspace-1'; }); } return d; } catch { const d = seed(); d.tasks.forEach(t=>t.workspaceId=d.workspace.id); save(d); return d; } }
function save(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); broadcast(data); }
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
function serve(res, file) { const ext = path.extname(file); const type = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html'; fs.readFile(path.join(ROOT, 'public', file), (e, data) => e ? (res.writeHead(404), res.end('Not found')) : (res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' }), res.end(data))); }
function log(data, actor, action, task='') { data.activity.unshift({ id: id(), actor, action, task, at: now() }); data.activity = data.activity.slice(0, 60); }
function notify(data, text, targetEmail = null) { data.notifications.unshift({ id: id(), text, read: false, at: now(), targetEmail }); }
async function body(req) { let raw=''; for await (const c of req) raw += c; return raw ? JSON.parse(raw) : {}; }

function getCurrentUser(req, data) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return data.users?.[0] || { id: 'u1', name: 'Annu Dagar', email: 'annu@northstar.dev' };
  }
  return data.users?.find(u => u.id === userId) || null;
}
const currentUser = (req, data) => getCurrentUser(req, data)?.name || 'Annu Dagar';

function getCallerRole(req, data, wsId) {
  const u = getCurrentUser(req, data);
  if (!u) return 'Viewer';
  const userRecord = data.users.find(x => x.id === u.id);
  const activeWsId = wsId || userRecord?.activeWorkspaceId || 'workspace-1';
  const m = data.members.find(x => x.workspaceId === activeWsId && x.email.toLowerCase() === u.email.toLowerCase());
  return m?.role || 'Workspace member';
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`); const parts = url.pathname.split('/').filter(Boolean); let data = load();
  if (req.method === 'GET' && url.pathname === '/api/live') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('\n');
    clients.push(res);
    req.on('close', () => {
      clients = clients.filter(c => c !== res);
    });
    return;
  }

  // 1. Authentication Endpoints (Public)
  if (req.method === 'GET' && url.pathname === '/api/auth/config') {
    return json(res, 200, {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/reset-password') {
    const b = await body(req);
    if (!b.email || !b.password) return json(res, 400, { error: 'Email and new password are required' });
    if (!data.users) data.users = [];
    const u = data.users.find(x => x.email.toLowerCase() === b.email.toLowerCase());
    if (u) {
      u.password = b.password;
      save(data);
    }
    return json(res, 200, { ok: true, message: 'Password updated successfully' });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const b = await body(req);
    if (!b.email || !b.password) return json(res, 400, { error: 'Email and password are required' });
    const cleanEmail = b.email.trim().toLowerCase();
    
    if (!data.users) data.users = [];
    let u = data.users.find(x => x.email.toLowerCase() === cleanEmail);

    // If user is not in in-memory list, check Supabase members table
    if (!u && supabase) {
      try {
        const { data: mems } = await supabase.from('members').select('*').eq('email', cleanEmail);
        if (mems && mems.length > 0) {
          const mem = mems[0];
          u = { id: mem.id || id(), name: mem.name || cleanEmail.split('@')[0], email: cleanEmail, password: b.password, activeWorkspaceId: mem.workspace_id };
          data.users.push(u);
          save(data);
        }
      } catch (e) {}
    }

    // Fallback: If valid email input and not blocked, authenticate cleanly
    if (!u) {
      const name = cleanEmail.split('@')[0];
      const wsId = id();
      const ws = { id: wsId, name: `${name}'s Workspace`, description: 'Default workspace', createdAt: now() };
      u = { id: id(), name: name, email: cleanEmail, password: b.password, activeWorkspaceId: wsId };
      data.users.push(u);
      if (!data.workspaces.some(w => w.id === wsId)) data.workspaces.push(ws);
      save(data);
    }

    return json(res, 200, { id: u.id, name: u.name, email: u.email });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/signup') {
    const b = await body(req);
    if (!b.name || !b.email || !b.password) return json(res, 400, { error: 'Name, email, and password are required' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = b.email.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) return json(res, 400, { error: 'Please enter a valid email address.' });
    if (b.password.length < 8 || !/[0-9]/.test(b.password) || !/[A-Z]/.test(b.password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(b.password)) {
      return json(res, 400, { error: 'Password must be at least 8 characters long, contain at least 1 number, 1 uppercase letter, and 1 special character.' });
    }
    if (!data.users) data.users = [];
    let u = data.users.find(x => x.email.toLowerCase() === cleanEmail);
    if (!u) {
      const ws = { id: id(), name: `${b.name.trim()}'s Workspace`, description: 'Your default workspace', createdAt: now() };
      u = { id: id(), name: b.name.trim(), email: cleanEmail, password: b.password, activeWorkspaceId: ws.id };
      data.users.push(u);
      data.workspaces.push(ws);
      const member = {
        id: id(),
        workspaceId: ws.id,
        name: u.name,
        email: cleanEmail,
        initials: u.name.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2),
        color: '#7c3aed',
        role: 'Workspace admin'
      };
      data.members.push(member);
      log(data, u.name, 'signed up and created a default workspace');
      save(data);

      if (supabase) {
        try {
          const { data: newWs } = await supabase.from('workspaces').insert([{ name: ws.name, description: ws.description }]).select();
          if (newWs && newWs[0]) {
            await supabase.from('members').insert([{ workspace_id: newWs[0].id, name: u.name, email: cleanEmail, initials: u.name.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2), color: '#7c3aed', role: 'Workspace admin' }]);
          }
        } catch (e) {}
      }
    }
    return json(res, 201, { id: u.id, name: u.name, email: u.email });
  }

  // Verify Auth for all other API endpoints
  if (parts[0] === 'api') {
    const user = getCurrentUser(req, data);
    if (!user) return json(res, 401, { error: 'Unauthorized' });

    // 2. Fetch Multi-tenant State from Supabase PostgreSQL Database
    if (req.method === 'GET' && url.pathname === '/api/state') {
      try {
        const userEmail = user.email.toLowerCase();
        // 1. Get member records for user email to find all joined workspaces
        const { data: userMems } = await supabase.from('members').select('*').eq('email', userEmail);
        let wsIds = (userMems || []).map(m => m.workspace_id || m.workspaceId);

        let userWorkspaces = [];
        if (wsIds.length > 0) {
          const { data: wsData } = await supabase.from('workspaces').select('*').in('id', wsIds);
          userWorkspaces = wsData || [];
        }

        const userRecord = data.users?.find(u => u.id === user.id || u.email.toLowerCase() === userEmail);
        let activeId = userRecord?.activeWorkspaceId;
        if (!activeId || !userWorkspaces.some(w => w.id === activeId)) {
          activeId = userWorkspaces[0]?.id || '';
        }
        const activeWorkspace = userWorkspaces.find(w => w.id === activeId) || userWorkspaces[0] || null;

        let workspaceMembers = [], workspaceTasks = [], workspaceProjects = [], workspaceInvites = [];
        if (activeId) {
          const { data: mems } = await supabase.from('members').select('*').eq('workspace_id', activeId);
          const memMap = new Map();
          (mems || []).forEach(m => {
            const key = (m.email || '').toLowerCase();
            if (!memMap.has(key)) {
              memMap.set(key, { ...m, workspaceId: m.workspace_id || m.workspaceId });
            }
          });
          workspaceMembers = Array.from(memMap.values());

          const { data: tsks } = await supabase.from('tasks').select('*').eq('workspace_id', activeId);
          workspaceTasks = (tsks || []).map(t => ({
            ...t,
            workspaceId: t.workspace_id || t.workspaceId,
            projectId: t.project_id || t.projectId,
            assigneeId: t.assignee_id || t.assigneeId,
            createdBy: (t.created_by || t.createdBy || '').toLowerCase(),
            dueDate: t.due_date || t.dueDate,
            attachments: t.attachments || [],
            comments: t.comments || []
          }));

          const { data: projs } = await supabase.from('projects').select('*').eq('workspace_id', activeId);
          workspaceProjects = (projs || []).map(p => ({ ...p, workspaceId: p.workspace_id || p.workspaceId }));

          const { data: invs } = await supabase.from('invites').select('*').eq('workspace_id', activeId);
          const invMap = new Map();
          (invs || []).forEach(i => {
            const key = (i.email || '').toLowerCase();
            if (!invMap.has(key)) {
              invMap.set(key, { ...i, workspaceId: i.workspace_id || i.workspaceId });
            }
          });
          workspaceInvites = Array.from(invMap.values());
        }

        let workspaceActivity = [], workspaceNotifications = [];
        if (activeId) {
          const { data: actData } = await supabase.from('activity').select('*').eq('workspace_id', activeId).order('at', { ascending: false });
          workspaceActivity = (actData || []).map(a => ({ ...a, workspaceId: a.workspace_id || a.workspaceId }));

          const { data: notifData } = await supabase.from('notifications').select('*').eq('workspace_id', activeId).order('at', { ascending: false });
          workspaceNotifications = (notifData || [])
            .filter(n => {
              const target = (n.target_email || n.targetEmail || '').toLowerCase();
              return !target || target === userEmail;
            })
            .map(n => ({ ...n, workspaceId: n.workspace_id || n.workspaceId, targetEmail: n.target_email || n.targetEmail }));
        }

        const { data: recInvs } = await supabase.from('invites').select('*').eq('email', userEmail);
        let receivedInvites = [];
        if (recInvs && recInvs.length > 0) {
          const allWsIds = recInvs.map(i => i.workspace_id || i.workspaceId);
          const { data: invWs } = await supabase.from('workspaces').select('*').in('id', allWsIds);
          const wsMap = new Map((invWs || []).map(w => [w.id, w.name]));
          receivedInvites = recInvs.map(i => ({
            ...i,
            workspaceId: i.workspace_id || i.workspaceId,
            workspaceName: wsMap.get(i.workspace_id || i.workspaceId) || i.workspaceName || 'Unknown Workspace'
          }));
        }

        return json(res, 200, {
          workspace: activeWorkspace,
          workspaces: userWorkspaces,
          activeWorkspaceId: activeId,
          projects: workspaceProjects,
          members: workspaceMembers,
          invites: workspaceInvites,
          tasks: workspaceTasks,
          activity: workspaceActivity,
          notifications: workspaceNotifications,
          receivedInvites: receivedInvites,
          user: user
        });
      } catch (err) {
        console.error('Supabase query error in server.js:', err);
      }
    }

    // 3. Edit Account Profile
    if (req.method === 'PATCH' && url.pathname === '/api/account') {
      const b = await body(req);
      const userRecord = data.users.find(u => u.id === user.id);
      if (!userRecord) return json(res, 404, { error: 'User record not found' });
      userRecord.name = b.name?.trim() || userRecord.name;
      userRecord.email = b.email?.trim() || userRecord.email;
      if (b.password) userRecord.password = b.password;
      data.members.forEach(m => {
        if (m.email.toLowerCase() === user.email.toLowerCase()) {
          m.name = userRecord.name;
          m.email = userRecord.email;
          m.initials = userRecord.name.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2);
          if (b.color) m.color = b.color;
          if (b.role) m.role = b.role;
        }
      });
      log(data, userRecord.name, 'updated their profile');
      save(data);
      return json(res, 200, { id: userRecord.id, name: userRecord.name, email: userRecord.email });
    }

    // 4. Accept/Decline Invitations
    if (req.method === 'POST' && url.pathname === '/api/invites/join') {
      const b = await body(req);
      const invite = data.invites.find(i => i.id === b.id);
      if (!invite) return json(res, 404, { error: 'Invitation not found' });
      if (invite.email.toLowerCase() !== user.email.toLowerCase()) return json(res, 403, { error: 'This invitation was not sent to you' });
      invite.status = 'Accepted';
      const alreadyMember = data.members.some(m => m.workspaceId === invite.workspaceId && m.email.toLowerCase() === user.email.toLowerCase());
      if (!alreadyMember) {
        const member = {
          id: id(),
          workspaceId: invite.workspaceId,
          name: user.name,
          email: user.email,
          initials: user.name.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2),
          color: '#0ea5e9',
          role: invite.role || 'Member'
        };
        data.members.push(member);
      }
      const userRecord = data.users.find(u => u.id === user.id);
      if (userRecord) {
        userRecord.activeWorkspaceId = invite.workspaceId;
      }
      log(data, user.name, 'joined the workspace via invite');
      save(data);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/invites/decline') {
      const b = await body(req);
      const invite = data.invites.find(i => i.id === b.id);
      if (!invite) return json(res, 404, { error: 'Invitation not found' });
      if (invite.email.toLowerCase() !== user.email.toLowerCase()) return json(res, 403, { error: 'This invitation was not sent to you' });
      invite.status = 'Declined';
      
      // Purge member record for this workspace
      data.members = data.members.filter(m => !(m.workspaceId === invite.workspaceId && m.email.toLowerCase() === user.email.toLowerCase()));
      
      // Switch active workspace if user was viewing the declined workspace
      const userRecord = data.users.find(u => u.id === user.id);
      const userWorkspaces = data.workspaces.filter(w => 
        data.members.some(m => m.workspaceId === w.id && m.email.toLowerCase() === user.email.toLowerCase())
      );
      if (userRecord && userRecord.activeWorkspaceId === invite.workspaceId) {
        userRecord.activeWorkspaceId = userWorkspaces[0]?.id || '';
      }

      log(data, user.name, 'declined invitation to workspace');
      save(data);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'DELETE' && parts[0] === 'api' && parts[1] === 'invites' && parts[2]) {
      const inviteId = parts[2];
      const invite = data.invites.find(i => i.id === inviteId);
      if (!invite) return json(res, 404, { error: 'Invitation not found' });
      if (getCallerRole(req, data, invite.workspaceId) !== 'Workspace admin') {
        return json(res, 403, { error: 'Only workspace admins can revoke invitations' });
      }
      data.invites = data.invites.filter(i => i.id !== inviteId);
      data.members = data.members.filter(m => !(m.workspaceId === invite.workspaceId && m.email.toLowerCase() === invite.email.toLowerCase()));
      save(data);
      return json(res, 200, { ok: true });
    }

    // 5. Workspaces
    if (req.method === 'POST' && url.pathname === '/api/workspaces') {
      const b = await body(req);
      const wsName = b.name?.trim() || 'Untitled workspace';
      const wsDesc = b.description?.trim() || '';
      let workspace = { id: id(), name: wsName, description: wsDesc, createdAt: now() };
      data.workspaces.push(workspace);

      const userRecord = data.users?.find(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
      if (userRecord) {
        userRecord.activeWorkspaceId = workspace.id;
      }

      const member = {
        id: id(),
        workspaceId: workspace.id,
        name: user.name,
        email: user.email.toLowerCase(),
        initials: user.name.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2),
        color: '#7c3aed',
        role: 'Workspace admin'
      };
      data.members.push(member);
      log(data, user.name, 'created workspace', workspace.name);
      save(data);

      if (supabase) {
        try {
          const { data: newWs } = await supabase.from('workspaces').insert([{ name: wsName, description: wsDesc }]).select();
          if (newWs && newWs[0]) {
            workspace.id = newWs[0].id;
            await supabase.from('members').insert([{
              workspace_id: newWs[0].id,
              name: user.name,
              email: user.email.toLowerCase(),
              initials: user.name.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2),
              color: '#7c3aed',
              role: 'Workspace admin'
            }]);
          }
        } catch (e) {
          console.error('Supabase workspace creation error:', e);
        }
      }

      return json(res, 201, workspace);
    }
    if (req.method === 'PATCH' && parts[0]==='api' && parts[1]==='workspaces' && parts[2]) {
      if (getCallerRole(req, data, parts[2]) !== 'Workspace admin') return json(res, 403, { error: 'Only workspace admins can modify workspace settings' });
      const w=data.workspaces.find(x=>x.id===parts[2]);
      if(!w)return json(res,404,{error:'Workspace not found'});
      const b=await body(req);
      Object.assign(w,{name:b.name?.trim()||w.name,description:b.description??w.description});
      data.workspace=w;
      log(data,user.name,'renamed workspace',w.name);
      save(data);
      return json(res,200,w);
    }
    if (req.method === 'POST' && parts[0]==='api' && parts[1]==='workspaces' && parts[3] === 'select') {
      const w=data.workspaces.find(x=>x.id===parts[2]);
      if(!w)return json(res,404,{error:'Workspace not found'});
      const isMember = data.members.some(m => m.workspaceId === parts[2] && m.email.toLowerCase() === user.email.toLowerCase());
      if (!isMember) return json(res, 403, { error: 'Access denied to workspace' });
      const userRecord = data.users.find(u => u.id === user.id);
      if (userRecord) {
        userRecord.activeWorkspaceId = w.id;
      }
      save(data);
      return json(res,200,w);
    }

    // Member Role Management
    if (req.method === 'PATCH' && parts[0] === 'api' && parts[1] === 'members' && parts[2]) {
      if (getCallerRole(req, data) !== 'Workspace admin') return json(res, 403, { error: 'Only workspace admins can manage member roles' });
      const memberId = parts[2];
      const member = data.members.find(m => m.id === memberId);
      if (!member) return json(res, 404, { error: 'Member not found' });
      const b = await body(req);
      if (b.role) {
        member.role = b.role;
        log(data, user.name, `assigned ${member.name} as ${b.role}`);
        notify(data, `${user.name} updated ${member.name}'s role to ${b.role}.`, member.email);
        save(data);
        return json(res, 200, member);
      }
      return json(res, 400, { error: 'Role is required' });
    }

    if (req.method === 'DELETE' && parts[0] === 'api' && parts[1] === 'members' && parts[2]) {
      if (getCallerRole(req, data) !== 'Workspace admin') return json(res, 403, { error: 'Only workspace admins can remove members' });
      const memberId = parts[2];
      const member = data.members.find(m => m.id === memberId);
      if (!member) return json(res, 404, { error: 'Member not found' });
      if (member.email.toLowerCase() === user.email.toLowerCase()) {
        return json(res, 400, { error: 'You cannot remove yourself from the workspace' });
      }
      data.members = data.members.filter(m => m.id !== memberId);
      log(data, user.name, `removed ${member.name} from workspace`);
      save(data);
      return json(res, 200, { ok: true });
    }

    // 5.5 Projects API
    if (req.method === 'GET' && url.pathname === '/api/projects') {
      const userRecord = data.users.find(u => u.id === user.id);
      const activeWsId = userRecord?.activeWorkspaceId || 'workspace-1';
      if (!data.projects) data.projects = [];
      const projects = data.projects.filter(p => p.workspaceId === activeWsId);
      return json(res, 200, projects);
    }
    if (req.method === 'POST' && url.pathname === '/api/projects') {
      const userRecord = data.users.find(u => u.id === user.id);
      const activeWsId = userRecord?.activeWorkspaceId || 'workspace-1';
      if (getCallerRole(req, data, activeWsId) !== 'Workspace admin') {
        return json(res, 403, { error: 'Only workspace admins can create projects' });
      }
      const b = await body(req);
      if (!data.projects) data.projects = [];
      const project = {
        id: id(),
        workspaceId: activeWsId,
        name: b.name?.trim() || 'Untitled project',
        description: b.description?.trim() || '',
        createdAt: now(),
        updatedAt: now()
      };
      data.projects.push(project);
      log(data, user.name, 'created project', project.name);
      notify(data, `${user.name} created project "${project.name}"`);
      save(data);
      return json(res, 201, project);
    }
    if (parts[0] === 'api' && parts[1] === 'projects' && parts[2]) {
      if (!data.projects) data.projects = [];
      const proj = data.projects.find(p => p.id === parts[2]);
      if (!proj) return json(res, 404, { error: 'Project not found' });
      if (req.method === 'PATCH' && parts.length === 3) {
        if (getCallerRole(req, data, proj.workspaceId) !== 'Workspace admin') {
          return json(res, 403, { error: 'Only workspace admins can rename projects' });
        }
        const b = await body(req);
        if (b.name) proj.name = b.name.trim();
        if (b.description !== undefined) proj.description = b.description.trim();
        proj.updatedAt = now();
        log(data, user.name, 'renamed project to', proj.name);
        notify(data, `${user.name} updated project "${proj.name}"`);
        save(data);
        return json(res, 200, proj);
      }
      if (req.method === 'DELETE' && parts.length === 3) {
        if (getCallerRole(req, data, proj.workspaceId) !== 'Workspace admin') {
          return json(res, 403, { error: 'Only workspace admins can delete projects' });
        }
        data.projects = data.projects.filter(p => p.id !== proj.id);
        data.tasks = data.tasks.filter(t => t.projectId !== proj.id);
        log(data, user.name, 'deleted project', proj.name);
        save(data);
        return json(res, 200, { ok: true });
      }
    }

    // 6. Tasks
    if (req.method === 'POST' && url.pathname === '/api/tasks') {
      if (getCallerRole(req, data) === 'Viewer') return json(res, 403, { error: 'Viewers have read-only access and cannot create tasks' });
      const b = await body(req);
      const userRecord = data.users.find(u => u.id === user.id);
      const activeWsId = userRecord?.activeWorkspaceId || 'workspace-1';
      if (!data.projects) data.projects = [];
      const wsProjects = data.projects.filter(p => p.workspaceId === activeWsId);
      const projId = b.projectId || wsProjects[0]?.id || '';
      const proj = data.projects.find(p => p.id === projId);
      const task = { id:id(), workspaceId:activeWsId, projectId:projId, title:b.title?.trim() || 'Untitled task', description:b.description || '', status:b.status || 'todo', priority:b.priority || 'medium', assigneeId:b.assigneeId || '', createdBy: user ? user.email.toLowerCase() : '', dueDate:b.dueDate || '', tags:b.tags || [], comments:[], attachments:[], createdAt:now(), updatedAt:now() };
      data.tasks.push(task);
      log(data, user.name, 'created task', `${task.title}${proj ? ` in ${proj.name}` : ''}`);
      if (task.assigneeId) {
        const m = data.members.find(x => x.id === task.assigneeId);
        if (m && m.email) {
          notify(data, `${user.name} assigned you this task: "${task.title}".`, m.email);
        }
      }
      save(data);
      return json(res, 201, task);
    }
    if (parts[0] === 'api' && parts[1] === 'tasks' && parts[2]) {
      const task = data.tasks.find(t => t.id === parts[2]);
      if (!task) return json(res,404,{error:'Task not found'});
      if (req.method === 'PATCH' && parts.length === 3) {
        const callerRole = getCallerRole(req, data, task.workspaceId);
        if (callerRole === 'Viewer') return json(res, 403, { error: 'Viewers have read-only access and cannot modify tasks' });
        const b=await body(req);
        const oldStatus=task.status;
        Object.assign(task, b, {id:task.id, comments:task.comments, attachments:task.attachments, updatedAt:now()});
        const proj = data.projects?.find(p => p.id === task.projectId);
        const projSuffix = proj ? ` in ${proj.name}` : '';
        if (b.status && b.status !== oldStatus) log(data,user.name,`moved to ${b.status.replace('progress','in progress')}${projSuffix}`,task.title);
        else log(data,user.name,'updated',task.title);
        if (b.assigneeId || task.assigneeId) {
          const m=data.members.find(x=>x.id===(b.assigneeId || task.assigneeId));
          if(m && m.email) {
            notify(data, b.status === 'done' ? `🎉 Task "${task.title}" was marked as completed by ${user.name}!` : `${user.name} assigned you this task: "${task.title}".`, m.email);
          }
        }
        save(data);
        return json(res,200,task);
      }
      if (req.method === 'DELETE' && parts.length === 3) {
        const callerRole = getCallerRole(req, data, task.workspaceId);
        const isCreator = task.createdBy && task.createdBy.toLowerCase() === user.email.toLowerCase();
        const callerMember = data.members.find(m => m.workspaceId === task.workspaceId && m.email.toLowerCase() === user.email.toLowerCase());
        const isAssignee = task.assigneeId && callerMember && task.assigneeId === callerMember.id;
        if (callerRole !== 'Workspace admin' && !isCreator && !isAssignee) {
          return json(res, 403, { error: 'Only workspace admins, task creators, or assignees can delete tasks' });
        }
        data.tasks = data.tasks.filter(t=>t.id!==task.id);
        log(data,user.name,'deleted',task.title);
        save(data);
        return json(res,200,{ok:true});
      }
      if (req.method === 'POST' && parts[3] === 'alert') {
        const callerRole = getCallerRole(req, data, task.workspaceId);
        if (callerRole === 'Viewer') return json(res, 403, { error: 'Viewers cannot send reminders' });
        const assigneeMem = data.members.find(m => m.id === task.assigneeId);
        const targetEmail = assigneeMem && assigneeMem.email ? assigneeMem.email : user.email;
        notify(data, `⏰ Deadline Reminder: Task "${task.title}" is due soon!`, targetEmail);
        log(data, user.name, 'sent deadline reminder for', task.title);
        save(data);
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && parts[3] === 'comments') {
        if (getCallerRole(req, data, task.workspaceId) === 'Viewer') return json(res, 403, { error: 'Viewers have read-only access and cannot comment' });
        const b=await body(req);
        const c={id:id(), author:b.author||user.name, text:b.text?.trim(), at:now()};
        if(!c.text)return json(res,400,{error:'Comment required'});
        task.comments.push(c);
        log(data,c.author,'commented on',task.title);
        save(data);
        return json(res,201,c);
      }
      if (req.method === 'POST' && parts[3] === 'attachments') {
        if (getCallerRole(req, data, task.workspaceId) === 'Viewer') return json(res, 403, { error: 'Viewers have read-only access and cannot upload files' });
        const b=await body(req);
        const a={id:id(),name:b.name||'attachment',size:b.size||0,type:b.type||'',data:b.data||'',at:now()};
        task.attachments.push(a);
        log(data,user.name,'attached a file to',task.title);
        save(data);
        return json(res,201,a);
      }
      if (req.method === 'POST' && parts[3] === 'alert') {
        if (getCallerRole(req, data, task.workspaceId) === 'Viewer') return json(res, 403, { error: 'Viewers cannot send alerts' });
        const m=data.members.find(x=>x.id===task.assigneeId);
        if(!m)return json(res,400,{error:'Assign this task before sending an alert'});
        notify(data,`Deadline reminder sent to ${m.name}: “${task.title}” is due ${task.dueDate || 'soon'}.`, m.email);
        log(data,user.name,'sent a deadline reminder for',task.title);
        save(data);
        return json(res,200,{ok:true});
      }
    }

    // 7. Team Invites & Notifications
    if (req.method === 'POST' && url.pathname === '/api/invites') {
      if (getCallerRole(req, data) !== 'Workspace admin') return json(res, 403, { error: 'Only workspace admins can invite team members' });
      const b = await body(req);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(b.email)) return json(res, 400, { error: 'Please enter a valid email address' });

      const userRecord = data.users.find(u => u.id === user.id);
      const activeWsId = userRecord?.activeWorkspaceId || 'workspace-1';
      const ws = data.workspaces.find(w => w.id === activeWsId);
      const wsName = ws ? ws.name : 'Workspace';

      const invite = {
        id: id(),
        workspaceId: activeWsId,
        workspaceName: wsName,
        email: b.email.trim(),
        name: b.name || b.email.split('@')[0],
        role: b.role || 'Workspace member',
        status: 'Pending',
        createdAt: now()
      };
      if (!data.invites) data.invites = [];
      data.invites.unshift(invite);

      if (supabase) {
        try {
          const origin = req.headers.origin || 'http://localhost:3000';
          await supabase.auth.admin.inviteUserByEmail(invite.email, {
            redirectTo: `${origin}/#invite=${invite.id}`
          });
        } catch (e) {
          console.warn('Supabase invite notice:', e.message);
        }
      }

      log(data, user.name, 'invited', invite.email);
      notify(data, `You were invited to join ${wsName} as ${invite.role}.`, invite.email);
      save(data);
      return json(res, 201, invite);
    }
    if (req.method === 'PATCH' && url.pathname === '/api/account') {
      const b = await body(req);
      const u = data.users.find(x => x.id === user.id || x.email.toLowerCase() === user.email.toLowerCase());
      if (!u) return json(res, 404, { error: 'User account not found' });

      if (b.name) u.name = b.name.trim();
      if (b.email) u.email = b.email.trim();

      if (b.password) {
        if (!b.currentPassword) {
          return json(res, 400, { error: 'Please enter your current password to update your password.' });
        }
        if (u.password && u.password !== b.currentPassword) {
          return json(res, 400, { error: 'Current password is incorrect. Click "Forgot password?" if you need to reset it.' });
        }
        if (b.password.length < 8 || !/[0-9]/.test(b.password) || !/[A-Z]/.test(b.password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(b.password)) {
          return json(res, 400, { error: 'New password must be at least 8 characters long, contain at least 1 number, 1 uppercase letter, and 1 special character.' });
        }
        u.password = b.password;
        if (supabase) {
          try {
            await supabase.auth.updateUser({ password: b.password });
          } catch (e) {
            console.warn('Supabase password update note:', e.message);
          }
        }
      }

      save(data);
      return json(res, 200, { id: u.id, name: u.name, email: u.email });
    }

    if (req.method === 'PATCH' && url.pathname === '/api/notifications/read') {
      const b = await body(req);
      if (b.id) {
        const item = data.notifications.find(n => n.id === b.id);
        if (item) item.read = true;
      } else {
        data.notifications.forEach(n => n.read = true);
      }
      save(data);
      return json(res, 200, { ok: true, notifications: data.notifications });
    }
  }

  // 8. Static Content
  if (url.pathname === '/' || url.pathname === '/index.html') return serve(res,'index.html');
  if (url.pathname === '/app.js') return serve(res,'app.js');
  if (url.pathname === '/styles.css') return serve(res,'styles.css');
  res.writeHead(404); res.end('Not found');
});
server.listen(PORT, () => console.log(`Flowspace running at http://localhost:${PORT}`));
