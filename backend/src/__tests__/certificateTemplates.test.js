import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import createTestApp from './app.js';
import { setupDB } from './db.js';
import { Certificate, CertificateTemplate } from '../models/certificate.models.js';
import {
  createTestAdmin,
  createTestUser,
  generateAdminToken,
  getAuthHeader,
} from './helpers.js';

const app = createTestApp();
setupDB();

const unique = () => `${Date.now()}${Math.floor(Math.random() * 10000)}`;

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZP6sAAAAASUVORK5CYII=';
const TINY_PDF = 'data:application/pdf;base64,JVBERi0xLjcKJYGBgYEKCjUgMCBvYmoKPDwKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL1R5cGUgL09ialN0bQovTiA0Ci9GaXJzdCAyMAovTGVuZ3RoIDI2Mgo+PgpzdHJlYW0KeJzVUk1LxDAQvedXzFFPmaRp05VS0H5cRFgWT8oewjYsBdlI2wX99740q+JBPEt45OO9yUzyRhGTJmMoI1uSoTzTVFVCPr6/epJbd/SzkPfjMNMzWKYd7YVswvm0kBJ1Lb61jVvcSziKFEQqij8V2ykM54OfqOq7vme2zFwYoGDWLeYG2AAae3C6xBqw5gKc2Yw5uwXXJxQ2xUR+1eaX+A4ztEXUtElryrT/yhtzdekO/Vc9m1rIhzC0bvF01d5o1oVibVWelUY9XeM7Ju+W8H8ft9Y/htOvL/zhc7Q3mjz52AOry3Ln53CeDrAdujr+lx9Gdxfe0DWMgeyEqtE7ID8AQTeN1wplbmRzdHJlYW0KZW5kb2JqCgo2IDAgb2JqCjw8Ci9TaXplIDcKL1Jvb3QgMiAwIFIKL0luZm8gMyAwIFIKL0ZpbHRlciAvRmxhdGVEZWNvZGUKL1R5cGUgL1hSZWYKL0xlbmd0aCAzNAovVyBbIDEgMiAyIF0KL0luZGV4IFsgMCA3IF0KPj4Kc3RyZWFtCnicFcQxDgAgCASwHsbdB/t3CB2K7nLZstV24pF8BkOPArAKZW5kc3RyZWFtCmVuZG9iagoKc3RhcnR4cmVmCjM4MAolJUVPRg==';

const adminHeaders = async (permissions = ['manage_users']) => {
  const admin = await createTestAdmin({
    email: `cert-template-admin-${unique()}@test.com`,
    permissions,
  });
  return getAuthHeader(generateAdminToken(admin._id));
};

const createCertificate = async (overrides = {}) => {
  const user = await createTestUser({ email: `cert-owner-${unique()}@test.com` });
  return Certificate.create({
    certificateId: `PS-CERT-TEST-${unique()}`,
    type: 'course_participation',
    user: user._id,
    issuedTo: 'Aarav Sharma',
    courseName: 'Foundations of Daily Wellness',
    title: 'Certificate of Completion',
    issuedAt: new Date(),
    ...overrides,
  });
};

const templateFields = [
  { key: 'recipientName', type: 'text', xPercent: 10, yPercent: 30, widthPercent: 80, fontSize: 24, color: '#2F241F', align: 'center', fontWeight: 'bold' },
  { key: 'certificateId', type: 'text', xPercent: 5, yPercent: 85, widthPercent: 40, fontSize: 10, color: '#6B584A', align: 'center', fontWeight: 'normal' },
  { key: 'qrCode', type: 'qr', xPercent: 45, yPercent: 80, widthPercent: 10, fontSize: 10, color: '#2F241F', align: 'center', fontWeight: 'normal' },
];

