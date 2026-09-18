import { describe, expect, it } from 'vitest';

import type { Idea } from '#domain/types';
import { httpHarness } from '#test/http';

// The layer tests below this one never touch app.ts, routes/ or controllers/:
// a route mounted on the wrong path, or wired to the wrong controller, passes
// them all. These tests exercise the wiring over real HTTP instead.
const { api, send } = httpHarness();

const createIdea = async (text = 'une idée'): Promise<Idea> => {
  const res = await send('POST', '/ideas', { text });
  return res.json() as Promise<Idea>;
};

describe('GET /ideas', () => {
  it('answers 200 with an empty collection', async () => {
    const res = await api('/ideas');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('shares the store across requests', async () => {
    await createIdea();

    expect(
      (await (await api('/ideas')).json()) as Idea[],
    ).toHaveLength(1);
  });
});

describe('POST /ideas', () => {
  it('answers 201 with the created idea', async () => {
    const res = await send('POST', '/ideas', { text: 'une idée' });

    expect(res.status).toBe(201);
    const idea = (await res.json()) as Idea;
    expect(idea.status).toBe('captured');
    expect(idea.variations[0]?.text).toBe('une idée');
  });

  it('answers 400 in the contract error shape', async () => {
    const res = await send('POST', '/ideas', { text: '  ' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Le champ "text" est obligatoire.',
    });
  });
});

describe('DELETE /ideas/:id', () => {
  it('answers 204 with no body', async () => {
    const idea = await createIdea();

    const res = await api(`/ideas/${idea.id}`, { method: 'DELETE' });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('answers 404 on an unknown id', async () => {
    const res = await api('/ideas/nope', { method: 'DELETE' });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Idée introuvable.' });
  });
});

describe('PATCH /ideas/:id', () => {
  it('answers 200 with the moved idea', async () => {
    const idea = await createIdea();

    const res = await send('PATCH', `/ideas/${idea.id}`, {
      status: 'ready',
    });

    expect(res.status).toBe(200);
    expect(((await res.json()) as Idea).status).toBe('ready');
  });
});

describe('variations', () => {
  it('answers 201 when appending one', async () => {
    const idea = await createIdea();

    const res = await send('POST', `/ideas/${idea.id}/variations`, {
      text: 'suite',
    });

    expect(res.status).toBe(201);
    expect(((await res.json()) as Idea).variations).toHaveLength(2);
  });

  it('answers 200 when editing one', async () => {
    const idea = await createIdea();
    const variationId = idea.variations[0]!.id;

    const res = await send(
      'PATCH',
      `/ideas/${idea.id}/variations/${variationId}`,
      { text: 'corrigée' },
    );

    expect(res.status).toBe(200);
    expect(((await res.json()) as Idea).variations[0]?.text).toBe(
      'corrigée',
    );
  });

  // The two 404s only differ once the request has gone through the router, so
  // this is the only place the distinction is proven end to end.
  it('tells the two 404s apart', async () => {
    const idea = await createIdea();
    const variationId = idea.variations[0]!.id;

    const unknownIdea = await send(
      'PATCH',
      `/ideas/nope/variations/${variationId}`,
      { text: 'x' },
    );
    expect(await unknownIdea.json()).toEqual({
      error: 'Idée introuvable.',
    });

    const unknownVariation = await send(
      'PATCH',
      `/ideas/${idea.id}/variations/nope`,
      { text: 'x' },
    );
    expect(await unknownVariation.json()).toEqual({
      error: 'Variation introuvable.',
    });
  });
});

describe('fallbacks', () => {
  it('answers 404 on an unknown URL', async () => {
    const res = await api('/inconnu');

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: 'Ressource introuvable.',
    });
  });

  it('answers 400 on malformed JSON', async () => {
    const res = await api('/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"text":',
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Corps de requête JSON invalide.',
    });
  });

  // Without a Content-Type express.json() never runs, so req.body stays
  // undefined. That has to reach validation as a 400, not crash into a 500.
  it('answers 400 when Content-Type is missing', async () => {
    const res = await api('/ideas', {
      method: 'POST',
      body: '{"text":"ok"}',
    });

    expect(res.status).toBe(400);
  });
});

describe('documentation', () => {
  it('serves the spec as YAML', async () => {
    const res = await api('/openapi.yaml');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('yaml');
    expect(await res.text()).toContain('openapi: 3.0.3');
  });

  // @scalar/api-reference's exports map does not cover the browser bundle, so
  // its path is derived from the filesystem and nothing in the package
  // guarantees it. An upgrade that moves the file fails here rather than
  // serving a blank page with a 404 only visible in the browser console.
  it('serves the Scalar bundle', async () => {
    const res = await api('/scalar.js');

    expect(res.status).toBe(200);
    expect((await res.text()).length).toBeGreaterThan(1_000_000);
  });

  it('renders a page wired to the local spec and bundle', async () => {
    const html = await (await api('/docs')).text();

    expect(html).toContain('/openapi.yaml');
    expect(html).toContain('/scalar.js');
  });

  // The point of vendoring a 3.6 MB bundle: the page must not reach out to a
  // CDN, which is exactly what Scalar does by default.
  it('reaches no CDN', async () => {
    const html = await (await api('/docs')).text();

    expect(html).not.toContain('jsdelivr');
    expect(html).not.toContain('cdn.');
  });
});

describe('GET /ideas ordering', () => {
  // Date resolution is one millisecond and three in-process requests fit
  // inside it. Without a real pause every timestamp ties, the order falls back
  // to the id tiebreaker, and the assertions below become a coin toss.
  const tick = () => new Promise((resolve) => setTimeout(resolve, 2));

  it('answers with ideas sorted by descending updatedAt', async () => {
    const first = await createIdea('une');
    await tick();
    await createIdea('deux');
    await tick();
    await createIdea('trois');
    await tick();
    await send('PATCH', `/ideas/${first.id}`, { status: 'ready' });

    const ideas = (await (await api('/ideas')).json()) as Idea[];
    const stamps = ideas.map((idea) => idea.updatedAt);

    // Without distinct timestamps the ordering assertion proves nothing.
    expect(new Set(stamps).size).toBe(3);
    expect(ideas[0]?.id).toBe(first.id);
    expect(stamps).toEqual([...stamps].sort().reverse());
  });
});
