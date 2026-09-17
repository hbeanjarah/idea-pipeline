import { db } from '#store/db';
import { SEALED_PREFIX, open, seal } from '#store/notes';

// Bounded, so the script never depends on the table fitting in memory.
const BATCH = 500;
const FIRST = '00000000-0000-0000-0000-000000000000';

// Three outcomes, not two. A row carrying the prefix that refuses to open is
// either sealed with a different key, or a note that genuinely starts with
// "v1.". Treating it as plaintext would encrypt the first case twice, so this
// stops and names the row instead of guessing.
function needsSealing(
  id: string,
  text: string,
  ideaId: string,
): boolean {
  if (!text.startsWith(SEALED_PREFIX)) return true;

  try {
    open(text, ideaId);
    return false;
  } catch {
    throw new Error(
      `Variation ${id} carries the sealed prefix but will not open. ` +
        'Refusing to continue: check that NOTE_KEY_V1 is the key these ' +
        'rows were sealed with.',
    );
  }
}

export async function sealExisting(): Promise<{
  sealed: number;
  already: number;
}> {
  let sealed = 0;
  let already = 0;
  let after = FIRST;

  for (;;) {
    // Paged on the id rather than an offset: the loop updates the rows it
    // walks, and an offset would drift under its own writes.
    const rows = await db()
      .selectFrom('variations')
      .select(['id', 'idea_id', 'text'])
      .where('id', '>', after)
      .orderBy('id')
      .limit(BATCH)
      .execute();

    if (rows.length === 0) break;

    const todo = rows.filter((row) =>
      needsSealing(row.id, row.text, row.idea_id),
    );
    already += rows.length - todo.length;

    if (todo.length > 0) {
      await db()
        .transaction()
        .execute(async (trx) => {
          for (const row of todo) {
            await trx
              .updateTable('variations')
              .set({ text: seal(row.text, row.idea_id) })
              .where('id', '=', row.id)
              .execute();
          }
        });
      sealed += todo.length;
    }

    after = rows.at(-1)!.id;
  }

  return { sealed, already };
}
