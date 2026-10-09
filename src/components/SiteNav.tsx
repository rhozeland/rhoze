import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import AuthModal from "@/create/AuthModal";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

type Props = { extra?: ReactNode; signIn?: () => void; signedIn?: boolean };
const links = [
  { href: "/discover", label: "Discover" },
  { href: "/projects.html", label: "Featured work" },
  { href: "/community.html", label: "Community" },
];
export default function SiteNav({ extra, signIn, signedIn = false }: Props) {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (signIn || !hasSession) { setAvatar(null); return; }
    let on = true;
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const { data: c } = await (supabase as any).from("creator_directory").select("photo_url").eq("user_id", uid).maybeSingle();
      if (on) setAvatar(c?.photo_url ?? null);
    });
    return () => { on = false; };
  }, [hasSession, signIn]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);
  useEffect(() => {
    let embedded = new URLSearchParams(window.location.search).get("embed") === "1";
    try { embedded = embedded || window.self !== window.top; } catch { embedded = true; }
    document.documentElement.classList.toggle("site-embedded", embedded);
  }, []);
  useEffect(() => {
    if (signIn) return;
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(!!s));
    return () => data.subscription.unsubscribe();
  }, [signIn]);
  const active = typeof window === "undefined" ? "" : window.location.pathname;
  const items = links.map(({ href, label }) => <a key={href} href={href} aria-current={active === href ? "page" : undefined}>{label}</a>);
  const account = signIn
    ? !signedIn && <Button type="button" variant="outline" className="sn-signin" onClick={signIn}>Sign in</Button>
    : hasSession
      ? <div className="sn-avatar-wrap">
          <button type="button" className="sn-avatar" aria-label="Account menu" aria-expanded={menuOpen} onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}>
            {avatar ? <img src={avatar} alt="" /> : <span aria-hidden="true">☺</span>}
          </button>
          {menuOpen && <div className="sn-menu" role="menu" onClick={(e) => e.stopPropagation()}>
            <a href="/me" role="menuitem">My profile</a>
            <button type="button" role="menuitem" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>}
        </div>
      : !signedIn && <Button type="button" variant="outline" className="sn-signin" onClick={() => { setOpen(false); setAuthOpen(true); }}>Sign in</Button>;
  return <>
    <link rel="stylesheet" href="/site-nav.css" />
    <nav className="site-nav" aria-label="Primary">
      <a className="sn-brand" href="/" aria-label="Rhozeland home"><img src="/images/logo-white.webp" alt="" /><span>Rhozeland</span></a>
      <div className="sn-links">{items}</div>
      <div className="sn-extra">{extra}{account}</div>
      <Button type="button" variant="ghost" size="icon" className="sn-toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</Button>
    </nav>
    <div className={`sn-mobile${open ? " open" : ""}`} aria-hidden={!open}>
      {open && <>{items}{account}</>}
    </div>
    {authOpen && <AuthModal action="" intro="Sign in to save creators, message them and manage your projects." redirectTo={window.location.href} onClose={() => setAuthOpen(false)} onDone={() => setAuthOpen(false)} />}
    <a className="site-book-float" href="/book.html" aria-label="Book a project">
      <span className="site-book-float__mark" aria-hidden="true">✳</span>
      <span>Book a project</span>
      <span className="site-book-float__arrow" aria-hidden="true">↗</span>
    </a>
  </>;
}
