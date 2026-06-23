import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { ideaRepository } from '../src/storage/storage';

// A fresh chrome.storage stub is installed before every test (test/setup.ts),
// so the singleton repository starts from an empty store each time.

describe('ChromeStorageIdeaRepository', () => {
  describe('create', () => {
    it('creates an idea with a single initial variation', async () => {
      const idea = await ideaRepository.create('first idea');

      expect(idea.id).not.toBe('');
      expect(idea.variations).toHaveLength(1);
      expect(idea.variations[0].text).toBe('first idea');
      expect(idea.createdAt).toBe(idea.updatedAt);
    });

    it('always forces status to captured', async () => {
      const idea = await ideaRepository.create('x');
      expect(idea.status).toBe('captured');
    });

    it('generates unique ids for ideas and their variations', async () => {
      const a = await ideaRepository.create('a');
      const b = await ideaRepository.create('b');

      expect(a.id).not.toBe(b.id);
      expect(a.variations[0].id).not.toBe(a.id);
    });

    it('persists the created idea', async () => {
      const created = await ideaRepository.create('persisted');
      const all = await ideaRepository.list();

      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(created.id);
    });
  });

  describe('list', () => {
    it('returns an empty array when nothing was stored', async () => {
      expect(await ideaRepository.list()).toEqual([]);
    });
  });

  describe('readAll guard against a corrupted store', () => {
    // The stub only stores what the code writes (always arrays), so a
    // corrupted value is seeded explicitly before the call. This mirrors a
    // real chrome.storage where the key holds a non-array value (e.g. the
    // DevTools editor writes "" instead of removing the key).
    it('returns [] when the ideas key holds a non-array value', async () => {
      for (const corrupted of ['', '[]', {}]) {
        await chrome.storage.local.set({ ideas: corrupted });
        expect(await ideaRepository.list()).toEqual([]);
      }
    });

    it('lets create() succeed (no r.push TypeError) over a corrupted value', async () => {
      await chrome.storage.local.set({ ideas: '' });

      const idea = await ideaRepository.create('after corruption');

      expect(idea.variations[0].text).toBe('after corruption');
      const all = await ideaRepository.list();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(idea.id);
    });
  });

  describe('addVariation', () => {
    it('appends a new variation and leaves the existing one untouched', async () => {
      const created = await ideaRepository.create('v1');
      const firstId = created.variations[0].id;

      const updated = await ideaRepository.addVariation(
        created.id,
        'v2',
      );

      expect(updated.variations).toHaveLength(2);
      // Append-only: the original variation keeps its id and text.
      expect(updated.variations[0].id).toBe(firstId);
      expect(updated.variations[0].text).toBe('v1');
      expect(updated.variations[1].text).toBe('v2');
    });

    it('returns the up-to-date idea and persists it', async () => {
      const created = await ideaRepository.create('v1');
      await ideaRepository.addVariation(created.id, 'v2');

      const [stored] = await ideaRepository.list();
      expect(stored.variations).toHaveLength(2);
    });

    it('throws on an unknown id', async () => {
      await expect(
        ideaRepository.addVariation('unknown', 'x'),
      ).rejects.toThrow();
    });
  });

  describe('editVariation', () => {
    it('changes the text of the target variation', async () => {
      const created = await ideaRepository.create('typo');
      const variationId = created.variations[0].id;

      const updated = await ideaRepository.editVariation(
        created.id,
        variationId,
        'fixed',
      );

      expect(updated.variations[0].text).toBe('fixed');
    });

    it('keeps the variation id and order intact', async () => {
      const created = await ideaRepository.create('v1');
      await ideaRepository.addVariation(created.id, 'v2');
      const withThird = await ideaRepository.addVariation(
        created.id,
        'v3',
      );
      const ids = withThird.variations.map(
        (variation) => variation.id,
      );

      const updated = await ideaRepository.editVariation(
        created.id,
        ids[1],
        'v2 edited',
      );

      // Count and order are preserved: no add, remove, or reorder.
      expect(updated.variations).toHaveLength(3);
      expect(updated.variations.map((v) => v.id)).toEqual(ids);
      expect(updated.variations[1].text).toBe('v2 edited');
      // Siblings are untouched.
      expect(updated.variations[0].text).toBe('v1');
      expect(updated.variations[2].text).toBe('v3');
    });

    it('throws on an unknown idea id', async () => {
      await expect(
        ideaRepository.editVariation('unknown', 'whatever', 'x'),
      ).rejects.toThrow();
    });

    it('throws on an unknown variation id', async () => {
      const created = await ideaRepository.create('v1');

      await expect(
        ideaRepository.editVariation(created.id, 'unknown', 'x'),
      ).rejects.toThrow();
    });

    describe('timestamps', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('freezes the variation createdAt while refreshing the idea updatedAt', async () => {
        vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
        const created = await ideaRepository.create('typo');
        const variation = created.variations[0];

        vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
        const updated = await ideaRepository.editVariation(
          created.id,
          variation.id,
          'fixed',
        );
        const editedVariation = updated.variations[0];

        // The variation's identity stays put; only its text moved.
        expect(editedVariation.id).toBe(variation.id);
        expect(editedVariation.createdAt).toBe(
          '2026-01-01T00:00:00.000Z',
        );
        // The idea's updatedAt tracks the edit.
        expect(updated.updatedAt).toBe('2026-01-02T00:00:00.000Z');
        expect(updated.createdAt).toBe('2026-01-01T00:00:00.000Z');
      });
    });
  });

  describe('changeStatus', () => {
    it('updates the status and keeps createdAt immutable', async () => {
      const created = await ideaRepository.create('x');

      const updated = await ideaRepository.changeStatus(
        created.id,
        'ready',
      );

      expect(updated.status).toBe('ready');
      expect(updated.createdAt).toBe(created.createdAt);
    });

    it('throws on an unknown id', async () => {
      await expect(
        ideaRepository.changeStatus('unknown', 'ready'),
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('removes the idea permanently', async () => {
      const created = await ideaRepository.create('x');

      await ideaRepository.delete(created.id);

      expect(await ideaRepository.list()).toEqual([]);
    });

    it('leaves other ideas in place for an unknown id', async () => {
      const created = await ideaRepository.create('x');

      await ideaRepository.delete('unknown');

      const all = await ideaRepository.list();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(created.id);
    });
  });

  describe('updatedAt', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('refreshes updatedAt on changeStatus while createdAt stays put', async () => {
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      const created = await ideaRepository.create('x');
      expect(created.createdAt).toBe('2026-01-01T00:00:00.000Z');

      vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
      const updated = await ideaRepository.changeStatus(
        created.id,
        'ready',
      );

      expect(updated.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(updated.updatedAt).toBe('2026-01-02T00:00:00.000Z');
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
        new Date(updated.createdAt).getTime(),
      );
    });

    it('refreshes updatedAt on addVariation and stamps the new variation', async () => {
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      const created = await ideaRepository.create('x');

      vi.setSystemTime(new Date('2026-01-03T12:00:00.000Z'));
      const updated = await ideaRepository.addVariation(
        created.id,
        'v2',
      );

      expect(updated.updatedAt).toBe('2026-01-03T12:00:00.000Z');
      expect(updated.variations[1].createdAt).toBe(
        '2026-01-03T12:00:00.000Z',
      );
    });
  });
});
