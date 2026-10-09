import { useEffect, useState } from 'react';
import type { ResourcePack } from '../assets/resourcePack';

/** Object URL of a material's icon from the loaded pack, or null while loading or when there is none. */
export function useItemIcon(pack: ResourcePack | null, id: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!pack || !id) return;
    pack.iconUrl(id).then((next) => { if (alive) setUrl(next); });
    return () => { alive = false; };
  }, [pack, id]);
  return url;
}

/** The icon of a material if the pack has one, otherwise the given text (e.g. a short material name). */
export function SlotContent({ pack, id, label }: { pack: ResourcePack | null; id?: string; label: string }) {
  const url = useItemIcon(pack, id);
  if (url) return <img className="slot-icon" src={url} alt="" width={32} height={32} />;
  return <>{label}</>;
}
