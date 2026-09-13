import { z } from 'zod';
import { extractJson, PlanValidationError } from './plan-schema.js';

export const GeneratedSpecWireSchema = z.object({
  fileName: z.string().describe('Kebab-case file name ending in .spec.ts'),
  code: z.string().describe('Complete Playwright Test file in TypeScript'),
  notes: z.array(z.string()).describe('Assumptions the author made that a reviewer must confirm'),
});

export type GeneratedSpec = z.infer<typeof GeneratedSpecWireSchema>;

const FILE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.spec\.ts$/;

export function parseGeneratedSpec(text: string): GeneratedSpec {
  const parsed = GeneratedSpecWireSchema.safeParse(extractJson(text));
  if (!parsed.success) {
    throw new PlanValidationError(
      parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  const spec = parsed.data;
  if (!FILE_NAME.test(spec.fileName)) {
    throw new PlanValidationError([`fileName "${spec.fileName}" must be kebab-case and end in .spec.ts`]);
  }
  if (spec.code.trim().length === 0) throw new PlanValidationError(['code is empty']);
  return spec;
}
