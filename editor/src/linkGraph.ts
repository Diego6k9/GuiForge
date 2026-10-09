import { linkTarget, type Project } from './format/model';

/** All `open:` links from one GUI to another. Several items linking the same target form one edge. */
export interface LinkEdge {
  /** Index of the GUI the links start from. */
  from: number;
  /** Index of the target GUI, or null when no GUI with that id exists. */
  to: number | null;
  targetId: string;
  itemKeys: string[];
}

export function linkEdges(project: Project): LinkEdge[] {
  const indexById = new Map<string, number>();
  project.guis.forEach((gui, i) => indexById.set(gui.id, i));

  const edges = new Map<string, LinkEdge>();
  project.guis.forEach((gui, from) => {
    for (const item of gui.items) {
      const targetId = linkTarget(item.action);
      if (targetId === null) continue;
      const key = `${from}->${targetId}`;
      const edge = edges.get(key) ?? { from, to: indexById.get(targetId) ?? null, targetId, itemKeys: [] };
      edge.itemKeys.push(item.key || '(ohne Key)');
      edges.set(key, edge);
    }
  });
  return [...edges.values()];
}
