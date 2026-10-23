import { useEffect } from "react";
import "./profile-alive.css";

/** Decorative CSS-3D layer + pointer tilt for profile heroes. Respects reduced motion. */
export function ProfileDepth() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement)?.closest?.(".rz-pf-top, .rz-pf-tile") as HTMLElement | null;
      if (!el) return;
      const b = el.getBoundingClientRect();
      el.style.setProperty("--rx", `${(((e.clientY - b.top) / b.height) - .5) * -8}deg`);
      el.style.setProperty("--ry", `${(((e.clientX - b.left) / b.width) - .5) * 10}deg`);
      el.style.setProperty("--mx", `${((e.clientX - b.left) / b.width) * 100}%`);
    };
    const onLeave = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (el?.classList?.contains("rz-pf-top") || el?.classList?.contains("rz-pf-tile")) { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); }
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave, true);
    return () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerleave", onLeave, true); };
  }, []);
  return (
    <div className="rz-pf-depth" aria-hidden="true">
      <span className="rz-pf-orb a" /><span className="rz-pf-orb b" /><span className="rz-pf-orb c" />
      <div className="rz-pf-cube"><i className="f1" /><i className="f2" /><i className="f3" /><i className="f4" /><i className="f5" /><i className="f6" /></div>
      <span className="rz-pf-ring" />
    </div>
  );
}
