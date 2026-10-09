import { plainText } from './minimessage';

// Editor-side model of a GUI and its conversion to/from GuiForge format v1.
// Validation and slot resolution mirror dev.diego.guiforge.format.GuiLoader.

export type Pattern = 'border' | 'empty';

export interface EditorItem {
  id: string;
  key: string;
  pattern: Pattern | null;
  slots: number[];
  material: string;
  amount: number;
  name: string;
  lore: string[];
  glint: boolean | null;
  hideTooltip: boolean;
  locked: boolean;
  action: string;
  /** Texture hash of a player head, empty if unset. */
  skin: string;
}

export interface EditorGui {
  id: string;
  title: string;
  rows: number;
  items: EditorItem[];
  paginated: boolean;
  contentSlots: number[];
  fill: 'empty' | 'filler';
  filler: string;
  navOnEdge: 'hide' | 'keep';
  navPrev: string;
  navNext: string;
}

export const MATERIALS = [
  'minecraft:stone', 'minecraft:gray_stained_glass_pane', 'minecraft:black_stained_glass_pane',
  'minecraft:white_stained_glass_pane', 'minecraft:red_stained_glass_pane', 'minecraft:blue_stained_glass_pane',
  'minecraft:lime_dye', 'minecraft:red_dye', 'minecraft:yellow_dye', 'minecraft:arrow', 'minecraft:barrier',
  'minecraft:diamond', 'minecraft:emerald', 'minecraft:gold_ingot', 'minecraft:iron_ingot', 'minecraft:chest',
  'minecraft:book', 'minecraft:paper', 'minecraft:compass', 'minecraft:clock', 'minecraft:player_head',
  'minecraft:name_tag', 'minecraft:ender_pearl', 'minecraft:nether_star', 'minecraft:golden_apple',
  'minecraft:oak_sign', 'minecraft:anvil', 'minecraft:enchanted_book', 'minecraft:bread', 'minecraft:torch',
];

const VANILLA_PREFIX = 'minecraft:';

/** Shows vanilla materials without their namespace; other namespaces stay visible. */
export function displayMaterial(material: string): string {
  return material.startsWith(VANILLA_PREFIX) ? material.slice(VANILLA_PREFIX.length) : material;
}

/** Stores a typed material. Plain names get the vanilla namespace, namespaced ones are kept. */
export function normalizeMaterial(input: string): string {
  const value = input.trim().toLowerCase().replace(/\s+/g, '_');
  if (!value) return '';
  return value.includes(':') ? value : VANILLA_PREFIX + value;
}

