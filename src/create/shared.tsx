import "./create.css";
import SiteNav from "@/components/SiteNav";

export type Milestone = { id: string; title: string; deliverable: string; amount_cents: number };

export const money = (cents: number) =>
  (cents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: cents % 100 ? 2 : 0 });

export const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function Shell({ children, right, className = "" }: { children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={`rz-flow ${className}`}>
      <SiteNav />
      <main className="rz-stage">{right && <div className="rz-subnav">{right}</div>}{children}</main>
      <footer className="rz-footer">
        © 2026 Rhozeland · <a href="mailto:collab@rhozeland.com">collab@rhozeland.com</a>
      </footer>
    </div>
  );
}
