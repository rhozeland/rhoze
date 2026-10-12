import { useEffect, useState } from "react";
type StudioWork = { title: string; artist: string; href: string; image: string; type: string; category: string };
export default function StudioProjects({ filter }: { filter: string }) {
  const [rows, setRows] = useState<StudioWork[]>([]);
  useEffect(() => { fetch("/projects.html").then((r) => r.text()).then((html) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    setRows(Array.from(doc.querySelectorAll<HTMLAnchorElement>("a.work-card")).map((el) => ({ title: el.querySelector("h3")?.textContent || "", artist: el.querySelector(".work-body p")?.textContent || "", href: el.getAttribute("href") || "", image: el.querySelector("img")?.getAttribute("src") || "", type: el.querySelector(".work-type-tag")?.textContent || "", category: el.getAttribute("data-category") || "" })));
  }).catch(() => setRows([])); }, []);
  const visible = rows.filter((r) => filter === "All" || filter === "Music" && r.category.includes("audio") || filter === "Film & Video" && /video|film|documentary|visualizer/i.test(r.type) || filter === "Art & Design" && /art|photo/i.test(r.type) || filter === "Brand campaigns" && /campaign|commercial/i.test(r.type));
  if (!visible.length) return null;
  return <section className="rz-studio-work"><h2>Studio projects</h2><div className="rz-feed">{visible.map((r, i) => <a className="rz-feed-card" key={`${r.href}-${i}`} href={r.href} target="_blank" rel="noopener noreferrer"><span className="rz-feed-cover"><img src={r.image} alt={r.title} loading="lazy" /></span><span className="rz-feed-meta"><small>{r.artist}</small><b>{r.title}</b><small>{r.type}</small></span></a>)}</div></section>;
}
