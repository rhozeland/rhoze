import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";
import { Sun, Moon } from "lucide-react";
import logoBlack from "@/assets/logo-black.webp";
import logoWhite from "@/assets/logo-white.webp";
import logoColor from "@/assets/logo-color.webp";

const Footer = () => {
  const [hovered, setHovered] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = useCallback(() => {
    const currentlyDark = document.documentElement.classList.contains("dark");
    const newMode = currentlyDark ? "light" : "dark";
    localStorage.setItem("theme-override", newMode);
    document.documentElement.classList.toggle("dark", newMode === "dark");
    setIsDark(newMode === "dark");
    window.dispatchEvent(new Event("theme-changed"));
  }, []);

  return (
    <footer className="py-8 px-6 border-t border-border">
      <div className="container mx-auto max-w-6xl flex flex-wrap gap-4 items-center justify-between">
        <p className="text-sm text-muted-foreground font-body">
          © {new Date().getFullYear()} Rhozeland. All rights reserved.
        </p>
        <div className="flex flex-wrap items-center gap-6">
          <a
            href="/team.html#/portal"
            className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors font-body"
            title="Portal"
          >
            Portal
          </a>
          {[["/discover.html","Discover"],["/create.html","Create"],["/rewards","Rewards"],["/about.html","Our story"],["mailto:collab@rhozeland.com","Project inquiries"]].map(([href,label])=><a key={href} href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{label}</a>)}
          <Button variant="ghost"
            onClick={toggleTheme}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
            aria-label="Toggle theme"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            <span>{isDark ? "Light" : "Dark"}</span>
          </Button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;