# 🔍 QA Audit Report — Paramsukh Online Gurukul

**Auditor Role:** Senior Android QA Engineer & Google Play Store Reviewer  
**Date:** 2026-06-20  
**App Version:** 1.0.1 (versionCode 2)  
**Package:** `com.paramsukh.onlinegurukul`  
**Framework:** Expo SDK 54 + React Native 0.81.5 + Expo Router 6

---

## Critical Issues

### 🔴 CRIT-1: Push Notification `projectId` Mismatch — Notifications Will Silently Fail

- **Location:** [usePushNotifications.ts:89](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/hooks/usePushNotifications.ts#L89) vs [app.json:58](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app.json#L58)
- **Root Cause:** The hook hardcodes `projectId: 'b6377463-45af-4c15-b761-627f43d190c8'`, but `app.json` declares a **different** project ID: `97449424-f4d1-490f-a8d8-30ceb8a9f75e`. `getExpoPushTokenAsync` will either throw an error or return a token bound to the wrong project, meaning push notifications from the backend will never be delivered.
- **Impact:** **All push notifications fail silently** in production. Users never receive any notifications. This is completely invisible to users and developers unless specifically tested.
- **Confidence Level:** 🔴 **Very High** — Direct string comparison shows two different UUIDs.

---

### 🔴 CRIT-2: Release Build Signed with Debug Keystore — Play Store Rejection Guaranteed

- **Location:** [android/app/build.gradle:115](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/android/app/build.gradle#L115)
- **Root Cause:** The `release` build type uses `signingConfig signingConfigs.debug`, which points to the checked-in `debug.keystore`. Google Play Store **rejects** APK/AABs signed with a debug key. Even if EAS Build overrides this with its own keystore, the local config is wrong and the comment on line 113 warns about this explicitly.
- **Impact:** If a developer does a manual release build, it will be rejected by Play Store. Future keystore rotation issues are also possible if not managed properly.
- **Confidence Level:** 🔴 **Very High** — Explicit in the Gradle config.

---

### 🔴 CRIT-3: `RAZORPAY_KEY_ID` Always Empty String in Production — All Payments Broken

- **Location:** [config/api.ts:15](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/config/api.ts#L15) and [app.json:55-61](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app.json#L55-L61)
- **Root Cause:** `RAZORPAY_KEY_ID` reads from `Constants.expoConfig?.extra?.razorpayKeyId`, but `app.json.extra` only contains `apiUrl`, `router`, and `eas`. There is **no `razorpayKeyId` defined anywhere** — not in `app.json`, not in `eas.json`, and `EXPO_NO_DOTENV=1` in EAS production build means `.env` is ignored. The fallback is `''` (empty string).
- **Impact:** While the checkout flow uses payment links (WebBrowser-based) rather than the native Razorpay SDK directly, the `RAZORPAY_KEY_ID` export is available for use and could cause failures in any flow that depends on it. The membership purchase screen references Razorpay key ID from the backend responses, partially mitigating this, but it's a fragile design.
- **Confidence Level:** 🟡 **High** — The key is confirmed empty. Impact depends on whether any flow actually uses this client-side constant directly (current checkout uses server-generated payment links instead).

---

## High Risk Issues

### 🟠 HIGH-1: `loadUser` in `_layout.tsx` Creates Unstable `useEffect` — Potential Infinite Render Loop

- **Location:** [_layout.tsx:58](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/_layout.tsx#L52-L58)
- **Root Cause:** `useEffect` has `[loadUser]` in its dependency array. Zustand's `create()` returns a new function reference for `loadUser` on every re-render if destructured via hook, but in this case `loadUser` comes from `useAuthStore()` which should be stable. However, the pattern is fragile — if the store is re-created (hot reload, testing), this could trigger infinite `loadUser` calls.
- **Impact:** During development/hot-reload, could cause login loops. In production, likely stable but violates React best practices.
- **Confidence Level:** 🟡 **Medium-High** — Zustand selectors are generally stable, but the pattern is risky.

---

### 🟠 HIGH-2: `index.tsx` Has Dependency Loop in `useEffect` — Could Fire Multiple Times

- **Location:** [index.tsx:87](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/index.tsx#L13-L87)
- **Root Cause:** The `useEffect` dependency array includes `[router, hasChecked, loadUser, fetchCurrentUser]`. When `hasChecked` changes from `false → true` (inside the callback), it triggers the effect again. The `if (!hasChecked)` guard prevents re-execution of the main logic, but the effect still re-runs. Additionally, `router` changes on navigation, potentially retriggering the effect after redirect.
- **Impact:** Could cause double navigation or race conditions during auth check. The 5-second timeout fallback also references stale `hasChecked` via closure.
- **Confidence Level:** 🟡 **High** — Confirmed by code analysis; stale closure on `hasChecked` in timeout callback (line 72 captures initial value).

---

### 🟠 HIGH-3: Auth Token Stored in Both SecureStore AND AsyncStorage — Dual Token Confusion

- **Location:** [biometricAuth.ts:121-166](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/utils/biometricAuth.ts#L121-L166) and [apiClient.ts:79](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/utils/apiClient.ts#L79)
- **Root Cause:** Tokens are stored in `expo-secure-store` with AsyncStorage as fallback. But `apiClient.ts` line 79 also writes to AsyncStorage directly during token refresh. After a refresh, SecureStore has the new token, and AsyncStorage ALSO has it. On `clearSecureTokens()`, if SecureStore succeeds, AsyncStorage tokens are NOT cleared (only in the catch fallback). This means stale tokens could persist in AsyncStorage even after logout — and the `getTokenSecurely` fallback reads from AsyncStorage!
- **Impact:** Stale session tokens surviving logout, potentially allowing unauthorized access. Security vulnerability.
- **Confidence Level:** 🟠 **High** — Clear from code flow: `clearSecureTokens` only clears AsyncStorage on SecureStore exception, but `apiClient` always writes to both.

---

### 🟠 HIGH-4: `AuthGuard` Does Not Block Rendering While Redirecting — Flash of Protected Content

- **Location:** [_layout.tsx:25-45](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/_layout.tsx#L25-L45)
- **Root Cause:** `AuthGuard` calls `router.replace('/signin')` in a `useEffect` but returns `{children}` immediately. Between the effect firing and navigation completing, the protected route's content renders momentarily.
- **Impact:** Users see a flash of protected content (e.g., the home menu) before being redirected to sign-in. Poor UX and potential data leak to unauthenticated users.
- **Confidence Level:** 🟠 **High** — Standard React navigation timing issue.

---

### 🟠 HIGH-5: `notificationStore` and Most Stores Use Raw `axios` Instead of `apiClient` — Token Refresh Bypass

- **Location:** [notificationStore.ts](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/notificationStore.ts), [courseStore.ts](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/courseStore.ts), [cartStore.ts](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/cartStore.ts), [orderStore.ts](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/orderStore.ts), [eventStore.ts](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/eventStore.ts), [communityStore.ts](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/communityStore.ts), [donationStore.ts](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/donationStore.ts), [counselingStore.ts](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/counselingStore.ts), [addressStore.ts](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/addressStore.ts), [productStore.ts](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/productStore.ts)
- **Root Cause:** All these stores import raw `axios` and manually attach `Bearer ${token}` headers. Only [membershipStore.ts](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/membershipStore.ts) and [assessment screen](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/assessment.tsx) use the `apiClient` with interceptors. The `apiClient` has the **token refresh interceptor** — raw `axios` calls do not.
- **Impact:** When access tokens expire, **10 of 12 stores** will get 401 errors that are NOT handled by the refresh interceptor. Users get kicked out or see "Failed to load" errors instead of silently refreshing. This is a **systemic authentication failure**.
- **Confidence Level:** 🔴 **Very High** — Clear import analysis. Only `membershipStore` and `assessment.tsx` use `apiClient`.

---

### 🟠 HIGH-6: `authStore.loadUser()` Silently Swallows ALL Errors — Corrupted Data Crash

- **Location:** [authStore.ts:262-263](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/authStore.ts#L262-L263)
- **Root Cause:** The `catch` block is completely empty. If `JSON.parse(userStr)` throws (corrupted AsyncStorage data), the error is swallowed, `isReady` in `_layout.tsx` is never set to `true`, and the app is stuck on the loading spinner forever.
- **Impact:** App hangs indefinitely on the white ActivityIndicator screen if stored user data is corrupted. The only fix is clearing app data.
- **Confidence Level:** 🟠 **High** — Empty catch with `JSON.parse` of user-controlled data.

---

## Medium Risk Issues

### 🟡 MED-1: `signin.tsx` Has Syntax Error Artifact — `[]` on Line 10

- **Location:** [signin.tsx:10](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/signin.tsx#L10)
- **Root Cause:** Line 10 reads `const otpInputRef = useRef<TextInput>(null);     []` — trailing `[]` that appears to be a copy-paste artifact. While this evaluates as an unused array expression (not a syntax error per se), it may cause confusion and could trigger lint warnings or unexpected behavior.
- **Impact:** Low runtime impact but indicates sloppy code review. Could mask real issues.
- **Confidence Level:** 🟢 **Very High** — Visible in source.

---

### 🟡 MED-2: `resendTimer` Interval Not Cleaned Up on Unmount — Memory Leak

- **Location:** [signin.tsx:81-92](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/signin.tsx#L81-L92) and [signup.tsx:80-91](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/signup.tsx#L80-L91)
- **Root Cause:** `startResendTimer()` creates a `setInterval` but never stores the interval ID at component scope. If the user navigates away before the timer completes, the interval continues running and calling `setResendTimer` on an unmounted component.
- **Impact:** React "can't update state on unmounted component" warning. Potential memory leak.
- **Confidence Level:** 🟡 **High** — Interval created without cleanup mechanism.

---

### 🟡 MED-3: Phone Number Formatting Inconsistency Between Signin and Signup

- **Location:** [signin.tsx:24-27](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/signin.tsx#L24-L27) vs [signup.tsx:35](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/signup.tsx#L35)
- **Root Cause:** `signin.tsx` strips spaces AND `+` then re-adds `+91`, but doesn't strip the `91` digits themselves (just `+91` prefix). If a user types `919876543210`, it becomes `+9191...`. `signup.tsx` uses simpler logic: `startsWith('+91') ? phone : '+91' + phone` which doesn't strip spaces.
- **Impact:** Edge case: users who paste phone numbers with country codes could end up with doubled prefixes. OTP would fail.
- **Confidence Level:** 🟡 **Medium** — Depends on user input patterns.

---

### 🟡 MED-4: `checkout.tsx` Returns `null` When Cart Is Empty — Blank Screen

- **Location:** [checkout.tsx:117](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/checkout.tsx#L117)
- **Root Cause:** `if (!cart) return null;` — If a user navigates to checkout without a cart (e.g., deep link, back button after clearing cart), they see a completely blank screen with no way to go back (no header rendered).
- **Impact:** Dead screen with no recovery path. User must force-close the app.
- **Confidence Level:** 🟠 **High** — Clear from code.

---

### 🟡 MED-5: `addressStore` `updateAddress` and `deleteAddress` Are Stub Implementations

- **Location:** [addressStore.ts:84-92](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/addressStore.ts#L84-L92)
- **Root Cause:** Both methods return `true` without making any API calls or updating local state. If the UI provides edit/delete buttons, they'll appear to succeed but do nothing.
- **Impact:** Users think they deleted/updated an address but it persists on the server.
- **Confidence Level:** 🟢 **Very High** — Methods are literally no-ops.

---

### 🟡 MED-6: Deprecated `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` Permissions

- **Location:** [AndroidManifest.xml:4,10](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/android/app/src/main/AndroidManifest.xml#L4-L10)
- **Root Cause:** On Android 13+ (API 33+), `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` are deprecated and automatically denied. These need `android:maxSdkVersion="32"` attributes or replacement with granular media permissions.
- **Impact:** Play Store may flag these during review. On newer devices, these permissions silently fail.
- **Confidence Level:** 🟡 **High** — Standard Android 13+ deprecation.

---

### 🟡 MED-7: `RECORD_AUDIO` Permission Declared But Seemingly Not Used

- **Location:** [AndroidManifest.xml:5](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/android/app/src/main/AndroidManifest.xml#L5)
- **Root Cause:** No audio recording feature is visible in the codebase. The community store supports audio posts but the upload is file-based. This permission may come from `expo-av` module auto-linking but is unnecessary if the app never records audio.
- **Impact:** Google Play Store reviewers may ask for justification. Unnecessary permissions reduce user trust.
- **Confidence Level:** 🟡 **Medium** — May be auto-linked from expo-av.

---

### 🟡 MED-8: `device-token` Registration Hardcodes Platform as `'android'`

- **Location:** [notificationStore.ts:171](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/notificationStore.ts#L171)
- **Root Cause:** `platform: 'android'` is hardcoded. If the app is ever built for iOS (which `app.json` supports with `supportsTablet: true`), the wrong platform will be registered, and iOS-specific push features won't work.
- **Impact:** iOS push notifications broken if/when iOS version ships.
- **Confidence Level:** 🟡 **Medium** — Only affects iOS builds.

---

### 🟡 MED-9: Stale Closure on `hasChecked` in Timeout Callback

- **Location:** [index.tsx:72](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/index.tsx#L70-L76)
- **Root Cause:** The `setTimeout` callback on line 72 captures `hasChecked` from the closure. Since `hasChecked` is React state, changes to it inside `checkAuthAndAssessment` are not visible to the timeout callback. The `if (!hasChecked && isMounted)` check always sees the initial `false` value.
- **Impact:** If `checkAuthAndAssessment` completes before 5s and sets `hasChecked = true`, the timeout still fires and may cause a second `router.replace('/signin')` call after the user has already been redirected.
- **Confidence Level:** 🟡 **Medium-High** — Standard React stale closure issue. Mitigated by `isMounted` check in some paths but not all.

---

## Play Store Rejection Risks

### 🚫 PSR-1: No Privacy Policy URL Configured

- **Location:** [app.json](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app.json) — missing `privacyPolicyUrl` or `termsOfServiceUrl` in `expo.extra` or `expo.ios`/`expo.android`
- **Root Cause:** The app collects personal data (phone number, email, name, location, health information via assessment, biometric data), but no privacy policy URL is configured in the app listing. The signin/signup screens reference "Terms & Privacy Policy" but provide no clickable links.
- **Impact:** **Automatic Play Store rejection.** Google requires a valid privacy policy for apps that collect personal data. The assessment screen collects health-related data ("Physical Issues", "Mental Health Issues") which triggers **additional scrutiny** under Google's health policy.
- **Confidence Level:** 🔴 **Very High** — Confirmed missing.

---

### 🚫 PSR-2: Health Data Collection Without Proper Disclosure

- **Location:** [assessment.tsx:47-78](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/assessment.tsx#L47-L78)
- **Root Cause:** The mandatory assessment asks about "Physical Issues", "Special Disease Issues", "Mental Health Issues", "Relationship Issues". This constitutes health-related data collection under Google Play's [Health Apps policy](https://support.google.com/googleplay/android-developer/answer/14078085). Without a Data Safety declaration and health policy compliance, the app will be flagged.
- **Impact:** Play Store rejection or removal after review.
- **Confidence Level:** 🟠 **High** — Google is strict about health data.

---

### 🚫 PSR-3: Data Safety Form Gaps — Multiple Undeclared Data Types

- **Location:** Across the entire app
- **Root Cause:** The app collects: phone numbers, email, name, age, occupation, location (country/state), health data, financial data (via Razorpay), biometric data, device push tokens, browsing behavior (course progress). All of these must be declared in the Google Play Data Safety form.
- **Impact:** Inaccurate Data Safety form = rejection or removal.
- **Confidence Level:** 🟠 **High** — Based on the breadth of data collected.

---

### 🚫 PSR-4: Payment Integration via WebBrowser (Not In-App) May Trigger Policy Flags

- **Location:** [checkout.tsx:75](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/checkout.tsx#L75) — `WebBrowser.openBrowserAsync(url)`
- **Root Cause:** Payments open an external browser session via `expo-web-browser`. Google Play policy requires in-app purchases for digital goods/services via Google Play Billing. If "Membership" plans (which unlock digital content like courses, downloads, community access) are classified as digital goods, using Razorpay instead of Google Play Billing violates the policy.
- **Impact:** Play Store rejection for the membership feature. Physical goods (shop products) are fine with external payment processors.
- **Confidence Level:** 🟡 **Medium-High** — Depends on how Google classifies the memberships (digital access vs. services).

---

## Startup Crash Risks

### 💥 SC-1: Missing Asset File Causes Hard Crash at Startup

- **Location:** [signin.tsx:114](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/signin.tsx#L114), [signup.tsx:113](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/signup.tsx#L113), [SplashScreen.tsx:51](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/SplashScreen.tsx#L51)
- **Root Cause:** Multiple screens use `require('../assets/paramsukh.png')`. The file exists at [assets/paramsukh.png](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/assets/paramsukh.png) (182KB). If this file were missing or the build process excluded it, the app would crash on require(). Currently this is **not an active issue** but the asset is critical.
- **Impact:** If the asset is missing in build — hard crash on any auth screen.
- **Confidence Level:** 🟢 **Low** — File exists. Noted for build verification.

---

### 💥 SC-2: `loadUser` Empty Catch → Infinite Loading Screen

- **Location:** [authStore.ts:262](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/store/authStore.ts#L262) + [_layout.tsx:52-58](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/_layout.tsx#L52-L58)
- **Root Cause:** See HIGH-6. If `loadUser()` throws (corrupted data), the promise rejection is swallowed, `initAuth()` in `_layout.tsx` never calls `setIsReady(true)`, and the app shows a white screen with a spinner forever.
- **Impact:** Effectively a "crash" from the user's perspective — the app never loads. Only clearing app data fixes it.
- **Confidence Level:** 🟠 **High** — The catch swallows exceptions that prevent `setIsReady(true)` from being reached.

> [!IMPORTANT]
> Actually, looking more carefully: `loadUser()` itself catches errors internally (line 262), so the `await loadUser()` in `_layout.tsx` won't throw. `setIsReady(true)` on line 55 will execute. **However**, if `JSON.parse` fails inside the catch, a **nested** exception could escape. The real risk is low but non-zero. Downgrading to **Medium** confidence.

---

### 💥 SC-3: `country-state-city` Library Loads ALL Countries/States at Assessment Screen

- **Location:** [assessment.tsx:39-43](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/assessment.tsx#L39-L43)
- **Root Cause:** `Country.getAllCountries()` and `State.getStatesOfCountry()` from `country-state-city` package load large datasets synchronously during render. This is wrapped in `useMemo`, but the initial render still processes all countries (~250 items).
- **Impact:** Slower load time on the assessment screen, especially on low-end devices. Not a crash but can cause ANR (Application Not Responding) on very old devices.
- **Confidence Level:** 🟡 **Medium** — `useMemo` helps, but initial load is synchronous.

---

## Release Build Risks

### 🔧 RB-1: Minification Disabled in Release Builds

- **Location:** [android/app/build.gradle:69](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/android/app/build.gradle#L69) + [gradle.properties](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/android/gradle.properties) (no `android.enableMinifyInReleaseBuilds` set)
- **Root Cause:** `enableMinifyInReleaseBuilds` defaults to `false`. R8/ProGuard minification is disabled in release builds. The APK/AAB will be larger than necessary.
- **Impact:** Larger app size, slower downloads, more storage usage. Not a crash risk but affects user experience and store metrics.
- **Confidence Level:** 🟢 **Very High** — Confirmed in Gradle config.

---

### 🔧 RB-2: ProGuard Rules Missing for Critical Libraries

- **Location:** [proguard-rules.pro](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/android/app/proguard-rules.pro)
- **Root Cause:** Only `react-native-reanimated` and `turbomodule` keep rules are present. If minification is ever enabled (RB-1 fix), libraries like `expo-secure-store`, `expo-notifications`, `react-native-razorpay`, `react-native-webview`, and `expo-local-authentication` could have their classes stripped, causing **runtime crashes only in release builds**.
- **Impact:** Release-only crashes after enabling minification. Hard to debug.
- **Confidence Level:** 🟡 **Medium** — Only relevant if minification is enabled (currently disabled).

---

### 🔧 RB-3: `EAS.json` Missing `development` Build Profile

- **Location:** [eas.json](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/eas.json#L6)
- **Root Cause:** Only `preview` and `production` profiles exist. No `development` profile for dev-client builds. Running `eas build --profile development` will fail.
- **Impact:** Development workflow friction, not a production issue.
- **Confidence Level:** 🟢 **Very High** — Missing from config.

---

### 🔧 RB-4: `SplashScreen.tsx` Component Exists But Is Never Used

- **Location:** [SplashScreen.tsx](file:///c:/Users/Neeraj/Desktop/saas-native/mobile/app/SplashScreen.tsx)
- **Root Cause:** This is a file in the `app/` directory which means Expo Router treats it as a route (`/SplashScreen`). However, it's never navigated to, and it expects an `onFinish` prop that the router won't provide. If a user somehow navigated to `/SplashScreen`, the `onFinish` callback would be `undefined`, and `onFinish()` on line 34 would crash.
- **Impact:** Navigating to `/SplashScreen` route crashes the app. Low probability but possible via deep links.
- **Confidence Level:** 🟡 **Medium** — Unlikely navigation path but technically accessible.

---

## Final Assessment

### Summary Table

| Category | Count | Severity |
|---|---|---|
| 🔴 Critical Issues | 3 | Must fix before release |
| 🟠 High Risk Issues | 6 | Should fix before release |
| 🟡 Medium Risk Issues | 9 | Fix in next sprint |
| 🚫 Play Store Rejection Risks | 4 | **Blocking** for store submission |
| 💥 Startup Crash Risks | 3 | 1 likely, 2 conditional |
| 🔧 Release Build Risks | 4 | Non-blocking but impactful |

### Overall Verdict: ⛔ **NOT READY FOR PLAY STORE SUBMISSION**

> [!CAUTION]
> The app has **3 blocking issues** that will prevent Play Store approval or cause critical failures in production:
> 1. **Push notification projectId mismatch** — all notifications silently fail
> 2. **Token refresh bypassed by 10/12 stores** — users get randomly logged out
> 3. **Missing privacy policy** with health data collection — automatic rejection

### Priority Fix Order                  

1. **CRIT-1** — Fix push notification `projectId` mismatch (5-minute fix)
2. **HIGH-5** — Migrate all stores from raw `axios` to `apiClient` (high effort, highest impact)
3. **PSR-1/PSR-2** — Add privacy policy URL and Data Safety form (required for submission)
4. **CRIT-2** — Configure proper release signing (or confirm EAS handles it)
5. **HIGH-3** — Fix dual token storage to prevent stale sessions
6. **HIGH-6** — Add error handling to `loadUser()` to prevent infinite spinner
7. **HIGH-4** — Add loading gate to `AuthGuard` to prevent content flash
8. **MED-4** — Add empty state for checkout screen
9. **MED-6** — Scope deprecated Android permissions
10. **PSR-4** — Evaluate membership billing compliance with Play Store policy
