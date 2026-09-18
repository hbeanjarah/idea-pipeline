import { z } from 'zod';

import { ApiError } from '#config/api-error';
import type { Idea } from '#domain/types';
import * as store from '#store/ideas';
import * as labelStore from '#store/labels';

// strictObject is docs/openapi.yaml's `additionalProperties: false`. trim() is
// a transform, so the trimmed value is the one that ends up stored.
const TextBody = z.strictObject({
  text: z.string().trim().min(1),
});

const LabelBody = z.strictObject({
  labelId: z.string().nullable(),
});

const hasUnknownField = (error: z.ZodError): boolean =>
  error.issues.some((issue) => issue.code === 'unrecognized_keys');

// Express 5 leaves req.body undefined when no parser matched (a missing
// Content-Type, typically) — that must surface as a 400, not a crash.
function parseTextBody(body: unknown): string {
  const result = TextBody.safeParse(body);

  if (result.success) return result.data.text;

  throw new ApiError(
    400,
    hasUnknownField(result.error)
      ? 'Champs non autorisés.'
      : 'Le champ "text" est obligatoire.',
  );
}

function parseLabelBody(body: unknown): string | null {
  const result = LabelBody.safeParse(body);

  if (result.success) return result.data.labelId;

  throw new ApiError(
    400,
    hasUnknownField(result.error)
      ? 'Champs non autorisés.'
      : 'Le champ "labelId" est obligatoire.',
  );
}

const requireIdea = (idea: Idea | null): Idea => {
  if (!idea) throw new ApiError(404, 'Idée introuvable.');
  return idea;
};

export async function listIdeas(userId: string): Promise<Idea[]> {
  return store.listIdeas(userId);
}

export async function createIdea(
  userId: string,
  body: unknown,
): Promise<Idea> {
  return store.createIdea(userId, parseTextBody(body));
}

export async function deleteIdea(
  userId: string,
  ideaId: string,
): Promise<void> {
  if (!(await store.deleteIdea(userId, ideaId))) {
    throw new ApiError(404, 'Idée introuvable.');
  }
}

export async function setIdeaLabel(
  userId: string,
  ideaId: string,
  body: unknown,
): Promise<Idea> {
  const labelId = parseLabelBody(body);

  // Checked before the write: left to the foreign key, an unknown id would
  // raise a 500 instead of the 404 the contract owes, and the constraint
  // cannot tell whose stage it is.
  if (
    labelId !== null &&
    !(await labelStore.labelExists(userId, labelId))
  ) {
    throw new ApiError(404, 'Étape introuvable.');
  }

  return requireIdea(await store.setLabel(userId, ideaId, labelId));
}

export async function addVariation(
  userId: string,
  ideaId: string,
  body: unknown,
): Promise<Idea> {
  return requireIdea(
    await store.addVariation(userId, ideaId, parseTextBody(body)),
  );
}

export async function editVariation(
  userId: string,
  ideaId: string,
  variationId: string,
  body: unknown,
): Promise<Idea> {
  const result = await store.editVariation(
    userId,
    ideaId,
    variationId,
    parseTextBody(body),
  );

  if (result === 'idea-not-found') {
    throw new ApiError(404, 'Idée introuvable.');
  }

  if (result === 'variation-not-found') {
    throw new ApiError(404, 'Variation introuvable.');
  }

  return result;
}
