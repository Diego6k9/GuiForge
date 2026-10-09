import { describe, expect, it } from 'vitest';
import { emptyGui, newItem, type EditorGui, type Project } from './format/model';
import { linkEdges } from './linkGraph';

function gui(id: string, actions: Array<[string, string]>): EditorGui {
  return {
    ...emptyGui(),
    id,
    items: actions.map(([key, action]) => ({ ...newItem(emptyGui()), key, action })),
  };
}

describe('linkEdges', () => {
  it('groups open: links by target and marks missing targets', () => {
    const project: Project = {
      guis: [
        gui('shop', [['buy', 'open:confirm'], ['cart', 'open:confirm'], ['gone', 'open:nope'], ['close', 'close']]),
        gui('confirm', [['yes', 'open:shop']]),
      ],
    };
    expect(linkEdges(project)).toEqual([
      { from: 0, to: 1, targetId: 'confirm', itemKeys: ['buy', 'cart'] },
      { from: 0, to: null, targetId: 'nope', itemKeys: ['gone'] },
      { from: 1, to: 0, targetId: 'shop', itemKeys: ['yes'] },
    ]);
  });

  it('returns nothing when no item opens a GUI', () => {
    expect(linkEdges({ guis: [gui('a', [['x', 'close']])] })).toEqual([]);
  });
});
