import { describe, expect, it } from 'vitest';

import { ALL, UNCLASSIFIED } from '@/lib/filterIdeas';
import { orderSegments } from '@/lib/filterSegments';
import type { Label } from '@/storage/types';

const stage = (
  id: string,
  name: string,
  position: number,
): Label => ({
  id,
  name,
  color: position,
  position,
});

const STAGES = [
  stage('a', 'Capturé', 1),
  stage('b', 'Maturation', 2),
  stage('c', 'Prêt', 3),
  stage('d', 'In progress', 4),
  stage('e', 'Publié', 5),
];

const names = (active: string) =>
  orderSegments(STAGES, active).map((segment) => segment.label);

describe('orderSegments', () => {
  it('leads with Tous, then the free ideas, then the stages in order', () => {
    expect(names(ALL)).toEqual([
      'Tous',
      'Sans étape',
      'Capturé',
      'Maturation',
      'Prêt',
      'In progress',
      'Publié',
    ]);
  });

  it('pulls the active stage to second place', () => {
    expect(names('d')).toEqual([
      'Tous',
      'In progress',
      'Sans étape',
      'Capturé',
      'Maturation',
      'Prêt',
      'Publié',
    ]);
  });

  // Second, not third: only two pills fit on a narrow panel, so a stage left
  // behind "Sans étape" is a stage the strip never shows.
  it('puts the active stage ahead of Sans étape, not behind it', () => {
    expect(names('e')[1]).toBe('Publié');
  });

  it('leaves the order alone when Tous is active', () => {
    expect(names(ALL)[0]).toBe('Tous');
    expect(names(ALL)[1]).toBe('Sans étape');
  });

  it('leaves the order alone when the free ideas are active', () => {
    expect(names(UNCLASSIFIED)[1]).toBe('Sans étape');
  });

  it('keeps every segment, whichever one is active', () => {
    expect(orderSegments(STAGES, 'c')).toHaveLength(
      STAGES.length + 2,
    );
  });

  it('survives an active id that no longer exists', () => {
    expect(names('gone')).toEqual([
      'Tous',
      'Sans étape',
      'Capturé',
      'Maturation',
      'Prêt',
      'In progress',
      'Publié',
    ]);
  });

  it('offers Tous and Sans étape on an account with no stage at all', () => {
    expect(orderSegments([], ALL).map((s) => s.value)).toEqual([
      ALL,
      UNCLASSIFIED,
    ]);
  });
});
