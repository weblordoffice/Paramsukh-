import crypto from 'crypto';
import XLSX from 'xlsx';
import { MembershipPlan } from '../models/membershipPlan.models.js';
import { User } from '../models/user.models.js';

const MAX_IMPORT_ROWS = 2000;
const REQUIRED_HEADERS = ['displayName', 'phone', 'subscriptionPlan'];
const ALLOWED_SUBSCRIPTION_STATUSES = new Set(['active', 'inactive', 'cancelled']);
const HEADER_ALIASES = {
  displayName: ['displayname', 'name', 'full name', 'full_name', 'fullname', 'user name', 'username'],
  phone: ['phone', 'phone number', 'phone_number', 'mobile', 'mobile number', 'contact', 'contact number'],
  email: ['email', 'e-mail', 'mail'],
  subscriptionPlan: ['subscriptionplan', 'subscription plan', 'membership', 'membership plan', 'membershipplan', 'plan'],
  subscriptionStatus: ['subscriptionstatus', 'subscription status', 'status'],
  tags: ['tags', 'tag'],
  isActive: ['isactive', 'is active', 'active'],
};

const normalizeText = (value) => String(value || '').trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const normalizePhone = (value) => normalizeText(value).replace(/[\s-]/g, '');
const normalizePlan = (value) => normalizeText(value).toLowerCase();
const normalizeStatus = (value) => normalizeText(value).toLowerCase();

const normalizeTags = (value) => {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return Array.from(new Set(raw.map((tag) => normalizeText(tag).toLowerCase()).filter(Boolean)));
};

const canonicalizeHeader = (header) => normalizeText(header).toLowerCase().replace(/[_-]/g, ' ');

const resolveCanonicalHeader = (header) => {
  const normalized = canonicalizeHeader(header);
  const entry = Object.entries(HEADER_ALIASES).find(([, aliases]) => aliases.includes(normalized));
  return entry ? entry[0] : null;
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone) => /^\+?[0-9]{10,15}$/.test(phone);

const parseBoolean = (value, defaultValue = true) => {
  if (value === undefined || value === null || normalizeText(value) === '') {
    return { value: defaultValue, isValid: true };
  }

  if (typeof value === 'boolean') {
    return { value, isValid: true };
  }

  const normalized = normalizeText(value).toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return { value: true, isValid: true };
  }

  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return { value: false, isValid: true };
  }

  return { value: defaultValue, isValid: false };
};

const addError = (row, code, message) => {
  if (!Array.isArray(row.errors)) {
    row.errors = [];
  }

  if (!row.errors.some((error) => error.code === code)) {
    row.errors.push({ code, message });
  }
};

const addWarning = (row, code, message) => {
  if (!Array.isArray(row.warnings)) {
    row.warnings = [];
  }

  if (!row.warnings.some((warning) => warning.code === code)) {
    row.warnings.push({ code, message });
  }
};

const buildHeaderMap = (sheet) => {
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: false });
  const headerRow = Array.isArray(matrix[0]) ? matrix[0] : [];
  const map = new Map();
  const recognized = [];

  headerRow.forEach((header) => {
    const canonical = resolveCanonicalHeader(header);
    if (!canonical) {
      return;
    }

    if (!map.has(header)) {
      map.set(header, canonical);
    }

    if (!recognized.includes(canonical)) {
      recognized.push(canonical);
    }
  });

  return { map, recognized };
};

