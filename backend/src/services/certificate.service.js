import crypto from 'crypto';
import { Certificate } from '../models/certificate.models.js';
import { Course } from '../models/course.models.js';
import { User } from '../models/user.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { UserMembership } from '../models/userMembership.models.js';
import { AssessmentAttempt } from '../models/assessmentAttempt.models.js';
import { VivaApplication } from '../models/vivaApplication.models.js';
import {
  getMembershipIssuanceKey,
  isPaidMembershipForCertificate,
} from './certificationEligibility.service.js';

const generateCertificateId = () => {
  const randomHex = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `PS-CERT-${randomHex}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
};

const buildAuditEntry = (action, { actorType = 'system', actor = null, reason = '', metadata = {} } = {}) => ({
  action,
  actorType,
  actor,
  reason,
  metadata,
  at: new Date(),
});

const createOrReturnCertificate = async (issuanceKey, payload) => {
  const existing = await Certificate.findOne({ issuanceKey });
  if (existing) return existing;

  try {
    return await Certificate.findOneAndUpdate(
      { issuanceKey },
      {
        $setOnInsert: {
          ...payload,
          issuanceKey,
          status: 'issued',
          isRevoked: false,
          issuedAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return Certificate.findOne({ issuanceKey });
    }
    throw error;
  }
};

export const issueParticipationCertificate = async (userId, courseId) => {
  const [user, course, enrollment] = await Promise.all([
    User.findById(userId).select('displayName'),
    Course.findById(courseId).select('title'),
    Enrollment.findOne({ userId, courseId }).select('isCompleted'),
  ]);

  if (!user || !course) {
    throw new Error('User or Course not found');
  }
  if (!enrollment?.isCompleted) {
    throw new Error('Course must be completed before issuing a participation certificate');
  }

  const legacyCertificate = await Certificate.findOne({
    user: userId,
    course: courseId,
    type: { $in: ['course_participation', null] },
  });

  if (legacyCertificate) {
    return legacyCertificate;
  }

  const issuanceKey = `course_participation:${userId}:${courseId}`;
  const created = await createOrReturnCertificate(issuanceKey, {
    certificateId: generateCertificateId(),
    type: 'course_participation',
    issuanceSource: 'automatic',
    title: 'Certificate of Participation',
    user: userId,
    course: courseId,
    issuedTo: user.displayName,
    courseName: course.title,
    auditTrail: [buildAuditEntry('issued', { actorType: 'system' })],
  });

  if (created) {
    console.log(`Certificate issued: ${created.certificateId} for user ${user.displayName}`);
  }

  return created;
};

export const issueMembershipCertificate = async (userId, membershipInput) => {
  const membershipId = membershipInput?._id || membershipInput;
  const membership = membershipId
    ? await UserMembership.findById(membershipId).lean()
    : null;

  if (!membership) {
    return { issued: false, reason: 'Membership not found', certificate: null };
  }

  const eligible = await isPaidMembershipForCertificate(membership, userId);
  if (!eligible) {
    return {
      issued: false,
      reason: 'Membership is not backed by a verified paid transaction',
      certificate: null,
    };
  }

  const user = await User.findById(userId).select('displayName');
  if (!user) {
    return { issued: false, reason: 'User not found', certificate: null };
  }

  const issuanceKey = getMembershipIssuanceKey(membership);
  const existing = await Certificate.findOne({ issuanceKey });
  if (existing) {
    return { issued: false, reason: null, certificate: existing };
  }

  const planTitle = membership.planSnapshot?.title || membership.planSnapshot?.slug || 'Membership';
  const certificate = await createOrReturnCertificate(issuanceKey, {
    certificateId: generateCertificateId(),
    type: 'membership',
    issuanceSource: 'automatic',
    title: 'Membership Certificate',
    user: userId,
    membership: membership._id,
    issuedTo: user.displayName,
    courseName: planTitle,
    planName: planTitle,
    validFrom: membership.startDate || null,
    validTo: membership.endDate || null,
    metadata: {
      planSlug: membership.planSnapshot?.slug,
      membershipSource: membership.source,
      paymentId: membership.payment?.paymentId || membership.metadata?.razorpayPaymentId || null,
      orderId: membership.payment?.orderId || membership.metadata?.razorpayOrderId || null,
    },
    auditTrail: [buildAuditEntry('issued', { actorType: 'system' })],
  });

  return { issued: Boolean(certificate), reason: null, certificate };
};

export const issueAssessmentCertificate = async ({
  userId,
  courseId,
  vivaApplicationId,
  adminId,
}) => {
  const viva = await VivaApplication.findOne({
    _id: vivaApplicationId,
    user: userId,
    course: courseId,
    status: 'passed',
  });

  if (!viva) {
    const error = new Error('A passed viva is required before issuing this certificate');
    error.status = 400;
    throw error;
  }

  const attempt = await AssessmentAttempt.findOne({
    _id: viva.assessmentAttempt,
    user: userId,
    course: courseId,
    passed: true,
  });

  if (!attempt) {
    const error = new Error('A passed assessment attempt is required before issuing this certificate');
    error.status = 400;
    throw error;
  }

  const [user, course] = await Promise.all([
    User.findById(userId).select('displayName'),
    Course.findById(courseId).select('title'),
  ]);

  if (!user || !course) {
    const error = new Error('User or Course not found');
    error.status = 404;
    throw error;
  }

  const issuanceKey = `course_assessment:${userId}:${courseId}`;
  const existing = await Certificate.findOne({ issuanceKey });

  if (existing && existing.status === 'issued' && !existing.isRevoked) {
    return existing;
  }

  if (existing) {
    existing.status = 'issued';
    existing.isRevoked = false;
    existing.revokedAt = null;
    existing.revokedBy = null;
    existing.revocationReason = '';
    existing.issuedAt = new Date();
    existing.issuedByAdmin = adminId || null;
    existing.assessmentAttempt = attempt._id;
    existing.vivaApplication = viva._id;
    existing.auditTrail = existing.auditTrail || [];
    existing.auditTrail.push(buildAuditEntry('reissued', {
      actorType: 'admin',
      actor: adminId || null,
    }));
    await existing.save();
    return existing;
  }

  const certificate = await createOrReturnCertificate(issuanceKey, {
    certificateId: generateCertificateId(),
    type: 'course_assessment',
    issuanceSource: 'manual',
    title: 'Course Assessment Certificate',
    user: userId,
    course: courseId,
    issuedTo: user.displayName,
    courseName: course.title,
    issuedByAdmin: adminId || null,
    assessmentAttempt: attempt._id,
    vivaApplication: viva._id,
    auditTrail: [buildAuditEntry('issued', {
      actorType: 'admin',
      actor: adminId || null,
    })],
  });

  await VivaApplication.updateOne(
    { _id: viva._id, certificate: null },
    { $set: { certificate: certificate._id } }
  );

  return certificate;
};

export const revokeCertificate = async (certificateId, { adminId = null, reason = '' } = {}) => {
  const certificate = await Certificate.findOne({ certificateId });
  if (!certificate) {
    const error = new Error('Certificate not found');
    error.status = 404;
    throw error;
  }

  if (certificate.status === 'revoked' || certificate.isRevoked) {
    return certificate;
  }

  certificate.status = 'revoked';
  certificate.isRevoked = true;
  certificate.revokedAt = new Date();
  certificate.revokedBy = adminId || null;
  certificate.revocationReason = String(reason || '').trim();
  certificate.auditTrail = certificate.auditTrail || [];
  certificate.auditTrail.push(buildAuditEntry('revoked', {
    actorType: adminId ? 'admin' : 'system',
    actor: adminId || null,
    reason: certificate.revocationReason,
  }));

  await certificate.save();
  return certificate;
};

export const generateCertificateRecord = (userId, courseId) =>
  issueParticipationCertificate(userId, courseId);
