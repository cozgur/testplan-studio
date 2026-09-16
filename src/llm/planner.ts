import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { Brief } from '../domain/brief.js';
import type { Finding } from '../domain/guardrails.js';
import type { RunFailure } from '../domain/run-failures.js';
import type { Scenario, TestPlan } from '../domain/plan-schema.js';
import type { GeneratedSpec } from '../domain/spec-schema.js';
import type { DemoTarget } from '../domain/targets.js';
import type { ModelId } from './models.js';
import { parsePlan, TestPlanWireSchema } from '../domain/plan-schema.js';
import {
  buildPlanPrompt,
  buildSpecPrompt,
  PLANNER_SYSTEM_PROMPT,
  SPEC_SYSTEM_PROMPT,
} from '../domain/prompts.js';
import { GeneratedSpecWireSchema, parseGeneratedSpec } from '../domain/spec-schema.js';

/**
 * The narrow slice of the Anthropic SDK this module needs. Production passes
 * `(params, options) => client.messages.stream(params, options)`; tests pass a fake.
 * Keeping the seam this small is what makes the orchestration unit-testable without a key.
 */
export type StreamHandle = {
  on(event: 'text', listener: (delta: string, snapshot: string) => void): unknown;
  finalMessage(): Promise<Anthropic.Message>;
  /** Accumulated message so far; the SDK exposes it even when structured-output parsing fails. */
  readonly currentMessage?: Anthropic.Message | undefined;
};
export type StreamOptions = { signal?: AbortSignal };
export type StreamFactory = (params: Anthropic.MessageStreamParams, options?: StreamOptions) => StreamHandle;

export type GenerationOptions = {
  model: ModelId;
  onProgress?: (characters: number) => void;
  /** Aborting rejects the promise with the SDK's APIUserAbortError. */
  signal?: AbortSignal;
};

export type GenerationErrorKind = 'refusal' | 'truncated' | 'invalid_output';

export class GenerationError extends Error {
  constructor(
    public readonly kind: GenerationErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

export async function generatePlan(
  stream: StreamFactory,
  brief: Brief,
  target: DemoTarget | undefined,
  options: GenerationOptions,
): Promise<TestPlan> {
  const text = await runStructured(stream, {
    model: options.model,
    system: PLANNER_SYSTEM_PROMPT,
    user: buildPlanPrompt(brief, target),
    format: zodOutputFormat(TestPlanWireSchema),
    onProgress: options.onProgress,
    signal: options.signal,
  });
  try {
    return parsePlan(text);
  } catch (error) {
    throw new GenerationError('invalid_output', describe(error));
  }
}

export async function generateSpec(
  stream: StreamFactory,
  plan: TestPlan,
  scenarios: Scenario[],
  target: DemoTarget | undefined,
  options: GenerationOptions & { feedback?: Finding[]; runFailures?: RunFailure[] },
): Promise<GeneratedSpec> {
  const text = await runStructured(stream, {
    model: options.model,
    system: SPEC_SYSTEM_PROMPT,
    user: buildSpecPrompt(plan, scenarios, target, options.feedback, options.runFailures),
    format: zodOutputFormat(GeneratedSpecWireSchema),
    // Writing a spec from an approved plan is mostly transcription; medium effort keeps
    // the thinking budget (which counts against max_tokens) and the wait proportionate.
    effort: 'medium',
    onProgress: options.onProgress,
    signal: options.signal,
  });
  try {
    return parseGeneratedSpec(text);
  } catch (error) {
    throw new GenerationError('invalid_output', describe(error));
  }
}

type OutputFormat = NonNullable<NonNullable<Anthropic.MessageStreamParams['output_config']>['format']>;

type Effort = NonNullable<NonNullable<Anthropic.MessageStreamParams['output_config']>['effort']>;

type StructuredRequest = {
  model: ModelId;
  system: string;
  user: string;
  format: OutputFormat;
  effort?: Effort;
  onProgress?: (characters: number) => void;
  signal?: AbortSignal;
};

async function runStructured(stream: StreamFactory, request: StructuredRequest): Promise<string> {
  const handle = stream(
    {
      model: request.model,
      // Streaming, so the budget can be generous: adaptive thinking tokens count against it,
      // and a 16k cap truncated real spec generations on Claude Opus 5.
      max_tokens: 64000,
      // Stable system text first with a cache breakpoint; the volatile brief goes in messages.
      system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: request.user }],
      output_config: request.effort
        ? { format: request.format, effort: request.effort }
        : { format: request.format },
    },
    { signal: request.signal },
  );

  handle.on('text', (_delta, snapshot) => request.onProgress?.(snapshot.length));

  let message: Anthropic.Message;
  try {
    message = await handle.finalMessage();
  } catch (error) {
    // Transport and HTTP failures (and user aborts) belong to the caller: typed classes, status codes.
    if (error instanceof Anthropic.APIError) throw error;
    // The SDK parses structured output inside finalMessage(). A refusal (empty text) or a truncated
    // response fails that parse before stop_reason can be inspected, so read the accumulated snapshot.
    rejectBadStop(handle.currentMessage);
    throw new GenerationError(
      'invalid_output',
      `The model returned output that could not be parsed. ${describe(error)}`,
    );
  }

  rejectBadStop(message);
  return textOf(message);
}

function rejectBadStop(message: Anthropic.Message | undefined): void {
  if (!message) return;
  if (message.stop_reason === 'refusal') {
    throw new GenerationError(
      'refusal',
      message.stop_details?.explanation ?? 'The model declined this request.',
    );
  }
  if (message.stop_reason === 'max_tokens') {
    throw new GenerationError(
      'truncated',
      'The response hit the token limit. Try a concise depth or fewer scenarios.',
    );
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}
