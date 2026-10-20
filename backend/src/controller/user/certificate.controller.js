import QRCode from 'qrcode';
import { Certificate } from '../../models/certificate.models.js';
import { Enrollment } from '../../models/enrollment.models.js';
import { generateCertificateRecord } from '../../services/certificate.service.js';

const getPublicBaseUrl = (req) => {
  const configured = String(
    process.env.PUBLIC_API_URL
    || process.env.BACKEND_PUBLIC_URL
    || process.env.API_PUBLIC_URL
    || ''
  ).trim().replace(/\/$/, '');

  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}`;
};

const buildCertificateLinks = (req, certificate) => {
  const baseUrl = getPublicBaseUrl(req);
  return {
    verificationUrl: `${baseUrl}/api/certificates/verify/${certificate.certificateId}`,
    viewUrl: `${baseUrl}/api/certificates/${certificate.certificateId}/view`,
  };
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export const verifyByCertificateId = async (req, res) => {
  try {
    const { certificateId } = req.params;
    if (!certificateId || typeof certificateId !== 'string' || certificateId.length < 8) {
      return res.status(400).json({ success: false, valid: false, message: 'Invalid certificate ID format' });
    }
    const cert = await Certificate.findOne({ certificateId, isRevoked: false });
    if (!cert) {
      return res.status(404).json({ success: false, valid: false, message: 'Certificate not found or has been revoked' });
    }
    return res.status(200).json({
      success: true,
      valid: true,
      certificate: {
        certificateId: cert.certificateId,
        issuedTo: cert.issuedTo,
        courseName: cert.courseName,
        issuedAt: cert.issuedAt
      }
    });
  } catch (error) {
    console.error('Certificate verification error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all certificates earned by the authenticated user
 */
export const getUserCertificates = async (req, res) => {
  try {
    const userId = req.user._id;
    const certificates = await Certificate.find({ user: userId, isRevoked: false })
      .sort({ issuedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      certificates: certificates.map((certificate) => ({
        ...certificate,
        ...buildCertificateLinks(req, certificate),
      }))
    });
  } catch (error) {
    console.error('❌ Get user certificates error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error fetching certificates.',
      error: error.message
    });
  }
};

/**
 * Manually generate/claim a certificate for a 100% completed course
 */
export const generateCertificate = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;

    const enrollment = await Enrollment.findOne({ userId, courseId });
    if (!enrollment || !enrollment.isCompleted) {
      return res.status(400).json({
        success: false,
        message: 'Course must be 100% completed to claim a certificate.'
      });
    }

    const certificate = await generateCertificateRecord(userId, courseId);

    return res.status(200).json({
      success: true,
      message: 'Certificate generated successfully.',
      certificate: {
        ...certificate.toObject(),
        ...buildCertificateLinks(req, certificate),
      }
    });
  } catch (error) {
    console.error('❌ Claim certificate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error generating certificate.',
      error: error.message
    });
  }
};

/**
 * Public printable certificate page.
 * GET /api/certificates/:certificateId/view
 */
export const renderCertificateView = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const certificate = await Certificate.findOne({ certificateId, isRevoked: false }).lean();

    if (!certificate) {
      return res.status(404).send('<!doctype html><html><body style="font-family:sans-serif;padding:40px"><h2>Certificate not found</h2><p>This certificate may have been revoked or does not exist.</p></body></html>');
    }

    const links = buildCertificateLinks(req, certificate);
    const qrDataUrl = await QRCode.toDataURL(links.verificationUrl, {
      margin: 1,
      width: 180,
      color: { dark: '#1f2937', light: '#ffffff' },
    });
    const issuedDate = new Date(certificate.issuedAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ParamSukh Certificate - ${escapeHtml(certificate.courseName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; background: #f5f0e8; font-family: Georgia, 'Times New Roman', serif; color: #2f241f; }
    .certificate { max-width: 920px; margin: 0 auto; background: #fffdf8; border: 10px solid #e9dcc7; padding: 48px 56px; position: relative; box-shadow: 0 18px 50px rgba(47,36,31,.12); }
    .certificate:before { content: ''; position: absolute; inset: 14px; border: 1px solid #c9a96b; pointer-events: none; }
    .brand { text-align: center; font-size: 15px; letter-spacing: 4px; text-transform: uppercase; color: #b07d32; font-weight: 700; }
    .title { text-align: center; font-size: 42px; margin: 28px 0 8px; color: #3b2c24; }
    .subtitle { text-align: center; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #8a7564; }
    .recipient { text-align: center; font-size: 32px; margin: 40px 0 8px; color: #b07d32; font-style: italic; }
    .copy { text-align: center; font-size: 16px; color: #6b584a; margin: 8px 0; }
    .course { text-align: center; font-size: 28px; margin: 18px 0 34px; color: #2f241f; font-weight: 700; }
    .footer { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-top: 36px; }
    .footer-block { font-size: 13px; color: #6b584a; }
    .footer-block strong { display: block; color: #2f241f; margin-top: 4px; font-size: 14px; }
    .qr { text-align: center; }
    .qr img { width: 120px; height: 120px; }
    .qr span { display: block; font-size: 11px; color: #8a7564; margin-top: 6px; }
    .actions { max-width: 920px; margin: 22px auto 0; display: flex; gap: 12px; justify-content: center; }
    .actions button, .actions a { border: 0; border-radius: 10px; padding: 12px 22px; font-size: 14px; font-weight: 700; cursor: pointer; text-decoration: none; }
    .actions button { background: #f1842d; color: white; }
    .actions a { background: white; color: #2f241f; border: 1px solid #d8cbb8; }
    @media print {
      body { padding: 0; background: white; }
      .certificate { box-shadow: none; border-width: 8px; }
      .actions { display: none; }
    }
    @media (max-width: 640px) {
      body { padding: 12px; }
      .certificate { padding: 28px 24px; }
      .title { font-size: 30px; }
      .recipient { font-size: 24px; }
      .course { font-size: 20px; }
      .footer { flex-direction: column; align-items: center; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="brand">ParamSukh Total Wellness Gurukul</div>
    <h1 class="title">Certificate of Completion</h1>
    <div class="subtitle">This certificate is proudly presented to</div>
    <div class="recipient">${escapeHtml(certificate.issuedTo)}</div>
    <p class="copy">for successfully completing</p>
    <div class="course">${escapeHtml(certificate.courseName)}</div>
    <div class="footer">
      <div class="footer-block">
        Date issued
        <strong>${escapeHtml(issuedDate)}</strong>
      </div>
      <div class="qr">
        <img src="${qrDataUrl}" alt="Certificate QR code" />
        <span>Scan to verify</span>
      </div>
      <div class="footer-block" style="text-align:right">
        Certificate ID
        <strong>${escapeHtml(certificate.certificateId)}</strong>
      </div>
    </div>
  </div>
  <div class="actions">
    <button onclick="window.print()">Download / Print</button>
    <a href="${escapeHtml(links.verificationUrl)}" target="_blank" rel="noopener">Verify Online</a>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Render Certificate Error:', error);
    return res.status(500).send('<!doctype html><html><body style="font-family:sans-serif;padding:40px"><h2>Unable to load certificate</h2><p>Please try again later.</p></body></html>');
  }
};
