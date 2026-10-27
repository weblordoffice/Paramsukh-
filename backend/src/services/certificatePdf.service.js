import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { CertificateTemplate } from '../models/certificate.models.js';

const DEFAULT_PAGE_WIDTH = 842;
const DEFAULT_PAGE_HEIGHT = 595;

const DEFAULT_FIELDS = [
  { key: 'certificateTitle', type: 'text', xPercent: 10, yPercent: 16, widthPercent: 80, fontSize: 34, align: 'center', fontWeight: 'bold', color: '#2F241F' },
  { key: 'recipientName', type: 'text', xPercent: 10, yPercent: 36, widthPercent: 80, fontSize: 30, align: 'center', fontWeight: 'bold', color: '#B07D32' },
  { key: 'courseName', type: 'text', xPercent: 12, yPercent: 50, widthPercent: 76, fontSize: 20, align: 'center', fontWeight: 'normal', color: '#2F241F' },
  { key: 'certificateId', type: 'text', xPercent: 3, yPercent: 82, widthPercent: 38, fontSize: 11, align: 'center', fontWeight: 'normal', color: '#6B584A' },
  { key: 'issuedDate', type: 'text', xPercent: 59, yPercent: 82, widthPercent: 38, fontSize: 11, align: 'center', fontWeight: 'normal', color: '#6B584A' },
  { key: 'qrCode', type: 'qr', xPercent: 44, yPercent: 78, widthPercent: 12, fontSize: 12, align: 'center', fontWeight: 'normal', color: '#2F241F' },
];

const hexToRgb = (value) => {
  const hex = String(value || '#2F241F').replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
  const parsed = Number.parseInt(normalized, 16);
  if (!Number.isFinite(parsed) || normalized.length !== 6) return rgb(0.18, 0.14, 0.12);
  return rgb(
    ((parsed >> 16) & 255) / 255,
    ((parsed >> 8) & 255) / 255,
    (parsed & 255) / 255
  );
};

const fetchBinary = async (url) => {
  const value = String(url || '');
  const dataMatch = value.match(/^data:([^;]+);base64,(.*)$/);
  if (dataMatch) {
    return { bytes: Buffer.from(dataMatch[2], 'base64'), mimeType: dataMatch[1] };
  }

  const response = await fetch(value);
  if (!response.ok) throw new Error(`Could not download certificate background (${response.status})`);
  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    mimeType: String(response.headers.get('content-type') || '').split(';')[0],
  };
};

const buildFieldValues = (certificate, verificationUrl) => {
  const title = certificate.title || (
    certificate.type === 'membership'
      ? 'Membership Certificate'
      : certificate.type === 'course_assessment'
        ? 'Course Assessment Certificate'
        : 'Certificate of Completion'
  );

  return {
    recipientName: certificate.issuedTo || 'ParamSukh Learner',
    courseName: certificate.courseName || certificate.planName || '',
    certificateTitle: title,
    certificateId: certificate.certificateId || '',
    issuedDate: new Date(certificate.issuedAt || Date.now()).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    planName: certificate.planName || certificate.courseName || '',
    customText: '',
    qrCode: verificationUrl || '',
  };
};

const resolveFieldValue = (field, values) => {
  if (field.key === 'customText') return field.text || '';
  return values[field.key] || '';
};

const wrapText = (text, font, size, maxWidth) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const drawTextField = (page, field, font, value, pageWidth, pageHeight) => {
  const size = Math.max(4, Number(field.fontSize) || 16);
  const boxWidth = Math.max(20, (Number(field.widthPercent) || 60) * pageWidth / 100);
  const top = (Number(field.yPercent) || 0) * pageHeight / 100;
  const left = (Number(field.xPercent) || 0) * pageWidth / 100;
  const lines = wrapText(value, font, size, boxWidth);
  const lineHeight = size * 1.2;

  lines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, size);
    let x = left;
    if (field.align === 'center') x = left + (boxWidth - lineWidth) / 2;
    if (field.align === 'right') x = left + boxWidth - lineWidth;
    const y = pageHeight - top - size - index * lineHeight;
    page.drawText(line, {
      x,
      y,
      size,
      font,
      color: hexToRgb(field.color),
    });
  });
};

const drawQrField = async (page, field, pdfDoc, value, pageWidth, pageHeight) => {
  if (!value) return;
  const size = Math.max(24, (Number(field.widthPercent) || 12) * pageWidth / 100);
  const top = (Number(field.yPercent) || 0) * pageHeight / 100;
  const left = (Number(field.xPercent) || 44) * pageWidth / 100;
  const boxWidth = (Number(field.widthPercent) || 12) * pageWidth / 100;
  const buffer = await QRCode.toBuffer(value, {
    type: 'png',
    margin: 1,
    width: Math.max(120, Math.round(size * 3)),
    color: { dark: '#1F2937', light: '#FFFFFF' },
  });
  const image = await pdfDoc.embedPng(buffer);
  page.drawImage(image, {
    x: left + (boxWidth - size) / 2,
    y: pageHeight - top - size,
    width: size,
    height: size,
  });
};

