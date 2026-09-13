import { z } from 'zod';

import { ApiError } from '#config/api-error';
import type { Idea } from '#domain/types';
import * as store from '#store/ideas';

// strictObject mirrors `additionalProperties: false` in docs/openapi.yaml: an
// extra field is a 400, not something we silently drop. trim() before min(1)
// is what rejects a text made only of spaces — and what gets stored.
const CreateIdeaBody = z.strictObject({
  text: z.string().trim().min(1),
});

// Express 5 leaves req.body undefined when no parser matched (a missing
// Content-Type, typically) — that must surface as a 400, not a crash.
function parseCreateIdea(body: unknown): string {
  const result = CreateIdeaBody.safeParse(body);

  if (result.success) return result.data.text;

  const hasUnknownField = result.error.issues.some(
    (issue) => issue.code === 'unrecognized_keys',
  );

  throw new ApiError(
    400,
    hasUnknownField
      ? 'Champs non autorisés.'
      : 'Le champ "text" est obligatoire.',
  );
}

export async function listIdeas(): Promise<Idea[]> {
  return store.listIdeas();
}

export async function createIdea(body: unknown): Promise<Idea> {
  return store.createIdea(parseCreateIdea(body));
}
