import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "system";

function readMode(): Mode {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem("theme-override");
  return v === "light" || v === "dark" ? v : "system";
}

function applyMode(mode: Mode) {
  if (mode === "system") {
    localStorage.removeItem("theme-override");
  } else {
    localStorage.setItem("theme-override", mode);
  }
  // Let App's theme listener re-apply the document class.
  window.dispatchEvent(new Event("theme-changed"));
}

const ORDER: Mode[] = ["system", "light", "dark"];

const META: Record<Mode, { Icon: typeof Sun; label: string; next: Mode }> = {
  system: { Icon: Monitor, label: "System", next: "light" },
  light: { Icon: Sun, label: "Light", next: "dark" },
  dark: { Icon: Moon, label: "Dark", next: "system" },
};

interface Props {
  className?: string;
  collapsed?: boolean;
}

export function ThemeToggle({ className, collapsed = false }: Props) {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    setMode(readMode());
    const sync = () => setMode(readMode());
    window.addEventListener("theme-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("theme-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const cycle = () => {
    const next = META[mode].next;
    applyMode(next);
    setMode(next);
  };

  const { Icon, label } = META[mode];
  const title = `Theme: ${label} (click to change)`;

  if (collapsed) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={cycle}
        aria-label={title}
        title={title}
        className={cn("h-9 w-9 mx-auto", className)}
      >
        <Icon size={14} />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={cycle}
      aria-label={title}
      title={title}
      className={cn("w-full justify-start gap-2", className)}
    >
      <Icon size={14} />
      <span className="text-xs">{label} mode</span>
    </Button>
  );
}

export default ThemeToggle;
