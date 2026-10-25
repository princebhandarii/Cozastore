import { useEffect, useMemo } from "react";
import { X } from "lucide-react";

const OK = ["image/jpeg", "image/png", "image/webp"];
const MAX = 5 * 1024 * 1024;

// Small controlled multi-image picker with previews and client-side checks
// (the server re-validates type and size).
export default function ImagePicker({ files, setFiles, max, onError }) {
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const add = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    const good = [];
    for (const f of picked) {
      if (!OK.includes(f.type)) { onError?.("Only JPG, PNG or WebP images are allowed"); continue; }
      if (f.size > MAX) { onError?.("Each image must be under 5MB"); continue; }
      good.push(f);
    }
    setFiles([...files, ...good].slice(0, max));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {previews.map((src, i) => (
        <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--border)]">
          <img src={src} alt="" className="h-full w-full object-cover" />
          <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove image" className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"><X size={10} /></button>
        </div>
      ))}
      {files.length < max && (
        <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--muted)]">
          + Add
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={add} />
        </label>
      )}
    </div>
  );
}