describe('Certificate templates', () => {
  it('creates, lists, updates, and deactivates a template', async () => {
    const headers = await adminHeaders();

    const created = await request(app)
      .post('/api/admin/certificate-templates')
      .set(headers)
      .send({
        name: 'Default Assessment',
        certificateType: 'course_assessment',
        backgroundType: 'image',
        backgroundUrl: TINY_PNG,
        pageWidth: 842,
        pageHeight: 595,
        fields: templateFields,
        isActive: true,
      });

    expect(created.status).toBe(201);
    expect(created.body.template.name).toBe('Default Assessment');
    expect(created.body.template.fields).toHaveLength(3);

    const list = await request(app)
      .get('/api/admin/certificate-templates?includeInactive=true')
      .set(headers);
    expect(list.status).toBe(200);
    expect(list.body.templates).toHaveLength(1);

    const updated = await request(app)
      .put(`/api/admin/certificate-templates/${created.body.template._id}`)
      .set(headers)
      .send({ name: 'Updated Assessment', fields: templateFields.slice(0, 2) });
    expect(updated.status).toBe(200);
    expect(updated.body.template.name).toBe('Updated Assessment');
    expect(updated.body.template.version).toBe(2);

    const deactivated = await request(app)
      .delete(`/api/admin/certificate-templates/${created.body.template._id}`)
      .set(headers);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.template.isActive).toBe(false);
  });

  it('keeps only one active template per certificate type and course scope', async () => {
    const headers = await adminHeaders();
    const payload = {
      certificateType: 'membership',
      backgroundType: 'image',
      backgroundUrl: TINY_PNG,
      pageWidth: 842,
      pageHeight: 595,
      fields: templateFields,
      isActive: true,
    };

    const first = await request(app)
      .post('/api/admin/certificate-templates')
      .set(headers)
      .send({ ...payload, name: 'First Membership' });
    const second = await request(app)
      .post('/api/admin/certificate-templates')
      .set(headers)
      .send({ ...payload, name: 'Second Membership' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const storedFirst = await CertificateTemplate.findById(first.body.template._id).lean();
    expect(storedFirst.isActive).toBe(false);
  });

  it('requires manage_users to manage templates', async () => {
    const headers = await adminHeaders(['manage_courses']);
    const response = await request(app)
      .get('/api/admin/certificate-templates')
      .set(headers);
    expect(response.status).toBe(403);
  });

  it('downloads a generated PDF using an image background', async () => {
    const headers = await adminHeaders();
    const template = await request(app)
      .post('/api/admin/certificate-templates')
      .set(headers)
      .send({
        name: 'Participation Image',
        certificateType: 'course_participation',
        backgroundType: 'image',
        backgroundUrl: TINY_PNG,
        pageWidth: 842,
        pageHeight: 595,
        fields: templateFields,
        isActive: true,
      });

    const certificate = await createCertificate();
    const response = await request(app)
      .get(`/api/certificates/${certificate.certificateId}/download`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.slice(0, 4).toString()).toBe('%PDF');

    const stored = await Certificate.findById(certificate._id).lean();
    expect(String(stored.templateId)).toBe(String(template.body.template._id));
    expect(stored.templateSnapshot).toBeTruthy();
  });

  it('downloads a generated PDF using a PDF background', async () => {
    const headers = await adminHeaders();

    const created = await request(app)
      .post('/api/admin/certificate-templates')
      .set(headers)
      .send({
        name: 'PDF Background',
        certificateType: 'course_assessment',
        backgroundType: 'pdf',
        backgroundUrl: TINY_PDF,
        pageWidth: 400,
        pageHeight: 300,
        fields: templateFields,
        isActive: true,
      });
    expect(created.status).toBe(201);

    const certificate = await createCertificate({
      type: 'course_assessment',
      title: 'Course Assessment Certificate',
    });
    const response = await request(app)
      .get(`/api/certificates/${certificate.certificateId}/download`);

    expect(response.status).toBe(200);
    expect(response.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it('falls back to a default PDF when no template exists', async () => {
    const certificate = await createCertificate();
    const response = await request(app)
      .get(`/api/certificates/${certificate.certificateId}/download`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it('does not download a revoked certificate PDF', async () => {
    const certificate = await createCertificate({
      status: 'revoked',
      isRevoked: true,
      revocationReason: 'Test revocation',
    });
    const response = await request(app)
      .get(`/api/certificates/${certificate.certificateId}/download`);
    expect(response.status).toBe(404);
  });
});
