import { useState } from 'react';
import { ROLE_COLORS, roleOf, type EditorGui, type EditorItem } from '../format/model';

const SAMPLE_COUNT = 30;

interface PreviewProps {
  gui: EditorGui;
  resolved: Map<string, number[]>;
}

function plain(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

interface Cell {
  label: string;
  color?: string;
  title?: string;
}

/**
 * Approximates the runtime: same slot resolution, same nav-hiding and filler rules as GuiSession.
 * Item textures are not rendered yet, so items show their name on a coloured tile.
 */
export function Preview({ gui, resolved }: PreviewProps) {
  const [page, setPage] = useState(0);
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
    label: plain(item.name) || item.key,
    color: ROLE_COLORS[roleOf(item, gui)],
    title: [item.key, ...item.lore.map(plain)].join('\n'),
  });

  const cells: Cell[] = [];
  for (let slot = 0; slot < size; slot++) {
    const contentIndex = contentSlots.indexOf(slot);
    if (gui.paginated && contentIndex >= 0) {
      const sample = currentPage * perPage + contentIndex;
      if (sample < SAMPLE_COUNT) {
        cells.push({ label: `Produkt ${sample + 1}`, color: '#2b7a78', title: `Beispiel ${sample + 1}` });
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

  const titleText = gui.title.replace(/<[^>]*>/g, '').trim() || gui.id;

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
            <div key={slot} className="mc-slot preview-slot" style={cell.color ? { background: cell.color } : undefined} title={cell.title}>
              <span>{cell.label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="muted small preview-note">Texturen und Schrift werden hier vereinfacht dargestellt. Maßgeblich ist das Spiel.</p>
    </div>
  );
}
