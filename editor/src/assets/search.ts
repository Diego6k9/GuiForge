/** One material the picker can offer. `aliases` are the other names it can be found under (German, English). */
export interface MaterialEntry {
  id: string;
  label: string;
  aliases: string[];
}

/**
 * Ranks materials for a query. Exact id or name matches come first, then prefixes, then substrings,
 * then queries where every word matches somewhere. Spaces count as underscores for ids, so
 * "diamond sword" finds diamond_sword.
 */
export function searchMaterials(entries: MaterialEntry[], query: string, limit = 12): MaterialEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.slice(0, limit);
  const idQuery = q.replace(/\s+/g, '_');
  const words = q.split(/\s+/);

  const scored: Array<{ entry: MaterialEntry; score: number }> = [];
  for (const entry of entries) {
    const id = entry.id.toLowerCase();
    const names = [entry.label, ...entry.aliases].map((n) => n.toLowerCase());
    let score = 0;
    if (id === idQuery || names.includes(q)) score = 100;
    else if (id.startsWith(idQuery) || names.some((n) => n.startsWith(q))) score = 80;
    else if (id.includes(idQuery) || names.some((n) => n.includes(q))) score = 60;
    else if (words.every((w) => id.includes(w) || names.some((n) => n.includes(w)))) score = 40;
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.id.length - b.entry.id.length || a.entry.id.localeCompare(b.entry.id));
  return scored.slice(0, limit).map((s) => s.entry);
}
