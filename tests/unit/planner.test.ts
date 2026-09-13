import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, test, vi } from 'vitest';
import type { StreamFactory, StreamHandle } from '../../src/llm/planner.js';
import { EMPTY_BRIEF } from '../../src/domain/brief.js';
import { findTarget } from '../../src/domain/targets.js';
import { SAMPLE_PLAN } from '../../src/fixtures/sample-plan.js';
import { SAMPLE_SPEC } from '../../src/fixtures/sample-spec.js';
import { GenerationError, generatePlan, generateSpec, textOf } from '../../src/llm/planner.js';

type FakeReply = {
  text: string;
  stopReason?: Anthropic.Message['stop_reason'];
  explanation?: string;
};

function fakeMessage(reply: FakeReply): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [{ type: 'text', text: reply.text, citations: null }],
    stop_reason: reply.stopReason ?? 'end_turn',
    stop_sequence: null,
    stop_details:
      reply.stopReason === 'refusal'
        ? { type: 'refusal', category: 'cyber', explanation: reply.explanation ?? 'declined' }
        : null,
    usage: { input_tokens: 10, output_tokens: 20 },
  } as unknown as Anthropic.Message;
}

/**
 * Records the params the planner sends and replays a canned message in two text chunks.
 * Like the real MessageStream, finalMessage() can throw when structured-output parsing
 * fails, leaving the raw message on currentMessage.
 */
function fakeStream(reply: FakeReply, options: { throwOnParse?: boolean } = {}) {
  const calls: Anthropic.MessageStreamParams[] = [];
  const factory: StreamFactory = (params) => {
    calls.push(params);
    const listeners: Array<(delta: string, snapshot: string) => void> = [];
    const message = fakeMessage(reply);
    const handle: StreamHandle = {
      currentMessage: message,
      on: (_event, listener) => listeners.push(listener),
      finalMessage: async () => {
        const half = Math.ceil(reply.text.length / 2);
        listeners.forEach((l) => l(reply.text.slice(0, half), reply.text.slice(0, half)));
        listeners.forEach((l) => l(reply.text.slice(half), reply.text));
        if (options.throwOnParse)
          throw new Anthropic.AnthropicError('Failed to parse structured output: bad JSON');
        return message;
      },
    };
    return handle;
  };
  return { factory, calls };
}

