import JSZip from 'jszip';

/** Names of one material in the languages the pack ships with. */
export interface MaterialName {
  en?: string;
  de?: string;
}

/**
 * A resource pack (or client .jar) the user loaded. Only item and block textures and the
 * language files are read; everything else in the archive is ignored. Icons are decoded lazily.
 */
export class ResourcePack {
  readonly name: string;
  /** Material ids (without minecraft:) that have an item texture. */
  readonly itemIds: string[];
  /** Material ids (without minecraft:) that have a block texture. */
  readonly blockIds: string[];
  readonly names: Map<string, MaterialName>;

  private readonly itemFiles: Map<string, JSZip.JSZipObject>;
  private readonly blockFiles: Map<string, JSZip.JSZipObject>;
  private readonly urls = new Map<string, Promise<string | null>>();

  private constructor(
    name: string,
    itemFiles: Map<string, JSZip.JSZipObject>,
    blockFiles: Map<string, JSZip.JSZipObject>,
    names: Map<string, MaterialName>,
  ) {
    this.name = name;
    this.itemFiles = itemFiles;
    this.blockFiles = blockFiles;
    this.itemIds = [...itemFiles.keys()].sort();
    this.blockIds = [...blockFiles.keys()].sort();
    this.names = names;
  }

  /** Reads the archive. Throws when the file is not a zip or has no vanilla textures at all. */
  static async open(file: Blob, name: string): Promise<ResourcePack> {
    const zip = await JSZip.loadAsync(file);
    const itemFiles = textureFiles(zip, 'item/');
    const blockFiles = textureFiles(zip, 'block/');
    if (itemFiles.size === 0 && blockFiles.size === 0) {
      throw new Error('Keine Item- oder Block-Texturen gefunden. Ist das ein Resource Pack oder eine Minecraft-.jar?');
    }
    const names = new Map<string, MaterialName>();
    for (const [lang, key] of [['de', 'de_de.json'], ['en', 'en_us.json']] as const) {
      const entry = zip.file(`assets/minecraft/lang/${key}`);
      if (!entry) continue;
      const table = JSON.parse(await entry.async('string')) as Record<string, string>;
      for (const [k, value] of Object.entries(table)) {
        const match = /^(item|block)\.minecraft\.(.+)$/.exec(k);
        if (!match) continue;
        const current = names.get(match[2]) ?? {};
        // Item names win over block names when both exist (e.g. the same material as item and block).
        if (match[1] === 'item' || current[lang] === undefined) current[lang] = value;
        names.set(match[2], current);
      }
    }
    return new ResourcePack(name, itemFiles, blockFiles, names);
  }

  /** Display name for a material id, in German if available, else English, else the id itself. */
  nameOf(id: string): string {
    const entry = this.names.get(id);
    return entry?.de ?? entry?.en ?? id;
  }

  /** Object URL of the 16x16 icon, or null when the pack has no texture for this material. */
  iconUrl(id: string): Promise<string | null> {
    let cached = this.urls.get(id);
    if (!cached) {
      cached = this.loadIcon(id);
      this.urls.set(id, cached);
    }
    return cached;
  }

  private async loadIcon(id: string): Promise<string | null> {
    const file = this.itemFiles.get(id) ?? this.blockFiles.get(id);
    if (!file) return null;
    const blob = await file.async('blob');
    return URL.createObjectURL(new Blob([blob], { type: 'image/png' }));
  }
}

function textureFiles(zip: JSZip, folder: string): Map<string, JSZip.JSZipObject> {
  const prefix = `assets/minecraft/textures/${folder}`;
  const out = new Map<string, JSZip.JSZipObject>();
  zip.forEach((path, entry) => {
    if (entry.dir || !path.startsWith(prefix) || !path.endsWith('.png')) return;
    const rest = path.slice(prefix.length);
    // Only direct children: textures/item/foo.png, not textures/item/sub/bar.png.
    if (rest.includes('/')) return;
    out.set(rest.slice(0, -'.png'.length), entry);
  });
  return out;
}
