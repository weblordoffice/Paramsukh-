/**
 * Centralized API base URL for all backend requests.
 * Set NEXT_PUBLIC_API_URL in .env.local (e.g. https://api.getbill.in for production).
 * Fallback is for local development only.
 */
function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000';
  return url.replace(/\/$/, '');
}

export const API_BASE_URL = getApiBaseUrl();
