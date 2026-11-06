const BASE = import.meta.env.VITE_API_URL || '/api';

let tokenGetter = () => null;
export function setTokenGetter(fn) { tokenGetter = fn; }

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const headers = {};
  const token = tokenGetter();
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }

  if (!res.ok) {
    const err = new Error((data && data.error) || 'request_failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return raw ? res : data;
}

export const api = {
  getConfig: () => request('/config'),
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/auth/me'),

  getVoters: () => request('/voters'),
  getMeta: () => request('/voters/meta'),

  getEdits: () => request('/edits'),
  saveEdits: (edits) => request('/edits', { method: 'PUT', body: { edits } }),
  clearEdits: () => request('/edits', { method: 'DELETE' }),

  subscribe: (payload) => request('/subscribe', { method: 'POST', body: payload }),

  adminUsers: () => request('/admin/users'),
  adminUpsertUser: (payload) => request('/admin/users', { method: 'POST', body: payload }),
  adminUpdateUser: (id, payload) => request('/admin/users/' + id, { method: 'PATCH', body: payload }),
  adminRequests: () => request('/subscribe'),
  adminUpdateRequest: (id, status) => request('/admin/requests/' + id, { method: 'PATCH', body: { status } }),
};

export { request };
