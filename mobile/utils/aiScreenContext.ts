export type AIScreenContext = {
  route: string;
  label: string;
  hint: string;
  entityId?: string;
  entityTitle?: string;
};

type RawParams = Record<string, string | string[] | undefined>;

const readFirst = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const prettifySegment = (value: string) =>
  value
    .replace(/[()]/g, '')
    .split(/[-_\/]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export function buildAIScreenContext(pathname: string, params: RawParams = {}): AIScreenContext {
  const courseTitle = readFirst(params.title) || readFirst(params.courseTitle);
  const courseId = readFirst(params.id) || readFirst(params.courseId);
  const eventTitle = readFirst(params.eventTitle) || readFirst(params.title);
  const eventId = readFirst(params.eventId) || readFirst(params.id);

  switch (pathname) {
    case '/courses':
      return {
        route: pathname,
        label: 'Courses',
        hint: 'The user is browsing the course catalog and may ask about recommended learning paths or course access.',
      };
    case '/course-detail':
      return {
        route: pathname,
        label: courseTitle ? `Course: ${courseTitle}` : 'Course Details',
        hint: 'The user is viewing a specific course detail page and may ask about lessons, benefits, or prerequisites.',
        entityId: courseId,
        entityTitle: courseTitle,
      };
    case '/events':
      return {
        route: pathname,
        label: 'Events',
        hint: 'The user is exploring upcoming or past events and may ask about schedules, attendance, or registration.',
      };
    case '/event-detail':
      return {
        route: pathname,
        label: eventTitle ? `Event: ${eventTitle}` : 'Event Details',
        hint: 'The user is viewing a specific event and may ask about timing, registration, or event benefits.',
        entityId: eventId,
        entityTitle: eventTitle,
      };
    case '/my-membership':
    case '/membership-new':
      return {
        route: pathname,
        label: 'Membership Plans',
        hint: 'The user is looking at memberships and may ask about plans, pricing, or access benefits.',
      };
    case '/community':
      return {
        route: pathname,
        label: 'Community',
        hint: 'The user is on the community screen and may ask about groups, posts, or how to participate.',
      };
    case '/podcasts':
      return {
        route: pathname,
        label: 'Podcasts',
        hint: 'The user is exploring podcast content and may ask about available episodes or what is included.',
      };
    case '/downloads':
      return {
        route: pathname,
        label: 'Downloads',
        hint: 'The user is in downloads and may ask about saved materials or offline access.',
      };
    case '/help-support':
      return {
        route: pathname,
        label: 'Help & Support',
        hint: 'The user is seeking help and may ask support-related questions or how to resolve issues.',
      };
    case '/notifications':
      return {
        route: pathname,
        label: 'Notifications',
        hint: 'The user is reviewing notifications and may ask about recent updates or actions to take.',
      };
    case '/menu':
      return {
        route: pathname,
        label: 'Main Menu',
        hint: 'The user is on the menu screen and may ask where to go next inside the app.',
      };
    case '/ai-chat':
      return {
        route: pathname,
        label: 'AI Guide',
        hint: 'The user is already in the dedicated AI chat screen.',
      };
    default: {
      const label = pathname && pathname !== '/'
        ? prettifySegment(pathname)
        : 'Home';

      return {
        route: pathname,
        label,
        hint: `The user is currently on the ${label} screen.`,
      };
    }
  }
}
