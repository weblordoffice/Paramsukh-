import { Certificate } from '../models/certificate.models.js';
import { Assignment } from '../models/course.models.js';
import { Enrollment } from '../models/enrollment.models.js';

const toId = (value) => String(value?._id || value || '');

const uniqueIssuanceKey = (baseKey, certificate, existingKeys) => {
  if (!existingKeys.has(baseKey)) return baseKey;
  return `${baseKey}:${certificate.certificateId}`;
};

export const runCertificationBackfill = async ({ dryRun = true } = {}) => {
  const report = {
    dryRun,
    certificatesScanned: 0,
    certificatesUpdated: 0,
    certificatesSkipped: 0,
    assignmentsUpdated: 0,
    enrollmentsUpdated: 0,
  };

  const existingKeys = new Set(
    (await Certificate.find({ issuanceKey: { $ne: null } }).select('issuanceKey').lean())
      .map((certificate) => certificate.issuanceKey)
      .filter(Boolean)
  );

  const cursor = Certificate.find({
    $or: [
      { type: { $exists: false } },
      { issuanceKey: { $exists: false } },
      { issuanceKey: null },
      { status: { $exists: false } },
    ],
  }).cursor();

  for await (const certificate of cursor) {
    report.certificatesScanned += 1;

    const type = certificate.membership
      ? 'membership'
      : certificate.course
        ? 'course_participation'
        : null;

    if (!type) {
      report.certificatesSkipped += 1;
      continue;
    }

    const update = {};

    if (!certificate.type) update.type = type;
    if (!certificate.issuanceSource) update.issuanceSource = certificate.issuedByAdmin ? 'manual' : 'automatic';
    if (!certificate.status) update.status = certificate.isRevoked ? 'revoked' : 'issued';
    if (type === 'course_participation' && certificate.legacy !== true) update.legacy = true;

    if (!certificate.issuanceKey) {
      const baseKey = type === 'membership'
        ? `membership:${toId(certificate.user)}:${toId(certificate.membership)}`
        : `course_participation:${toId(certificate.user)}:${toId(certificate.course)}`;
      const issuanceKey = uniqueIssuanceKey(baseKey, certificate, existingKeys);
      update.issuanceKey = issuanceKey;
      existingKeys.add(issuanceKey);
    }

    if (!Object.keys(update).length) {
      report.certificatesSkipped += 1;
      continue;
    }

    if (!dryRun) {
      await Certificate.updateOne({ _id: certificate._id }, { $set: update });
    }
    report.certificatesUpdated += 1;
  }

  const assignmentResult = dryRun
    ? { modifiedCount: await Assignment.countDocuments({ requiredForAssessment: { $exists: false } }) }
    : await Assignment.updateMany(
      { requiredForAssessment: { $exists: false } },
      { $set: { requiredForAssessment: false } }
    );
  report.assignmentsUpdated = assignmentResult.modifiedCount || 0;

  const completedEnrollmentQuery = {
    isCompleted: true,
    completionAwardedAt: null,
  };

  if (dryRun) {
    report.enrollmentsUpdated = await Enrollment.countDocuments(completedEnrollmentQuery);
  } else {
    const enrollmentResult = await Enrollment.updateMany(
      completedEnrollmentQuery,
      {
        $set: {
          completionAwardedAt: new Date(),
          assessmentUnlocked: false,
          assessmentUnlockedAt: null,
          completedRequiredAssignments: [],
        },
      }
    );
    report.enrollmentsUpdated = enrollmentResult.modifiedCount || 0;
  }

  return report;
};
