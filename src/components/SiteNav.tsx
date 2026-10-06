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
  { href: "/#ecosystem", label: "Grow" },
];
export default function SiteNav({ extra, signIn, signedIn = false }: Props) {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [hasSession, setHasSession] = useState(false);
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
      ? <Button type="button" variant="outline" className="sn-signin" onClick={() => supabase.auth.signOut()}>Sign out</Button>
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
    {authOpen && <AuthModal action="" redirectTo={window.location.href} onClose={() => setAuthOpen(false)} onDone={() => setAuthOpen(false)} />}
    <a className="site-book-float" href="/book.html" aria-label="Book a project">
      <span className="site-book-float__mark" aria-hidden="true">✳</span>
      <span>Book a project</span>
      <span className="site-book-float__arrow" aria-hidden="true">↗</span>
    </a>
  </>;
}
