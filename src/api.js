const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const USER_ID = import.meta.env.VITE_USER_ID || '';

export class ApiError extends Error {
  constructor(message, status, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function request(path, options = {}) {
  if (!API_URL) throw new Error('Set VITE_API_URL in your environment to connect to the API.');
  if (!USER_ID) throw new Error('Set VITE_USER_ID in your environment to identify this user.');

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': USER_ID,
      ...options.headers,
    },
  });
  if (!response.ok) {
    const retryAfter = response.headers.get('Retry-After');
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body?.message === 'string') message = body.message;
      else if (typeof body?.error === 'string') message = body.error;
    } catch { /* The response may not include a JSON body. */ }
    throw new ApiError(message, response.status, retryAfter);
  }
  if (response.status === 204) return null;
  return response.json();
}

export const getQuotaStatus = () => request('/api/quota/status');
export const getQuotaHistory = () => request('/api/quota/history');
export const generateResponse = (prompt) => request('/api/ai/generate', {
  method: 'POST',
  body: JSON.stringify({ prompt }),
});
export const upgradePlan = () => request('/api/quota/upgrade', { method: 'POST' });
