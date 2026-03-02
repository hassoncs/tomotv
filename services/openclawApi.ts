import { z } from 'zod';

import { logger } from '@/utils/logger';

// ─── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_OPENCLAW_URL = 'http://openclaw.lan:18789';
const DEFAULT_SESSION_KEY = 'agent:tv:ai-tab';

function getConfig() {
  const url =
    (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_OPENCLAW_URL : undefined) ||
    DEFAULT_OPENCLAW_URL;
  const token =
    (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_OPENCLAW_TOKEN : undefined) || '';
  const sessionKey =
    (typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_OPENCLAW_SESSION_KEY : undefined) ||
    DEFAULT_SESSION_KEY;
  return { url, token, sessionKey };
}

// ─── Response schema ────────────────────────────────────────────────────────

const chatMessageSchema = z.object({
  role: z.string(),
  content: z.string().nullable(),
});

const chatChoiceSchema = z.object({
  message: chatMessageSchema,
});

const chatCompletionResponseSchema = z.object({
  choices: z.array(chatChoiceSchema).min(1),
});

const chatErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
});

// ─── Public API ─────────────────────────────────────────────────────────────

export interface ChatResponse {
  text: string;
}

/**
 * Send a chat message to OpenClaw and return the assistant's text response.
 *
 * While this HTTP request is in-flight, OpenClaw may also push `ui.render`
 * commands over the WebSocket relay — those are handled separately by the
 * componentRegistry listener in the AI tab.
 */
export async function sendChatMessage(
  text: string,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const { url, token, sessionKey } = getConfig();

  if (!token) {
    throw new OpenClawError(
      'Missing EXPO_PUBLIC_OPENCLAW_TOKEN — set it in .env.local',
      'config',
    );
  }

  const endpoint = `${url}/v1/chat/completions`;

  logger.info('OpenClaw: sending chat message', {
    service: 'openclawApi',
    endpoint,
    textLength: text.length,
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-openclaw-session-key': sessionKey,
      },
      body: JSON.stringify({
        model: 'default',
        messages: [{ role: 'user', content: text }],
      }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err; // let caller handle abort
    }
    throw new OpenClawError(
      `Network error: ${err instanceof Error ? err.message : String(err)}`,
      'network',
    );
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      const parsed = chatErrorResponseSchema.safeParse(body);
      if (parsed.success) {
        errorMessage = parsed.data.error.message;
      }
    } catch {
      // ignore parse failures — use status code message
    }
    throw new OpenClawError(errorMessage, 'http');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new OpenClawError('Invalid JSON in response', 'parse');
  }

  const parsed = chatCompletionResponseSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn('OpenClaw: invalid response shape', {
      service: 'openclawApi',
      issues: parsed.error.issues.map((i) => i.message).join(', '),
    });
    throw new OpenClawError('Unexpected response format from OpenClaw', 'parse');
  }

  const content = parsed.data.choices[0].message.content ?? '';

  logger.info('OpenClaw: received response', {
    service: 'openclawApi',
    responseLength: content.length,
  });

  return { text: content };
}

// ─── Error class ────────────────────────────────────────────────────────────

export type OpenClawErrorKind = 'config' | 'network' | 'http' | 'parse';

export class OpenClawError extends Error {
  readonly kind: OpenClawErrorKind;

  constructor(message: string, kind: OpenClawErrorKind) {
    super(message);
    this.name = 'OpenClawError';
    this.kind = kind;
  }
}
