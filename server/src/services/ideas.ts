import { z } from 'zod';

import { ApiError } from '#config/api-error';
import type { Idea, Status } from '#domain/types';
import { STATUSES } from '#domain/types';
import * as store from '#store/ideas';

// strictObject is docs/openapi.yaml's `additionalProperties: false`. trim() is
// a transform, so the trimmed value is the one that ends up stored.
const TextBody = z.strictObject({
  text: z.string().trim().min(1),
});

const StatusBody = z.strictObject({
  status: z.enum(STATUSES),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

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

function parseStatusBody(body: unknown): Status {
  const result = StatusBody.safeParse(body);

  if (result.success) return result.data.status;

  if (hasUnknownField(result.error)) {
    throw new ApiError(400, 'Champs non autorisés.');
  }

  // Zod reports an absent `status` and a value outside the enum with the same
  // issue code, so presence has to be read off the input itself.
  const absent = !isRecord(body) || !('status' in body);

  throw new ApiError(
    400,
    absent
      ? 'Le champ "status" est obligatoire.'
      : 'Statut invalide.',
  );
}

const requireIdea = (idea: Idea | null): Idea => {
  if (!idea) throw new ApiError(404, 'Idée introuvable.');
  return idea;
};

export async function listIdeas(): Promise<Idea[]> {
  return store.listIdeas();
}

export async function createIdea(body: unknown): Promise<Idea> {
  return store.createIdea(parseTextBody(body));
}

export async function deleteIdea(ideaId: string): Promise<void> {
  if (!(await store.deleteIdea(ideaId))) {
    throw new ApiError(404, 'Idée introuvable.');
  }
}

export async function changeStatus(
  ideaId: string,
  body: unknown,
): Promise<Idea> {
  return requireIdea(
    await store.changeStatus(ideaId, parseStatusBody(body)),
  );
}

export async function addVariation(
  ideaId: string,
  body: unknown,
): Promise<Idea> {
  return requireIdea(
    await store.addVariation(ideaId, parseTextBody(body)),
  );
}

export async function editVariation(
  ideaId: string,
  variationId: string,
  body: unknown,
): Promise<Idea> {
  const result = await store.editVariation(
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
