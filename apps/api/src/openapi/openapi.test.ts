import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV ??= 'test';
const { app } = await import('../app');

test('GET /openapi.json returns valid OpenAPI 3.1 specification', async () => {
  const res = await app.request('/openapi.json');

  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /application\/json/);

  const spec = (await res.json()) as {
    openapi: string;
    info: { title: string; version: string };
    components: {
      securitySchemes: Record<string, { type: string }>;
    };
  };

  assert.equal(spec.openapi, '3.1.0');
  assert.equal(spec.info.title, 'Morphic AI Gateway');
  assert.equal(spec.info.version, '1.0.0');
  assert.ok(spec.components.securitySchemes.ApiKeyAuth);
  assert.ok(spec.components.securitySchemes.SessionAuth);

  const paths = (spec as unknown as { paths: Record<string, Record<string, { summary: string; tags: string[] }>> }).paths;
  assert.ok(paths['/v1/models']);
  assert.ok(paths['/v1/models'].get);
  assert.equal(paths['/v1/models'].get.summary, 'List Models');

  assert.ok(paths['/v1/models/{id}']);
  assert.ok(paths['/v1/models/{id}'].get);
  assert.equal(paths['/v1/models/{id}'].get.summary, 'Get Model Details');

  assert.ok(paths['/v1/chat/completions']);
  assert.ok(paths['/v1/chat/completions'].post);
  assert.equal(paths['/v1/chat/completions'].post.summary, 'Create Chat Completion');
});

test('GET /docs returns Scalar API documentation HTML', async () => {
  const res = await app.request('/docs');

  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /text\/html/);

  const html = await res.text();
  assert.ok(html.includes('<title>Morphic API Reference</title>'));
  assert.ok(html.includes('/openapi.json'));
});

test('GET /health route remains healthy and unaffected', async () => {
  const res = await app.request('/health');

  assert.equal(res.status, 200);
  const data = (await res.json()) as { ok: boolean };
  assert.equal(data.ok, true);
});

test('Security Guard: /docs and /openapi.json are disabled in production (404 Not Found)', async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origEnableDocs = process.env.ENABLE_API_DOCS;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_API_DOCS;

    const resDocs = await app.request('/docs');
    assert.equal(resDocs.status, 404);

    const resDocsSlash = await app.request('/docs/');
    assert.equal(resDocsSlash.status, 404);

    const resSpec = await app.request('/openapi.json');
    assert.equal(resSpec.status, 404);
  } finally {
    if (origNodeEnv !== undefined) {
      process.env.NODE_ENV = origNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    if (origEnableDocs !== undefined) {
      process.env.ENABLE_API_DOCS = origEnableDocs;
    } else {
      delete process.env.ENABLE_API_DOCS;
    }
  }
});

test('Security Guard: ENABLE_API_DOCS=true overrides production block', async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origEnableDocs = process.env.ENABLE_API_DOCS;
  try {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_API_DOCS = 'true';

    const resDocs = await app.request('/docs');
    assert.equal(resDocs.status, 200);

    const resSpec = await app.request('/openapi.json');
    assert.equal(resSpec.status, 200);
  } finally {
    if (origNodeEnv !== undefined) {
      process.env.NODE_ENV = origNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    if (origEnableDocs !== undefined) {
      process.env.ENABLE_API_DOCS = origEnableDocs;
    } else {
      delete process.env.ENABLE_API_DOCS;
    }
  }
});

test('Security Guard: ENABLE_API_DOCS=false disables docs even in development/test', async () => {
  const origEnableDocs = process.env.ENABLE_API_DOCS;
  try {
    process.env.ENABLE_API_DOCS = 'false';

    const resDocs = await app.request('/docs');
    assert.equal(resDocs.status, 404);

    const resSpec = await app.request('/openapi.json');
    assert.equal(resSpec.status, 404);
  } finally {
    if (origEnableDocs !== undefined) {
      process.env.ENABLE_API_DOCS = origEnableDocs;
    } else {
      delete process.env.ENABLE_API_DOCS;
    }
  }
});

test('BUG-01: /docs and /openapi.json fail closed (404) when NODE_ENV is unset or staging', async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origEnableDocs = process.env.ENABLE_API_DOCS;
  try {
    delete process.env.ENABLE_API_DOCS;

    delete process.env.NODE_ENV;
    assert.equal((await app.request('/docs')).status, 404);
    assert.equal((await app.request('/openapi.json')).status, 404);

    process.env.NODE_ENV = 'staging';
    assert.equal((await app.request('/docs')).status, 404);
    assert.equal((await app.request('/openapi.json')).status, 404);
  } finally {
    if (origNodeEnv !== undefined) {
      process.env.NODE_ENV = origNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    if (origEnableDocs !== undefined) {
      process.env.ENABLE_API_DOCS = origEnableDocs;
    } else {
      delete process.env.ENABLE_API_DOCS;
    }
  }
});

test('BUG-01: POST /v1/responses returns 404 (not unauthenticated 400/501 OpenAPI stub) when RESPONSES_API_ENABLED is unset', async () => {
  if (process.env.RESPONSES_API_ENABLED === 'true') return;

  const invalidRes = await app.request('/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(invalidRes.status, 404);

  const validShapeRes = await app.request('/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'morphic-deepseek-v4', input: 'hello' }),
  });
  assert.equal(validShapeRes.status, 404);
});
