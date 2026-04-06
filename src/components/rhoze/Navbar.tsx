import { motion } from "framer-motion";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import logoBlack from "@/assets/logo-black.png";
import logoWhite from "@/assets/logo-white.png";
import logoColor from "@/assets/logo-color.png";

const navLinks = [
  { label: "About", href: "#about" },
  { label: "Ecosystem", href: "#ecosystem" },
  { label: "Chart", href: "#chart" },
  { label: "Support", href: "#support" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.nav
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border"
    >
      <div className="container mx-auto flex items-center justify-between py-4 px-6">
        <a
          href="#"
          className="flex items-center gap-2.5 group"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="relative w-8 h-8">
            {/* Default logos */}
            <img
              src={logoBlack}
              alt="Rhozeland logo"
              className="absolute inset-0 w-8 h-8 object-contain dark-hide transition-all duration-300"
              style={{ opacity: hovered ? 0 : 1, transform: hovered ? 'scale(0.7) rotate(-20deg)' : 'scale(1) rotate(0deg)' }}
            />
            <img
              src={logoWhite}
              alt="Rhozeland logo"
              className="absolute inset-0 w-8 h-8 object-contain light-hide transition-all duration-300"
              style={{ opacity: hovered ? 0 : 1, transform: hovered ? 'scale(0.7) rotate(-20deg)' : 'scale(1) rotate(0deg)' }}
            />
            {/* Color logo on hover */}
            <img
              src={logoColor}
              alt="Rhozeland Toybox logo"
              className="absolute inset-0 w-8 h-8 object-contain transition-all duration-300"
              style={{ opacity: hovered ? 1 : 0, transform: hovered ? 'scale(1) rotate(0deg)' : 'scale(0.7) rotate(20deg)' }}
            />
          </div>
          <span className="font-display text-xl font-semibold text-foreground tracking-normal">Rhozeland</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://dexscreener.com/solana/c4rrvr1gcneeyhwa6masbgycky7671rq3x4yfegm4rmf"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 rounded-full bg-gradient-mint text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Buy $RHOZE
          </a>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="md:hidden bg-card border-t border-border px-6 pb-6"
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-muted-foreground hover:text-foreground transition-colors font-body"
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://dexscreener.com/solana/c4rrvr1gcneeyhwa6masbgycky7671rq3x4yfegm4rmf"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block px-5 py-2 rounded-full bg-gradient-mint text-sm font-semibold text-primary-foreground"
          >
            Buy $RHOZE
          </a>
        </motion.div>
      )}
    </motion.nav>
  );
};

export default Navbar;