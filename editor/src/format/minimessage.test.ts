import { describe, expect, it } from 'vitest';
import { parseMiniMessage, plainText, tagsOf } from './minimessage';

describe('parseMiniMessage', () => {
  it('returns one plain segment for untagged text', () => {
    expect(parseMiniMessage('Hallo')).toEqual([
      { text: 'Hallo', bold: false, italic: false, underlined: false, strikethrough: false },
    ]);
  });

  it('applies named colours until closed', () => {
    const segs = parseMiniMessage('<gold>Gold</gold> normal');
    expect(segs.map((s) => [s.text, s.color])).toEqual([
      ['Gold', '#ffaa00'],
      [' normal', undefined],
    ]);
  });

  it('restores the outer colour after a nested tag closes', () => {
    const segs = parseMiniMessage('<red>Alles <white>und</white> rot</red>');
    expect(segs.map((s) => [s.text, s.color])).toEqual([
      ['Alles ', '#ff5555'],
      ['und', '#ffffff'],
      [' rot', '#ff5555'],
    ]);
  });

  it('applies hex colours', () => {
    const [seg] = parseMiniMessage('<#FF8800>Orange');
    expect(seg.color).toBe('#ff8800');
  });

  it('handles decorations and reset', () => {
    const segs = parseMiniMessage('<bold><red>A<reset>B');
    expect(segs[0]).toMatchObject({ text: 'A', bold: true, color: '#ff5555' });
    expect(segs[1]).toMatchObject({ text: 'B', bold: false });
    expect(segs[1].color).toBeUndefined();
  });

  it('supports short decoration aliases and closing tags', () => {
    const segs = parseMiniMessage('<i>x</i>y');
    expect(segs[0].italic).toBe(true);
    expect(segs[1].italic).toBe(false);
  });

  it('ignores unknown tags without dropping text', () => {
    expect(plainText('<click:run_command:/x>Klick</click>')).toBe('Klick');
  });
});

describe('tagsOf', () => {
  it('returns colour name and decorations', () => {
    const [seg] = parseMiniMessage('<gold><bold>Hi');
    expect(tagsOf(seg)).toEqual(['gold', 'bold']);
  });

  it('keeps unknown hex colours as hex tags', () => {
    expect(tagsOf({ color: '#ff8800', bold: false, italic: false, underlined: false, strikethrough: false })).toEqual(['#ff8800']);
  });
});
