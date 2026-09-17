import { closeDb } from '#store/db';
import { sealExisting } from '#store/seal';

try {
  const { sealed, already } = await sealExisting();
  console.log(`Sealed: ${sealed}. Already sealed: ${already}.`);
} finally {
  await closeDb();
}
