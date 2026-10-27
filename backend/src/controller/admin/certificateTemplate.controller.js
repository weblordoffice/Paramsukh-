import mongoose from 'mongoose';
import { CertificateTemplate } from '../../models/certificate.models.js';

const ALLOWED_FIELDS = new Set([
  'recipientName',
  'courseName',
  'certificateTitle',
  'certificateId',
  'issuedDate',
  'planName',
  'customText',
  'qrCode',
]);

const normalizeFields = (fields) => {
  if (!Array.isArray(fields)) return [];

  return fields
    .filter((field) => field && ALLOWED_FIELDS.has(String(field.key || '')))
    .map((field) => ({
      key: String(field.key),
      type: field.key === 'qrCode' ? 'qr' : 'text',
      label: String(field.label || '').trim(),
      text: String(field.text || '').trim(),
      xPercent: Math.min(100, Math.max(0, Number(field.xPercent) || 0)),
      yPercent: Math.min(100, Math.max(0, Number(field.yPercent) || 0)),
      widthPercent: Math.min(100, Math.max(1, Number(field.widthPercent) || 40)),
      fontSize: Math.min(200, Math.max(4, Number(field.fontSize) || 16)),
      color: /^#[0-9a-fA-F]{6}$/.test(String(field.color || '')) ? String(field.color) : '#2F241F',
      align: ['left', 'center', 'right'].includes(field.align) ? field.align : 'center',
      fontWeight: ['normal', 'bold'].includes(field.fontWeight) ? field.fontWeight : 'normal',
    }));
};

const normalizeCourseId = (value) => {
  if (!value) return null;
  const id = String(value).trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error('Invalid course ID');
    error.status = 400;
    throw error;
  }
  return id;
};

const normalizePayload = (body, { partial = false } = {}) => {
  const payload = {};

  if (body.name !== undefined || !partial) {
    const name = String(body.name || '').trim();
    if (!name) {
      const error = new Error('Template name is required');
      error.status = 400;
      throw error;
    }
    payload.name = name;
  }

  if (body.certificateType !== undefined || !partial) {
    if (!['membership', 'course_participation', 'course_assessment'].includes(body.certificateType)) {
      const error = new Error('Invalid certificate type');
      error.status = 400;
      throw error;
    }
    payload.certificateType = body.certificateType;
  }

  if (body.courseId !== undefined || !partial) {
    payload.courseId = normalizeCourseId(body.courseId);
  }

  if (body.backgroundType !== undefined || !partial) {
    if (!['image', 'pdf'].includes(body.backgroundType)) {
      const error = new Error('Background must be an image or PDF');
      error.status = 400;
      throw error;
    }
    payload.backgroundType = body.backgroundType;
  }

  if (body.backgroundUrl !== undefined || !partial) {
    const backgroundUrl = String(body.backgroundUrl || '').trim();
    if (!backgroundUrl) {
      const error = new Error('Upload a certificate background first');
      error.status = 400;
      throw error;
    }
    payload.backgroundUrl = backgroundUrl;
  }

  if (body.backgroundPublicId !== undefined || !partial) {
    payload.backgroundPublicId = body.backgroundPublicId ? String(body.backgroundPublicId) : null;
  }

  if (body.pageWidth !== undefined || !partial) {
    payload.pageWidth = Math.max(100, Number(body.pageWidth) || 842);
  }

  if (body.pageHeight !== undefined || !partial) {
    payload.pageHeight = Math.max(100, Number(body.pageHeight) || 595);
  }

  if (body.fields !== undefined || !partial) {
    payload.fields = normalizeFields(body.fields);
  }

  if (body.isActive !== undefined) {
    payload.isActive = body.isActive !== false;
  }

  return payload;
};

const deactivateCompetingTemplates = async ({ certificateType, courseId, excludeId = null }) => {
  const query = {
    certificateType,
    courseId: courseId || null,
    isActive: true,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  };
  await CertificateTemplate.updateMany(query, { $set: { isActive: false } });
};

export const listCertificateTemplatesAdmin = async (req, res) => {
  try {
    const query = {};
    if (req.query.certificateType) query.certificateType = req.query.certificateType;
    if (req.query.courseId) query.courseId = req.query.courseId;
    if (req.query.includeInactive !== 'true') query.isActive = true;

    const templates = await CertificateTemplate.find(query)
      .populate('courseId', 'title')
      .sort({ certificateType: 1, courseId: 1, updatedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, templates });
  } catch (error) {
    console.error('List certificate templates error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load certificate templates' });
  }
};

export const getCertificateTemplateAdmin = async (req, res) => {
  try {
    const template = await CertificateTemplate.findById(req.params.id)
      .populate('courseId', 'title')
      .lean();
    if (!template) {
      return res.status(404).json({ success: false, message: 'Certificate template not found' });
    }
    return res.status(200).json({ success: true, template });
  } catch (error) {
    console.error('Get certificate template error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load certificate template' });
  }
};

export const createCertificateTemplateAdmin = async (req, res) => {
  try {
    const payload = normalizePayload(req.body || {});
    const template = await CertificateTemplate.create({
      ...payload,
      version: 1,
      isActive: payload.isActive !== false,
      createdBy: req.admin?._id || null,
      updatedBy: req.admin?._id || null,
    });

    if (template.isActive) {
      await deactivateCompetingTemplates({
        certificateType: template.certificateType,
        courseId: template.courseId,
        excludeId: template._id,
      });
    }

    return res.status(201).json({ success: true, template });
  } catch (error) {
    console.error('Create certificate template error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to create certificate template',
    });
  }
};

export const updateCertificateTemplateAdmin = async (req, res) => {
  try {
    const template = await CertificateTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Certificate template not found' });
    }

    const payload = normalizePayload(req.body || {}, { partial: true });
    Object.assign(template, payload);
    template.version = (template.version || 1) + 1;
    template.updatedBy = req.admin?._id || null;
    await template.save();

    if (template.isActive) {
      await deactivateCompetingTemplates({
        certificateType: template.certificateType,
        courseId: template.courseId,
        excludeId: template._id,
      });
    }

    return res.status(200).json({ success: true, template });
  } catch (error) {
    console.error('Update certificate template error:', error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to update certificate template',
    });
  }
};

export const deactivateCertificateTemplateAdmin = async (req, res) => {
  try {
    const template = await CertificateTemplate.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false, updatedBy: req.admin?._id || null } },
      { new: true }
    );

    if (!template) {
      return res.status(404).json({ success: false, message: 'Certificate template not found' });
    }

    return res.status(200).json({ success: true, template });
  } catch (error) {
    console.error('Deactivate certificate template error:', error);
    return res.status(500).json({ success: false, message: 'Failed to deactivate certificate template' });
  }
};
