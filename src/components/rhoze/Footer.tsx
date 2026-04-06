import { useState, useCallback } from "react";
import { Sun, Moon } from "lucide-react";
import logoBlack from "@/assets/logo-black.png";
import logoWhite from "@/assets/logo-white.png";
import logoColor from "@/assets/logo-color.png";

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
    <footer className="py-12 px-6 border-t border-border">
      <div className="container mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="relative w-6 h-6">
            <img
              src={logoBlack}
              alt="Rhozeland logo"
              className="absolute inset-0 w-6 h-6 object-contain dark-hide transition-all duration-300"
              style={{ opacity: hovered ? 0 : 1, transform: hovered ? 'scale(0.7) rotate(-20deg)' : 'scale(1) rotate(0deg)' }}
            />
            <img
              src={logoWhite}
              alt="Rhozeland logo"
              className="absolute inset-0 w-6 h-6 object-contain light-hide transition-all duration-300"
              style={{ opacity: hovered ? 0 : 1, transform: hovered ? 'scale(0.7) rotate(-20deg)' : 'scale(1) rotate(0deg)' }}
            />
            <img
              src={logoColor}
              alt="Rhozeland Toybox logo"
              className="absolute inset-0 w-6 h-6 object-contain transition-all duration-300"
              style={{ opacity: hovered ? 1 : 0, transform: hovered ? 'scale(1) rotate(0deg)' : 'scale(0.7) rotate(20deg)' }}
            />
          </div>
          <span className="font-display text-lg font-semibold text-foreground">Rhozeland</span>
        </div>
        <p className="text-sm text-muted-foreground font-body">
          © {new Date().getFullYear()} Rhozeland. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <a
            href="https://dexscreener.com/solana/c4rrvr1gcneeyhwa6masbgycky7671rq3x4yfegm4rmf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors font-body"
          >
            DexScreener
          </a>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
            aria-label="Toggle theme"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;