import { Link } from "react-router-dom";
import type { GlobePin } from "./DiscoverGlobe";

export default function SpotlightCard({ pin, onClose }: { pin: GlobePin; onClose: () => void }) {
  return (
    <div className="rz-globe-spotlight" role="dialog" aria-label={`${pin.title} spotlight`}>
      <button type="button" className="rz-globe-spotlight-close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <div className="rz-globe-spotlight-media">
        {pin.image ? (
          <img src={pin.image} alt="" />
        ) : (
          <span className="rz-globe-spotlight-fallback">{pin.title.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="rz-globe-spotlight-body">
        <small>{pin.kind === "release" ? "Project" : "Creator"} · {pin.city}</small>
        <b>{pin.title}</b>
        {pin.subtitle && <p>{pin.subtitle}</p>}
        <div className="rz-globe-spotlight-actions">
          <Link className="rz-btn pri" to={pin.href}>
            View {pin.kind === "release" ? "project" : "profile"}
          </Link>
          <a className="rz-btn" href="/create.html?new=1">
            Start a project here
          </a>
        </div>
      </div>
    </div>
  );
}