describe('generatePlan', () => {
  const brief = { ...EMPTY_BRIEF, targetId: 'lab' };

  test('sends a cacheable system prompt, the brief and a structured output format', async () => {
    const { factory, calls } = fakeStream({ text: JSON.stringify(SAMPLE_PLAN) });
    const plan = await generatePlan(factory, brief, findTarget('lab'), { model: 'claude-opus-5' });

    expect(plan.title).toBe(SAMPLE_PLAN.title);
    expect(calls).toHaveLength(1);
    const params = calls[0];
    expect(params.model).toBe('claude-opus-5');
    expect(params.max_tokens).toBe(16000);
    expect(params.system).toEqual([
      expect.objectContaining({ type: 'text', cache_control: { type: 'ephemeral' } }),
    ]);
    expect(params.messages).toEqual([
      { role: 'user', content: expect.stringContaining('Quality Engineering Lab') },
    ]);
    expect(params.output_config?.format).toMatchObject({ type: 'json_schema' });
  });

  test('reports progress as text streams in', async () => {
    const { factory } = fakeStream({ text: JSON.stringify(SAMPLE_PLAN) });
    const onProgress = vi.fn();
    await generatePlan(factory, brief, findTarget('lab'), { model: 'claude-sonnet-5', onProgress });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress.mock.calls.at(-1)?.[0]).toBe(JSON.stringify(SAMPLE_PLAN).length);
  });

  test.each([false, true])(
    'maps a refusal to a GenerationError (SDK parse throws: %s)',
    async (throwOnParse) => {
      const { factory } = fakeStream(
        { text: '', stopReason: 'refusal', explanation: 'Not this one.' },
        { throwOnParse },
      );
      await expect(generatePlan(factory, brief, undefined, { model: 'claude-opus-5' })).rejects.toMatchObject(
        {
          name: 'GenerationError',
          kind: 'refusal',
          message: 'Not this one.',
        },
      );
    },
  );

  test.each([false, true])(
    'maps a max_tokens stop to a truncated error (SDK parse throws: %s)',
    async (throwOnParse) => {
      const { factory } = fakeStream({ text: '{"title": "cut', stopReason: 'max_tokens' }, { throwOnParse });
      await expect(generatePlan(factory, brief, undefined, { model: 'claude-opus-5' })).rejects.toMatchObject(
        {
          kind: 'truncated',
        },
      );
    },
  );

  test('re-throws API errors untouched so the UI can explain them by type', async () => {
    const factory: StreamFactory = () => ({
      on: () => undefined,
      finalMessage: async () => {
        throw new Anthropic.AuthenticationError(
          401,
          { type: 'authentication_error' },
          'invalid x-api-key',
          new Headers(),
        );
      },
    });
    await expect(generatePlan(factory, brief, undefined, { model: 'claude-opus-5' })).rejects.toBeInstanceOf(
      Anthropic.AuthenticationError,
    );
  });

  test('wraps an SDK parse failure with a normal stop as invalid_output', async () => {
    const { factory } = fakeStream({ text: 'not json' }, { throwOnParse: true });
    await expect(generatePlan(factory, brief, undefined, { model: 'claude-opus-5' })).rejects.toMatchObject({
      kind: 'invalid_output',
      message: expect.stringContaining('could not be parsed'),
    });
  });

  test('maps output that breaks plan rules to invalid_output with the validation details', async () => {
    const { factory } = fakeStream({ text: JSON.stringify({ ...SAMPLE_PLAN, risks: [] }) });
    const error = await generatePlan(factory, brief, undefined, { model: 'claude-opus-5' }).catch((e) => e);
    expect(error).toBeInstanceOf(GenerationError);
    expect(error.kind).toBe('invalid_output');
    expect(error.message).toContain('plan has no risks');
  });
});

describe('generateSpec', () => {
  test('passes the selected scenarios and lint feedback into the prompt', async () => {
    const { factory, calls } = fakeStream({ text: JSON.stringify(SAMPLE_SPEC) });
    const spec = await generateSpec(
      factory,
      SAMPLE_PLAN,
      SAMPLE_PLAN.scenarios.slice(0, 1),
      findTarget('lab'),
      {
        model: 'claude-opus-5',
        feedback: [{ rule: 'no-force', severity: 'warning', line: 3, message: 'Forced click.' }],
      },
    );

    expect(spec).toEqual(SAMPLE_SPEC);
    const content = String(calls[0].messages[0].content);
    expect(content).toContain('S1 [P0, e2e]');
    expect(content).not.toContain('S2 ');
    expect(content).toContain('- line 3 [no-force]: Forced click.');
  });

  test('rejects a spec with an unsafe file name', async () => {
    const { factory } = fakeStream({ text: JSON.stringify({ ...SAMPLE_SPEC, fileName: '../x.spec.ts' }) });
    await expect(
      generateSpec(factory, SAMPLE_PLAN, SAMPLE_PLAN.scenarios, undefined, { model: 'claude-opus-5' }),
    ).rejects.toMatchObject({ kind: 'invalid_output' });
  });
});

describe('textOf', () => {
  test('joins text blocks and ignores others', () => {
    const message = fakeMessage({ text: 'a' });
    message.content = [
      { type: 'text', text: 'a', citations: null },
      { type: 'tool_use', id: 't', name: 'n', input: {} },
      { type: 'text', text: 'b', citations: null },
    ] as Anthropic.ContentBlock[];
    expect(textOf(message)).toBe('ab');
  });
});
