import { useEffect, useState } from "react";
import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  { id: "hc-black",  name: "High contrast — black",  hsl: "0 0% 0%",     fg: "0 0% 100%", contrast: true },
];

const STORAGE_KEY = "accent-preset";

function applyPreset(p: Preset) {
  const root = document.documentElement;
  root.style.setProperty("--primary", p.hsl);
  root.style.setProperty("--primary-foreground", p.fg);
  root.style.setProperty("--accent", p.hsl);
  root.style.setProperty("--accent-foreground", p.fg);
  root.style.setProperty("--ring", p.hsl);
}

export function readAccent(): Preset {
  if (typeof window === "undefined") return PRESETS[0];
  const id = localStorage.getItem(STORAGE_KEY);
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

/** Module-level boot so the accent applies before paint on every load. */
if (typeof window !== "undefined") {
  try {
    applyPreset(readAccent());
  } catch {
    /* noop */
  }
}

interface Props {
  collapsed?: boolean;
  className?: string;
}

export function AccentPicker({ collapsed = false, className }: Props) {
  const [current, setCurrent] = useState<Preset>(() => readAccent());

  useEffect(() => {
    applyPreset(current);
  }, [current]);

  const choose = (p: Preset) => {
    localStorage.setItem(STORAGE_KEY, p.id);
    setCurrent(p);
    window.dispatchEvent(new Event("accent-changed"));
  };

  const swatch = (p: Preset) => (
    <button
      key={p.id}
      type="button"
      onClick={() => choose(p)}
      title={p.name}
      aria-label={p.name}
      className={cn(
        "relative h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        current.id === p.id ? "border-foreground" : "border-border",
      )}
      style={{ background: `hsl(${p.hsl})` }}
    >
      {current.id === p.id && (
        <Check
          size={12}
          className="absolute inset-0 m-auto"
          style={{ color: `hsl(${p.fg})` }}
        />
      )}
    </button>
  );

  const standard = PRESETS.filter((p) => !p.contrast);
  const contrast = PRESETS.filter((p) => p.contrast);

  return (
    <Popover>
      <PopoverTrigger asChild>
        {collapsed ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Accent color: ${current.name}`}
            title={`Accent: ${current.name}`}
            className={cn("h-9 w-9 mx-auto", className)}
          >
            <Palette size={14} />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Accent color: ${current.name}`}
            className={cn("w-full justify-start gap-2", className)}
          >
            <Palette size={14} />
            <span className="text-xs flex-1 text-left">Accent</span>
            <span
              className="h-4 w-4 rounded-full border border-border"
              style={{ background: `hsl(${current.hsl})` }}
              aria-hidden="true"
            />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-64 p-3 space-y-3">
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
        <p className="text-[10px] text-muted-foreground leading-snug">
          Saved to this device. Affects buttons, links, and highlights across the portal.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export default AccentPicker;
