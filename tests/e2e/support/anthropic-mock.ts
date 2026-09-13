import type { Page, Route } from '@playwright/test';

/**
 * Network-level mock of the Anthropic Messages API. The real SDK runs in the
 * browser and parses these server-sent events exactly as it would in production,
 * so the test exercises request construction, SSE parsing and structured-output
 * handling, not a stubbed client.
 */
export type MockReply =
  | {
      kind: 'message';
      text: string;
      stopReason?: 'end_turn' | 'max_tokens' | 'refusal';
      explanation?: string;
    }
  | { kind: 'error'; status: number; type: string; message: string };

export type CapturedRequest = {
  model: string;
  system: unknown;
  messages: Array<{ role: string; content: string }>;
  output_config?: { format?: { type: string } };
  stream?: boolean;
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function mockAnthropic(
  page: Page,
  reply: (request: CapturedRequest, index: number) => MockReply,
) {
  const requests: CapturedRequest[] = [];
  await page.route('https://api.anthropic.com/**', async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const body = route.request().postDataJSON() as CapturedRequest;
    requests.push(body);
    const response = reply(body, requests.length - 1);

    if (response.kind === 'error') {
      await route.fulfill({
        status: response.status,
        headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'error', error: { type: response.type, message: response.message } }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'text/event-stream' },
      body: sseBody(body.model, response),
    });
  });
  return requests;
}

export function sseBody(model: string, reply: Extract<MockReply, { kind: 'message' }>): string {
  const stopReason = reply.stopReason ?? 'end_turn';
  const events: Array<[string, unknown]> = [
    [
      'message_start',
      {
        type: 'message_start',
        message: {
          id: 'msg_mock',
          type: 'message',
          role: 'assistant',
          model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          stop_details: null,
          usage: { input_tokens: 25, output_tokens: 1 },
        },
      },
    ],
    [
      'content_block_start',
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ],
  ];

  for (const chunk of chunks(reply.text, 400)) {
    events.push([
      'content_block_delta',
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: chunk } },
    ]);
  }

  events.push(['content_block_stop', { type: 'content_block_stop', index: 0 }]);
  events.push([
    'message_delta',
    {
      type: 'message_delta',
      delta: {
        stop_reason: stopReason,
        stop_sequence: null,
        stop_details:
          stopReason === 'refusal'
            ? { type: 'refusal', category: 'cyber', explanation: reply.explanation ?? 'The model declined.' }
            : null,
      },
      usage: { output_tokens: 200 },
    },
  ]);
  events.push(['message_stop', { type: 'message_stop' }]);

  return events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
}

function chunks(text: string, size: number): string[] {
  if (text.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}
