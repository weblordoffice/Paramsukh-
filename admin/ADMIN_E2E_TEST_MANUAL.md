# Admin E2E Test Manual

This manual is for a QA tester to validate the `admin` panel feature-by-feature, in real user flows.

## 1. Test Setup

1. Start backend and admin app.
2. Open admin app at `/`.
3. Keep 2 test accounts ready:
   - `super_admin` account (full access)
   - `admin` account with limited permissions
4. Keep sample data ready:
   - At least 2 users
   - At least 1 membership plan
   - At least 1 course, event, product, podcast
5. Browser: test on desktop first, then responsive/mobile width.

## 2. Global Checks (Run Once)

1. Login page shows Google sign-in button.
2. Non-admin Google account is blocked.
3. Allowed admin account can enter `/dashboard`.
4. Sidebar only shows modules allowed by user role/permissions.
5. Logout clears session and returns to login page.

## 3. Feature-by-Feature E2E Scenarios

## F01. Dashboard

1. Open `/dashboard`.
2. Verify stats cards load (`users`, `courses`, `events`, `orders`).
3. Click quick actions and confirm correct module opens.
4. Validate no crash when any stat API has empty data.

Expected:
- Page loads without blocking errors.
- Counts are visible and navigation buttons work.

## F02. Users

1. Open `/dashboard/users`.
2. Search by name/email/phone and verify filtering.
3. Click `Add User`, create user with name, phone, email, plan.
4. Edit same user and change plan/status.
5. Open assessment icon:
   - If assessment exists: modal opens.
   - If not exists: info toast shown.
6. Delete test user and verify row removed.

Expected:
- CRUD works.
- Validation and messages appear correctly.

## F03. Memberships (User Membership Operations)

1. Open `/dashboard/memberships`.
2. Validate summary cards and filters (`plan`, `status`, `search`).
3. Export CSV and verify downloaded file has visible rows.
4. Open `Grant Complimentary Membership`:
   - Select user, plan, duration, submit.
   - Verify grant appears in grants table.
5. Extend the grant and verify new validity.
6. Revoke active grant and verify status update.
7. Click user `Edit`:
   - Change plan and status.
   - Test active date validation (end date must be >= start date).
8. Click user `View` to open details page:
   - Subscription tab shows current plan/features.
   - Enrollments tab loads data or empty state.
   - Payments tab loads and CSV export works.
   - Activity tab handles empty/404 gracefully.

Expected:
- Membership updates persist.
- Grants lifecycle (create/extend/revoke) works.

## F04. Plans (Membership Plan Builder)

1. Open `/dashboard/plans`.
2. Search existing plans.
3. Create `New Plan` with:
   - Title, slug, status
   - Price, validity
   - Access mode and limits
   - Included categories/courses
4. Save and verify plan appears in list.
5. Edit and move status via quick buttons (`Publish`, `Draft`, `Archive`).
6. If plan has active users, verify warning/confirm dialog appears before downgrade.

Expected:
- Validation errors block invalid save.
- Status changes persist and refresh correctly.

## F05. Courses

1. Open `/dashboard/courses`.
2. Create course with metadata, category, tags, plan inclusion, thumbnail/banner.
3. Confirm course card appears with status and counts.
4. Edit course and verify updated values.
5. Open `Manage` on the course:
   - Videos tab: add/edit/delete video, upload file path, check order value.
   - PDFs tab: upload PDF, add metadata, edit/delete.
   - Live Sessions tab: create/edit/delete with datetime and meeting link.
   - Assignments tab: create with MCQ/input questions, edit/delete.
6. Delete course from course list and confirm removal.

Expected:
- All sub-tabs save correctly.
- Empty states show when no content exists.

## F06. Podcasts

1. Open `/dashboard/podcasts`.
2. Create podcast with source `youtube`.
3. Create podcast with source `local` (upload video + thumbnail).
4. Test access types:
   - `free`
   - `membership` (must select at least one plan)
   - `paid` (must enter price)
5. Edit podcast and verify values update.
6. Delete podcast and verify list refresh.

Expected:
- Source-specific validation works.
- Access control fields behave correctly.

