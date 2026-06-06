// Wipe ALL data except users
// Run with: mongosh <connection-string> --file scripts/wipe-all-except-users.mongodb.js
// Or: mongosh use("your-db-name") then load("scripts/wipe-all-except-users.mongodb.js")

// ============== KEEP THESE ==============
const keep = ["users", "admins"];

// ============== WIPE THESE ==============
const wipe = [
  // Courses & Learning
  "courses",
  "videos",
  "pdfs",
  "livesessions",
  "assignments",
  "enrollments",
  "courseplans",

  // Events
  "events",
  "eventregistrations",

  // Plans & Memberships
  "membershipplans",
  "usermemberships",

  // Counseling & Bookings
  "counselingservices",
  "bookings",
  "counseloravailabilityexceptions",

  // Podcasts
  "podcasts",
  "podcastpurchases",

  // E-Commerce / Shop
  "shops",
  "categories",
  "products",
  "orders",
  "carts",
  "wishlists",
  "addresses",
  "reviews",
  "coupons",
  "couponusages",

  // Community
  "groups",
  "groupmembers",
  "posts",
  "comments",

  // Notifications & Support
  "notifications",
  "devicetokens",
  "supportmessages",

  // Admin / System
  "adminpaymentlinks",
  "userimportsessions",
  "appconfigs",
  "assessments",
  "donations",
];

print("============================================");
print("  WIPING ALL DATA EXCEPT USERS & ADMINS");
print("============================================\n");

let totalDeleted = 0;

for (const colName of wipe) {
  const col = db.getCollection(colName);
  try {
    const count = col.countDocuments();
    if (count > 0) {
      const result = col.deleteMany({});
      print(`  [DELETED] ${colName}: ${result.deletedCount} documents`);
      totalDeleted += result.deletedCount;
    } else {
      print(`  [EMPTY]   ${colName}`);
    }
  } catch (e) {
    print(`  [MISSING] ${colName} (collection does not exist)`);
  }
}

print(`\n============================================`);
print(`  TOTAL DELETED: ${totalDeleted} documents`);
print(`  KEPT: users, admins`);
print(`============================================`);
