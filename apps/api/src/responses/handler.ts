import { errorResponse, upstreamError } from './errors';
import { fromChatCompletion } from './response-converter';
import { toChatRequest } from './request-converter';
import { parseResponsesRequest } from './validation';
import { formatSse, parseSseStream } from './sse';
import { StreamConverter } from './stream-converter';
import type { ChatCompletion, ChatRequest, ResponsesRequest, SseEvent } from './types';

/**
 * Calls the existing chat completions route in-process and returns its raw Response.
 */
export type ForwardChat = (body: ChatRequest, headers: Headers, signal?: AbortSignal) => Promise<Response>;

const FORWARD_REQUEST_HEADERS = [
  'authorization',
  'x-api-key',
  'x-forwarded-for',
  'cf-connecting-ip',
  'user-agent',
];

const PASSTHROUGH_RESPONSE_HEADERS = [
  'x-request-id',
  'x-ratelimit-limit-requests',
  'x-ratelimit-remaining-requests',
  'retry-after',
  'x-morphic-warning',
];

const SSE_HEADERS = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
  'x-accel-buffering': 'no',
};

const pick = (source: Headers, names: string[]): Headers => {
  const out = new Headers();
  for (const name of names) {
    const value = source.get(name);
    if (value !== null) {
      out.set(name, value);
    }
  }
  return out;
};

/**
 * Builds headers for the internal chat call (auth + client identity only).
 * @param incoming Incoming client HTTP headers
 * @returns Filtered headers with content-type set to application/json
 */
export const forwardHeaders = (incoming: Headers): Headers => {
  const headers = pick(incoming, FORWARD_REQUEST_HEADERS);
  headers.set('content-type', 'application/json');
  return headers;
};

/**
 * Selects the tracing and rate-limit headers to return to the client.
 * @param upstream Headers received from the upstream chat response
 * @returns Filtered passthrough headers
 */
export const passthroughHeaders = (upstream: Headers): Headers =>
  pick(upstream, PASSTHROUGH_RESPONSE_HEADERS);

const isChatCompletion = (value: unknown): value is ChatCompletion =>
  typeof value === 'object' && value !== null && Array.isArray((value as ChatCompletion).choices);

async function toJsonResponse(upstream: Response, req: ResponsesRequest): Promise<Response> {
  const chat: unknown = await upstream.json().catch(() => null);
  if (!isChatCompletion(chat)) {
    return errorResponse(upstreamError('Invalid upstream response'));
  }
  return Response.json(fromChatCompletion(chat, req), {
    headers: passthroughHeaders(upstream.headers),
  });
}

/**
 * Streams Responses events converted from the upstream chat SSE body.
 * Cancelling the returned stream cancels the upstream read (client disconnect)
 * and signals the downstream abort controller so partial token billing settles accurately.
 * @param upstreamBody ReadableStream of bytes from upstream chat SSE
 * @param req Original ResponsesRequest
 * @param onCancel Optional callback invoked on downstream stream cancellation
 * @param onDone Optional cleanup callback invoked when stream finishes or cancels
 * @returns ReadableStream of encoded SSE bytes
 */
export function toSseStream(
  upstreamBody: ReadableStream<Uint8Array>,
  req: ResponsesRequest,
  onCancel?: (reason: unknown) => void,
  onDone?: () => void,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const converter = new StreamConverter(req);
  const reader = upstreamBody.getReader();
  let cancelled = false;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (events: SseEvent[]) =>
        events.forEach((e) => controller.enqueue(encoder.encode(formatSse(e))));
      try {
        for await (const chunk of parseSseStream(reader)) {
          if (cancelled) {
            return;
          }
          send(converter.push(chunk));
        }
        if (!cancelled) {
          send(converter.finish());
        }
      } catch (error) {
        if (!cancelled) {
          send(converter.fail(error instanceof Error ? error.message : 'stream error'));
        }
      } finally {
        onDone?.();
        if (!cancelled) {
          controller.close();
        }
      }
    },
    cancel(reason) {
      cancelled = true;
      onCancel?.(reason);
      onDone?.();
      return reader.cancel(reason);
    },
  });
}

function toStreamResponse(
  upstream: Response,
  req: ResponsesRequest,
  onCancel: (reason: unknown) => void,
  onDone: () => void,
): Response {
  if (!upstream.body) {
    onDone();
    return errorResponse(upstreamError('Upstream returned no body'));
  }
  const headers = passthroughHeaders(upstream.headers);
  Object.entries(SSE_HEADERS).forEach(([name, value]) => headers.set(name, value));
  return new Response(toSseStream(upstream.body, req, onCancel, onDone), { headers });
}

/**
 * Handles POST /v1/responses: validate -> convert -> forward to chat route -> convert back.
 * Upstream error responses are returned unchanged (same status/body/headers).
 * Client abort signals (both pre-header and mid-stream) propagate to the upstream chat call.
 * @param request Incoming HTTP Request
 * @param forwardChat Forwarding function calling /v1/chat/completions
 * @returns HTTP Response
 */
export async function handleResponses(request: Request, forwardChat: ForwardChat): Promise<Response> {
  const downstreamAbort = new AbortController();
  const onRequestAbort = () => downstreamAbort.abort(request.signal.reason);
  if (request.signal.aborted) {
    downstreamAbort.abort(request.signal.reason);
  } else {
    request.signal.addEventListener('abort', onRequestAbort, { once: true });
  }
  const cleanupAbortListener = () => {
    request.signal.removeEventListener('abort', onRequestAbort);
  };

  try {
    const body = parseResponsesRequest(await request.json().catch(() => null));
    const upstream = await forwardChat(
      toChatRequest(body),
      forwardHeaders(request.headers),
      downstreamAbort.signal,
    );
    if (!upstream.ok) {
      cleanupAbortListener();
      return upstream;
    }
    if (body.stream) {
      return toStreamResponse(
        upstream,
        body,
        (reason) => downstreamAbort.abort(reason),
        cleanupAbortListener,
      );
    }
    try {
      return await toJsonResponse(upstream, body);
    } finally {
      cleanupAbortListener();
    }
  } catch (error) {
    cleanupAbortListener();
    return errorResponse(error);
  }
}
