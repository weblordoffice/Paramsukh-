# Features & Implementation Spec

> Purpose: give a new developer enough context to understand how the major
> features in this codebase are implemented, where the code lives, and the
> key decisions / gotchas — so they can start contributing quickly.

## 0. Repository layout

Monorepo with three apps:

| Folder     | Stack                              | Notes |
|------------|------------------------------------|-------|
| `backend/` | Node + Express + Mongoose (MongoDB) | REST API. Source in `backend/src`. |
| `admin/`   | Next.js (React) admin panel        | Talks to the same backend. |
| `mobile/`  | Expo / React Native                | Talks to the same backend. |

Backend conventions:
- `src/controller/<area>/<area>.controller.js` — request handlers.
- `src/routes/<area>/<area>Route.js` — route definitions.
- `src/services/*.js` — business logic (email, OTP, referral, etc.).
- `src/models/*.models.js` — Mongoose schemas.
- `src/middleware/protectedRoutes.js` (user auth) and `adminAuth` (admin auth).

Base API path is `/api`. User routes mount under `/api/user`, orders under
`/api/orders`, etc.

### Local dev note (IMPORTANT)
`mobile/app.json` is frequently modified locally for Expo and is **intentionally
left uncommitted**. Do not stage/commit it unless you know why. Also: the Jest
suite in `backend/src/__tests__` does not run in restricted/sandbox
environments — use `node --check <file>` for backend syntax and
`npx tsc --noEmit` in `mobile/` for type checks.

---

## 1. Email Notification System

**Requirement:** email notifications are always enabled by default and cannot be
disabled; every transactional email must be wired to the user's preference and
actually fire at the right event.

### Data model
`backend/src/models/user.models.js` → `User.preferences.emailNotifications`
(boolean, **default `true`**).

### Preference is enforced server-side (cannot be turned off)
`backend/src/controller/user/profile.controller.js` → `updatePreferences`
(`PUT /api/user/preferences`):
```js
if (emailNotifications !== undefined) {
  // Email notifications are always enabled by design and cannot be disabled.
  updateData['preferences.emailNotifications'] = true;
}
```
The mobile settings UI also hard-disables the toggle (see §1.3).