let idCounter = 0;
export function newId(prefix = 'i'): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter}`;
}

export function emptyGui(): EditorGui {
  return {
    id: 'gui', title: 'Neue GUI', rows: 3, items: [], paginated: false, contentSlots: [],
    fill: 'empty', filler: '', navOnEdge: 'hide', navPrev: '', navNext: '',
  };
}

export function newItem(gui: EditorGui): EditorItem {
  let n = gui.items.length + 1;
  const used = new Set(gui.items.map((i) => i.key));
  while (used.has(`item-${n}`)) n += 1;
  return {
    id: newId('item'), key: `item-${n}`, pattern: null, slots: [], material: 'minecraft:stone', amount: 1,
    name: '', lore: [], glint: null, hideTooltip: false, locked: true, action: '', skin: '',
  };
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export function borderSlots(rows: number): number[] {
  const out: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < 9; col++) {
      if (row === 0 || row === rows - 1 || col === 0 || col === 8) out.push(row * 9 + col);
    }
  }
  return out;
}

/** Slots each item actually occupies, after pattern resolution (same rules as the Java loader). */
export function resolveSlots(gui: EditorGui): Map<string, number[]> {
  const size = gui.rows * 9;
  const content = new Set(gui.paginated ? gui.contentSlots : []);
  const taken = new Set<number>();
  const result = new Map<string, number[]>();
  for (const item of gui.items) {
    if (item.pattern) continue;
    const slots = item.slots.filter((s) => s >= 0 && s < size);
    result.set(item.id, slots);
    slots.forEach((s) => taken.add(s));
  }
  for (const item of gui.items) {
    if (!item.pattern) continue;
    const candidates = item.pattern === 'border' ? borderSlots(gui.rows) : range(size);
    const free = candidates.filter((s) => !taken.has(s) && !content.has(s));
    result.set(item.id, free);
    free.forEach((s) => taken.add(s));
  }
  return result;
}

const SKIN_BASE = 'http://textures.minecraft.net/texture/';

/** Extracts the 64-character texture hash from a hash or textures.minecraft.net URL. Returns null if invalid. */
export function skinHashOf(input: string): string | null {
  const value = input.trim();
  const fromUrl = /^https?:\/\/textures\.minecraft\.net\/texture\/([0-9a-fA-F]{64})\/?$/.exec(value);
  if (fromUrl) return fromUrl[1].toLowerCase();
  return /^[0-9a-fA-F]{64}$/.test(value) ? value.toLowerCase() : null;
}

export function skinUrl(hash: string): string {
  return SKIN_BASE + hash;
}

/** A project is a list of GUIs. Links between them are `open:<id>` actions on items. */
export interface Project {
  guis: EditorGui[];
}

export function emptyProject(): Project {
  return { guis: [emptyGui()] };
}

/** The target GUI id of a link action, or null if the action is not a link. */
export function linkTarget(action: string): string | null {
  const trimmed = action.trim();
  return trimmed.startsWith('open:') ? trimmed.slice('open:'.length).trim() : null;
}

/** Turns free text into a GUI id that is safe to use (lowercase, a-z, 0-9, _ and -). */
export function sanitizeGuiId(text: string): string {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'gui';
}

/** Plain key text from an item name: no tags, no umlauts, a-z 0-9 and _ only. */
export function slugKey(name: string): string {
  const plain = plainText(name)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return plain.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Whether a key still looks automatic: empty, the default `item-N`, or the slug of the name it came from. */
export function isAutoKey(key: string, nameItWasDerivedFrom: string): boolean {
  return key === '' || /^item-\d+$/.test(key) || key === slugKey(nameItWasDerivedFrom);
}

/** A key derived from the name that no other item in the GUI uses. Null when the name yields nothing. */
export function derivedKey(name: string, items: EditorItem[], itemId: string): string | null {
  const root = slugKey(name);
  if (!root) return null;
  const taken = new Set(items.filter((i) => i.id !== itemId).map((i) => i.key));
  let key = root;
  let n = 2;
  while (taken.has(key)) {
    key = `${root}_${n}`;
    n += 1;
  }
  return key;
}

/** A GUI id that no other GUI in the project uses yet. */
export function uniqueGuiId(guis: EditorGui[], base: string): string {
  const taken = new Set(guis.map((g) => g.id));
  const root = sanitizeGuiId(base);
  let id = root;
  let n = 2;
  while (taken.has(id)) {
    id = `${root}-${n}`;
    n += 1;
  }
  return id;
}

/**
 * Renames a GUI id and rewrites every link to it in the other GUIs.
 * The old id is passed explicitly: guis[index] may already carry the new id.
 */
export function renameGuiEverywhere(guis: EditorGui[], index: number, newId: string, oldId: string): EditorGui[] {
  return guis.map((g, i) => {
    const renamed = i === index ? { ...g, id: newId } : g;
    if (oldId === newId) return renamed;
    return {
      ...renamed,
      items: renamed.items.map((item) =>
        linkTarget(item.action) === oldId ? { ...item, action: `open:${newId}` } : item),
    };
  });
}

/** Problems that span the project: links to GUIs that do not exist, and duplicate GUI ids. */
export function linkProblems(project: Project, gui: EditorGui): Problem[] {
  const out: Problem[] = [];
  const ids = new Set(project.guis.map((g) => g.id));
  for (const item of gui.items) {
    const target = linkTarget(item.action);
    if (target !== null && !ids.has(target)) {
      const label = item.key ? `„${item.key}“` : '(ohne Key)';
      out.push({ message: `Item ${label}: verlinkt auf GUI „${target}“, die es nicht gibt.`, itemId: item.id });
    }
  }
  const seen = new Set<string>();
  for (const g of project.guis) {
    if (seen.has(g.id) && g.id === gui.id) out.push({ message: `GUI-ID „${g.id}“ gibt es mehrfach.` });
    seen.add(g.id);
  }
  return out;
}

/** Storage format: the whole project as a list of format-v1 documents. */
export function projectToStorage(project: Project): unknown {
  return { version: 2, guis: project.guis.map((g) => toFormat(g)) };
}

/** Reads the project storage, and also the older single-GUI storage (a plain format-v1 document). */
export function projectFromStorage(json: any): Project {
  if (json && Array.isArray(json.guis)) {
    const guis = json.guis.map((g: unknown) => fromFormat(g));
    return { guis: guis.length ? guis : [emptyGui()] };
  }
  return { guis: [fromFormat(json)] };
}

export interface Template {
  id: string;
  label: string;
  build: () => EditorGui;
}

/** Inner 4x7 area of a 6-row paginated GUI (rows 1-4, columns 1-7). */
const SHOP_CONTENT = [10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24, 25, 28, 29, 30, 31, 32, 33, 34, 37, 38, 39, 40, 41, 42, 43];

function withItems(gui: EditorGui, items: Array<Partial<EditorItem>>): EditorGui {
  return { ...gui, items: items.map((partial) => ({ ...newItem(gui), ...partial })) };
}

/** Starting points for new GUIs. All of them pass validation as they are. */
export const TEMPLATES: Template[] = [
  {
    id: 'confirm',
    label: 'Bestätigung (3 Zeilen, Ja / Nein)',
    build: () => withItems({ ...emptyGui(), id: 'confirm', title: 'Bestätigen?', rows: 3, filler: 'frame' }, [
      { key: 'frame', pattern: 'empty', material: 'minecraft:gray_stained_glass_pane', name: ' ', hideTooltip: true },
      { key: 'yes', slots: [11], material: 'minecraft:lime_dye', name: '<green>Ja', action: 'close' },
      { key: 'no', slots: [15], material: 'minecraft:red_dye', name: '<red>Nein', action: 'close' },
    ]),
  },
  {
    id: 'shop',
    label: 'Shop (paginiert, 6 Zeilen)',
    build: () => {
      const base: EditorGui = {
        ...emptyGui(), id: 'shop', title: 'Shop', rows: 6, paginated: true,
        contentSlots: SHOP_CONTENT, fill: 'filler', filler: 'frame', navOnEdge: 'hide',
        navPrev: 'prev', navNext: 'next',
      };
      return withItems(base, [
        { key: 'frame', pattern: 'empty', material: 'minecraft:gray_stained_glass_pane', name: ' ', hideTooltip: true },
        { key: 'prev', slots: [48], material: 'minecraft:arrow', name: '<yellow>Zurück', action: 'prev-page' },
        { key: 'close', slots: [49], material: 'minecraft:barrier', name: '<red>Schließen', action: 'close' },
        { key: 'next', slots: [50], material: 'minecraft:arrow', name: '<yellow>Weiter', action: 'next-page' },
      ]);
    },
  },
];

export interface Problem {
  message: string;
  /** The item to jump to when the problem is clicked, if it belongs to one. */
  itemId?: string;
}

/** Problems with the GUI. An empty list means it exports to a valid format v1 file. */
export function problems(gui: EditorGui): Problem[] {
  const out: Problem[] = [];
  const add = (message: string, itemId?: string) => out.push({ message, itemId });
  if (!gui.id.trim()) add('Die GUI braucht eine ID.');
  const keys = new Set<string>();
  const firstByKey = new Map<string, EditorItem>();
  for (const item of gui.items) {
    const label = item.key ? `„${item.key}“` : '(ohne Key)';
    if (!item.key.trim()) add('Ein Item hat keinen Key.', item.id);
    else if (keys.has(item.key)) add(`Doppelter Key ${label}.`, item.id);
    keys.add(item.key);
    if (item.key && !firstByKey.has(item.key)) firstByKey.set(item.key, item);
    if (!item.material.trim()) add(`Item ${label}: Material fehlt.`, item.id);
    if (item.skin.trim()) {
      if (!skinHashOf(item.skin)) add(`Item ${label}: Kopf-Textur ist kein Hash und keine textures.minecraft.net-URL.`, item.id);
      if (item.material.trim() !== 'minecraft:player_head') add(`Item ${label}: Kopf-Textur nur für minecraft:player_head.`, item.id);
    }
    if (!item.pattern && item.slots.length === 0) add(`Item ${label}: keine Slots gewählt.`, item.id);
  }
  const size = gui.rows * 9;
  const seen = new Map<number, EditorItem>();
  for (const item of gui.items) {
    for (const s of item.slots) {
      if (s < 0 || s >= size) add(`Item „${item.key}“: Slot ${s} liegt außerhalb der Kiste.`, item.id);
      const other = seen.get(s);
      if (other) add(`Slot ${s} gehört zu mehreren Items („${other.key}“, „${item.key}“).`, item.id);
      seen.set(s, item);
    }
  }
  if (gui.paginated) {
    if (gui.contentSlots.length === 0) add('Paginiert, aber keine Content-Slots markiert.');
    for (const s of gui.contentSlots) {
      const other = seen.get(s);
      if (other) add(`Content-Slot ${s} überschneidet das Item „${other.key}“.`, other.id);
    }
    if (gui.fill === 'filler' && !keys.has(gui.filler)) add('Füllung „filler“ braucht ein existierendes Rahmen-Item.');
    if (gui.filler && !keys.has(gui.filler)) add(`Rahmen-Item „${gui.filler}“ existiert nicht.`);
    if (gui.navPrev && !keys.has(gui.navPrev)) add(`Zurück-Button „${gui.navPrev}“ existiert nicht.`);
    if (gui.navNext && !keys.has(gui.navNext)) add(`Weiter-Button „${gui.navNext}“ existiert nicht.`);
  }
  return out;
}

export function validate(gui: EditorGui): string[] {
  return problems(gui).map((p) => p.message);
}

export type ItemRole = 'frame' | 'button' | 'item';

export const ROLE_COLORS: Record<ItemRole, string> = {
  frame: '#5d6470',
  button: '#2f6fd6',
  item: '#7a4fb0',
};

/** Frames are patterns or the filler; buttons have an action; everything else is an item. */
export function roleOf(item: EditorItem, gui: EditorGui): ItemRole {
  if (item.pattern || (gui.filler !== '' && item.key === gui.filler)) return 'frame';
  if (item.action.trim()) return 'button';
  return 'item';
}

export function toFormat(gui: EditorGui): Record<string, unknown> {
  const out: Record<string, unknown> = {
    formatVersion: 1,
    id: gui.id,
    type: 'chest',
    rows: gui.rows,
  };
  if (gui.title.trim()) out.title = gui.title;
  out.items = gui.items.map((item) => {
    const json: Record<string, unknown> = {
      key: item.key,
      slots: item.pattern ?? [...item.slots].sort((a, b) => a - b),
      material: item.material,
    };
    if (item.amount !== 1) json.amount = item.amount;
    if (item.name.trim()) json.name = item.name;
    if (item.lore.length) json.lore = item.lore;
    if (item.glint !== null) json.glint = item.glint;
    if (item.hideTooltip) json.hideTooltip = true;
    json.locked = item.locked;
    if (item.action.trim()) json.action = item.action;
    if (item.skin) json.skin = skinHashOf(item.skin) ?? item.skin;
    return json;
  });
  if (gui.paginated) {
    const content: Record<string, unknown> = {
      slots: [...gui.contentSlots].sort((a, b) => a - b),
      fill: gui.fill,
      navOnEdge: gui.navOnEdge,
    };
    if (gui.filler) content.filler = gui.filler;
    const nav: Record<string, string> = {};
    if (gui.navPrev) nav.prev = gui.navPrev;
    if (gui.navNext) nav.next = gui.navNext;
    if (Object.keys(nav).length) content.nav = nav;
    out.content = content;
  }
  return out;
}

/** Parses format v1 JSON into the editor model. Throws on structurally broken input. */
export function fromFormat(json: any): EditorGui {
  if (!json || typeof json !== 'object') throw new Error('Keine GUI-Datei.');
  if (json.formatVersion !== 1) throw new Error(`Unbekannte formatVersion ${json.formatVersion}.`);
  const gui = emptyGui();
  gui.id = String(json.id ?? 'gui');
  gui.title = typeof json.title === 'string' ? json.title : '';
  gui.rows = Number(json.rows ?? 3);
  gui.items = (json.items ?? []).map((raw: any) => {
    const isPattern = typeof raw.slots === 'string';
    const item: EditorItem = {
      id: newId('item'),
      key: String(raw.key ?? ''),
      pattern: isPattern ? (raw.slots as Pattern) : null,
      slots: isPattern ? [] : (raw.slots ?? []).map(Number),
      material: String(raw.material ?? ''),
      amount: Number(raw.amount ?? 1),
      name: String(raw.name ?? ''),
      lore: (raw.lore ?? []).map(String),
      glint: typeof raw.glint === 'boolean' ? raw.glint : null,
      hideTooltip: raw.hideTooltip === true,
      locked: raw.locked !== false,
      action: String(raw.action ?? ''),
      skin: skinHashOf(String(raw.skin ?? '')) ?? String(raw.skin ?? ''),
    };
    return item;
  });
  if (json.content) {
    gui.paginated = true;
    gui.contentSlots = (json.content.slots ?? []).map(Number);
    gui.fill = json.content.fill === 'filler' ? 'filler' : 'empty';
    gui.filler = String(json.content.filler ?? '');
    gui.navOnEdge = json.content.navOnEdge === 'keep' ? 'keep' : 'hide';
    gui.navPrev = String(json.content.nav?.prev ?? '');
    gui.navNext = String(json.content.nav?.next ?? '');
  }
  return gui;
}
