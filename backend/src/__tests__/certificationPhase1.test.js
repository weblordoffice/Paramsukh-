import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { setupDB } from './db.js';
import { createTestUser, createTestCourse } from './helpers.js';
import { Course, Assignment } from '../models/course.models.js';
import { Enrollment } from '../models/enrollment.models.js';
import { Certificate } from '../models/certificate.models.js';
import { UserMembership } from '../models/userMembership.models.js';
import { User } from '../models/user.models.js';
import { CourseAssessment } from '../models/courseAssessment.models.js';
import { AssessmentAttempt } from '../models/assessmentAttempt.models.js';
import { VivaApplication } from '../models/vivaApplication.models.js';
import {
  isPaidMembershipForCertificate,
  recalculateAssessmentUnlock,
} from '../services/certificationEligibility.service.js';
import {
  issueParticipationCertificate,
  issueMembershipCertificate,
  issueAssessmentCertificate,
  revokeCertificate,
} from '../services/certificate.service.js';
import {
  sanitizeAssessmentForStudent,
  gradeAssessmentAnswers,
} from '../services/assessmentGrading.service.js';
import {
  applyForViva,
  transitionVivaApplication,
} from '../services/viva.service.js';
import { runCertificationBackfill } from '../services/certificationBackfill.service.js';

setupDB();

const oid = () => new mongoose.Types.ObjectId();

const createMembership = (userId, overrides = {}) => UserMembership.create({
  userId,
  planId: oid(),
  planSnapshot: {
    title: 'Gold Membership',
    slug: 'gold',
    pricing: { amount: 1000, currency: 'INR', type: 'one_time' },
  },
  status: 'active',
  source: 'purchase',
  startDate: new Date(Date.now() - 86400000),
  endDate: new Date(Date.now() + 86400000 * 30),
  payment: {
    provider: 'razorpay',
    orderId: 'order_test_1',
    paymentId: 'pay_test_1',
    amount: 1000,
    currency: 'INR',
  },
  ...overrides,
});

const createPassedAttempt = ({ userId, courseId, assessmentId }) => AssessmentAttempt.create({
  user: userId,
  course: courseId,
  assessment: assessmentId,
  attemptNumber: 1,
  status: 'graded',
  correctCount: 5,
  totalQuestions: 5,
  score: 5,
  maxScore: 5,
  percentage: 100,
  passed: true,
  submittedAt: new Date(),
  gradedAt: new Date(),
});

