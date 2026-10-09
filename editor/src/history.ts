import type { Project } from './format/model';

// Undo/redo over whole-project snapshots. Rapid edits to the same field (typing) are merged into one step.
export interface History {
  past: Project[];
  present: Project;
  future: Project[];
  coalesceKey?: string;
  coalesceAt?: number;
}

export type HistoryAction =
  | { type: 'set'; next: Project; coalesceKey?: string; at: number }
  | { type: 'undo' }
  | { type: 'redo' };

const LIMIT = 100;
const MERGE_WINDOW_MS = 1200;

export function historyReducer(h: History, action: HistoryAction): History {
  switch (action.type) {
    case 'set': {
      if (action.next === h.present) return h;
      const merge =
        action.coalesceKey !== undefined &&
        action.coalesceKey === h.coalesceKey &&
        h.coalesceAt !== undefined &&
        action.at - h.coalesceAt < MERGE_WINDOW_MS;
      if (merge) {
        return { ...h, present: action.next, future: [], coalesceAt: action.at };
      }
      return {
        past: [...h.past, h.present].slice(-LIMIT),
        present: action.next,
        future: [],
        coalesceKey: action.coalesceKey,
        coalesceAt: action.at,
      };
    }
    case 'undo': {
      if (h.past.length === 0) return h;
      const previous = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: previous,
        future: [h.present, ...h.future],
      };
    }
    case 'redo': {
      if (h.future.length === 0) return h;
      const [next, ...rest] = h.future;
      return { past: [...h.past, h.present], present: next, future: rest };
    }
  }
}
