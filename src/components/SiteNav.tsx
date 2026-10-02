import { useState, type ReactNode } from "react";
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
  const active = typeof window === "undefined" ? "" : window.location.pathname;
  const items = links.map(({ href, label }) => <a key={href} href={href} aria-current={active === href ? "page" : undefined}>{label}</a>);
  const account = !signedIn && (signIn ? <Button type="button" variant="outline" className="sn-signin" onClick={signIn}>Sign in</Button> : <a className="sn-signin" href="/team.html#/portal">Sign in</a>);
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
    <a className="site-book-float" href="/book.html" aria-label="Book a project">
      <span className="site-book-float__mark" aria-hidden="true">✳</span>
      <span>Book a project</span>
      <span className="site-book-float__arrow" aria-hidden="true">↗</span>
    </a>
  </>;
}
