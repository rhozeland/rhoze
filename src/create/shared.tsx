import "./create.css";
import SiteNav from "@/components/SiteNav";
import ThemeToggle from '@/components/ThemeToggle';

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
        <span>© 2026 Rhozeland</span> · <a href="/discover.html">Discover</a> · <a href="/create.html">Create</a> · <a href="/rewards">Rewards</a> · <a href="/about.html">Our story</a> · <a href="/waitlist">Join the waitlist</a> · <a href="mailto:collab@rhozeland.com">Project inquiries</a>
        <ThemeToggle />
      </footer>
    </div>
  );
}
