import { useLayoutEffect, useRef, type MouseEvent, type KeyboardEvent, type ClipboardEvent } from 'react';
import { COLOR_TAGS, DECORATION_TAGS, NAMED_COLORS, parseMiniMessage, tagsOf } from '../format/minimessage';

interface RichFieldProps {
  /** MiniMessage source, as stored on the item. */
  value: string;
  onChange: (value: string) => void;
  /** Multi-line (lore) or single-line (name). */
  multiline?: boolean;
  label: string;
}

/** One character of the text together with the tags that style it. */
interface Char {
  ch: string;
  tags: string[];
}

/** A run of characters that share the same tags. */
interface Group {
  text: string;
  tags: string[];
}

type Op = { kind: 'toggle'; tag: string } | { kind: 'clear' };

const BR = () => document.createElement('br');

function isColorTag(tag: string): boolean {
  return tag in NAMED_COLORS || /^#[0-9a-f]{6}$/i.test(tag);
}

/** Colour first, then decorations in button order, so equal styles always compare equal. */
function sortTags(tags: string[]): string[] {
  const rank = (t: string) => (isColorTag(t) ? 0 : 1 + DECORATION_TAGS.indexOf(t));
  return [...tags].sort((a, b) => rank(a) - rank(b));
}

function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

/** The MiniMessage text as one entry per UTF-16 code unit (the same unit the DOM offsets use). */
function toChars(value: string): Char[] {
  return parseMiniMessage(value).flatMap((seg) => {
    const tags = tagsOf(seg);
    return seg.text.split('').map((ch) => ({ ch, tags }));
  });
}

function groupChars(chars: Char[]): Group[] {
  const groups: Group[] = [];
  for (const c of chars) {
    const last = groups[groups.length - 1];
    if (last && sameTags(last.tags, c.tags)) last.text += c.ch;
    else groups.push({ text: c.ch, tags: c.tags });
  }
  return groups;
}

/** A span for one MiniMessage tag. The inline style is what the user sees; data-mm is what gets saved. */
function makeSpan(tag: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.dataset.mm = tag;
  if (isColorTag(tag)) span.style.color = NAMED_COLORS[tag] ?? tag;
  if (tag === 'bold') {
    span.style.fontWeight = '700';
    span.style.webkitTextStroke = '0.5px currentColor'; // monospace bold is subtle on its own
  }
  if (tag === 'italic') span.style.fontStyle = 'italic';
  if (tag === 'underlined') span.style.textDecoration = 'underline';
  if (tag === 'strikethrough') span.style.textDecoration = 'line-through';
  return span;
}

/** Rebuilds the editable DOM from styled groups: each tag is a nested span, newlines are <br>. */
function buildDom(root: HTMLElement, groups: Group[], multiline: boolean) {
  const frag = document.createDocumentFragment();
  for (const group of groups) {
    const inner = document.createDocumentFragment();
    group.text.split('\n').forEach((part, i) => {
      if (i > 0) inner.appendChild(BR());
      if (part) inner.appendChild(document.createTextNode(part));
    });
    let node: Node = inner;
    for (const tag of [...group.tags].reverse()) {
      const span = makeSpan(tag);
      span.appendChild(node);
      node = span;
    }
    frag.appendChild(node);
  }
  // A browser needs a placeholder <br> to show a trailing empty line; serialize() removes it again.
  if (multiline && groups.length && groups[groups.length - 1].text.endsWith('\n')) frag.appendChild(BR());
  root.replaceChildren(frag);
}

/** Turns the editable DOM back into MiniMessage. Spans with data-mm become tags; everything else is text. */
function serializeNode(node: Node): string {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent ?? '';
      return;
    }
    if (!(child instanceof HTMLElement)) return;
    if (child.tagName === 'BR') {
      out += '\n';
      return;
    }
    const block = child.tagName === 'DIV' || child.tagName === 'P';
    if (block && out && !out.endsWith('\n')) out += '\n';
    const inner = serializeNode(child);
    if (!inner) return;
    const tags = (child.dataset.mm ?? '').split(' ').filter(Boolean);
    out += tags.map((t) => `<${t}>`).join('') + inner + [...tags].reverse().map((t) => `</${t}>`).join('');
  });
  return out;
}

function serialize(root: HTMLElement, multiline: boolean): string {
  let text = serializeNode(root);
  // Pressing Enter in a browser leaves a placeholder <br> behind; it is not a line of the lore.
  const last = root.lastChild;
  if (multiline && last instanceof HTMLElement && last.tagName === 'BR' && text.endsWith('\n')) {
    text = text.slice(0, -1);
  }
  return text;
}

/**
 * The game colours each lore line on its own, so a tag may not run across a line break. Tags that are
 * open at the end of a line are closed there and opened again on the next line.
 */
export function selfContainedLines(text: string): string {
  const lines: Char[][] = [[]];
  for (const c of toChars(text)) {
    if (c.ch === '\n') lines.push([]);
    else lines[lines.length - 1].push(c);
  }
  return lines
    .map((line) =>
      groupChars(line)
        .filter((g) => g.text)
        .map((g) => g.tags.map((t) => `<${t}>`).join('') + g.text + [...g.tags].reverse().map((t) => `</${t}>`).join(''))
        .join(''),
    )
    .join('\n');
}

