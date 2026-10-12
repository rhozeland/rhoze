import type { ReactNode } from "react";
import SiteNav from "@/components/SiteNav";
import "./portal-shell.css";

/** Embedded portals inherit their parent website's frame and navigation. */
export default function PortalShell({ children }: { children: ReactNode }) {
  let embedded = new URLSearchParams(window.location.search).get("embed") === "1";
  try { embedded = embedded || window.self !== window.top; } catch { embedded = true; }
  if (embedded) return <>{children}</>;
  return <div className="portal-shell"><SiteNav /><div className="portal-shell__content">{children}</div></div>;
}