## F07. Events

1. Open `/dashboard/events`.
2. Filter by status/category and test search.
3. Create event with:
   - Date/time
   - Location type (`physical`, `online`, `hybrid`)
   - Category/tags
   - Paid toggle and price
4. Edit event and verify update.
5. Open event `Manage`:
   - Photos tab: upload/add URLs, delete one photo.
   - Videos tab: add YouTube link, delete one video.
   - Registrations tab: search/filter, check-in a confirmed user, export CSV.
6. Delete event and confirm list update.

Expected:
- Event media and registration actions work end-to-end.

## F08. Products

1. Open `/dashboard/products`.
2. Create `regular` product (price/stock required) with multiple images.
3. Create `external` product (external link required, price/stock not required).
4. Verify product cards render correct badge/price behavior.
5. Edit both product types and confirm field behavior switches correctly.
6. Delete a product and verify removal.

Expected:
- Type-based validation is correct.
- Multi-image handling persists.

## F09. Orders

1. Open `/dashboard/orders`.
2. Search by order number or customer.
3. Open an order detail modal.
4. Validate items, amount, customer and address sections.
5. Update status through full cycle (`pending`, `processing`, `shipped`, `delivered`, `cancelled`).
6. Confirm status badge updates in modal and table.

Expected:
- Status patch is reflected immediately and after refresh.

## F10. Bookings (Counseling Appointments)

1. Open `/dashboard/bookings`.
2. Search by user/counselor/title.
3. Open booking detail modal.
4. Update booking status (`confirmed`, `rescheduled`, `completed`, `cancelled`).
5. Add meeting details:
   - Platform
   - Meeting link
   - ID/password (optional)
6. Save and confirm meeting link is visible and openable.
7. Delete booking and verify it is removed.

Expected:
- Status and meeting data persist.

## F11. Community

1. Open `/dashboard/community`.
2. Search posts by content or author.
3. Pin/unpin a post and verify visual pinned state.
4. Delete a post and confirm it disappears.

Expected:
- Moderation actions are immediate and stable on reload.

## F12. Counseling Services

1. Open `/dashboard/counseling`.
2. Create service with:
   - Title, counselor, duration
   - Free/paid toggle
   - Slot interval
   - Business hours per day
   - Theme color and icon
3. Verify service card renders correctly.
4. Toggle active/inactive state.
5. Edit service and verify update.
6. Delete service and confirm removal.

Expected:
- Service configuration and schedule fields persist.

## F13. Notifications

1. Open `/dashboard/notifications`.
2. Test `Broadcast` mode:
   - Fill title, message, type, priority, icon
   - Send and verify success toast
3. Test `Targeted` mode:
   - Select section (`users`, `memberships`, `courses`, etc.)
   - Add optional filter values
   - Send and verify recipient count response
4. Use template chips and confirm form is prefilled.
5. Search notification history.
6. Mark one item as read.
7. Delete one notification.

Expected:
- Send flows work for both modes.
- History actions (`read`, `delete`) work.

## F14. Settings (Super Admin only)

1. Login as `super_admin`, open `/dashboard/settings`.
2. Add new admin with role + permissions.
3. Login with that admin email (Google), verify access.
4. Confirm sidebar only shows permitted modules.
5. Edit admin permissions and re-test access.
6. Deactivate admin and verify they cannot use panel.
7. Delete admin (cannot delete currently logged-in self).

Expected:
- RBAC works exactly by role/permission.

## 4. Regression Checklist (Quick Run)

1. Login and logout still work.
2. Sidebar navigation works for every visible module.
3. Create and delete flows do not leave stale UI rows.
4. Search/filter controls work in list pages.
5. Modals open/close without UI break.
6. API failure shows user-friendly toast and UI stays usable.

## 5. Evidence to Capture Per Feature

1. Screenshot: before action.
2. Screenshot: after successful action.
3. Screenshot: validation/error state.
4. CSV/file export proof where available.
5. Short note with:
   - Feature ID (`F01`..`F14`)
   - Pass/Fail
   - Bug ID (if fail)

