export const MODELS = [
  {
    id: 'claude-opus-5',
    label: 'Claude Opus 5',
    note: 'Default. Strongest reasoning about risk and layer choice.',
  },
  {
    id: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    note: 'Faster and cheaper; good for iterating on a brief.',
  },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', note: 'Cheapest; fine for concise plans.' },
] as const;

export type ModelId = (typeof MODELS)[number]['id'];
export const DEFAULT_MODEL: ModelId = 'claude-opus-5';
