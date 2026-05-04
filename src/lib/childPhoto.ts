import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Extract a storage path from either a stored path or a legacy public URL. */
export function toStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  const idx = value.indexOf("/child-photos/");
  if (idx >= 0) return value.slice(idx + "/child-photos/".length);
  // assume already a path
  return value;
}

const cache = new Map<string, { url: string; exp: number }>();

export async function getChildPhotoUrl(value: string | null | undefined): Promise<string | null> {
  const path = toStoragePath(value);
  if (!path) return null;
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.exp > now + 60_000) return cached.url;
  const { data, error } = await supabase.storage.from("child-photos").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, exp: now + 3600 * 1000 });
  return data.signedUrl;
}

export function useChildPhoto(value: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let aktiv = true;
    setUrl(null);
    if (!value) return;
    getChildPhotoUrl(value).then((u) => { if (aktiv) setUrl(u); });
    return () => { aktiv = false; };
  }, [value]);
  return url;
}
