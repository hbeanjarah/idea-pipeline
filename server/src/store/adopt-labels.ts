import { sql } from 'kysely';

import { db } from '#store/db';
import { seedDefaultLabels } from '#store/labels';

// The historical status values, in the order they were declared. The index is
// the position of the stage that replaces each one.
const BY_STATUS: Record<string, number> = {
  captured: 0,
  maturing: 1,
  ready: 2,
  published: 3,
};

export interface AdoptionReport {
  seeded: number;
  skipped: number;
  linked: number;
}

export async function adoptLabels(): Promise<AdoptionReport> {
  const users = await db().selectFrom('users').select('id').execute();

  const report: AdoptionReport = { seeded: 0, skipped: 0, linked: 0 };

  for (const user of users) {
    await db()
      .transaction()
      .execute(async (trx) => {
        const existing = await trx
          .selectFrom('labels')
          .select('id')
          .where('user_id', '=', user.id)
          .executeTakeFirst();

        // The whole of what makes this script replayable: an account that
        // already has stages is left alone, links included.
        if (existing) {
          report.skipped += 1;
          return;
        }

        const stages = await seedDefaultLabels(user.id, trx);
        report.seeded += 1;

        // Raw SQL to read `status` on purpose: 004_drop_status.sql removes the
        // column, which removes it from schema.generated.ts. Through Kysely
        // this file would stop compiling the moment that migration runs, and
        // production would need two deploys instead of one.
        const { rows: ideas } = await sql<{
          id: string;
          status: string;
        }>`SELECT id, status FROM ideas WHERE user_id = ${user.id}`.execute(
          trx,
        );

        for (const idea of ideas) {
          const index = BY_STATUS[idea.status];
          const stage =
            index === undefined ? undefined : stages[index];
          if (!stage) continue;

          await trx
            .insertInto('idea_labels')
            .values({ idea_id: idea.id, label_id: stage.id })
            .execute();

          report.linked += 1;
        }
      });
  }

  return report;
}
