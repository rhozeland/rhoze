import { useEffect, useMemo, useState } from "react";
import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Preset = {
  id: string;
  name: string;
  /** HSL triplet "H S% L%" used for --primary, --accent, --ring */
  hsl: string;
  /** Foreground for primary/accent buttons */
  fg: string;
  contrast?: boolean;
};

const PRESETS: Preset[] = [
  { id: "mint",     name: "Mint (default)", hsl: "170 60% 55%",  fg: "0 0% 100%" },
  { id: "indigo",   name: "Indigo",         hsl: "243 75% 65%",  fg: "0 0% 100%" },
  { id: "rose",     name: "Rose",           hsl: "340 80% 60%",  fg: "0 0% 100%" },
  { id: "amber",    name: "Amber",          hsl: "38 95% 55%",   fg: "0 0% 10%"  },
  { id: "emerald",  name: "Emerald",        hsl: "152 70% 45%",  fg: "0 0% 100%" },
  { id: "sky",      name: "Sky",            hsl: "200 90% 55%",  fg: "0 0% 100%" },
  { id: "violet",   name: "Violet",         hsl: "270 75% 65%",  fg: "0 0% 100%" },
  { id: "coral",    name: "Coral",          hsl: "12 85% 60%",   fg: "0 0% 100%" },
  // High-contrast options
  { id: "hc-yellow", name: "High contrast — yellow", hsl: "52 100% 55%", fg: "0 0% 0%",   contrast: true },
  { id: "hc-cyan",   name: "High contrast — cyan",   hsl: "190 100% 50%", fg: "0 0% 0%",   contrast: true },
  { id: "hc-white",  name: "High contrast — white",  hsl: "0 0% 100%",   fg: "0 0% 0%",   contrast: true },
];

const STORAGE_KEY = "accent-preset";
const CUSTOM_KEY = "accent-custom-hex";

// ───────────────────────── color math ─────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hexToHslTriplet(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const { h, s, l } = rgbToHsl(...rgb);
  return `${h} ${s}% ${l}%`;
}

