/**
 * A small subset of MiniMessage, enough to preview item names and lore the way the
 * game shows them: named colours, `<#rrggbb>`, and the four text decorations.
 * Unknown tags are dropped (the runtime shows them as plain text, the editor warns elsewhere).
 */

export interface Style {
  color?: string;
  bold: boolean;
  italic: boolean;
  underlined: boolean;
  strikethrough: boolean;
}

export interface Segment extends Style {
  text: string;
}

export const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  dark_blue: '#0000aa',
  dark_green: '#00aa00',
  dark_aqua: '#00aaaa',
  dark_red: '#aa0000',
  dark_purple: '#aa00aa',
  gold: '#ffaa00',
  gray: '#aaaaaa',
  dark_gray: '#555555',
  blue: '#5555ff',
  green: '#55ff55',
  aqua: '#55ffff',
  red: '#ff5555',
  light_purple: '#ff55ff',
  yellow: '#ffff55',
  white: '#ffffff',
};

const DECORATIONS: Record<string, keyof Omit<Style, 'color'>> = {
  bold: 'bold',
  b: 'bold',
  italic: 'italic',
  i: 'italic',
  underlined: 'underlined',
  u: 'underlined',
  strikethrough: 'strikethrough',
  st: 'strikethrough',
};

const TAG = /<(\/?)([^<>]*)>/g;

function emptyStyle(): Style {
  return { bold: false, italic: false, underlined: false, strikethrough: false };
}

/** The style a single opening tag adds, or null for tags the preview does not know. */
function openStyle(style: Style, name: string): Style | null {
  if (name in DECORATIONS) return { ...style, [DECORATIONS[name]]: true };
  if (name in NAMED_COLORS) return { ...style, color: NAMED_COLORS[name] };
  if (/^#[0-9a-f]{6}$/i.test(name)) return { ...style, color: name };
  return null;
}

/**
 * Splits MiniMessage text into styled segments. Empty segments are dropped.
 * Closing a tag restores the style that was active before it was opened, so nested colours
 * behave like in-game: `<red>a <white>b</white> c</red>` gives red, white, red.
 */
export function parseMiniMessage(input: string): Segment[] {
  const segments: Segment[] = [];
  let style = emptyStyle();
  const stack: { name: string; before: Style }[] = [];
  let last = 0;

  const push = (text: string) => {
    if (text) segments.push({ text, ...style });
  };

  for (const match of input.matchAll(TAG)) {
    const index = match.index ?? 0;
    push(input.slice(last, index));
    last = index + match[0].length;

    const closing = match[1] === '/';
    const name = match[2].trim().toLowerCase();

    if (name === 'reset' && !closing) {
      style = emptyStyle();
      stack.length = 0;
      continue;
    }
    if (!closing) {
      const next = openStyle(style, name);
      // Anything else (click, hover, gradient, ...) is ignored in the preview.
      if (!next) continue;
      stack.push({ name, before: style });
      style = next;
    } else {
      const i = stack.map((entry) => entry.name).lastIndexOf(name);
      if (i >= 0) {
        style = stack[i].before;
        stack.length = i;
      }
    }
  }
  push(input.slice(last));
  return segments;
}

/** Text without any tags, for places that only need a label. */
export function plainText(input: string): string {
  return parseMiniMessage(input).map((s) => s.text).join('');
}

/** Tag names (as typed in MiniMessage) that produce this segment's style, outermost first. */
export function tagsOf(seg: Style): string[] {
  const tags: string[] = [];
  if (seg.color) {
    const name = Object.keys(NAMED_COLORS).find((k) => NAMED_COLORS[k] === seg.color);
    tags.push(name ?? seg.color);
  }
  if (seg.bold) tags.push('bold');
  if (seg.italic) tags.push('italic');
  if (seg.underlined) tags.push('underlined');
  if (seg.strikethrough) tags.push('strikethrough');
  return tags;
}

/** Colour tags offered by the editor, in palette order. */
export const COLOR_TAGS = Object.keys(NAMED_COLORS);
/** Decoration tags offered by the editor, in button order. */
export const DECORATION_TAGS = ['bold', 'italic', 'underlined', 'strikethrough'];
