import Anthropic from '@anthropic-ai/sdk';
import type { StreamFactory } from './planner.js';

/**
 * Bring-your-own-key: the key lives in memory in the user's browser and is sent
 * only to api.anthropic.com. The SDK requires an explicit opt-in for browser use
 * precisely because shipping a shared key in a static site would be a mistake;
 * here each user supplies their own.
 */
export function createStreamFactory(apiKey: string): StreamFactory {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
  return (params) => client.messages.stream(params);
}

export function describeApiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError)
    return 'The API key was rejected. Check it and try again.';
  if (error instanceof Anthropic.PermissionDeniedError)
    return 'This key is not allowed to use the selected model.';
  if (error instanceof Anthropic.RateLimitError) return 'Rate limited by the API. Wait a moment and retry.';
  if (error instanceof Anthropic.BadRequestError) return `The API rejected the request: ${error.message}`;
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach api.anthropic.com. Check your network or an extension blocking the request.';
  }
  if (error instanceof Anthropic.APIError) return `API error ${error.status ?? ''}: ${error.message}`.trim();
  return error instanceof Error ? error.message : 'Unknown error';
}
