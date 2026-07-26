import { supabase } from './supabase';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, code = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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
    );
  }

  return data;
}

export async function getAdminAccessToken() {
  if (!supabase) throw new Error('Not authenticated');

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

export async function adminApiRequest(path, options = {}) {
  const token = await getAdminAccessToken();
  return apiRequest(path, { ...options, token });
}

export { API_URL };
