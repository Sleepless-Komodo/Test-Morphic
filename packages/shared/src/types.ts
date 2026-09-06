import { z } from 'zod';

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool', 'developer']),
  content: z.union([z.string(), z.array(z.unknown())]),
  name: z.string().optional(),
});

export const chatCompletionRequestSchema = z.object({
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
});

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
