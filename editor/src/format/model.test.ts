import { describe, expect, it } from 'vitest';
import { emptyGui, fromFormat, newItem, problems, resolveSlots, roleOf, toFormat, validate, type EditorGui } from './model';

function gui(partial: Partial<EditorGui>): EditorGui {
  return { ...emptyGui(), ...partial };
}

describe('resolveSlots', () => {
  it('gives the border pattern only the outer ring', () => {
    const frame = { ...newItem(emptyGui()), id: 'f', key: 'frame', pattern: 'border' as const };
    const slots = resolveSlots(gui({ rows: 3, items: [frame] })).get('f')!;
    expect(slots).toHaveLength(20);
    expect(slots).not.toContain(13);
  });

  it('lets explicit slots win over patterns and skips content slots', () => {
    const a = { ...newItem(emptyGui()), id: 'a', key: 'a', slots: [0] };
    const bg = { ...newItem(emptyGui()), id: 'bg', key: 'bg', pattern: 'empty' as const };
    const result = resolveSlots(gui({ rows: 1, items: [a, bg], paginated: true, contentSlots: [2, 3] }));
    expect(result.get('bg')).toEqual([1, 4, 5, 6, 7, 8]);
  });
});

describe('validate', () => {
  it('accepts a clean GUI', () => {
    const a = { ...newItem(emptyGui()), key: 'a', slots: [4] };
    expect(validate(gui({ rows: 3, items: [a] }))).toEqual([]);
  });

  it('reports duplicate keys and shared slots', () => {
    const a = { ...newItem(emptyGui()), key: 'a', slots: [4] };
    const b = { ...newItem(emptyGui()), key: 'a', slots: [4] };
    const errors = validate(gui({ rows: 3, items: [a, b] }));
    expect(errors.some((e) => e.includes('Doppelter Key'))).toBe(true);
    expect(errors.some((e) => e.includes('mehreren Items'))).toBe(true);
  });

  it('reports a content slot that overlaps a fixed item', () => {
    const a = { ...newItem(emptyGui()), key: 'a', slots: [10] };
    const errors = validate(gui({ rows: 3, items: [a], paginated: true, contentSlots: [10, 11] }));
    expect(errors.some((e) => e.includes('überschneidet'))).toBe(true);
  });

  it('reports a nav button that points to a missing key', () => {
    const errors = validate(gui({ rows: 3, paginated: true, contentSlots: [10], navNext: 'nope' }));
    expect(errors.some((e) => e.includes('nope'))).toBe(true);
  });
});

describe('format round trip', () => {
  it('exports and re-imports a paginated GUI without losing structure', () => {
    const frame = { ...newItem(emptyGui()), key: 'frame', pattern: 'border' as const, glint: true, hideTooltip: true };
    const next = { ...newItem(emptyGui()), key: 'btn-next', slots: [52], action: 'next-page' };
    const original = gui({
      id: 'shop-list', rows: 6, title: '<gold>Shop</gold>', items: [frame, next],
      paginated: true, contentSlots: [10, 11, 12], fill: 'empty', filler: 'frame', navOnEdge: 'hide',
      navNext: 'btn-next',
    });
    const json = JSON.parse(JSON.stringify(toFormat(original)));
    expect(json.items[0].slots).toBe('border');
    expect(json.items[0].glint).toBe(true);
    expect(json.content.nav).toEqual({ next: 'btn-next' });

    const back = fromFormat(json);
    expect(back.id).toBe('shop-list');
    expect(back.contentSlots).toEqual([10, 11, 12]);
    expect(back.items[0].pattern).toBe('border');
    expect(back.items[1].slots).toEqual([52]);
    expect(validate(back)).toEqual([]);
  });

  it('refuses files with an unknown format version', () => {
    expect(() => fromFormat({ formatVersion: 2 })).toThrow();
  });
});

describe('problems and roles', () => {
  it('points problems at the item that causes them', () => {
    const a = { ...newItem(emptyGui()), key: 'a', slots: [4] };
    const b = { ...newItem(emptyGui()), key: 'b', slots: [4] };
    const p = problems(gui({ rows: 3, items: [a, b] }));
    expect(p.find((x) => x.message.includes('mehreren Items'))?.itemId).toBe(b.id);
  });

  it('classifies frame, button and plain items', () => {
    const frame = { ...newItem(emptyGui()), key: 'frame', pattern: 'border' as const };
    const button = { ...newItem(emptyGui()), key: 'next', slots: [52], action: 'next-page' };
    const plain = { ...newItem(emptyGui()), key: 'plain', slots: [0] };
    const g = gui({ rows: 6, items: [frame, button, plain] });
    expect(roleOf(frame, g)).toBe('frame');
    expect(roleOf(button, g)).toBe('button');
    expect(roleOf(plain, g)).toBe('item');
  });
});
