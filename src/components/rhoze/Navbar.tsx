import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Menu, X, Sparkles, ArrowUpRight, LayoutGrid, Radio } from "lucide-react";
import logoBlack from "@/assets/logo-black.png";
import logoWhite from "@/assets/logo-white.png";
import logoColor from "@/assets/logo-color.png";

const navLinks = [
  { label: "About", href: "/about.html" },
  { label: "Projects", href: "/projects.html" },
  { label: "Shop", href: "https://rhozeland.shop", external: true },
  { label: "Contact", href: "/contact.html" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!createOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCreateOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prev;
    };
  }, [createOpen]);

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
              {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-5 py-2 rounded-full bg-gradient-mint text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Create
          </button>
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
              {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              onClick={() => setOpen(false)}
              className="block py-3 text-muted-foreground hover:text-foreground transition-colors font-body"
            >
              {link.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => { setOpen(false); setCreateOpen(true); }}
            className="mt-3 inline-block px-5 py-2 rounded-full bg-gradient-mint text-sm font-semibold text-primary-foreground"
          >
            Create
          </button>
        </motion.div>
      )}

      {createOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-modal-title"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setCreateOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-[hsl(240_12%_7%)] text-white shadow-2xl"
          >
            <div
              className="h-1 w-full"
              style={{
                background:
                  "linear-gradient(90deg, hsl(330 90% 70%), hsl(28 95% 65%), hsl(48 95% 65%), hsl(150 70% 60%), hsl(195 90% 65%), hsl(260 80% 70%))",
              }}
            />
            <div className="p-6 sm:p-10">
              <div className="mb-6 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/80">
                  <Sparkles size={12} /> Create
                </span>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  aria-label="Close"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/90 transition-colors hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>
              <h2
                id="create-modal-title"
                className="mb-7 max-w-[12ch] text-3xl font-extrabold leading-[1.02] tracking-tight sm:text-4xl lg:text-5xl"
              >
                What are we building next?
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <a
                  href="/start.html"
                  className="group relative flex min-h-[200px] flex-col gap-2 rounded-2xl border border-white/10 bg-[hsl(240_18%_5%)] p-5 transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-[hsl(240_18%_7%)]"
                >
                  <span
                    className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-white"
                    style={{ background: "linear-gradient(135deg, hsl(215 35% 22%), hsl(220 30% 14%))" }}
                  >
                    <LayoutGrid size={20} />
                  </span>
                  <ArrowUpRight size={16} className="absolute right-4 top-4 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  <h3 className="text-xl font-bold tracking-tight">Produce</h3>
                  <p className="max-w-[38ch] text-sm leading-relaxed text-white/65">
                    Start a project with Rhozeland for studio, visuals, rollout support, and launch planning.
                  </p>
                </a>
                <a
                  href="https://rhozeland.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex min-h-[200px] flex-col gap-2 rounded-2xl border border-white/10 bg-[hsl(240_18%_5%)] p-5 transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-[hsl(240_18%_7%)]"
                >
                  <span
                    className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-white"
                    style={{ background: "linear-gradient(135deg, hsl(345 35% 22%), hsl(330 30% 14%))" }}
                  >
                    <Radio size={20} />
                  </span>
                  <ArrowUpRight size={16} className="absolute right-4 top-4 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  <h3 className="text-xl font-bold tracking-tight">Distribute</h3>
                  <p className="max-w-[38ch] text-sm leading-relaxed text-white/65">
                    Open the creator app to publish, connect, and keep your release moving through the network.
                  </p>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.nav>
  );
};

export default Navbar;