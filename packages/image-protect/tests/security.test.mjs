import test from 'node:test';
import assert from 'node:assert/strict';
import { readBodyWithinLimit } from '../src/utils/body.ts';
import {
  detectImageContentType,
  isAllowedImageUpload,
} from '../src/protection/image-validation.ts';
import { generateSignedUrl, validateSignedUrl } from '../src/protection/signed-url.ts';
import { checkRateLimit } from '../src/protection/rate-limiter.ts';
import { getConfig, config } from '../src/config.ts';
import { parseAdminAuthBody } from '../src/utils/auth-body.ts';

test('image type detection checks file signatures and declared type', () => {
  const cases = [
    [[0xff, 0xd8, 0xff, 0x00], 'image/jpeg'],
    [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'image/png'],
    [[0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 'image/gif'],
    [[0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 'image/webp'],
  ];

  for (const [signature, contentType] of cases) {
    const bytes = new Uint8Array(signature);
    assert.equal(detectImageContentType(bytes), contentType);
    assert.equal(isAllowedImageUpload(contentType, bytes, [contentType]), true);
    const mismatchedType = contentType === 'image/png' ? 'image/jpeg' : 'image/png';
    assert.equal(isAllowedImageUpload(mismatchedType, bytes, [mismatchedType]), false);
  }

  assert.equal(detectImageContentType(new TextEncoder().encode('<html>')), null);
});

test('bounded body reader accepts the limit and rejects larger input', async () => {
  const accepted = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
      controller.enqueue(new Uint8Array([3]));
      controller.close();
    },
  });
  assert.deepEqual(await readBodyWithinLimit(accepted, 3), new Uint8Array([1, 2, 3]));

  const rejected = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3, 4]));
    },
  });
  assert.equal(await readBodyWithinLimit(rejected, 3), null);
});

test('signed image URL is bound to the requested image ID', async () => {
  const signedUrl = await generateSignedUrl(
    'https://images.example.test',
    '0123456789abcdef',
    'test-secret',
    3600,
  );
  const validRequest = new Request(signedUrl);
  assert.equal(
    (await validateSignedUrl(validRequest, 'test-secret', '0123456789abcdef')).valid,
    true,
  );

  const alteredUrl = new URL(signedUrl);
  alteredUrl.pathname = '/api/image/fedcba9876543210';
  assert.equal(
    (await validateSignedUrl(new Request(alteredUrl), 'test-secret', 'fedcba9876543210')).valid,
    false,
  );
});

test('rate limiter denies requests when the KV read fails', async () => {
  const kv = {
    async get() {
      throw new Error('KV unavailable');
    },
    async put() {
      assert.fail('put should not run after a failed read');
    },
  };
  const result = await checkRateLimit(kv, 'upload:127.0.0.1', 10, 60);
  assert.equal(result.allowed, false);
  assert.equal(result.unavailable, true);
});

test('rate limiter allows requests when a KV write fails', async () => {
  const firstRequest = await checkRateLimit(
    {
      async get() {
        return null;
      },
      async put() {
        throw new Error('KV write conflict');
      },
    },
    'upload:127.0.0.1',
    10,
    60,
  );
  assert.equal(firstRequest.allowed, true);
  assert.equal(firstRequest.unavailable, undefined);

  const laterRequest = await checkRateLimit(
    {
      async get() {
        return { count: 1, resetAt: Math.floor(Date.now() / 1000) + 60 };
      },
      async put() {
        throw new Error('KV write rate limit');
      },
    },
    'upload:127.0.0.1',
    10,
    60,
  );
  assert.equal(laterRequest.allowed, true);
  assert.equal(laterRequest.unavailable, undefined);
});

test('auth body parser rejects JSON without an object string password', () => {
  const invalidBodies = [
    null,
    [],
    'password',
    {},
    { password: null },
    { password: 1 },
    { password: '' },
  ];

  for (const body of invalidBodies) {
    assert.equal(parseAdminAuthBody(JSON.stringify(body)), null);
  }

  assert.equal(parseAdminAuthBody('not json'), null);
  assert.deepEqual(parseAdminAuthBody('{"password":"secret"}'), {
    password: 'secret',
  });
});

test('configuration rejects unsafe limits and normalizes allowed types', () => {
  const safe = getConfig({
    MAX_FILE_SIZE: '-1',
    RATE_LIMIT_UPLOAD: 'Infinity',
    SIGNED_URL_EXPIRY: '999999999',
    ALLOWED_TYPES: ' image/png, image/jpeg, ,image/png ',
  });
  assert.equal(safe.maxFileSize, config.maxFileSize);
  assert.equal(safe.rateLimits.upload.max, config.rateLimits.upload.max);
  assert.equal(safe.signedUrlExpiry, config.signedUrlExpiry);
  assert.deepEqual(safe.allowedTypes, ['image/png', 'image/jpeg']);
});
