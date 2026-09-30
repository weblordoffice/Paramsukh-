/**
 * Central resolver for notification deep-links.
 * Guarantees every tap lands on a real expo-router route — never a 404.
 */

export interface NotificationTarget {
  type?: string;
  actionUrl?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
}

export type ResolvedRoute =
  | { pathname: string; params?: Record<string, string> }
  | string;

// Allow-list of real in-app routes (must match app/**/*.tsx).
const KNOWN_PATHS = new Set([
  '/(home)/notifications',
  '/(home)/help-support',
  '/(home)/my-membership',
  '/(home)/community',
  '/(home)/podcasts',
  '/(home)/my-progress',
  '/(home)/courses',
  '/(home)/events',
  '/(home)/referral',
  '/(home)/settings',
  '/event-detail',
  '/course-detail',
  '/counseling',
  '/counseling-detail',
  '/order-detail',
  '/orders',
  '/donations',
  '/shops',
  '/shop-detail',
  '/product-detail',
  '/blogs',
  '/blog-detail',
]);

const FALLBACK: ResolvedRoute = '/(home)/notifications';

function sanitizeActionUrl(actionUrl: string): ResolvedRoute | null {
  const raw = actionUrl.trim();
  if (!raw || /^https?:\/\//i.test(raw)) return null; // external URLs: don't router.push
  const [path, query] = raw.split('?');
  if (!KNOWN_PATHS.has(path)) {
    // Legacy web-style links emitted by older backend versions
    const orderMatch = path.match(/^\/orders\/([a-fA-F0-9]{24})$/);
    if (orderMatch) return { pathname: '/order-detail', params: { orderId: orderMatch[1] } };
    const counselingMatch = path.match(/^\/counseling\/([a-fA-F0-9]{24})$/);
    if (counselingMatch) return { pathname: '/counseling-detail', params: { bookingId: counselingMatch[1] } };
    const blogMatch = path.match(/^\/blogs\/([a-fA-F0-9]{24})$/);
    if (blogMatch) return { pathname: '/blog-detail', params: { id: blogMatch[1] } };
    return null;
  }
  if (!query) return path;
  try {
    const params: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(query)) params[k] = v;
    return { pathname: path, params };
  } catch {
    return path;
  }
}

export function resolveNotificationRoute(item: NotificationTarget): ResolvedRoute {
  // 1. Explicit, allow-listed actionUrl wins (covers backend deep-links)
  if (item.actionUrl) {
    const sanitized = sanitizeActionUrl(item.actionUrl);
    if (sanitized) return sanitized;
    // Invalid actionUrl → fall through to relatedType mapping (never 404)
  }

  // 2. Support replies always go to help-support
  if (item.relatedType === 'support' || item.type === 'support_reply') {
    return '/(home)/help-support';
  }

  const { relatedType, relatedId } = item;
  if (!relatedType) return FALLBACK;

  switch (relatedType) {
    case 'event':
      return relatedId
        ? { pathname: '/event-detail', params: { eventId: relatedId } }
        : '/(home)/events';
    case 'course':
    case 'enrollment':
      return relatedId
        ? { pathname: '/course-detail', params: { id: relatedId, courseId: relatedId } }
        : '/(home)/courses';
    case 'booking':
      return relatedId
        ? { pathname: '/counseling-detail', params: { bookingId: relatedId } }
        : '/counseling';
    case 'membership':
      return '/(home)/my-membership';
    case 'support':
      return '/(home)/help-support';
    case 'order':
      return relatedId
        ? { pathname: '/order-detail', params: { orderId: relatedId } }
        : '/orders';
    case 'podcast':
      return relatedId
        ? { pathname: '/(home)/podcasts', params: { podcastId: relatedId } }
        : '/(home)/podcasts';
    case 'post':
    case 'comment':
      return '/(home)/community';
    case 'donation':
      return '/donations';
    case 'blog':
      return relatedId
        ? { pathname: '/blog-detail', params: { id: relatedId } }
        : '/blogs';
    default:
      return FALLBACK;
  }
}