const buildNormalizedRow = (rawRow, rowNumber, headerMap) => {
  const mapped = {};

  Object.entries(rawRow || {}).forEach(([header, value]) => {
    const canonical = headerMap.get(header) || resolveCanonicalHeader(header);
    if (!canonical) {
      return;
    }

    if (mapped[canonical] === undefined || mapped[canonical] === '') {
      mapped[canonical] = value;
    }
  });

  const parsedIsActive = parseBoolean(mapped.isActive, true);
  const subscriptionStatus = normalizeStatus(mapped.subscriptionStatus);

  const row = {
    rowNumber,
    raw: rawRow,
    normalized: {
      displayName: normalizeText(mapped.displayName),
      phone: normalizePhone(mapped.phone),
      email: normalizeEmail(mapped.email),
      subscriptionPlan: normalizePlan(mapped.subscriptionPlan),
      subscriptionStatus,
      tags: normalizeTags(mapped.tags),
      isActive: parsedIsActive.value,
    },
    errors: [],
    warnings: [],
    existingUserId: null,
    phoneMatchUserId: null,
    emailMatchUserId: null,
    actionHint: null,
  };

  if (!row.normalized.displayName) {
    addError(row, 'MISSING_DISPLAY_NAME', 'displayName is required');
  }

  if (!row.normalized.phone) {
    addError(row, 'MISSING_PHONE', 'phone is required');
  } else if (!isValidPhone(row.normalized.phone)) {
    addError(row, 'INVALID_PHONE', 'phone must be 10-15 digits (optionally with + prefix)');
  }

  if (!row.normalized.subscriptionPlan) {
    addError(row, 'MISSING_SUBSCRIPTION_PLAN', 'subscriptionPlan is required');
  }

  if (row.normalized.email && !isValidEmail(row.normalized.email)) {
    addError(row, 'INVALID_EMAIL', 'email format is invalid');
  }

  if (!parsedIsActive.isValid) {
    addError(row, 'INVALID_IS_ACTIVE', 'isActive must be true/false (or yes/no, 1/0)');
  }

  if (
    row.normalized.subscriptionStatus
    && !ALLOWED_SUBSCRIPTION_STATUSES.has(row.normalized.subscriptionStatus)
  ) {
    addError(
      row,
      'INVALID_SUBSCRIPTION_STATUS',
      'subscriptionStatus must be one of active, inactive, cancelled'
    );
  }

  if (!row.normalized.subscriptionStatus) {
    row.normalized.subscriptionStatus = row.normalized.subscriptionPlan === 'free' ? 'inactive' : 'active';
  }

  return row;
};

const loadWorkbookRows = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('No worksheet found in uploaded file');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
    blankrows: false,
  });

  const { map, recognized } = buildHeaderMap(sheet);

  return { rows, headerMap: map, recognizedHeaders: recognized, sheetName: firstSheetName };
};

const validatePlanSlugs = async (previewRows) => {
  const requiredPlans = Array.from(
    new Set(
      previewRows
        .map((row) => row.normalized.subscriptionPlan)
        .filter((plan) => plan && plan !== 'free')
    )
  );

  if (!requiredPlans.length) {
    return new Map();
  }

  const plans = await MembershipPlan.find({ slug: { $in: requiredPlans }, status: 'published' })
    .select('slug validityDays')
    .lean();

  const planMap = new Map(plans.map((plan) => [String(plan.slug).toLowerCase(), plan]));

  previewRows.forEach((row) => {
    const plan = row.normalized.subscriptionPlan;
    if (!plan || plan === 'free') {
      return;
    }

    if (!planMap.has(plan)) {
      addError(row, 'INVALID_SUBSCRIPTION_PLAN', `subscriptionPlan '${plan}' is not a published plan`);
      return;
    }

    const resolved = planMap.get(plan);
    row.normalized.planValidityDays = Number(resolved?.validityDays || 365);
  });

  return planMap;
};

const applyInFileDuplicateChecks = (previewRows) => {
  const phoneBuckets = new Map();
  const emailBuckets = new Map();

  previewRows.forEach((row, index) => {
    const phone = row.normalized.phone;
    const email = row.normalized.email;

    if (phone) {
      if (!phoneBuckets.has(phone)) {
        phoneBuckets.set(phone, []);
      }
      phoneBuckets.get(phone).push(index);
    }

    if (email) {
      if (!emailBuckets.has(email)) {
        emailBuckets.set(email, []);
      }
      emailBuckets.get(email).push(index);
    }
  });

  phoneBuckets.forEach((indices, phone) => {
    if (indices.length <= 1) {
      return;
    }

    indices.forEach((index) => {
      addError(previewRows[index], 'DUPLICATE_PHONE_IN_FILE', `phone '${phone}' is duplicated in uploaded file`);
    });
  });

  emailBuckets.forEach((indices, email) => {
    if (indices.length <= 1) {
      return;
    }

    indices.forEach((index) => {
      addError(previewRows[index], 'DUPLICATE_EMAIL_IN_FILE', `email '${email}' is duplicated in uploaded file`);
    });
  });
};

