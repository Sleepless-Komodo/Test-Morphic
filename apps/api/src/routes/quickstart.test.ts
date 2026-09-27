import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../app';

test('GET /quickstart/opencode.sh returns bash script with correct headers and base URL', async () => {
  const res = await app.request('/quickstart/opencode.sh', {
    headers: {
      host: 'morphic-api.web.id',
      'x-forwarded-proto': 'https',
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');

  const text = await res.text();
  assert.ok(text.includes('#!/usr/bin/env bash'));
  assert.ok(text.includes('https://morphic-api.web.id/v1'));
  assert.ok(text.includes('opencode.json'));
  assert.ok(text.includes('morphic/deepseek-v4'));
});
