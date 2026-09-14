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

export async function changeStatus(
  userId: string,
  ideaId: string,
  body: unknown,
): Promise<Idea> {
  return requireIdea(
    await store.changeStatus(userId, ideaId, parseStatusBody(body)),
  );
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