const applyExistingUserChecks = async (previewRows) => {
  const phones = Array.from(new Set(previewRows.map((row) => row.normalized.phone).filter(Boolean)));
  const emails = Array.from(new Set(previewRows.map((row) => row.normalized.email).filter(Boolean)));

  if (!phones.length && !emails.length) {
    return;
  }

  const orConditions = [];
  if (phones.length) {
    orConditions.push({ phone: { $in: phones } });
  }
  if (emails.length) {
    orConditions.push({ email: { $in: emails } });
  }

  const existingUsers = await User.find({ $or: orConditions })
    .select('_id phone email')
    .lean();

  const byPhone = new Map();
  const byEmail = new Map();

  existingUsers.forEach((user) => {
    const phone = normalizePhone(user.phone);
    const email = normalizeEmail(user.email);

    if (phone && !byPhone.has(phone)) {
      byPhone.set(phone, String(user._id));
    }

    if (email && !byEmail.has(email)) {
      byEmail.set(email, String(user._id));
    }
  });

  previewRows.forEach((row) => {
    const phoneMatch = row.normalized.phone ? byPhone.get(row.normalized.phone) || null : null;
    const emailMatch = row.normalized.email ? byEmail.get(row.normalized.email) || null : null;

    row.phoneMatchUserId = phoneMatch;
    row.emailMatchUserId = emailMatch;

    if (phoneMatch && emailMatch && phoneMatch !== emailMatch) {
      addError(
        row,
        'AMBIGUOUS_EXISTING_USER',
        'phone and email match different existing users; resolve conflict before import'
      );
      return;
    }

    row.existingUserId = phoneMatch || emailMatch || null;
    row.actionHint = row.existingUserId ? 'update' : 'create';

    if (row.existingUserId) {
      addWarning(row, 'EXISTING_USER_FOUND', 'matching existing user found; import mode will decide create/update behavior');
    }
  });
};

const buildSummary = (previewRows) => {
  const validRows = previewRows.filter((row) => row.errors.length === 0).length;
  const invalidRows = previewRows.length - validRows;

  const duplicateRows = previewRows.filter((row) =>
    row.errors.some((error) => ['DUPLICATE_PHONE_IN_FILE', 'DUPLICATE_EMAIL_IN_FILE'].includes(error.code))
  ).length;

  const ambiguousRows = previewRows.filter((row) =>
    row.errors.some((error) => error.code === 'AMBIGUOUS_EXISTING_USER')
  ).length;

  return {
    totalRows: previewRows.length,
    validRows,
    invalidRows,
    duplicateRows,
    ambiguousRows,
  };
};

const buildChecksum = (fileName, previewRows) => {
  const payload = previewRows.map((row) => ({
    rowNumber: row.rowNumber,
    normalized: row.normalized,
    errors: row.errors,
  }));

  return crypto
    .createHash('sha256')
    .update(`${normalizeText(fileName)}:${JSON.stringify(payload)}`)
    .digest('hex');
};

export const normalizeImportMode = (value) => {
  const mode = normalizeText(value).toLowerCase();
  if (['create_only', 'update_existing', 'upsert'].includes(mode)) {
    return mode;
  }
  return 'upsert';
};

export const parseAndValidateImportFile = async ({ buffer, fileName }) => {
  const { rows, headerMap, recognizedHeaders } = loadWorkbookRows(buffer);

  if (rows.length === 0) {
    throw new Error('Uploaded file contains no data rows');
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Maximum ${MAX_IMPORT_ROWS} rows allowed per import`);
  }

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !recognizedHeaders.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
  }

  const previewRows = rows.map((rawRow, index) => buildNormalizedRow(rawRow, index + 2, headerMap));

  await validatePlanSlugs(previewRows);
  applyInFileDuplicateChecks(previewRows);
  await applyExistingUserChecks(previewRows);

  const summary = buildSummary(previewRows);
  const checksum = buildChecksum(fileName, previewRows);

  return {
    checksum,
    rows: previewRows,
    summary,
    recognizedHeaders,
  };
};

export const buildImportTemplateCsv = () => {
  const header = 'displayName,phone,subscriptionPlan,email,tags,isActive';
  const exampleOne = 'Ravi Kumar,+919876543210,bronze,ravi@example.com,"school-a,vip",true';
  const exampleTwo = 'Anita Sharma,9988776655,silver,anita@example.com,"cohort-2",false';
  return `${header}\n${exampleOne}\n${exampleTwo}\n`;
};
