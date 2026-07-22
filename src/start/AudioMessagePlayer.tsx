import { useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause, Captions } from "lucide-react";

type Cue = { start: number; end: number; text: string };

function parseVTT(src: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = src.replace(/\r/g, "").split(/\n\n+/);
  const toSec = (t: string) => {
    const parts = t.split(":");
    let h = 0, m = 0, s = 0;
    if (parts.length === 3) { h = +parts[0]; m = +parts[1]; s = parseFloat(parts[2]); }
    else if (parts.length === 2) { m = +parts[0]; s = parseFloat(parts[1]); }
    else { s = parseFloat(parts[0]); }
    return h * 3600 + m * 60 + s;
  };
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    const timing = lines.find(l => l.includes("-->"));
    if (!timing) continue;
    const [a, b] = timing.split("-->").map(s => s.trim().split(" ")[0]);
    if (!a || !b) continue;
    const start = toSec(a);
    const end = toSec(b);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    const idx = lines.indexOf(timing);
    const text = lines.slice(idx + 1).join("\n").trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

function fmt(t: number) {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  src: string;
  captionsUrl?: string | null;
  mine?: boolean;
};

export default function AudioMessagePlayer({ src, captionsUrl, mine }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cues, setCues] = useState<Cue[]>([]);
  const [showCaptions, setShowCaptions] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 44,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      cursorWidth: 1,
      waveColor: mine ? "rgba(255,255,255,0.55)" : "hsl(var(--muted-foreground) / 0.55)",
      progressColor: mine ? "rgba(255,255,255,0.95)" : "hsl(var(--foreground))",
      cursorColor: mine ? "rgba(255,255,255,0.9)" : "hsl(var(--foreground))",
      url: src,
    });
    wsRef.current = ws;
    const onReady = () => { setReady(true); setDuration(ws.getDuration()); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onFinish = () => setPlaying(false);
    const onAudioProcess = () => setCurrent(ws.getCurrentTime());
    const onSeek = () => setCurrent(ws.getCurrentTime());
    ws.on("ready", onReady);
    ws.on("play", onPlay);
    ws.on("pause", onPause);
    ws.on("finish", onFinish);
    ws.on("audioprocess", onAudioProcess);
    ws.on("seeking", onSeek);
    return () => { ws.destroy(); wsRef.current = null; };
  }, [src, mine]);

  useEffect(() => {
    let cancel = false;
    setCues([]);
    if (!captionsUrl) return;
    fetch(captionsUrl)
      .then(r => r.ok ? r.text() : "")
      .then(txt => { if (!cancel && txt) setCues(parseVTT(txt)); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [captionsUrl]);

  const activeCue = useMemo(
    () => cues.find(c => current >= c.start && current <= c.end) ?? null,
    [cues, current]
  );

  return (
    <div className={`w-72 max-w-full rounded-xl border px-2.5 py-2 space-y-1.5 ${mine ? "border-primary-foreground/30 bg-primary-foreground/10" : "border-border bg-background/60"}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => wsRef.current?.playPause()}
          disabled={!ready}
          className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center transition-colors ${mine ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90" : "bg-foreground text-background hover:bg-foreground/85"} disabled:opacity-50`}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
        <div ref={containerRef} className="flex-1 min-w-0" />
      </div>
      <div className="flex items-center justify-between text-[10px] tabular-nums opacity-80">
        <span>{fmt(current)} / {fmt(duration)}</span>
        {cues.length > 0 && (
          <button
            type="button"
            onClick={() => setShowCaptions(v => !v)}
            className="inline-flex items-center gap-1 hover:opacity-100 opacity-80"
            title={showCaptions ? "Hide captions" : "Show captions"}
          >
            <Captions size={11} /> {showCaptions ? "CC on" : "CC off"}
          </button>
        )}
      </div>
      {showCaptions && cues.length > 0 && (
        <div
          className={`rounded-md px-2 py-1.5 text-xs leading-snug min-h-[28px] ${mine ? "bg-primary-foreground/15" : "bg-muted"}`}
          aria-live="polite"
        >
          {activeCue ? activeCue.text : <span className="opacity-50">—</span>}
        </div>
      )}
    </div>
  );
}