import { Button } from "@/components/ui/button";
import type { GlobePin } from "./DiscoverGlobe";

export default function SpotlightCard({ pin, onClose }: { pin: GlobePin; onClose: () => void }) {
  return (
    <div className="rz-globe-spotlight" role="dialog" aria-label={`${pin.title} spotlight`}>
      <Button variant="ghost" size="icon" className="rz-globe-spotlight-close" aria-label="Close spotlight" onClick={onClose}>
        ×
      </Button>
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
          <Button variant="outline" asChild><a href={pin.href}>
            View {pin.kind === "release" ? "project" : "profile"}
          </a></Button>
          <Button variant="outline" asChild><a href="/create.html?new=1">
            Start a project here
          </a></Button>
        </div>
      </div>
    </div>
  );
}
