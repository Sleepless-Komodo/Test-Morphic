import { z } from 'zod';

export const functionCallSchema = z
  .object({
    name: z.string(),
    arguments: z.string(),
  })
  .passthrough();

export const toolCallSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().optional().default('function'),
    function: functionCallSchema,
  })
  .passthrough();

export const chatMessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool', 'developer']),
    content: z.union([z.string(), z.array(z.unknown())]).nullish(),
    name: z.string().optional(),
    tool_calls: z.array(toolCallSchema).optional(),
    tool_call_id: z.string().optional(),
    refusal: z.string().nullable().optional(),
  })
  .passthrough();

export const chatCompletionRequestSchema = z
  .object({
    model: z.string().min(1),
    messages: z.array(chatMessageSchema).min(1),
    stream: z.boolean().optional(),
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    max_tokens: z.number().int().positive().optional(),
    stop: z.union([z.string(), z.array(z.string())]).nullish(),
    tools: z.array(z.unknown()).optional(),
    tool_choice: z.unknown().optional(),
    response_format: z.unknown().optional(),
    stream_options: z.object({ include_usage: z.boolean().optional() }).passthrough().optional(),
    seed: z.number().int().optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    user: z.string().optional(),
    parallel_tool_calls: z.boolean().optional(),
  })
  .passthrough();

export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>;

export const reservationStatus = ['reserved', 'settled', 'released'] as const;
export type ReservationStatus = (typeof reservationStatus)[number];

export const ledgerEntryType = [
  'purchase',
  'redeem',
  'usage',
  'reservation',
  'settlement',
  'release',
  'refund',
  'admin_adjustment',
  'promotion',
] as const;
export type LedgerEntryType = (typeof ledgerEntryType)[number];
