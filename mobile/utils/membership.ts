export function hasActiveMembership(user?: {
  subscriptionPlan?: string;
  subscriptionStatus?: string;
} | null): boolean {
  if (!user) return false;

  const plan = (user.subscriptionPlan || '').trim().toLowerCase();
  const status = (user.subscriptionStatus || '').trim().toLowerCase();

  return status === 'active' && plan !== '' && plan !== 'free';
}
