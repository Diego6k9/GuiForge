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
    name: '', lore: [], glint: null, hideTooltip: false, locked: true, action: '',
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
