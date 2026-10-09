import { describe, expect, it } from 'vitest';
import { selfContainedLines } from './RichField';

describe('selfContainedLines', () => {
  it('closes and reopens a colour at each line break', () => {
    expect(selfContainedLines('<aqua>eins\nzwei\ndrei</aqua>')).toBe('<aqua>eins</aqua>\n<aqua>zwei</aqua>\n<aqua>drei</aqua>');
  });

  it('keeps nested tags per line and leaves plain text alone', () => {
    expect(selfContainedLines('<red><bold>a\nb</bold></red>\nc')).toBe('<red><bold>a</bold></red>\n<red><bold>b</bold></red>\nc');
  });
});