### Email engine
`backend/src/services/emailService.js` sends via **Resend**.
- `sendEmail({ to, subject, html })` — low-level send. **Silently no-ops if
  `RESEND_API_KEY` is missing** (by design, so local/dev doesn't crash).
- `safeSend(fn)` — wraps a send and swallows errors (one failed email must not
  break the calling request).
- `canSendEmail(user)` — gate used by every email function:
  ```js
  export const canSendEmail = (user) => {
    if (!user || !user.email) return false;
    return user.preferences?.emailNotifications !== false;
  };
  ```
  Because the default is `true` and the API/UI can't set it `false`, emails
  effectively always send — but the preference is still honored if ever
  explicitly opted out.

### Email functions (all gated by `canSendEmail`)
| Function | Triggered when | Call site |
|----------|----------------|-----------|
| `sendWelcomeEmail(user)` | signup | `auth/authOTP.controller.js`, `auth/clerkAuth.controller.js` |
| `sendOrderConfirmationEmail(user, order)` | order placed / confirmed | `controller/orders/orders.controller.js` |
| `sendMembershipPurchaseEmail(user)` | membership activated | `controller/payments/payments.controller.js`, `controller/user/profile.controller.js` |
| `sendEventRegistrationEmail(user, title, amount)` | event booked | `controller/events/eventRegistration.controller.js`, `payments.controller.js` |
| `sendDonationReceiptEmail(user, donation)` | donation made | `controller/donations/donations.controller.js` |
| `sendPodcastPurchaseEmail(user, podcast)` | podcast bought | `controller/podcast/podcastPayment.controller.js` |
| `sendCounselingBookingEmail(user, booking)` | counseling booked | `controller/counseling/counseling.controller.js`, `payments.controller.js` |
| `sendCertificateEarnedEmail(user, courseName, certId)` | course completed | `services/courseCompletion.service.js` |
| `sendReferralRewardEmail(referrerId, { rewardType, referredUserName, points })` | referrer earns reward | `services/referral.service.js` (`fireTrigger`) |

### Mobile UI
`mobile/app/(home)/settings.tsx`:
- `UserSettings.emailNotifications` defaults to `true`.
- `loadSettings` / `saveSettings` force `emailNotifications: true`.
- The "Email Notifications" `Switch` is rendered `disabled` (always on) so the
  user cannot turn it off.

### Config
Set in environment: `RESEND_API_KEY` and optionally `RESEND_FROM`
(`emailService.js` falls back to a Resend dev sender).

---

## 2. Dark Mode (Mobile)

Centralized, theme-driven styling so the whole app adapts to light/dark.

### Files
- `mobile/theme/colors.ts` — `light` and `dark` palettes (neutral, consistent
  scheme chosen during the migration).
- `mobile/store/themeStore.ts` — Zustand store holding `theme` (`light`/`dark`/
  `system`) and `colors`, with `loadTheme()`/`setTheme()` and AsyncStorage
  persistence.
- `mobile/hooks/useTheme.ts` — convenience hook (wraps the store).
- `mobile/app/_layout.tsx` — loads the persisted theme on boot and themes the
  `StatusBar` / loading screens via `colors.background` and
  `colors.statusBarStyle`.

### Usage pattern in a screen
```tsx
const colors = useThemeStore((s) => s.colors);
// inline styles
<View style={{ backgroundColor: colors.background }}>
// or a StyleSheet factory for sub-components
const makeStyles = (c: typeof colors) => StyleSheet.create({ ... });
```
For components that can't easily call the hook at module scope, the
`makeStyles(colors)` factory pattern is used so styles are rebuilt when the
theme changes.

All ~40 screens were migrated to consume `colors` instead of hardcoded hex
values. `tsc --noEmit` must stay clean after any styling change.

---

## 3. Account Deletion (Mobile OTP + Irreversible Confirmation)

Account deletion is destructive, so it requires (1) a server-sent OTP verified
on the device, and (2) a final explicit "this is permanent" confirmation.

### Backend
`backend/src/controller/user/profile.controller.js`:
- `requestDeleteAccountOtp` — generates + sends an OTP to the user
  (via `services/otpService.js`). Route:
  `POST /api/user/account/delete-otp`.
- `deleteAccount` — **requires `otp`** in the body; verifies it through
  `otpService` before deleting the user. Route:
  `DELETE /api/user/account`.

### Mobile
`mobile/app/(home)/settings.tsx`:
1. User taps "Delete Account" → OTP is requested, an OTP modal is shown.
2. After a valid OTP, a final `Alert` asks "Delete Permanently?" — only after
   this irreversible confirmation does the delete call fire.

### Gotcha
If `otpService` is misconfigured, `deleteAccount` will reject with an OTP error
rather than deleting — this is intentional (fail safe).

---

## 4. Admin Order Status Update

`backend/src/controller/admin/orders.controller.js` →
`updateOrderStatusAdmin`, exposed at `PATCH /api/orders/:id/status`
(admin-authenticated).

Key correctness fixes (history, for context):
- `updatedBy` is set from `req.admin?._id || null` (previously it used
  `req.user?._id || 'admin'`, which is not an ObjectId and caused a CastError
  that made **every** status update 500).
- Inventory is restored to `product.inventory.stock` when an order is
  cancelled/returned (previously it wrote to a non-existent
  `inventory.quantity`).
- `confirmedAt` is stamped when status becomes `confirmed`.

---

## 5. Profile: Age / BirthDate Sync

`backend/src/models/assessment.models.js`:
- `birthDate` is **optional** (it used to be required, which broke profile
  saves that didn't supply it).
- An `age` (Number) field was added so the app can store age directly.

`mobile/app/(home)/edit-profile.tsx` computes `age` from `birthDate` (with a
fallback) before saving, so the two stay consistent.

---

## 6. Referral System

Reward logic lives in `backend/src/services/referral.service.js`:
- `fireTrigger(triggerEvent, { referrerId, referredUserId, ... })` — evaluates
  active `ReferralEarningRule`s, atomically awards `referralPoints` (capped via
  `ReferralConfig.maxPointsPerReferrerTotal`), creates a `PointTransaction`,
  and (when `config.notifyOnEarn`) creates an in-app `Notification` **and** sends
  the referral reward email via `sendReferralRewardEmail`.
- `releaseHeldPoints()` / `expireOldPoints()` — cron helpers for point holds
  and expiry.
- `redeemPoints(userId, points, orderId)` — atomic decrement used at checkout.

Trigger events wired today: `user.signup` (in `authOTP`/`clerkAuth`/
`referral` controllers), `user.first_purchase` (in `payments.controller.js`),
and `user.course_complete` (in `services/courseCompletion.service.js`).

Models: `ReferralConfig`, `ReferralEarningRule`, `Referral`, `PointTransaction`,
plus `referralPoints` / `totalPointsEarned` / `referralCode` on `User`.

Tests: `backend/src/__tests__/referral.test.js` and `dynamicReferrals.test.js`.

---

## 7. Getting started for a new developer

1. Read §0 for the layout and the `app.json`/Jest caveats.
2. Pick a feature above, open its controller + service + model files.
3. Backend: verify with `node --check <file>` after edits.
4. Mobile: run `npx tsc --noEmit` in `mobile/` after edits.
5. Email: remember emails only actually send when `RESEND_API_KEY` is set; in
   dev they no-op silently.
6. Keep `mobile/app.json` out of your commits.
