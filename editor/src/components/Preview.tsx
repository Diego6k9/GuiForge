import { useState, type MouseEvent } from 'react';
import { ROLE_COLORS, roleOf, type EditorGui, type EditorItem } from '../format/model';
import { parseMiniMessage, plainText, type Segment } from '../format/minimessage';

const SAMPLE_COUNT = 30;

interface PreviewProps {
  gui: EditorGui;
  resolved: Map<string, number[]>;
}

interface Cell {
  label: string;
  color?: string;
  /** The item shown in this slot; drives the hover tooltip. */
  item?: EditorItem;
  /** Name for sample products, which have no item behind them. */
  sampleName?: string;
}

interface Tip {
  cell: Cell;
  x: number;
  y: number;
}

const TIP_OFFSET = 14;
const TIP_WIDTH = 260;

/**
 * Approximates the runtime: same slot resolution, same nav-hiding and filler rules as GuiSession.
 * Item textures are not rendered yet, so items show their name on a coloured tile.
 */
export function Preview({ gui, resolved }: PreviewProps) {
  const [page, setPage] = useState(0);
  const [tip, setTip] = useState<Tip | null>(null);
  const size = gui.rows * 9;
  const contentSlots = gui.paginated ? gui.contentSlots : [];
  const perPage = contentSlots.length || 1;
  const pages = gui.paginated ? Math.max(1, Math.ceil(SAMPLE_COUNT / perPage)) : 1;
  const currentPage = Math.min(page, pages - 1);

  const owner = new Map<number, EditorItem>();
  for (const item of gui.items) {
    for (const slot of resolved.get(item.id) ?? []) owner.set(slot, item);
  }
  const filler = gui.items.find((i) => i.key === gui.filler);

  const itemCell = (item: EditorItem): Cell => ({
    label: plainText(item.name) || item.key,
    color: ROLE_COLORS[roleOf(item, gui)],
    item,
  });

  const cells: Cell[] = [];
  for (let slot = 0; slot < size; slot++) {
    const contentIndex = contentSlots.indexOf(slot);
    if (gui.paginated && contentIndex >= 0) {
      const sample = currentPage * perPage + contentIndex;
      if (sample < SAMPLE_COUNT) {
        cells.push({ label: `Produkt ${sample + 1}`, color: '#2b7a78', sampleName: `Produkt ${sample + 1}` });
      } else if (gui.fill === 'filler' && filler) {
        cells.push(itemCell(filler));
      } else {
        cells.push({ label: '' });
      }
      continue;
    }
    const item = owner.get(slot);
    if (!item) {
      cells.push({ label: '' });
      continue;
    }
    const hiddenNav =
      gui.paginated &&
      gui.navOnEdge === 'hide' &&
      ((item.key === gui.navPrev && currentPage === 0) || (item.key === gui.navNext && currentPage === pages - 1));
    if (hiddenNav) {
      cells.push(filler ? itemCell(filler) : { label: '' });
      continue;
    }
    cells.push(itemCell(item));
  }

  const titleText = plainText(gui.title).trim() || gui.id;

  const onEnter = (cell: Cell, e: MouseEvent) => {
    if (!cell.item && !cell.sampleName) return setTip(null);
    setTip({ cell, x: e.clientX, y: e.clientY });
  };
  const onMove = (e: MouseEvent) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));

  return (
    <div className="section preview">
      <div className="section-head">
        <span>Vorschau</span>
        {gui.paginated && (
          <div className="pager">
            <button className="btn" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>‹</button>
            <span>Seite {currentPage + 1} / {pages}</span>
            <button className="btn" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>›</button>
          </div>
        )}
      </div>
      {/* Like the in-game container: the title sits inside the window, top left. */}
      <div className="mc-window">
        <div className="mc-title">{titleText}</div>
        <div className="mc-grid preview-grid">
          {cells.map((cell, slot) => (
            <div
              key={slot}
              className="mc-slot preview-slot"
              style={cell.color ? { background: cell.color } : undefined}
              onMouseEnter={(e) => onEnter(cell, e)}
              onMouseMove={onMove}
              onMouseLeave={() => setTip(null)}
            >
              <span>{cell.label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="muted small preview-note">Texturen und Schrift werden hier vereinfacht dargestellt. Maßgeblich ist das Spiel.</p>
      {tip && <Tooltip tip={tip} />}
    </div>
  );
}

/** Dark purple item tooltip, positioned at the cursor like in-game. Hidden for hideTooltip items. */
function Tooltip({ tip }: { tip: Tip }) {
  const { cell, x, y } = tip;
  if (cell.item?.hideTooltip) return null;

  const name: Segment[] = cell.item
    ? parseMiniMessage(cell.item.name || cell.item.key)
    : [{ text: cell.sampleName ?? '', bold: false, italic: false, underlined: false, strikethrough: false }];
  const lore = cell.item ? cell.item.lore.map((line) => parseMiniMessage(line)) : [];

  const flip = x + TIP_OFFSET + TIP_WIDTH > window.innerWidth;
  const left = flip ? x - TIP_OFFSET - TIP_WIDTH : x + TIP_OFFSET;

  return (
    <div className="mc-tooltip" style={{ left, top: y + TIP_OFFSET }} role="tooltip">
      <div className="mc-tip-line mc-tip-name">{name.map(renderSegment)}</div>
      {lore.map((line, i) => (
        <div key={i} className="mc-tip-line">
          {line.length ? line.map(renderSegment) : ' '}
        </div>
      ))}
    </div>
  );
}

function renderSegment(seg: Segment, i: number) {
  const style = {
    color: seg.color ?? '#ffffff',
    fontWeight: seg.bold ? 700 : undefined,
    WebkitTextStroke: seg.bold ? '0.5px currentColor' : undefined,
    fontStyle: seg.italic ? 'italic' : undefined,
    textDecoration: [seg.underlined && 'underline', seg.strikethrough && 'line-through'].filter(Boolean).join(' ') || undefined,
  } as const;
  return <span key={i} style={style}>{seg.text}</span>;
}
