import { describe, expect, it } from 'vitest';
import { derivedKey, isAutoKey, slugKey, displayMaterial, emptyGui, fromFormat, linkProblems, newItem, normalizeMaterial, problems, projectFromStorage, projectToStorage, renameGuiEverywhere, resolveSlots, roleOf, sanitizeGuiId, skinHashOf, TEMPLATES, toFormat, uniqueGuiId, validate, type EditorGui } from './model';

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

describe('material display', () => {
  it('hides the vanilla prefix and adds it back when storing', () => {
    expect(displayMaterial('minecraft:diamond')).toBe('diamond');
    expect(normalizeMaterial('diamond')).toBe('minecraft:diamond');
    expect(normalizeMaterial('  Gold Ingot ')).toBe('minecraft:gold_ingot');
  });

  it('keeps other namespaces visible', () => {
    expect(displayMaterial('nexo:ruby')).toBe('nexo:ruby');
    expect(normalizeMaterial('nexo:ruby')).toBe('nexo:ruby');
  });
});

describe('player head skins', () => {
  const HASH = '2cdca1d7d7e27132a805af3a5f9d3f29b78f22e31eb97db406cd37be0e2d6e77';

  it('accepts a bare hash or a textures URL and extracts the hash', () => {
    expect(skinHashOf(HASH)).toBe(HASH);
    expect(skinHashOf(`http://textures.minecraft.net/texture/${HASH}`)).toBe(HASH);
    expect(skinHashOf(HASH.toUpperCase())).toBe(HASH);
    expect(skinHashOf('https://example.com/skin.png')).toBeNull();
  });

  it('round-trips the skin through format v1 as a hash', () => {
    const g = gui({ items: [{ ...newItem(gui({})), material: 'minecraft:player_head', skin: `http://textures.minecraft.net/texture/${HASH}`, slots: [0] }] });
    const json = toFormat(g) as { items: Array<{ skin?: string }> };
    expect(json.items[0].skin).toBe(HASH);
    expect(fromFormat(json).items[0].skin).toBe(HASH);
  });

  it('reports a skin on a non-head material', () => {
    const g = gui({ items: [{ ...newItem(gui({})), material: 'minecraft:stone', skin: HASH, slots: [0] }] });
    expect(validate(g).some((m) => m.includes('player_head'))).toBe(true);
  });
});

describe('templates', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s is valid and round-trips', (_id, template) => {
    const g = template.build();
    expect(problems(g)).toEqual([]);
    expect(fromFormat(toFormat(g)).items.map((i) => i.key)).toEqual(g.items.map((i) => i.key));
  });
});

describe('projects and links', () => {
  const project = (...guis: EditorGui[]) => ({ guis });

  it('flags links to GUIs that do not exist, on the item', () => {
    const shop = gui({ id: 'shop', items: [{ ...newItem(gui({})), key: 'buy', action: 'open:list', slots: [0] }] });
    const found = linkProblems(project(shop), shop);
    expect(found).toHaveLength(1);
    expect(found[0].itemId).toBe(shop.items[0].id);
    const withTarget = project(shop, gui({ id: 'list' }));
    expect(linkProblems(withTarget, shop)).toEqual([]);
  });

  it('keeps unique GUI ids and rewrites links on rename', () => {
    expect(uniqueGuiId([gui({ id: 'gui' }), gui({ id: 'gui-2' })], 'gui')).toBe('gui-3');
    expect(sanitizeGuiId('Shop Liste!')).toBe('shop-liste');
    const shop = gui({ id: 'shop', items: [{ ...newItem(gui({})), key: 'buy', action: 'open:list', slots: [0] }] });
    const list = gui({ id: 'list' });
    const renamed = renameGuiEverywhere([shop, list], 1, 'angebote', 'list');
    expect(renamed[1].id).toBe('angebote');
    expect(renamed[0].items[0].action).toBe('open:angebote');
  });

  it('rewrites links when the GUI already carries the new id in the list', () => {
    // This is what the editor passes: the active GUI was replaced by its renamed copy before the rewrite.
    const shop = gui({ id: 'shop', items: [{ ...newItem(gui({})), key: 'buy', action: 'open:list', slots: [0] }] });
    const renamedList = gui({ id: 'angebote' });
    const result = renameGuiEverywhere([shop, renamedList], 1, 'angebote', 'list');
    expect(result[0].items[0].action).toBe('open:angebote');
  });

  it('reads both the old single-GUI storage and the project storage', () => {
    const single = toFormat(gui({ id: 'solo' }));
    expect(projectFromStorage(single).guis.map((g) => g.id)).toEqual(['solo']);
    const stored = projectToStorage({ guis: [gui({ id: 'a' }), gui({ id: 'b' })] });
    expect(projectFromStorage(JSON.parse(JSON.stringify(stored))).guis.map((g) => g.id)).toEqual(['a', 'b']);
  });
});

