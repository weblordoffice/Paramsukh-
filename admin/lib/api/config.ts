/**
 * Centralized API base URL for all backend requests.
 *
 * Local:  In admin/.env.local set NEXT_PUBLIC_API_URL to your local backend
 *         (e.g. http://127.0.0.1:3000 — or another port if your backend uses it).
 * Production: Set NEXT_PUBLIC_API_URL when building (e.g. https://api.getbill.in).
 *         Without this, the app would try to call 127.0.0.1 and fail.
 */
function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  const url = envUrl && envUrl.trim() !== '' ? envUrl : 'http://127.0.0.1:3000';
  return url.replace(/\/$/, '');
}

export const API_BASE_URL = getApiBaseUrl();
