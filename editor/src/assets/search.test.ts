import { describe, expect, it } from 'vitest';
import { searchMaterials, type MaterialEntry } from './search';

const entries: MaterialEntry[] = [
  { id: 'diamond', label: 'Diamant', aliases: ['diamond'] },
  { id: 'diamond_sword', label: 'Diamantschwert', aliases: ['diamond sword'] },
  { id: 'diamond_axe', label: 'Diamantaxt', aliases: ['diamond axe'] },
  { id: 'stone', label: 'Stein', aliases: ['stone'] },
  { id: 'lime_dye', label: 'Limettenfarbstoff', aliases: ['lime dye'] },
];

describe('searchMaterials', () => {
  it('finds materials by German name and English name', () => {
    expect(searchMaterials(entries, 'diamant')[0].id).toBe('diamond');
    expect(searchMaterials(entries, 'lime dye')[0].id).toBe('lime_dye');
  });

  it('ranks exact matches before prefixes and substrings', () => {
    const ids = searchMaterials(entries, 'diamond').map((e) => e.id);
    expect(ids[0]).toBe('diamond');
    expect(ids.indexOf('diamond_sword')).toBeLessThan(ids.length);
  });

  it('treats spaces as underscores for ids', () => {
    expect(searchMaterials(entries, 'diamond sword')[0].id).toBe('diamond_sword');
  });

  it('matches every word anywhere when no simple match exists', () => {
    expect(searchMaterials(entries, 'sword diamond')[0].id).toBe('diamond_sword');
  });

  it('returns nothing for unknown queries and the first entries for an empty query', () => {
    expect(searchMaterials(entries, 'xyzzy')).toEqual([]);
    expect(searchMaterials(entries, '', 2).map((e) => e.id)).toEqual(['diamond', 'diamond_sword']);
  });
});
