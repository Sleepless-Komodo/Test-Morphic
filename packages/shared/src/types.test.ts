import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatCompletionRequestSchema, chatMessageSchema } from './types.ts';

test('chatMessageSchema accepts content: null for assistant tool calls and preserves tool_calls', () => {
  const msg = {
    role: 'assistant',
    content: null,
    tool_calls: [
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'calc', arguments: '{"expr":"2+2"}' },
      },
    ],
  };

  const parsed = chatMessageSchema.safeParse(msg);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.role, 'assistant');
    assert.equal(parsed.data.content, null);
    assert.deepEqual(parsed.data.tool_calls, msg.tool_calls);
  }
});

test('chatMessageSchema accepts role: tool and preserves tool_call_id', () => {
  const msg = {
    role: 'tool',
    tool_call_id: 'call_1',
    content: '4',
  };

  const parsed = chatMessageSchema.safeParse(msg);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.role, 'tool');
    assert.equal(parsed.data.tool_call_id, 'call_1');
    assert.equal(parsed.data.content, '4');
  }
});

test('chatCompletionRequestSchema accepts full agentic flow with content: null and extra options', () => {
  const req = {
    model: 'deepseek-v4.1',
    stream_options: { include_usage: true },
    seed: 42,
    messages: [
      { role: 'user', content: 'pakai tool calc untuk 2+2' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'calc', arguments: '{"expr":"2+2"}' },
          },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '4' },
      { role: 'assistant', content: '' },
    ],
  };

  const parsed = chatCompletionRequestSchema.safeParse(req);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    // Top-level passthrough fields
    assert.deepEqual((parsed.data as Record<string, unknown>).stream_options, { include_usage: true });
    assert.equal((parsed.data as Record<string, unknown>).seed, 42);

    // Messages
    assert.equal(parsed.data.messages.length, 4);
    assert.equal(parsed.data.messages[1]!.content, null);
    assert.ok(parsed.data.messages[1]!.tool_calls);
    assert.equal(parsed.data.messages[2]!.tool_call_id, 'call_1');
    assert.equal(parsed.data.messages[3]!.content, '');
  }
});

test('chatCompletionRequestSchema validates tool definitions, tool_choice, and refusal', () => {
  const req = {
    model: 'deepseek-v4.1',
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_current_weather',
          description: 'Get the current weather in a given location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
        },
      },
    ],
    tool_choice: 'auto',
    messages: [
      {
        role: 'assistant',
        content: null,
        refusal: null,
        tool_calls: [
          {
            id: 'call_weather_1',
            type: 'function',
            function: {
              name: 'get_current_weather',
              arguments: '{"location":"Jakarta"}',
            },
          },
        ],
      },
    ],
  };

  const parsed = chatCompletionRequestSchema.safeParse(req);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.tools?.length, 1);
    assert.equal(parsed.data.tool_choice, 'auto');
    assert.equal(parsed.data.messages[0]!.refusal, null);
    assert.equal(parsed.data.messages[0]!.tool_calls?.[0]!.function.name, 'get_current_weather');
  }
});

