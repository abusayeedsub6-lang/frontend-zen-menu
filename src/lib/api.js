const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const ADMIN_TOKEN_KEY = 'admin_token';

export class ApiError extends Error {
  constructor(message, status, code = null, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, token, headers: extraHeaders } = options;

  const headers = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    throw new ApiError(
      data?.message || data?.error || `Request failed (${response.status})`,
      response.status,
      data?.code || null,
      data,
    );
  }

  return data;
}

export function getAdminAccessToken() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) throw new Error('Not authenticated');
  return token;
}

export async function adminApiRequest(path, options = {}) {
  const token = getAdminAccessToken();
  return apiRequest(path, { ...options, token });
}

export { API_URL };
