import { adoptLabels } from '#store/adopt-labels';
import { closeDb } from '#store/db';

try {
  const { seeded, skipped, linked } = await adoptLabels();
  console.log(
    `Comptes pourvus: ${seeded}. Déjà pourvus: ${skipped}. Liens créés: ${linked}.`,
  );
} finally {
  await closeDb();
}