const drawFields = async (pdfDoc, page, template, certificate, verificationUrl) => {
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const values = buildFieldValues(certificate, verificationUrl);

  for (const field of template.fields || []) {
    if (field.key === 'qrCode' || field.type === 'qr') {
      await drawQrField(page, field, pdfDoc, values.qrCode, pageWidth, pageHeight);
      continue;
    }

    const font = await pdfDoc.embedFont(
      field.fontWeight === 'bold' ? StandardFonts.HelveticaBold : StandardFonts.Helvetica
    );
    drawTextField(page, field, font, resolveFieldValue(field, values), pageWidth, pageHeight);
  }
};

const buildDefaultTemplate = () => ({
  backgroundType: null,
  pageWidth: DEFAULT_PAGE_WIDTH,
  pageHeight: DEFAULT_PAGE_HEIGHT,
  fields: DEFAULT_FIELDS,
});

const templateSnapshot = (template) => ({
  templateId: template._id,
  version: template.version || 1,
  backgroundType: template.backgroundType,
  backgroundUrl: template.backgroundUrl,
  pageWidth: template.pageWidth || DEFAULT_PAGE_WIDTH,
  pageHeight: template.pageHeight || DEFAULT_PAGE_HEIGHT,
  fields: (template.fields || []).map((field) => (
    typeof field.toObject === 'function' ? field.toObject() : { ...field }
  )),
});

export const resolveTemplateForCertificate = async (certificate) => {
  const type = certificate.type || 'course_participation';
  let template = null;

  if (certificate.course) {
    template = await CertificateTemplate.findOne({
      certificateType: type,
      courseId: certificate.course,
      isActive: true,
    }).sort({ updatedAt: -1 });
  }

  if (!template) {
    template = await CertificateTemplate.findOne({
      certificateType: type,
      courseId: null,
      isActive: true,
    }).sort({ updatedAt: -1 });
  }

  return template;
};

export const attachTemplateToCertificate = async (certificate) => {
  if (!certificate) return null;
  if (certificate.templateSnapshot) return certificate.templateSnapshot;

  const template = await resolveTemplateForCertificate(certificate);
  if (!template) return null;

  certificate.templateId = template._id;
  certificate.templateVersion = template.version || 1;
  certificate.templateSnapshot = templateSnapshot(template);
  await certificate.save();
  return certificate.templateSnapshot;
};

const getSnapshot = async (certificate) => {
  if (certificate.templateSnapshot) return certificate.templateSnapshot;
  return attachTemplateToCertificate(certificate);
};

export const buildCertificatePdfBuffer = async (certificate, verificationUrl) => {
  const snapshot = await getSnapshot(certificate);
  const template = snapshot || buildDefaultTemplate();
  const pdfDoc = await PDFDocument.create();

  pdfDoc.setTitle(certificate.title || 'ParamSukh Certificate');
  pdfDoc.setAuthor('ParamSukh Online Gurukul');
  pdfDoc.setSubject(certificate.courseName || certificate.planName || 'Certificate');

  let page;
  if (template.backgroundType && template.backgroundUrl) {
    const background = await fetchBinary(template.backgroundUrl);
    if (template.backgroundType === 'pdf') {
      const source = await PDFDocument.load(background.bytes);
      const [sourcePage] = await pdfDoc.copyPages(source, [0]);
      pdfDoc.addPage(sourcePage);
      page = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
    } else {
      page = pdfDoc.addPage([
        Number(template.pageWidth) || DEFAULT_PAGE_WIDTH,
        Number(template.pageHeight) || DEFAULT_PAGE_HEIGHT,
      ]);
      const image = background.mimeType === 'image/png'
        ? await pdfDoc.embedPng(background.bytes)
        : await pdfDoc.embedJpg(background.bytes);
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();
      const scale = Math.min(pageWidth / image.width, pageHeight / image.height);
      page.drawImage(image, {
        x: (pageWidth - image.width * scale) / 2,
        y: (pageHeight - image.height * scale) / 2,
        width: image.width * scale,
        height: image.height * scale,
      });
    }
  } else {
    page = pdfDoc.addPage([DEFAULT_PAGE_WIDTH, DEFAULT_PAGE_HEIGHT]);
    page.drawRectangle({
      x: 26,
      y: 26,
      width: DEFAULT_PAGE_WIDTH - 52,
      height: DEFAULT_PAGE_HEIGHT - 52,
      borderColor: rgb(0.78, 0.66, 0.42),
      borderWidth: 2,
    });
  }

  await drawFields(pdfDoc, page, template, certificate, verificationUrl);
  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
};
