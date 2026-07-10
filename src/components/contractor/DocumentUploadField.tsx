"use client";

import { useRef, useState } from "react";
import { Camera, FileUp, Loader2, CheckCircle2 } from "lucide-react";

type Props = {
  label: string;
  hint?: string;
  currentPath?: string | null;
  uploadKind: "operative_id" | "personnel_id";
  personnelId?: string;
  onUploaded: (path: string) => void;
  onRemove?: () => void;
};

export default function DocumentUploadField({
  label,
  hint,
  currentPath,
  uploadKind,
  personnelId,
  onUploaded,
  onRemove,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("kind", uploadKind);
    if (personnelId) form.append("personnelId", personnelId);

    const res = await fetch("/api/contractor/documents/upload", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; path?: string };
    setUploading(false);
    if (!res.ok || !json.path) {
      setError(json.error || "Upload failed");
      return;
    }
    onUploaded(json.path);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = "";
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {currentPath && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Document uploaded
          </p>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs font-medium text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={onFileChange}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFileChange}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          Upload file
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => cameraRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:hidden"
        >
          <Camera className="h-4 w-4" />
          Take photo
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        JPEG, PNG or PDF up to 10MB. We use this only to verify your identity for Kleen contractor onboarding (UK GDPR).
      </p>
    </div>
  );
}