function relLum(r: number, g: number, b: number) {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a: [number, number, number], b: [number, number, number]) {
  const la = relLum(...a), lb = relLum(...b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function hslTripletToRgb(triplet: string): [number, number, number] {
  const m = triplet.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  if (!m) return [0, 0, 0];
  const h = parseFloat(m[1]) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const t = (x: number) => {
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [
    Math.round(t(h + 1 / 3) * 255),
    Math.round(t(h) * 255),
    Math.round(t(h - 1 / 3) * 255),
  ];
}

function rateRatio(r: number) {
  // WCAG 2.1: AA non-text 3, AA text 4.5, AAA text 7
  if (r >= 7) return { label: "AAA", tone: "text-emerald-500" };
  if (r >= 4.5) return { label: "AA", tone: "text-emerald-500" };
  if (r >= 3) return { label: "AA Large", tone: "text-amber-500" };
  return { label: "Fail", tone: "text-destructive" };
}

// ───────────────────────── apply ─────────────────────────

function applyTriplet(hsl: string, fg: string) {
  const root = document.documentElement;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--primary-foreground", fg);
  root.style.setProperty("--accent", hsl);
  root.style.setProperty("--accent-foreground", fg);
  root.style.setProperty("--ring", hsl);
}

/** Pick a foreground (white/near-black) that has the best contrast on `triplet`. */
function bestForeground(triplet: string): string {
  const rgb = hslTripletToRgb(triplet);
  const cWhite = contrastRatio(rgb, [255, 255, 255]);
  const cBlack = contrastRatio(rgb, [10, 10, 10]);
  return cWhite >= cBlack ? "0 0% 100%" : "0 0% 4%";
}

type StoredAccent =
  | { kind: "preset"; preset: Preset }
  | { kind: "custom"; hex: string; hsl: string; fg: string };

export function readAccent(): StoredAccent {
  if (typeof window === "undefined") return { kind: "preset", preset: PRESETS[0] };
  const id = localStorage.getItem(STORAGE_KEY);
  if (id === "custom") {
    const hex = localStorage.getItem(CUSTOM_KEY) || "";
    const hsl = hexToHslTriplet(hex);
    if (hsl) return { kind: "custom", hex, hsl, fg: bestForeground(hsl) };
  }
  const preset = PRESETS.find((p) => p.id === id);
  return { kind: "preset", preset: preset ?? PRESETS[0] };
}

function applyAccent(a: StoredAccent) {
  if (a.kind === "preset") applyTriplet(a.preset.hsl, a.preset.fg);
  else applyTriplet(a.hsl, a.fg);
}

if (typeof window !== "undefined") {
  try { applyAccent(readAccent()); } catch { /* noop */ }
}

// ───────────────────────── component ─────────────────────────

interface Props {
  collapsed?: boolean;
  className?: string;
}

export function AccentPicker({ collapsed = false, className }: Props) {
  const [accent, setAccent] = useState<StoredAccent>(() => readAccent());
  const [hexInput, setHexInput] = useState<string>(() =>
    accent.kind === "custom" ? accent.hex : "#",
  );

  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  const choosePreset = (p: Preset) => {
    localStorage.setItem(STORAGE_KEY, p.id);
    setAccent({ kind: "preset", preset: p });
    window.dispatchEvent(new Event("accent-changed"));
  };

  const applyCustom = (raw: string) => {
    const hex = raw.startsWith("#") ? raw : `#${raw}`;
    const hsl = hexToHslTriplet(hex);
    if (!hsl) return;
    const fg = bestForeground(hsl);
    localStorage.setItem(STORAGE_KEY, "custom");
    localStorage.setItem(CUSTOM_KEY, hex);
    setAccent({ kind: "custom", hex, hsl, fg });
    window.dispatchEvent(new Event("accent-changed"));
  };

  const currentTriplet = accent.kind === "preset" ? accent.preset.hsl : accent.hsl;
  const currentFg = accent.kind === "preset" ? accent.preset.fg : accent.fg;
  const currentName = accent.kind === "preset" ? accent.preset.name : `Custom ${accent.hex.toUpperCase()}`;

  const a11y = useMemo(() => {
    const accentRgb = hslTripletToRgb(currentTriplet);
    const fgRgb = hslTripletToRgb(currentFg);
    const onAccent = contrastRatio(accentRgb, fgRgb);
    const onWhite = contrastRatio(accentRgb, [255, 255, 255]);
    const onBlack = contrastRatio(accentRgb, [12, 12, 14]);

    // Recommend the best non-current preset by max(min(contrast vs white, vs black))
    const candidates = PRESETS.filter((p) => p.contrast);
    let best = candidates[0];
    let bestScore = 0;
    for (const c of candidates) {
      const rgb = hslTripletToRgb(c.hsl);
      const score = Math.min(
        contrastRatio(rgb, [255, 255, 255]),
        contrastRatio(rgb, [12, 12, 14]),
      );
      if (score > bestScore) { bestScore = score; best = c; }
    }

    return { onAccent, onWhite, onBlack, recommended: best, recommendedScore: bestScore };
  }, [currentTriplet, currentFg]);

  const swatch = (p: Preset) => {
    const isSelected = accent.kind === "preset" && accent.preset.id === p.id;
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => choosePreset(p)}
        title={p.name}
        aria-label={p.name}
        className={cn(
          "relative h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isSelected ? "border-foreground" : "border-border",
        )}
        style={{ background: `hsl(${p.hsl})` }}
      >
        {isSelected && (
          <Check size={12} className="absolute inset-0 m-auto" style={{ color: `hsl(${p.fg})` }} />
        )}
      </button>
    );
  };

  const standard = PRESETS.filter((p) => !p.contrast);
  const contrast = PRESETS.filter((p) => p.contrast);

  const Row = ({ label, ratio }: { label: string; ratio: number }) => {
    const r = rateRatio(ratio);
    return (
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="flex items-center gap-1.5">
          <span className="font-mono">{ratio.toFixed(2)}:1</span>
          <span className={cn("font-medium", r.tone)}>{r.label}</span>
        </span>
      </div>
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {collapsed ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Accent color: ${currentName}`}
            title={`Accent: ${currentName}`}
            className={cn("h-9 w-9 mx-auto", className)}
          >
            <Palette size={14} />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Accent color: ${currentName}`}
            className={cn("w-full justify-start gap-2", className)}
          >
            <Palette size={14} />
            <span className="text-xs flex-1 text-left">Accent</span>
            <span
              className="h-4 w-4 rounded-full border border-border"
              style={{ background: `hsl(${currentTriplet})` }}
              aria-hidden="true"
            />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-3 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Accent color
          </div>
          <div className="grid grid-cols-8 gap-1.5">{standard.map(swatch)}</div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            High contrast
          </div>
          <div className="grid grid-cols-8 gap-1.5">{contrast.map(swatch)}</div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Custom HEX
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={accent.kind === "custom" ? accent.hex : `#${("000000" + Math.floor(Math.random()).toString(16)).slice(-6)}`}
              onChange={(e) => { setHexInput(e.target.value); applyCustom(e.target.value); }}
              aria-label="Pick custom accent"
              className="h-8 w-10 rounded border border-border bg-transparent cursor-pointer p-0"
            />
            <Input
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={() => applyCustom(hexInput)}
              onKeyDown={(e) => { if (e.key === "Enter") applyCustom(hexInput); }}
              placeholder="#3B82F6"
              className="h-8 text-xs font-mono"
              maxLength={7}
            />
          </div>
        </div>

        <div className="rounded-md border border-border p-2 space-y-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Accessibility preview
            </span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: `hsl(${currentTriplet})`, color: `hsl(${currentFg})` }}
            >
              Sample
            </span>
          </div>
          <Row label="Accent vs foreground" ratio={a11y.onAccent} />
          <Row label="Accent on white bg" ratio={a11y.onWhite} />
          <Row label="Accent on dark bg" ratio={a11y.onBlack} />
          {a11y.onAccent < 4.5 && (
            <button
              type="button"
              onClick={() => choosePreset(a11y.recommended)}
              className="mt-1 w-full text-left text-[11px] rounded border border-border px-2 py-1.5 hover:bg-muted transition-colors"
            >
              <span className="text-muted-foreground">Recommended:</span>{" "}
              <span className="font-medium">{a11y.recommended.name}</span>
              <span className="text-muted-foreground"> — {a11y.recommendedScore.toFixed(1)}:1</span>
            </button>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground leading-snug">
          Saved to this device. WCAG AA needs ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export default AccentPicker;
