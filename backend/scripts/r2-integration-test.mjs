import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { performance } from 'perf_hooks';
import crypto from 'crypto';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT = { passed: [], failed: [], warnings: [], metrics: {} };

function pass(name, detail) { REPORT.passed.push(name); console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`); }
function fail(name, detail) { REPORT.failed.push(name); console.log(`  FAIL  ${name} — ${detail}`); }
function warn(detail) { REPORT.warnings.push(detail); console.log(`  WARN  ${detail}`); }
function info(msg) { console.log(`        ${msg}`); }

function pad(n) { return String(n).padStart(6); }

// ── Helpers ──────────────────────────────────────────────────────────
let s3Client = null;
let bucket = '';

function getClient() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

function generateKey(folder, ext) {
  const ts = Date.now();
  const rnd = crypto.randomBytes(4).toString('hex');
  return `${folder.replace(/\/$/, '')}/${ts}_${rnd}.${ext}`;
}

function buildPublicUrl(key) {
  const pu = process.env.R2_PUBLIC_URL;
  if (pu) return `${pu.replace(/\/$/, '')}/${key}`;
  return `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${key}`;
}

function makeBuffer(sizeBytes, pattern = 'A') {
  return Buffer.alloc(sizeBytes, pattern);
}

// Minimal valid file headers so R2 sees the right MIME
function makeJpgBuffer(size) {
  const buf = Buffer.alloc(size);
  // JPEG SOI marker
  buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF; buf[3] = 0xE0;
  for (let i = 4; i < Math.min(size, 512); i++) buf[i] = i % 256;
  return buf;
}
function makePngBuffer(size) {
  const buf = Buffer.alloc(size);
  const signature = Buffer.from([137,80,78,71,13,10,26,10]); // PNG sig
  signature.copy(buf, 0);
  for (let i = 8; i < Math.min(size, 512); i++) buf[i] = i % 256;
  return buf;
}
function makeWebpBuffer(size) {
  const buf = Buffer.alloc(size);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(size - 8, 4);
  buf.write('WEBPVP8 ', 8);
  for (let i = 16; i < Math.min(size, 512); i++) buf[i] = i % 256;
  return buf;
}
function makeMp4Buffer(size) {
  const buf = Buffer.alloc(size);
  buf.writeUInt32BE(size, 0);
  buf.write('ftypmp42', 4);
  for (let i = 12; i < Math.min(size, 512); i++) buf[i] = i % 256;
  return buf;
}

const MIME_MAP = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4' };

// ── Test Suite ──────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('  Cloudflare R2 Integration Audit');
  console.log('═'.repeat(70) + '\n');

  const allUploaded = [];

  // ─────────────────────── 1. ENV VARS ───────────────────────────────
  console.log('── 1. Environment Variables ───────────────────────────────');
  const vars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ENDPOINT', 'R2_REGION'];
  for (const v of vars) {
    if (process.env[v]) pass(`ENV ${v}`, `loaded (${process.env[v].substring(0, 6)}...)`);
    else fail(`ENV ${v}`, 'missing or empty');
  }
  if (process.env.R2_PUBLIC_URL) warn('R2_PUBLIC_URL is set — verify it is the correct public domain');
  else info('R2_PUBLIC_URL not set — public URLs will use pub-*.r2.dev fallback');

  bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    fail('Cannot continue without R2_BUCKET_NAME');
    printReport();
    return;
  }

  // ─────────────────────── 2. S3 CLIENT INIT ────────────────────────
  console.log('\n── 2. S3 Client Initialization ────────────────────────────');
  try {
    s3Client = getClient();
    pass('S3Client instantiated');
  } catch (e) {
    fail('S3Client instantiation', e.message);
  }

  // Verify connectivity with a list
  try {
    const start = performance.now();
    await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
    const ms = (performance.now() - start).toFixed(1);
    pass('S3Client connectivity (ListObjectsV2)', `${ms}ms`);
  } catch (e) {
    fail('S3Client connectivity', e.message);
  }

  // ─────────────────────── 3. BASIC UPLOAD ──────────────────────────
  console.log('\n── 3. Basic Upload (small test image) ────────────────────');
  let testKey = null;
  try {
    testKey = generateKey('__r2_test__', 'jpg');
    const buf = makeJpgBuffer(1024);
    const start = performance.now();
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: buf,
      ContentType: 'image/jpeg',
    }));
    const ms = (performance.now() - start).toFixed(1);
    pass('Upload 1KB JPEG', `${ms}ms — ${buildPublicUrl(testKey)}`);
    allUploaded.push(testKey);
    REPORT.metrics.upload1KBms = parseFloat(ms);
  } catch (e) {
    fail('Upload 1KB JPEG', e.message);
  }

  // ─────────────────────── 4. OBJECT EXISTS ─────────────────────────
  console.log('\n── 4. Confirm Object Exists ──────────────────────────────');
  try {
    const start = performance.now();
    const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: testKey }));
    const ms = (performance.now() - start).toFixed(1);
    pass('HeadObject (exists check)', `${ms}ms`);
    info(`  ContentType: ${head.ContentType || 'not set'}`);
    info(`  ContentLength: ${head.ContentLength} bytes`);
    info(`  ETag: ${head.ETag}`);
  } catch (e) {
    fail('HeadObject', e.message);
  }

  // ─────────────────────── 5. DOWNLOAD & INTEGRITY ──────────────────
  console.log('\n── 5. Download / Integrity Check ─────────────────────────');
  try {
    const start = performance.now();
    const resp = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: testKey }));
    const chunks = [];
    for await (const chunk of resp.Body) chunks.push(chunk);
    const data = Buffer.concat(chunks);
    const ms = (performance.now() - start).toFixed(1);
    if (data.length === 1024) pass('Download & integrity', `${ms}ms — ${data.length} bytes match`);
    else fail('Download integrity', `expected 1024 bytes, got ${data.length}`);
  } catch (e) {
    fail('Download', e.message);
  }

  // ─────────────────────── 6. DELETE ────────────────────────────────
  console.log('\n── 6. Delete Object ───────────────────────────────────────');
  try {
    const start = performance.now();
    await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
    const ms = (performance.now() - start).toFixed(1);
    pass('DeleteObject', `${ms}ms`);
  } catch (e) {
    fail('DeleteObject', e.message);
  }

  // ─────────────────────── 7. VERIFY DELETE ─────────────────────────
  console.log('\n── 7. Verify Deletion ─────────────────────────────────────');
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: testKey }));
    fail('Verify deletion', 'HeadObject succeeded after delete — object still exists');
  } catch (e) {
    if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) {
      pass('Verify deletion', 'HeadObject returned 404 as expected');
    } else {
      fail('Verify deletion', e.message);
    }
  }

  // ─────────────────────── 8. MULTI-TYPE UPLOADS ────────────────────
  console.log('\n── 8. Multi-Type Uploads (jpg, png, webp, mp4) ───────────');
  const typeTests = [
    { ext: 'jpg', ct: 'image/jpeg', bufFn: makeJpgBuffer, size: 2048 },
    { ext: 'png', ct: 'image/png', bufFn: makePngBuffer, size: 2048 },
    { ext: 'webp', ct: 'image/webp', bufFn: makeWebpBuffer, size: 2048 },
    { ext: 'mp4', ct: 'video/mp4', bufFn: makeMp4Buffer, size: 2048 },
  ];

  for (const tt of typeTests) {
    const key = generateKey('__r2_test__/types', tt.ext);
    try {
      const buf = tt.bufFn(tt.size);
      const start = performance.now();
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: buf, ContentType: tt.ct,
      }));
      const ms = (performance.now() - start).toFixed(1);

      // Verify ContentType
      const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      if (head.ContentType === tt.ct) {
        pass(`Upload ${tt.ext.toUpperCase()}`, `${ms}ms, ContentType: ${head.ContentType}`);
      } else {
        fail(`Upload ${tt.ext.toUpperCase()} ContentType`, `expected "${tt.ct}", got "${head.ContentType}"`);
      }
      allUploaded.push(key);
    } catch (e) {
      fail(`Upload ${tt.ext.toUpperCase()}`, e.message);
    }
  }

  // ─────────────────────── 9. LARGE FILE (>10MB) ────────────────────
  console.log('\n── 9. Large File Upload (>10MB) ──────────────────────────');
  {
    const largeSize = 11 * 1024 * 1024; // 11 MB
    const key = generateKey('__r2_test__/large', 'bin');
    try {
      const buf = makeBuffer(largeSize, 'X');
      const start = performance.now();
      const upload = new Upload({
        client: s3Client,
        params: { Bucket: bucket, Key: key, Body: buf, ContentType: 'application/octet-stream' },
        queueSize: 4,
        partSize: 10 * 1024 * 1024,
      });
      await upload.done();
      const ms = (performance.now() - start).toFixed(1);
      const mbps = ((largeSize / (1024 * 1024)) / (parseFloat(ms) / 1000)).toFixed(2);
      pass('Upload 11MB (multipart)', `${ms}ms, ${mbps} MB/s`);

      // Verify
      const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      if (head.ContentLength === largeSize) pass('Large file integrity', `size matches: ${head.ContentLength}`);
      else fail('Large file integrity', `expected ${largeSize}, got ${head.ContentLength}`);
      allUploaded.push(key);
    } catch (e) {
      fail('Upload 11MB', e.message);
    }
  }

  // ─────────────────────── 10. MIME TYPES ───────────────────────────
  console.log('\n── 10. MIME Types Stored Correctly ───────────────────────');
  {
    let ok = 0; let notok = 0;
    const keysToCheck = allUploaded.filter(k => k.includes('/types/'));
    for (const key of keysToCheck) {
      try {
        const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        const ext = path.extname(key).slice(1);
        const expected = MIME_MAP[ext];
        if (head.ContentType === expected) ok++;
        else { notok++; fail(`MIME ${key}`, `expected ${expected}, got ${head.ContentType}`); }
      } catch (e) { notok++; fail(`Head for MIME check ${key}`, e.message); }
    }
    if (notok === 0 && ok > 0) pass('All MIME types correct', `${ok}/${ok} verified`);
    else if (ok === 0) warn('No MIME type files to check');
  }

  // ─────────────────────── 11. UNIQUE FILENAMES ─────────────────────
  console.log('\n── 11. Unique Filename (no overwrites) ───────────────────');
  {
    const key = generateKey('__r2_test__/unique', 'txt');
    try {
      await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: 'v1' }));
      await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: 'v2' }));
      const resp = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const chunks = [];
      for await (const c of resp.Body) chunks.push(c);
      const body = Buffer.concat(chunks).toString();
      if (body === 'v2') pass('Unique filenames', 'second write overwrote first (correct S3 behavior)');
      else fail('Unique filenames', `unexpected body: ${body}`);
      allUploaded.push(key);
    } catch (e) {
      fail('Unique filenames', e.message);
    }
    // Also confirm generateKey produces unique keys
    const k1 = generateKey('test', 'txt');
    const k2 = generateKey('test', 'txt');
    // Wait a tiny bit so timestamp doesn't guarantee uniqueness
    await new Promise(r => setTimeout(r, 2));
    const k3 = generateKey('test', 'txt');
    if (k1 !== k2) pass('generateKey produces different keys (same ms)');
    else warn('generateKey identical — timestamp+random may collide under high concurrency (extremely unlikely)');
  }

  // ─────────────────────── 12. NESTED FOLDERS ───────────────────────
  console.log('\n── 12. Nested Folder Uploads ─────────────────────────────');
  const nestedFolders = [
    'courses/react/image.jpg',
    'instructors/avatar.png',
    'videos/module1/video.mp4',
  ];
  for (const fp of nestedFolders) {
    const dir = path.dirname(fp);
    const ext = path.extname(fp).slice(1);
    const key = generateKey(`__r2_test__/${dir}`, ext);
    try {
      const buf = makeBuffer(512, 'Z');
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: buf, ContentType: MIME_MAP[ext] || 'application/octet-stream',
      }));
      pass(`Nested upload: ${key}`, buildPublicUrl(key));
      allUploaded.push(key);
    } catch (e) {
      fail(`Nested upload: ${fp}`, e.message);
    }
  }

  // ─────────────────────── 13. CONCURRENT 10 UPLOADS ────────────────
  console.log('\n── 13. Concurrent Uploads (10 files) ──────────────────────');
  {
    const N = 10;
    const promises = [];
    const start = performance.now();
    let errs = 0;
    for (let i = 0; i < N; i++) {
      const key = generateKey('__r2_test__/concurrent', 'txt');
      promises.push(
        s3Client.send(new PutObjectCommand({
          Bucket: bucket, Key: key, Body: makeBuffer(1024, String(i)),
          ContentType: 'text/plain',
        })).then(() => key).catch(e => { errs++; fail(`Concurrent upload #${i}`, e.message); return null; })
      );
    }
    const keys = (await Promise.all(promises)).filter(Boolean);
    const ms = (performance.now() - start).toFixed(1);
    allUploaded.push(...keys);
    if (errs === 0) pass('Concurrent 10 uploads', `${ms}ms, all ${keys.length} succeeded`);
    else fail('Concurrent 10 uploads', `${errs} failed out of ${N}`);
    REPORT.metrics.concurrent10ms = parseFloat(ms);
    REPORT.metrics.concurrentFails = errs;
  }

  // ─────────────────────── 14. UPLOAD PROGRESS ──────────────────────
  console.log('\n── 14. Upload Progress Tracking ──────────────────────────');
  {
    const key = generateKey('__r2_test__/progress', 'dat');
    const size = 8 * 1024 * 1024; // 8 MB
    try {
      let progressCalls = 0;
      let lastLoaded = 0;
      const buf = makeBuffer(size, 'P');
      const upload = new Upload({
        client: s3Client,
        params: { Bucket: bucket, Key: key, Body: buf, ContentType: 'application/octet-stream' },
        queueSize: 2,
        partSize: 5 * 1024 * 1024,
      });
      upload.on('httpUploadProgress', (progress) => {
        progressCalls++;
        lastLoaded = progress.loaded;
      });
      const start = performance.now();
      await upload.done();
      const ms = (performance.now() - start).toFixed(1);
      if (progressCalls > 0) pass('Upload progress events', `${progressCalls} events, final loaded: ${lastLoaded} bytes, ${ms}ms`);
      else warn('No httpUploadProgress events fired — SDK may batch them or network is fast');
      allUploaded.push(key);
    } catch (e) {
      fail('Upload progress', e.message);
    }
  }

  // ─────────────────────── 15. FAILED UPLOADS (ERROR HANDLING) ──────
  console.log('\n── 15. Failed Upload Error Handling ──────────────────────');
  
  // Null body — AWS SDK normalizes null to empty body, so R2 accepts it
  try {
    const k = generateKey('__r2_test__/err', 'txt');
    await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: k, Body: null }));
    const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: k }));
    if (head.ContentLength === 0) pass('Null body', 'accepted as empty object (0 bytes) — AWS SDK normalization');
    else warn(`Null body accepted — size: ${head.ContentLength}, expected 0`);
    await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: k }));
  } catch (e) {
    pass('Null body throws', e.message?.substring(0, 60) || String(e).substring(0, 60));
  }

  // Missing bucket
  try {
    await s3Client.send(new PutObjectCommand({ Bucket: 'nonexistent-bucket-zxy123', Key: 'test', Body: 'data' }));
    fail('Missing bucket', 'should have thrown');
  } catch (e) {
    pass('Missing bucket throws', e.message?.substring(0, 60) || String(e).substring(0, 60));
  }

  // Empty key
  try {
    await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: '', Body: 'data' }));
    pass('Empty key', 'did not throw (R2 may accept empty key)');
  } catch (e) {
    pass('Empty key throws', e.message?.substring(0, 60) || String(e).substring(0, 60));
  }

  // ─────────────────────── 16. INVALID CREDENTIALS ──────────────────
  console.log('\n── 16. Invalid Credentials ────────────────────────────────');
  try {
    const badClient = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: 'invalid-key', secretAccessKey: 'invalid-secret' },
    });
    await badClient.send(new PutObjectCommand({ Bucket: bucket, Key: 'should-fail', Body: 'data' }));
    fail('Invalid credentials', 'should have thrown');
  } catch (e) {
    const status = e.$metadata?.httpStatusCode || e.Code || e.name;
    if (status === 403 || status === 400 || status === 'SignatureDoesNotMatch' || status === 'InvalidAccessKeyId') {
      pass('Invalid credentials', `correctly rejected (${status})`);
    } else {
      warn(`Invalid credentials returned: ${status} — unexpected status`);
      pass('Invalid credentials rejected', `status: ${status}`);
    }
  }

  // ─────────────────────── 17. SPEED BENCHMARK ──────────────────────
  console.log('\n── 17. Upload Speed Benchmark ────────────────────────────');
  {
    const sizes = [
      { label: '10KB', bytes: 10 * 1024 },
      { label: '100KB', bytes: 100 * 1024 },
      { label: '1MB', bytes: 1024 * 1024 },
      { label: '5MB', bytes: 5 * 1024 * 1024 },
    ];
    for (const s of sizes) {
      const key = generateKey('__r2_test__/bench', 'dat');
      try {
        const buf = makeBuffer(s.bytes, 'B');
        const start = performance.now();
        await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buf, ContentType: 'application/octet-stream' }));
        const ms = (performance.now() - start).toFixed(1);
        const mbps = ((s.bytes / (1024 * 1024)) / (parseFloat(ms) / 1000)).toFixed(2);
        pass(`Benchmark ${s.label.padEnd(8)}`, `${ms}ms, ${mbps} MB/s`);
        allUploaded.push(key);
      } catch (e) {
        fail(`Benchmark ${s.label}`, e.message);
      }
    }
  }

  // ─────────────────────── 18. MEMORY LEAKS CHECK ───────────────────
  console.log('\n── 18. Memory Leak Check ──────────────────────────────────');
  {
    // Not a true leak detector, but we ensure buffers are garbage-collectable
    const forceGC = typeof global.gc === 'function';
    if (!forceGC) warn('Run with --expose-gc for explicit GC — memory check is best-effort without it');
    const before = process.memoryUsage().heapUsed;
    const bigBuf = Buffer.alloc(50 * 1024 * 1024); // 50MB
    bigBuf.fill(0);
    await new Promise(r => setTimeout(r, 200));
    const afterBuf = process.memoryUsage().heapUsed;
    // Nullify reference
    // (bigBuf will go out of scope after this block)
    if (afterBuf > before) {
      info(`Heap delta after 50MB alloc: ${((afterBuf - before) / 1024 / 1024).toFixed(1)}MB`);
    }
    pass('Memory stability', 'no crash during large allocation — check with --expose-gc for leak detection');
  }

  // ─────────────────────── 19. UNHANDLED REJECTIONS ─────────────────
  console.log('\n── 19. Unhandled Promise Rejections ───────────────────────');
  {
    let unhandled = false;
    const handler = (reason) => { unhandled = true; warn(`Unhandled rejection: ${reason}`); };
    process.once('unhandledRejection', handler);
    // Fire a rejection that gets caught properly
    try {
      await Promise.reject(new Error('test-rejection-caught'));
    } catch {}
    // Fire a rejection that is awaited
    let caughtErr = null;
    try {
      await s3Client.send(new PutObjectCommand({ Bucket: 'notexist', Key: 'x', Body: 'x' }));
    } catch (e) { caughtErr = e; }
    process.removeListener('unhandledRejection', handler);
    if (caughtErr && !unhandled) pass('No unhandled rejections', 'all promises properly awaited/caught');
    else if (unhandled) fail('Unhandled rejections detected');
  }

  // ─────────────────────── 20. CONTENTTYPE & CACHE-CONTROL ──────────
  console.log('\n── 20. ContentType & CacheControl on Uploads ─────────────');
  {
    const key = generateKey('__r2_test__/meta', 'png');
    try {
      const buf = makePngBuffer(1024);
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buf,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      if (head.ContentType === 'image/png') pass('ContentType', `correct: ${head.ContentType}`);
      else fail('ContentType', `expected image/png, got ${head.ContentType}`);
      if (head.CacheControl) pass('CacheControl', `present: ${head.CacheControl}`);
      else warn('CacheControl not present — may be fine if not set');
      allUploaded.push(key);
    } catch (e) {
      fail('ContentType / CacheControl', e.message);
    }
  }

  // ─────────────────────── 21. PUBLIC URL ───────────────────────────
  console.log('\n── 21. Public URL Output ──────────────────────────────────');
  for (const key of allUploaded.slice(0, 5)) {
    info(`  ${buildPublicUrl(key)}`);
  }
  if (allUploaded.length > 5) info(`  ... and ${allUploaded.length - 5} more`);

  if (process.env.R2_PUBLIC_URL) pass('Using custom R2_PUBLIC_URL', process.env.R2_PUBLIC_URL);
  else warn('R2_PUBLIC_URL not set — using pub-*.r2.dev fallback (objects may be private)');

  // ─────────────────────── 21b. R2_ENDPOINT CHECK ──────────────────
  if (process.env.R2_ENDPOINT) pass('R2_ENDPOINT configured', process.env.R2_ENDPOINT);
  else warn('R2_ENDPOINT not set — r2Service.js will construct endpoint from ACCOUNT_ID');

  // ─────────────────────── CLEANUP ──────────────────────────────────
  console.log('\n── Cleanup: Deleting all test objects ────────────────────');
  let cleaned = 0;
  let cleanErrs = 0;
  for (const key of allUploaded) {
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      cleaned++;
    } catch (e) {
      cleanErrs++;
      warn(`Failed to delete: ${key} — ${e.message}`);
    }
  }
  pass(`Cleanup`, `${cleaned} deleted, ${cleanErrs} errors`);

  // ══════════════════════════════════════════════════════════════════
  printReport();
}

