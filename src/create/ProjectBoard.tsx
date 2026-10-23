import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Play, Pause, X } from "lucide-react";
import "./board.css";

type Item = { id: string; kind: "note" | "image" | "audio" | "colour" | "link"; x: number; y: number; color: string | null; body: string | null; url: string | null; storage_path: string | null };
const NOTE_COLORS = ["yellow", "pink", "orange", "blue"] as const;
const db = () => (supabase.from as any)("release_board_items");

/** Private, owner-only canvas. Positions persist in release_board_items; files live in the private board-media bucket. */
export default function ProjectBoard({ releaseId }: { releaseId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [blobs, setBlobs] = useState<Record<string, string>>({});
  const [noteColor, setNoteColor] = useState<(typeof NOTE_COLORS)[number]>("yellow");
  const [err, setErr] = useState("");
  const canvas = useRef<HTMLDivElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const kindRef = useRef<"image" | "audio">("image");

  useEffect(() => {
    db().select("*").eq("release_id", releaseId).order("created_at").then(({ data, error }: any) => {
      if (error) setErr("Couldn't load the board."); else setItems(data || []);
    });
  }, [releaseId]);

  useEffect(() => {
    items.forEach(async (it) => {
      if (!it.storage_path || blobs[it.id]) return;
      const { data } = await supabase.storage.from("board-media").download(it.storage_path);
      if (data) setBlobs((b) => ({ ...b, [it.id]: URL.createObjectURL(data) }));
    });
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const spot = () => ({ x: 40 + (items.length % 5) * 40, y: 40 + (items.length % 5) * 30 });
  const add = async (row: Partial<Item>) => {
    setErr("");
    const { data, error } = await db().insert({ release_id: releaseId, ...spot(), ...row }).select().single();
    if (error) { setErr("Couldn't add that item."); return; }
    setItems((s) => [...s, data]);
  };
  const patch = (id: string, p: Partial<Item>) => { setItems((s) => s.map((i) => (i.id === id ? { ...i, ...p } : i))); db().update({ ...p, updated_at: new Date().toISOString() }).eq("id", id).then(() => {}); };
  const remove = async (it: Item) => {
    setItems((s) => s.filter((i) => i.id !== it.id));
    await db().delete().eq("id", it.id);
    if (it.storage_path) await supabase.storage.from("board-media").remove([it.storage_path]);
  };

  const upload = async (f: File) => {
    const kind = kindRef.current;
    if (!f.type.startsWith(kind === "image" ? "image/" : "audio/")) { setErr(`Choose an ${kind} file.`); return; }
    const path = `${releaseId}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("board-media").upload(path, f);
    if (error) { setErr("Upload failed. Files must be under 20 MB."); return; }
    add({ kind, storage_path: path, body: f.name });
  };
  const pick = (k: "image" | "audio") => { kindRef.current = k; if (fileIn.current) { fileIn.current.accept = `${k}/*`; fileIn.current.click(); } };
  const addLink = () => {
    const url = prompt("Link URL (https://…)")?.trim();
    if (!url) return;
    if (!/^https?:\/\/\S+$/i.test(url)) { setErr("Use a complete https:// link."); return; }
    add({ kind: "link", url, body: prompt("Title for this link") || new URL(url).hostname });
  };

  const drag = (e: React.PointerEvent, it: Item) => {
    if ((e.target as HTMLElement).closest("textarea,input,button,a")) return;
    const sx = e.clientX - it.x, sy = e.clientY - it.y, el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    let nx = it.x, ny = it.y;
    const move = (ev: PointerEvent) => { nx = Math.max(0, ev.clientX - sx); ny = Math.max(0, ev.clientY - sy); setItems((s) => s.map((i) => (i.id === it.id ? { ...i, x: nx, y: ny } : i))); };
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); if (nx !== it.x || ny !== it.y) patch(it.id, { x: Math.round(nx), y: Math.round(ny) }); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
  };

  return (
    <div className="rz-board">
      <div className="rz-board-canvas" ref={canvas}>
        {items.length === 0 && <p className="rz-board-empty">Add notes, images, audio, colours and links with the toolbar below. Only you can see this board.</p>}
        {items.map((it) => (
          <div key={it.id} className={`rz-bi rz-bi-${it.kind}${it.kind === "note" ? ` c-${it.color || "yellow"}` : ""}`} style={{ left: it.x, top: it.y }} onPointerDown={(e) => drag(e, it)}>
            <button type="button" className="rz-bi-del" aria-label="Delete item" onClick={() => remove(it)}><X size={12} /></button>
            {it.kind === "note" && <textarea aria-label="Note" defaultValue={it.body || ""} placeholder="Type a note…" maxLength={2000} onBlur={(e) => e.target.value !== (it.body || "") && patch(it.id, { body: e.target.value })} />}
            {it.kind === "image" && (blobs[it.id] || it.url ? <img src={blobs[it.id] || it.url!} alt={it.body || "Board image"} draggable={false} /> : <span>Loading…</span>)}
            {it.kind === "audio" && <AudioCard src={blobs[it.id]} name={it.body || "Audio clip"} />}
            {it.kind === "colour" && <label className="rz-bi-swatch" style={{ background: it.color || "#F5DD4B" }}><input type="color" aria-label="Pick colour" defaultValue={it.color || "#F5DD4B"} onChange={(e) => patch(it.id, { color: e.target.value })} /><span>{it.color || "#F5DD4B"}</span></label>}
            {it.kind === "link" && <a href={it.url!} target="_blank" rel="noopener noreferrer"><b>{it.body}</b><small>{it.url}</small></a>}
          </div>
        ))}
        <div className="rz-board-tools" role="toolbar" aria-label="Board tools">
          <Button variant="ghost" type="button">Select</Button>
          <Button variant="ghost" type="button" onClick={() => add({ kind: "note", color: noteColor, body: "" })}>Note</Button>
          <span className="rz-board-dots" aria-label="Note colour">{NOTE_COLORS.map((c) => <button key={c} type="button" aria-label={`${c} note`} aria-pressed={noteColor === c} className={`c-${c}`} onClick={() => setNoteColor(c)} />)}</span>
          <Button variant="ghost" type="button" onClick={() => pick("image")}>Image</Button>
          <Button variant="ghost" type="button" onClick={() => pick("audio")}>Audio</Button>
          <Button variant="ghost" type="button" onClick={() => add({ kind: "colour", color: "#F5DD4B" })}>Colour</Button>
          <Button variant="ghost" type="button" onClick={addLink}>Link</Button>
        </div>
        <input ref={fileIn} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      </div>
      {err && <p role="alert" className="rz-board-err">{err}</p>}
    </div>
  );
}

function AudioCard({ src, name }: { src?: string; name: string }) {
  const a = useRef<HTMLAudioElement>(null);
  const [on, setOn] = useState(false);
  const bars = Array.from({ length: 18 }, (_, i) => 8 + ((i * 37) % 26));
  return (
    <div className="rz-bi-audio-in">
      <b>{name}</b>
      <div className="rz-bi-wave">
        <button type="button" aria-label={on ? "Pause" : "Play"} disabled={!src} onClick={() => { if (!a.current) return; on ? a.current.pause() : a.current.play(); }}>{on ? <Pause size={14} /> : <Play size={14} />}</button>
        {bars.map((h, i) => <i key={i} style={{ height: h }} />)}
      </div>
      {src && <audio ref={a} src={src} onPlay={() => setOn(true)} onPause={() => setOn(false)} onEnded={() => setOn(false)} />}
    </div>
  );
}
