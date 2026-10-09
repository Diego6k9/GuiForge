import { useMemo } from 'react';
import type { Project } from '../format/model';
import { linkEdges } from '../linkGraph';

const W = 620;
const H = 420;
const CX = W / 2;
const CY = H / 2;
const RADIUS = 150;
const NODE_W = 160;
const NODE_H = 46;
const ARROW = 'link-arrow';

/** GUIs on a circle, first one at the top. A single GUI sits in the middle. */
function layout(n: number): Array<{ x: number; y: number }> {
  return Array.from({ length: n }, (_, i) => {
    if (n === 1) return { x: CX, y: CY };
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return { x: CX + RADIUS * Math.cos(angle), y: CY + RADIUS * Math.sin(angle) };
  });
}

/** Distance from a node centre to its border in the given unit direction. */
function exitDistance(ux: number, uy: number): number {
  const byX = ux === 0 ? Infinity : NODE_W / 2 / Math.abs(ux);
  const byY = uy === 0 ? Infinity : NODE_H / 2 / Math.abs(uy);
  return Math.min(byX, byY);
}

/** A straight arrow between two node borders, pushed sideways by `offset` so opposite arrows do not overlap. */
function arrow(a: { x: number; y: number }, b: { x: number; y: number }, offset: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy * offset;
  const py = ux * offset;
  const gap = 6;
  const s = exitDistance(ux, uy) + gap;
  const x1 = a.x + px + ux * s;
  const y1 = a.y + py + uy * s;
  const x2 = b.x + px - ux * s;
  const y2 = b.y + py - uy * s;
  return { x1, y1, x2, y2, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
}

interface LinkViewProps {
  project: Project;
  onOpen: (index: number) => void;
}

export function LinkView({ project, onOpen }: LinkViewProps) {
  const edges = useMemo(() => linkEdges(project), [project]);
  const points = layout(project.guis.length);
  const drawn = edges.filter((e) => e.to !== null);
  const broken = edges.filter((e) => e.to === null);
  const hasReverse = (from: number, to: number) => drawn.some((e) => e.from === to && e.to === from);

  return (
    <div className="section link-view">
      <div className="section-head">
        <span>Verknüpfungen</span>
        <span className="muted">{edges.length === 0 ? 'keine' : `${edges.length} Verbindung${edges.length === 1 ? '' : 'en'}`}</span>
      </div>

      {edges.length === 0 ? (
        <p className="muted">
          Noch keine Verknüpfungen. Ein Item mit der Aktion „open:&lt;GUI-ID&gt;“ verbindet zwei GUIs.
        </p>
      ) : null}

      {project.guis.length > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} className="link-svg" role="img" aria-label="Verknüpfungen zwischen den GUIs">
          <defs>
            <marker id={ARROW} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#8b90a0" />
            </marker>
          </defs>

          {drawn.map((edge) => {
            const from = points[edge.from];
            const to = edge.to as number;
            if (edge.from === to) {
              // Self link: a loop above the node.
              const { x, y } = from;
              const d = `M ${x - 26} ${y - NODE_H / 2} C ${x - 70} ${y - 100}, ${x + 70} ${y - 100}, ${x + 26} ${y - NODE_H / 2}`;
              return (
                <g key={`${edge.from}-${to}`} className="link-edge">
                  <path d={d} markerEnd={`url(#${ARROW})`} />
                  <text x={x} y={y - 78} textAnchor="middle">{edge.itemKeys.join(', ')}</text>
                </g>
              );
            }
            const offset = hasReverse(edge.from, to) ? (edge.from < to ? 9 : -9) : 0;
            const a = arrow(from, points[to], offset);
            return (
              <g key={`${edge.from}-${to}`} className="link-edge">
                <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} markerEnd={`url(#${ARROW})`} />
                <text x={a.mx} y={a.my - 6} textAnchor="middle">{edge.itemKeys.join(', ')}</text>
              </g>
            );
          })}

          {project.guis.map((gui, i) => {
            const { x, y } = points[i];
            return (
              <g
                key={i}
                className="link-node"
                role="button"
                tabIndex={0}
                aria-label={`GUI ${gui.id} öffnen`}
                onClick={() => onOpen(i)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(i); }}
              >
                <rect x={x - NODE_W / 2} y={y - NODE_H / 2} width={NODE_W} height={NODE_H} rx={8} />
                <text x={x} y={y - 2} textAnchor="middle" className="link-node-title">{gui.id}</text>
                <text x={x} y={y + 14} textAnchor="middle" className="link-node-meta">{gui.rows}×9{gui.paginated ? ' · pag.' : ''}</text>
              </g>
            );
          })}
        </svg>
      )}

      {broken.length > 0 && (
        <ul className="link-broken">
          {broken.map((edge) => (
            <li key={`${edge.from}-${edge.targetId}`} className="error-text">
              „{project.guis[edge.from].id}“ verweist auf „{edge.targetId}“, diese GUI gibt es nicht ({edge.itemKeys.join(', ')}).
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
