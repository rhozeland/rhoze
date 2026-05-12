import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ArrowUpRight, Menu, Paintbrush, RadioTower, Sparkles, X } from "lucide-react";
import logoBlack from "@/assets/logo-black.png";
import logoWhite from "@/assets/logo-white.png";
import logoColor from "@/assets/logo-color.png";

const navLinks = [
  { label: "About", href: "/about.html" },
  { label: "Projects", href: "/projects.html" },
  { label: "Shop", href: "https://rhozeland.shop", external: true },
  { label: "Contact", href: "/contact.html" },
];

const createPaths = [
  {
    label: "Produce",
    description: "Studio, visuals, rollout support, and project builds with Rhozeland.",
    href: "/projects.html",
    icon: Paintbrush,
  },
  {
    label: "Distribute",
    description: "Move into the creator app to publish, connect, and keep momentum going.",
    href: "https://rhozeland.app/",
    external: true,
    icon: RadioTower,
  },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
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

          <button className="md:hidden text-foreground" onClick={() => setOpen(!open)} aria-label="Open menu">
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
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="mt-3 inline-block px-5 py-2 rounded-full bg-gradient-mint text-sm font-semibold text-primary-foreground"
            >
              Create
            </button>
          </motion.div>
        )}
      </motion.nav>

      <AnimatePresence>
        {createOpen && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 px-4 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCreateOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-modal-title"
              className="relative w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-border bg-card p-6 text-card-foreground shadow-lift sm:p-8"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Close create options"
                onClick={() => setCreateOpen(false)}
                className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/70 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <X size={18} />
              </button>

              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-mint" aria-hidden="true" />
              <div className="pointer-events-none absolute -right-12 top-12 grid rotate-12 grid-cols-3 gap-2 opacity-20" aria-hidden="true">
                {Array.from({ length: 18 }).map((_, index) => (
                  <motion.span
                    key={index}
                    className="h-5 w-5 rounded-full bg-primary"
                    animate={{ scale: [0.75, 1.15, 0.75], opacity: [0.35, 0.8, 0.35] }}
                    transition={{ duration: 2.4, repeat: Infinity, delay: index * 0.05 }}
                  />
                ))}
              </div>

              <div className="relative z-10 max-w-xl">
                <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <Sparkles size={14} /> Create
                </span>
                <h2 id="create-modal-title" className="text-4xl font-semibold leading-none text-foreground sm:text-5xl">
                  What are we building next?
                </h2>
              </div>

              <div className="relative z-10 mt-7 grid gap-4 sm:grid-cols-2">
                {createPaths.map((path) => {
                  const PathIcon = path.icon;

                  return (
                    <a
                      key={path.label}
                      href={path.href}
                      {...(path.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="group relative overflow-hidden rounded-[1.35rem] border border-border bg-background/65 p-5 transition-all hover:-translate-y-1 hover:bg-background"
                    >
                      <div className="mb-8 flex items-center justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                          <PathIcon size={22} />
                        </div>
                        <ArrowUpRight className="text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-foreground" size={18} />
                      </div>
                      <h3 className="text-2xl font-semibold text-foreground">{path.label}</h3>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{path.description}</p>
                    </a>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