describe('Certification Phase 1', () => {
  let user;
  let course;

  beforeEach(async () => {
    user = await createTestUser();
    course = await createTestCourse();
  });

  describe('participation certificates', () => {
    it('issues once and remains idempotent', async () => {
      await Enrollment.create({
        userId: user._id,
        courseId: course._id,
        isCompleted: true,
        progress: 100,
      });

      const first = await issueParticipationCertificate(user._id, course._id);
      const second = await issueParticipationCertificate(user._id, course._id);

      expect(first.type).toBe('course_participation');
      expect(first.issuanceKey).toBe(`course_participation:${user._id}:${course._id}`);
      expect(first.title).toBe('Certificate of Participation');
      expect(first.certificateId).toMatch(/^PS-CERT-/);
      expect(String(second._id)).toBe(String(first._id));
      expect(await Certificate.countDocuments()).toBe(1);
    });

    it('rejects issuance for an incomplete course', async () => {
      await Enrollment.create({ userId: user._id, courseId: course._id });

      await expect(
        issueParticipationCertificate(user._id, course._id)
      ).rejects.toThrow('Course must be completed');
    });

    it('returns an existing legacy certificate without changing it', async () => {
      const legacy = await Certificate.create({
        certificateId: 'LEGACY-CERT-1',
        user: user._id,
        course: course._id,
        issuedTo: user.displayName,
        courseName: 'Legacy Course',
        issuedAt: new Date('2024-01-01T00:00:00.000Z'),
      });
      await Enrollment.create({ userId: user._id, courseId: course._id, isCompleted: true });

      const result = await issueParticipationCertificate(user._id, course._id);

      expect(result.certificateId).toBe('LEGACY-CERT-1');
      expect(result.issuedAt.toISOString()).toBe(legacy.issuedAt.toISOString());
      expect(await Certificate.countDocuments()).toBe(1);
    });
  });

  describe('membership certificates', () => {
    it('accepts a membership with verified Razorpay payment details', async () => {
      const membership = await createMembership(user._id);

      expect(await isPaidMembershipForCertificate(membership, user._id)).toBe(true);

      const result = await issueMembershipCertificate(user._id, membership._id);

      expect(result.issued).toBe(true);
      expect(result.certificate.type).toBe('membership');
      expect(result.certificate.membership.toString()).toBe(membership._id.toString());
      expect(result.certificate.title).toBe('Membership Certificate');
    });

    it('is idempotent per membership period', async () => {
      const membership = await createMembership(user._id);

      const first = await issueMembershipCertificate(user._id, membership._id);
      const second = await issueMembershipCertificate(user._id, membership._id);

      expect(second.certificate._id.toString()).toBe(first.certificate._id.toString());
      expect(await Certificate.countDocuments()).toBe(1);
    });

    it('rejects admin-granted memberships', async () => {
      const membership = await createMembership(user._id, {
        source: 'admin_grant',
        payment: { provider: 'manual', amount: 0, currency: 'INR' },
      });

      expect(await isPaidMembershipForCertificate(membership, user._id)).toBe(false);

      const result = await issueMembershipCertificate(user._id, membership._id);
      expect(result.issued).toBe(false);
      expect(result.certificate).toBeNull();
    });

    it('falls back to a completed User.payments record when payment details are absent', async () => {
      const membership = await createMembership(user._id, {
        payment: { provider: 'razorpay', amount: 0, currency: 'INR' },
        metadata: { orderId: 'order_linked_1', paymentId: 'pay_linked_1' },
      });

      await User.updateOne(
        { _id: user._id },
        {
          $push: {
            payments: {
              orderId: 'order_linked_1',
              paymentId: 'pay_linked_1',
              amount: 999,
              plan: 'gold',
              status: 'completed',
              date: new Date(),
            },
          },
        }
      );

      expect(await isPaidMembershipForCertificate(membership, user._id)).toBe(true);
    });
  });

  describe('assessment certificates', () => {
    it('requires a passed viva before issuing the assessment certificate', async () => {
      const assessmentId = oid();
      const attempt = await createPassedAttempt({
        userId: user._id,
        courseId: course._id,
        assessmentId,
      });

      await expect(
        issueAssessmentCertificate({
          userId: user._id,
          courseId: course._id,
          vivaApplicationId: oid(),
          adminId: oid(),
        })
      ).rejects.toThrow('A passed viva is required');

      const viva = await VivaApplication.create({
        user: user._id,
        course: course._id,
        assessmentAttempt: attempt._id,
        status: 'passed',
        result: { status: 'passed', remarks: 'Passed oral examination' },
        statusHistory: [{ from: 'completed', to: 'passed', actorType: 'admin' }],
      });

      const certificate = await issueAssessmentCertificate({
        userId: user._id,
        courseId: course._id,
        vivaApplicationId: viva._id,
        adminId: oid(),
      });

      expect(certificate.type).toBe('course_assessment');
      expect(certificate.issuanceSource).toBe('manual');
      expect(certificate.assessmentAttempt.toString()).toBe(attempt._id.toString());
      expect(certificate.vivaApplication.toString()).toBe(viva._id.toString());

      const refreshedViva = await VivaApplication.findById(viva._id);
      expect(refreshedViva.certificate.toString()).toBe(certificate._id.toString());
    });

    it('revokes a certificate with an audit entry', async () => {
      await Enrollment.create({ userId: user._id, courseId: course._id, isCompleted: true });
      const certificate = await issueParticipationCertificate(user._id, course._id);
      const adminId = oid();

      const revoked = await revokeCertificate(certificate.certificateId, {
        adminId,
        reason: 'Issued in error',
      });

      expect(revoked.status).toBe('revoked');
      expect(revoked.isRevoked).toBe(true);
      expect(revoked.revocationReason).toBe('Issued in error');
      expect(revoked.auditTrail.at(-1).action).toBe('revoked');
      expect(revoked.auditTrail.at(-1).actor.toString()).toBe(adminId.toString());
    });
  });

  describe('assessment grading', () => {
    it('never exposes answer keys to students', () => {
      const assessment = {
        _id: oid(),
        course: course._id,
        title: 'Final Assessment',
        questions: [{
          _id: oid(),
          prompt: 'What is 2 + 2?',
          type: 'mcq',
          options: [{ key: 'A', text: '3' }, { key: 'B', text: '4' }],
          correctOptionKey: 'B',
          acceptedAnswers: ['four'],
          explanation: 'Basic arithmetic',
          points: 2,
          isEnabled: true,
          order: 0,
        }],
        passingRule: { type: 'correct_count', value: 1 },
      };

      const safe = sanitizeAssessmentForStudent(assessment);
      const serialized = JSON.stringify(safe);

      expect(serialized).not.toContain('correctOptionKey');
      expect(serialized).not.toContain('acceptedAnswers');
      expect(serialized).not.toContain('Basic arithmetic');
      expect(safe.questions[0].options).toHaveLength(2);
    });

    it('auto-grades objective answers and marks descriptive answers pending', () => {
      const mcqId = oid();
      const descriptiveId = oid();
      const assessment = {
        questions: [
          {
            _id: mcqId,
            type: 'mcq',
            options: [{ key: 'A', text: 'Wrong' }, { key: 'B', text: 'Right' }],
            correctOptionKey: 'B',
            points: 2,
            isEnabled: true,
            order: 0,
          },
          {
            _id: descriptiveId,
            type: 'descriptive',
            points: 3,
            isEnabled: true,
            order: 1,
          },
        ],
        passingRule: { type: 'correct_count', value: 1 },
      };

      const result = gradeAssessmentAnswers(assessment, {
        [String(mcqId)]: 'B',
        [String(descriptiveId)]: 'A detailed answer',
      });

      expect(result.correctCount).toBe(1);
      expect(result.score).toBe(2);
      expect(result.maxScore).toBe(5);
      expect(result.status).toBe('pending_manual');
      expect(result.passed).toBeNull();
      expect(result.answers[1].gradingStatus).toBe('manual_pending');
    });

    it('passes an all-objective attempt when the threshold is met', () => {
      const firstId = oid();
      const secondId = oid();
      const assessment = {
        questions: [
          {
            _id: firstId,
            type: 'mcq',
            options: [{ key: 'A', text: 'One' }, { key: 'B', text: 'Two' }],
            correctOptionKey: 'B',
            points: 1,
            isEnabled: true,
            order: 0,
          },
          {
            _id: secondId,
            type: 'short_answer',
            acceptedAnswers: ['pranayama'],
            gradingMode: 'exact',
            points: 1,
            isEnabled: true,
            order: 1,
          },
        ],
        passingRule: { type: 'correct_count', value: 2 },
      };

      const result = gradeAssessmentAnswers(assessment, {
        [String(firstId)]: 'Two',
        [String(secondId)]: ' Pranayama ',
      });

      expect(result.correctCount).toBe(2);
      expect(result.status).toBe('graded');
      expect(result.passed).toBe(true);
    });
  });

  describe('assessment unlock eligibility', () => {
    it('requires learning completion and required assignment passes', async () => {
      const assignment = await Assignment.create({
        title: 'Required quiz',
        order: 1,
        requiredForAssessment: true,
        questions: [],
      });
      const courseWithAssignment = await Course.create({
        title: 'Unlock Course',
        description: 'Course to test assessment unlock.',
        slug: `unlock-${Date.now()}`,
        category: 'yoga',
        duration: '2 weeks',
        status: 'published',
        videos: [{
          title: 'Only video',
          duration: '05:00',
          videoUrl: 'https://example.com/video.mp4',
          order: 0,
        }],
        assignments: [assignment._id],
      });

      const videoId = courseWithAssignment.videos[0]._id;
      const enrollment = await Enrollment.create({
        userId: user._id,
        courseId: courseWithAssignment._id,
        completedVideos: [videoId],
      });

      const blocked = await recalculateAssessmentUnlock(user._id, courseWithAssignment._id);
      expect(blocked.learningComplete).toBe(true);
      expect(blocked.requiredAssignmentsComplete).toBe(false);
      expect(blocked.assessmentUnlocked).toBe(false);

      const { CourseActivitySubmission } = await import('../models/courseActivitySubmission.models.js');
      await CourseActivitySubmission.create({
        userId: user._id,
        courseId: courseWithAssignment._id,
        type: 'quiz',
        assignmentId: assignment._id,
        passed: true,
      });

      const unlocked = await recalculateAssessmentUnlock(user._id, courseWithAssignment._id);
      expect(unlocked.requiredAssignmentsComplete).toBe(true);
      expect(unlocked.assessmentUnlocked).toBe(true);

      const refreshed = await Enrollment.findById(enrollment._id);
      expect(refreshed.assessmentUnlocked).toBe(true);
      expect(refreshed.assessmentUnlockedAt).toBeTruthy();
      expect(refreshed.completedRequiredAssignments.map(String)).toContain(String(assignment._id));
    });
  });

  describe('viva workflow', () => {
    it('applies only after a passing assessment and enforces status transitions', async () => {
      const attempt = await createPassedAttempt({
        userId: user._id,
        courseId: course._id,
        assessmentId: oid(),
      });

      const application = await applyForViva(user._id, course._id, 'Please schedule my viva');
      expect(application.status).toBe('applied');
      expect(application.assessmentAttempt.toString()).toBe(attempt._id.toString());

      const adminId = oid();
      await transitionVivaApplication({
        vivaId: application._id,
        nextStatus: 'under_review',
        adminId,
      });
      await transitionVivaApplication({
        vivaId: application._id,
        nextStatus: 'scheduled',
        adminId,
        payload: {
          scheduledAt: new Date(Date.now() + 86400000),
          meetingPlatform: 'Google Meet',
          meetingLink: 'https://meet.example.com/viva',
        },
      });
      await transitionVivaApplication({
        vivaId: application._id,
        nextStatus: 'completed',
        adminId,
      });
      const passed = await transitionVivaApplication({
        vivaId: application._id,
        nextStatus: 'passed',
        adminId,
        payload: { remarks: 'Clear understanding demonstrated' },
      });

      expect(passed.status).toBe('passed');
      expect(passed.result.remarks).toBe('Clear understanding demonstrated');
      expect(passed.statusHistory).toHaveLength(5);

      await expect(
        transitionVivaApplication({
          vivaId: application._id,
          nextStatus: 'scheduled',
          adminId,
        })
      ).rejects.toThrow('Invalid viva transition');
    });
  });

  describe('safe backfill', () => {
    it('is rerunnable and preserves legacy certificate identity', async () => {
      const legacy = await Certificate.create({
        certificateId: 'LEGACY-BACKFILL-1',
        user: user._id,
        course: course._id,
        issuedTo: user.displayName,
        courseName: course.title,
        issuedAt: new Date('2023-05-01T00:00:00.000Z'),
      });
      const enrollment = await Enrollment.create({
        userId: user._id,
        courseId: course._id,
        isCompleted: true,
        completedAt: new Date('2023-06-01T00:00:00.000Z'),
      });
      await Assignment.collection.insertOne({
        title: 'Legacy assignment',
        order: 1,
        isStandalone: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const dryRun = await runCertificationBackfill({ dryRun: true });
      expect(dryRun.dryRun).toBe(true);
      expect(dryRun.certificatesUpdated).toBeGreaterThanOrEqual(1);
      expect(dryRun.assignmentsUpdated).toBeGreaterThanOrEqual(1);
      expect(dryRun.enrollmentsUpdated).toBeGreaterThanOrEqual(1);

      const untouched = await Certificate.findById(legacy._id);
      expect(untouched.type).toBeUndefined();
      expect(untouched.issuanceKey).toBeUndefined();

      const applied = await runCertificationBackfill({ dryRun: false });
      expect(applied.certificatesUpdated).toBeGreaterThanOrEqual(1);

      const migrated = await Certificate.findById(legacy._id);
      expect(migrated.certificateId).toBe('LEGACY-BACKFILL-1');
      expect(migrated.type).toBe('course_participation');
      expect(migrated.issuanceKey).toBe(`course_participation:${user._id}:${course._id}`);
      expect(migrated.issuedAt.toISOString()).toBe('2023-05-01T00:00:00.000Z');
      expect(migrated.legacy).toBe(true);

      const refreshedEnrollment = await Enrollment.findById(enrollment._id);
      expect(refreshedEnrollment.completionAwardedAt).toBeTruthy();

      const legacyAssignment = await Assignment.findOne({ title: 'Legacy assignment' });
      expect(legacyAssignment.requiredForAssessment).toBe(false);

      const rerun = await runCertificationBackfill({ dryRun: false });
      expect(rerun.certificatesUpdated).toBe(0);
      expect(rerun.enrollmentsUpdated).toBe(0);
    });
  });
});
