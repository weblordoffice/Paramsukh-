// Wipe ALL data except users
// Run with: mongosh <connection-string> --file scripts/wipe-all-except-users.mongodb.js
// Or: mongosh use("your-db-name") then load("scripts/wipe-all-except-users.mongodb.js")

// ============== SAFETY GUARD ==============
// Refuse to run against the production database unless explicitly overridden.
const PROD_DB = (typeof process !== "undefined" && process.env && process.env.PROD_MONGO_DB) || "psog";
const ALLOW_PROD =
  typeof process !== "undefined" && process.env && process.env.ALLOW_PROD_DESTRUCTIVE === "1";
const currentDbName = db.getName();

print(`Target database: ${currentDbName}`);
if (currentDbName === PROD_DB && !ALLOW_PROD) {
  print(
    `ABORTED: refusing to wipe the production database "${currentDbName}". Set ALLOW_PROD_DESTRUCTIVE=1 to override.`
  );
  quit(1);
}

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