/** How many text characters lie before a DOM position, counted the same way serialize() counts them. */
function countBefore(root: HTMLElement, container: Node, offset: number): number {
  const pre = document.createRange();
  pre.setStart(root, 0);
  pre.setEnd(container, offset);
  const frag = pre.cloneContents();
  frag.querySelectorAll('[data-mm]').forEach((node) => node.removeAttribute('data-mm'));
  return serializeNode(frag).length;
}

/** The DOM position of the n-th character in the rebuilt field. */
function positionAt(root: HTMLElement, index: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let left = index;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0;
      if (left <= len) return { node, offset: left };
      left -= len;
    } else if (node instanceof HTMLElement && node.tagName === 'BR') {
      const parent = node.parentNode as Node;
      if (left === 0) return { node: parent, offset: Array.from(parent.childNodes).indexOf(node) };
      left -= 1;
    }
  }
  return { node: root, offset: root.childNodes.length };
}

/**
 * Applies a formatting operation to the current selection. The selection is turned into characters
 * with tags, changed there, and the DOM is rebuilt from that. Returns false when nothing is selected.
 */
function applyOp(root: HTMLElement, op: Op, multiline: boolean): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (range.collapsed || !root.contains(range.commonAncestorContainer)) return false;

  const chars = toChars(serialize(root, multiline));
  const start = Math.min(countBefore(root, range.startContainer, range.startOffset), chars.length);
  const end = Math.min(countBefore(root, range.endContainer, range.endOffset), chars.length);
  if (end <= start) return false;

  const target = chars.slice(start, end);
  if (op.kind === 'clear') {
    target.forEach((c) => (c.tags = []));
  } else {
    const { tag } = op;
    // Toggle: if the whole selection already has the tag, remove it; otherwise add it everywhere.
    const removing = target.every((c) => c.tags.includes(tag));
    target.forEach((c) => {
      if (removing) {
        c.tags = c.tags.filter((t) => t !== tag);
      } else {
        // A new colour replaces the colour that was there.
        const kept = c.tags.filter((t) => !(isColorTag(tag) && isColorTag(t)) && t !== tag);
        c.tags = sortTags([...kept, tag]);
      }
    });
  }

  buildDom(root, groupChars(chars), multiline);

  const sel2 = window.getSelection();
  if (sel2) {
    const a = positionAt(root, start);
    const b = positionAt(root, end);
    const next = document.createRange();
    next.setStart(a.node, a.offset);
    next.setEnd(b.node, b.offset);
    sel2.removeAllRanges();
    sel2.addRange(next);
  }
  return true;
}

export function RichField({ value, onChange, multiline = false, label }: RichFieldProps) {
  const ref = useRef<HTMLDivElement>(null);
  // The last value this field emitted itself; only other changes (templates, undo) rewrite the DOM,
  // so typing and the caret are never reset by our own updates.
  const emitted = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value === emitted.current) return;
    buildDom(el, groupChars(toChars(value)), multiline);
    emitted.current = value;
  }, [value, multiline]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const raw = serialize(el, multiline);
    const next = multiline ? selfContainedLines(raw) : raw;
    emitted.current = next;
    onChange(next);
  };

  const apply = (op: Op) => (e: MouseEvent) => {
    e.preventDefault(); // keep the text selection inside the field
    const el = ref.current;
    if (el && applyOp(el, op, multiline)) emit();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!multiline && e.key === 'Enter') e.preventDefault();
  };

  // Paste plain text only, so pasted HTML does not bring its own styles along.
  const onPaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(multiline ? /\r/g : /[\r\n]+/g, multiline ? '' : ' ');
    document.execCommand('insertText', false, text);
  };

  return (
    <div className="rich-field">
      <span className="rich-label">{label}</span>
      <div
        ref={ref}
        className={`rich${multiline ? ' rich-multi' : ''}`}
        role="textbox"
        aria-multiline={multiline}
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={emit}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />
      <div className="format-bar" aria-label={`Formatierung für ${label}`}>
        <div className="format-colors">
          {COLOR_TAGS.map((name) => (
            <button
              key={name}
              type="button"
              className="format-swatch"
              title={name}
              aria-label={`Farbe ${name}`}
              style={{ background: NAMED_COLORS[name] }}
              onMouseDown={apply({ kind: 'toggle', tag: name })}
            />
          ))}
        </div>
        <div className="format-decor">
          {DECORATION_TAGS.map((tag) => (
            <button key={tag} type="button" className="format-btn" title={tag} onMouseDown={apply({ kind: 'toggle', tag })}>
              {tag === 'bold' ? <b>B</b> : tag === 'italic' ? <i>I</i> : tag === 'underlined' ? <u>U</u> : <s>S</s>}
            </button>
          ))}
          <button type="button" className="format-btn" title="Formatierung entfernen" onMouseDown={apply({ kind: 'clear' })}>
            ↺
          </button>
        </div>
      </div>
    </div>
  );
}
