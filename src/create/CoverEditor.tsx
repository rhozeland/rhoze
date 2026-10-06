import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { file: Blob; busy: boolean; onCancel: () => void; onApply: (file: File) => Promise<void> };

export default function CoverEditor({ file, busy, onCancel, onApply }: Props) {
  const [source, setSource] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy && !working) onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [busy, working, onCancel]);

  async function apply() {
    if (!area || !source) return;
    setWorking(true); setError("");
    try {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 1600; canvas.height = 900;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image editor unavailable");
      context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Unable to crop image")), "image/jpeg", 0.92));
      await onApply(new File([blob], "project-cover.jpg", { type: "image/jpeg" }));
    } catch { setError("We couldn't save this image. Please try again."); }
    finally { setWorking(false); }
  }

  return (
    <div className="rz-modal rz-cover-modal" role="dialog" aria-modal="true" aria-labelledby="cover-editor-title">
      <div className="rz-cover-editor">
        <h2 id="cover-editor-title">Adjust cover</h2>
        <div className="rz-cover-crop">
          {source && <Cropper image={source} crop={crop} zoom={zoom} aspect={16 / 9} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} onMediaLoaded={() => setError("")} />}
        </div>
        <div className="rz-cover-zoom">
          <label htmlFor="cover-zoom">Zoom</label>
          <input id="cover-zoom" type="range" min="1" max="4" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
          <Button variant="ghost" size="icon" title="Reset position and zoom" aria-label="Reset position and zoom" disabled={busy || working} onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }}><RotateCcw size={16} /></Button>
        </div>
        {error && <p className="rz-err" role="alert">{error}</p>}
        <div className="rz-actions">
          <Button className="rz-btn" variant="outline" disabled={busy || working} onClick={onCancel}>Cancel</Button>
          <Button className="rz-btn pri" disabled={!area || busy || working} onClick={apply}>{busy || working ? "Saving…" : "Save cover"}</Button>
        </div>
      </div>
    </div>
  );
}