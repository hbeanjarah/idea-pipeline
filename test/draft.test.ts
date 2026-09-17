import { describe, expect, it } from 'vitest';

import { isMeaningfulDraft } from '@/lib/variations';

describe('a reformulation draft', () => {
  it('is meaningful when the text actually changed', () => {
    expect(isMeaningfulDraft('nouvelle version', 'ancienne')).toBe(
      true,
    );
  });

  it('is not meaningful when it matches the current text', () => {
    expect(isMeaningfulDraft('même texte', 'même texte')).toBe(false);
  });

  it('ignores surrounding whitespace on both sides', () => {
    expect(isMeaningfulDraft('  même texte \n', 'même texte')).toBe(
      false,
    );
  });

  it('is not meaningful when it is empty', () => {
    expect(isMeaningfulDraft('   ', 'ancienne')).toBe(false);
  });
});
