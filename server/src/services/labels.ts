import { z } from 'zod';

import { ApiError } from '#config/api-error';
import type { Label } from '#domain/types';
import * as store from '#store/labels';

const NameBody = z.strictObject({
  name: z.string().trim().min(1).max(32),
});

// Not z.string().uuid(): a malformed id simply matches no label of the account
// and falls into the set comparison below.
const ReorderBody = z.strictObject({
  ids: z.array(z.string()).min(1),
});

const hasUnknownField = (error: z.ZodError): boolean =>
  error.issues.some((issue) => issue.code === 'unrecognized_keys');

function parseName(body: unknown): string {
  const result = NameBody.safeParse(body);

  if (result.success) return result.data.name;

  if (hasUnknownField(result.error)) {
    throw new ApiError(400, 'Champs non autorisés.');
  }

  const tooLong = result.error.issues.some(
    (issue) => issue.code === 'too_big',
  );

  throw new ApiError(
    400,
    tooLong
      ? "Le nom de l'étape est trop long."
      : "Le nom de l'étape est obligatoire.",
  );
}

// Case-insensitive, accents left alone — the rule filterIdeas already settled
// for search: « Prêt » and « prêt » collide, « Prêt » and « Pret » do not.
const same = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

async function refuseDuplicate(
  userId: string,
  name: string,
  exceptId?: string,
): Promise<void> {
  const existing = await store.listLabels(userId);

  if (
    existing.some(
      (label) => label.id !== exceptId && same(label.name, name),
    )
  ) {
    throw new ApiError(400, 'Cette étape existe déjà.');
  }
}

const requireLabel = (label: Label | null): Label => {
  if (!label) throw new ApiError(404, 'Étape introuvable.');
  return label;
};

export async function listLabels(userId: string): Promise<Label[]> {
  return store.listLabels(userId);
}

export async function createLabel(
  userId: string,
  body: unknown,
): Promise<Label> {
  const name = parseName(body);
  await refuseDuplicate(userId, name);

  return store.createLabel(userId, name);
}

export async function renameLabel(
  userId: string,
  id: string,
  body: unknown,
): Promise<Label> {
  const name = parseName(body);
  // Excluding itself: renaming a stage to the name it already has is not a
  // clash.
  await refuseDuplicate(userId, name, id);

  return requireLabel(await store.renameLabel(userId, id, name));
}

export async function deleteLabel(
  userId: string,
  id: string,
): Promise<void> {
  if (!(await store.deleteLabel(userId, id))) {
    throw new ApiError(404, 'Étape introuvable.');
  }
}

export async function reorderLabels(
  userId: string,
  body: unknown,
): Promise<Label[]> {
  const result = ReorderBody.safeParse(body);

  if (!result.success) {
    throw new ApiError(
      400,
      hasUnknownField(result.error)
        ? 'Champs non autorisés.'
        : 'La liste des étapes est incomplète.',
    );
  }

  const { ids } = result.data;
  const given = new Set(ids);
  const existing = await store.listLabels(userId);

  // The first check is not redundant: [a, a] against a single-label account
  // passes the other two, and would write position 1 then 2 to the same row.
  if (
    given.size !== ids.length ||
    given.size !== existing.length ||
    existing.some((label) => !given.has(label.id))
  ) {
    throw new ApiError(400, 'La liste des étapes est incomplète.');
  }

  return store.reorderLabels(userId, ids);
}
