"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Renders a photo or video from Supabase `job-evidence` path or an external http(s) URL. */
export function JobEvidenceMedia({ pathOrUrl }: { pathOrUrl: string }) {
  const [src, setSrc] = useState<string | null>(pathOrUrl.startsWith("http") ? pathOrUrl : null);

  useEffect(() => {
    if (pathOrUrl.startsWith("http")) {
      setSrc(pathOrUrl);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase.storage
      .from("job-evidence")
      .createSignedUrl(pathOrUrl, 3600)
      .then(({ data, error }) => {
        if (!cancelled) {
          setSrc(error ? null : data?.signedUrl ?? null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pathOrUrl]);

  if (!src) {
    return <span className="text-xs text-slate-400">Loading media…</span>;
  }

  const isVideo = /\.(mp4|webm|mov)$/i.test(pathOrUrl) || pathOrUrl.includes("video");
  if (isVideo) {
    return <video src={src} controls className="max-h-48 max-w-full rounded-lg border border-slate-200" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="max-h-48 max-w-full rounded-lg border border-slate-200 object-cover" />;
}