describe('item keys from names', () => {
  it('slugs plain names, umlauts and tags', () => {
    expect(slugKey('Größer Diamant!')).toBe('groesser_diamant');
    expect(slugKey('<gold><bold>Café Ü</bold></gold>')).toBe('cafe_ue');
    expect(slugKey('  ')).toBe('');
  });

  it('keeps the key when it was typed by hand', () => {
    expect(isAutoKey('my_key', 'Diamant')).toBe(false);
    expect(isAutoKey('item-3', 'Diamant')).toBe(true);
    expect(isAutoKey('diamant', 'Diamant')).toBe(true);
    expect(isAutoKey('', '')).toBe(true);
  });

  it('makes derived keys unique within the GUI', () => {
    const items = [
      { ...newItem(emptyGui()), id: 'a', key: 'diamant' },
      { ...newItem(emptyGui()), id: 'b', key: 'diamant_2' },
    ];
    expect(derivedKey('Diamant', items, 'c')).toBe('diamant_3');
    expect(derivedKey('Diamant', items, 'a')).toBe('diamant');
    expect(derivedKey('   ', items, 'c')).toBeNull();
  });
});

describe('item keys from names', () => {
  it('slugs plain names, umlauts and tags', () => {
    expect(slugKey('Größer Diamant!')).toBe('groesser_diamant');
    expect(slugKey('<gold><bold>Café Ü</bold></gold>')).toBe('cafe_ue');
    expect(slugKey('  ')).toBe('');
  });

  it('keeps the key when it was typed by hand', () => {
    expect(isAutoKey('my_key', 'Diamant')).toBe(false);
    expect(isAutoKey('item-3', 'Diamant')).toBe(true);
    expect(isAutoKey('diamant', 'Diamant')).toBe(true);
    expect(isAutoKey('', '')).toBe(true);
  });

  it('makes derived keys unique within the GUI', () => {
    const items = [
      { ...newItem(emptyGui()), id: 'a', key: 'diamant' },
      { ...newItem(emptyGui()), id: 'b', key: 'diamant_2' },
    ];
    expect(derivedKey('Diamant', items, 'c')).toBe('diamant_3');
    expect(derivedKey('Diamant', items, 'a')).toBe('diamant');
    expect(derivedKey('   ', items, 'c')).toBeNull();
  });
});

describe('hideAttributes', () => {
  it('is omitted from the format by default and written as false when turned off', () => {
    const item = { ...newItem(emptyGui()), key: 'sword', material: 'minecraft:diamond_sword' };
    const shown = toFormat(gui({ items: [item] })) as any;
    expect(shown.items[0].hideAttributes).toBeUndefined();

    const visible = toFormat(gui({ items: [{ ...item, hideAttributes: false }] })) as any;
    expect(visible.items[0].hideAttributes).toBe(false);
  });

  it('reads a missing value as true and keeps an explicit false', () => {
    const g = fromFormat({ formatVersion: 1, id: 'g', title: 't', rows: 3, items: [{ key: 'a', slots: [0], material: 'minecraft:stone' }, { key: 'b', slots: [1], material: 'minecraft:stone', hideAttributes: false }] });
    expect(g.items[0].hideAttributes).toBe(true);
    expect(g.items[1].hideAttributes).toBe(false);
  });
});
