import { describe, expect, it } from 'vitest';

import { httpHarness } from '#test/http';

// Same reason as app.test.ts: the service tests never touch routes/ or
// controllers/, so a handler wired to the wrong verb passes all of them.
const { api, send } = httpHarness();

describe('labels', () => {
  const createLabel = async (name: string) => {
    const res = await send('POST', '/labels', { name });
    return (await res.json()) as { id: string; name: string };
  };

  it('answers 200 with an empty collection', async () => {
    const res = await api('/labels');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('answers 201 with the created stage', async () => {
    const res = await send('POST', '/labels', { name: 'Maturation' });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      name: 'Maturation',
      color: 1,
      position: 1,
    });
  });

  it('answers 200 when renaming one', async () => {
    const label = await createLabel('Maturation');

    const res = await send('PATCH', `/labels/${label.id}`, {
      name: 'À explorer',
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: 'À explorer' });
  });

  // PATCH /labels and PATCH /labels/:id are one character apart and land on
  // different controllers. Nothing below this file would notice them swapped.
  it('tells the collection PATCH from the item PATCH apart', async () => {
    const first = await createLabel('Un');
    const second = await createLabel('Deux');

    const res = await send('PATCH', '/labels', {
      ids: [second.id, first.id],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject([
      { name: 'Deux', position: 1 },
      { name: 'Un', position: 2 },
    ]);
  });

  it('answers 204 with no body when deleting one', async () => {
    const label = await createLabel('Maturation');

    const res = await api(`/labels/${label.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('answers 404 in the contract error shape', async () => {
    const res = await api(
      '/labels/99999999-9999-4999-8999-999999999999',
      { method: 'DELETE' },
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Étape introuvable.' });
  });

  it('answers 400 in the contract error shape', async () => {
    const res = await send('POST', '/labels', { name: '   ' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Le nom de l'étape est obligatoire.",
    });
  });
});
