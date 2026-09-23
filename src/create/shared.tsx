import "./create.css";

export type Milestone = { id: string; title: string; deliverable: string; amount_cents: number };

export const money = (cents: number) =>
  (cents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: cents % 100 ? 2 : 0 });

export const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rz-flow">
      <nav className="rz-nav">
        <a href="/"><img src="/images/logo-black.webp" alt="Rhozeland" /></a>
        {right ?? <a className="rz-link" href="/">Home</a>}
      </nav>
      <main className="rz-stage">{children}</main>
      <footer className="rz-footer">
        © 2026 Rhozeland · <a href="mailto:collab@rhozeland.com">collab@rhozeland.com</a>
      </footer>
    </div>
  );
}