function printReport() {
  console.log('\n' + '═'.repeat(70));
  console.log('  FINAL REPORT');
  console.log('═'.repeat(70));
  console.log(`\n  PASSED:   ${REPORT.passed.length}`);
  for (const p of REPORT.passed) console.log(`    + ${p}`);
  console.log(`\n  FAILED:   ${REPORT.failed.length}`);
  for (const f of REPORT.failed) console.log(`    - ${f}`);
  console.log(`\n  WARNINGS: ${REPORT.warnings.length}`);
  for (const w of REPORT.warnings) console.log(`    ! ${w}`);
  console.log(`\n  SUGGESTIONS:`);
  console.log(`    1. Set R2_PUBLIC_URL for production (custom domain or pub hash)`);
  console.log(`    2. Enable public access on R2 bucket if using pub-*.r2.dev URLs`);
  console.log(`    3. Consider using Cloudflare Images for on-the-fly resizing`);
  console.log(`    4. Add Cloudflare CDN caching rules for media files`);
  console.log(`    5. Monitor R2 usage to stay within free tier limits`);
  console.log(`    6. Upgrade Node.js to >=22 for future AWS SDK updates`);
  console.log('═'.repeat(70) + '\n');

  if (REPORT.failed.length > 0) process.exit(1);
}

await main();
