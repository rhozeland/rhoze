import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import AuthModal from "@/create/AuthModal";
import { Button } from "@/components/ui/button";
import { Menu, X, MessageSquare } from "lucide-react";

type Props = { extra?: ReactNode; signIn?: () => void; signedIn?: boolean };
const links = [
  { href: "/projects.html", label: "Featured work" },
  { href: "/discover", label: "Discover" },
  { href: "/community.html", label: "Community" },
  { href: "/community.html?view=open-calls", label: "Opportunities" },
];
export default function SiteNav({ extra, signIn, signedIn = false }: Props) {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (signIn || !hasSession) { setAvatar(null); setName(null); return; }
    let on = true;
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const meta = data.user?.user_metadata as any;
      const fallback = String(meta?.display_name || meta?.full_name || data.user?.email || "").split(/\s|@/)[0] || null;
      if (on && fallback) setName(fallback);
      const { data: c } = await (supabase as any).from("creator_directory").select("photo_url,name").eq("user_id", uid).maybeSingle();
      if (!on) return;
      setAvatar(c?.photo_url ?? null);
      if (c?.name) setName(String(c.name).split(/\s|@/)[0]);
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
      ? <div className="nav-auth-wrap" onMouseEnter={() => setMenuOpen(true)} onMouseLeave={() => setMenuOpen(false)} onFocus={() => setMenuOpen(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setMenuOpen(false); }}>
          <div className="nav-auth" role="group" aria-label="Your Rhozeland account">
            <a className="nav-auth-chip nav-auth-chip--icon" href="/messages" aria-label="Messages" title="Messages"><MessageSquare size={16} aria-hidden="true" /></a>
            <a href="/me" className="nav-auth-identity" title="Your profile" aria-label="My profile" aria-expanded={menuOpen}>
              <span className="nav-auth-avatar" aria-hidden="true">{avatar ? <img src={avatar} alt="" /> : (name ? name.charAt(0).toUpperCase() : "☺")}</span>
              <span className="nav-auth-name">{name || "You"}</span>
            </a>
          </div>
          {menuOpen && <div className="sn-menu" role="menu" onClick={(e) => e.stopPropagation()}>
            <a href="/me?settings=1" role="menuitem">Settings</a>
            <Button type="button" variant="ghost" role="menuitem" onClick={() => supabase.auth.signOut()}>Sign out</Button>
          </div>}
        </div>
      : !signedIn && <Button type="button" variant="outline" className="sn-signin" onClick={() => { setOpen(false); setAuthOpen(true); }}>Sign in</Button>;
  const msg = null;
  return <>
    <link rel="stylesheet" href="/site-nav.css" />
    <nav className="site-nav" aria-label="Primary">
      <a className="sn-brand" href="/" aria-label="Rhozeland home"><img src="/images/logo-white.webp" alt="" /><span>Rhozeland</span></a>
      <div className="sn-links">{items}</div>
      <div className="sn-extra">{extra}{msg}{account}</div>
      <Button type="button" variant="ghost" size="icon" className="sn-toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</Button>
    </nav>
    <div className={`sn-mobile${open ? " open" : ""}`} aria-hidden={!open}>
      {open && <>{items}{msg}{account}</>}
    </div>
    {authOpen && <AuthModal action="" intro="Sign in to save creators, message them and manage your projects." redirectTo={`${window.location.origin}/me`} onClose={() => setAuthOpen(false)} onDone={() => { setAuthOpen(false); window.location.href = "/me"; }} />}
    <a className="site-book-float" href="/book.html" aria-label="Book a project">
      <span className="site-book-float__mark" aria-hidden="true">✳</span>
      <span>Book a project</span>
    </a>
  </>;
}
