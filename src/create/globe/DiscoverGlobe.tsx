/**
 * DiscoverGlobe — light editorial spinning globe for the Discover page.
 *
 * Renders a projected SVG sphere (not CSS 3D) so drag-to-spin stays stable
 * and pins read correctly at any rotation. Auto-rotates slowly, pauses for
 * prefers-reduced-motion, and opens a SpotlightCard when a pin is clicked.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { CONTINENTS } from "./geo";
import SpotlightCard from "./SpotlightCard";
import { Button } from "@/components/ui/button";
import "./globe.css";

export type GlobePin = {
  id: string;
  kind: "release" | "creator";
  title: string;
  subtitle?: string | null;
  image?: string | null;
  href: string;
  city: string;
  lat: number;
  lng: number;
};

const cx = 50;
const cy = 50;
const radius = 44;

const normalizeRotation = (angle: number) => {
  let n = angle % 360;
  if (n > 180) n -= 360;
  if (n < -180) n += 360;
  return n;
};

const projectPoint = (lat: number, lng: number, rotation: number) => {
  const latRad = (lat * Math.PI) / 180;
  const lngRad = ((lng + rotation) * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  const x3 = cosLat * Math.sin(lngRad);
  const y3 = Math.sin(latRad);
  const z3 = cosLat * Math.cos(lngRad);
  return { x: cx + radius * x3, y: cy - radius * y3, depth: z3 };
};

const buildLatitudePath = (latitude: number, rotation: number) => {
  let path = "";
  let drawing = false;
  for (let lng = -180; lng <= 180; lng += 5) {
    const p = projectPoint(latitude, lng, rotation);
    if (p.depth > 0.02) {
      path += `${drawing ? " L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      drawing = true;
    } else drawing = false;
  }
  return path;
};

const buildLongitudePath = (longitude: number, rotation: number) => {
  let path = "";
  let drawing = false;
  for (let lat = -88; lat <= 88; lat += 4) {
    const p = projectPoint(lat, longitude, rotation);
    if (p.depth > 0.02) {
      path += `${drawing ? " L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      drawing = true;
    } else drawing = false;
  }
  return path;
};

const buildContinentPath = (points: [number, number][], rotation: number) => {
  const projected = points.map(([lat, lng]) => projectPoint(lat, lng, rotation));
  if (!projected.some((p) => p.depth > 0)) return "";
  let path = "";
  let drawing = false;
  for (const p of projected) {
    if (p.depth > -0.05) {
      path += `${drawing ? " L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      drawing = true;
    } else drawing = false;
  }
  if (drawing) path += " Z";
  return path;
};

export default function DiscoverGlobe({ pins }: { pins: GlobePin[] }) {
  const dragState = useRef<{ pointerId: number; startX: number; startRotation: number } | null>(null);
  const [rotation, setRotation] = useState(-22);
  const [isDragging, setIsDragging] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  useEffect(() => {
    if (isDragging || reducedMotion.current) return;
    const interval = window.setInterval(() => {
      setRotation((r) => normalizeRotation(r + 0.12));
    }, 40);
    return () => window.clearInterval(interval);
  }, [isDragging]);

  const projectedPins = useMemo(
    () =>
      pins.map((pin) => ({ pin, ...projectPoint(pin.lat, pin.lng, rotation) })).sort((a, b) => a.depth - b.depth),
    [pins, rotation],
  );

  const latitudePaths = useMemo(
    () => [-52, -24, 0, 24, 52].map((lat) => buildLatitudePath(lat, rotation)).filter(Boolean),
    [rotation],
  );
  const longitudePaths = useMemo(
    () => [-90, -45, 0, 45, 90].map((lng) => buildLongitudePath(lng, rotation)).filter(Boolean),
    [rotation],
  );
  const continentPaths = useMemo(
    () => CONTINENTS.map((c) => ({ name: c.name, d: buildContinentPath(c.points, rotation) })).filter((c) => c.d),
    [rotation],
  );

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragState.current = { pointerId: e.pointerId, startX: e.clientX, startRotation: rotation };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };
  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current || dragState.current.pointerId !== e.pointerId) return;
    const delta = e.clientX - dragState.current.startX;
    setRotation(normalizeRotation(dragState.current.startRotation + delta * 0.38));
  };
  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current || dragState.current.pointerId !== e.pointerId) return;
    dragState.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const activePin = pins.find((p) => p.id === activeId) ?? null;

  return (
    <div className="rz-globe-wrap">
      <div
        className="rz-globe-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <svg viewBox="0 0 100 100" className="rz-globe-svg">
          <defs>
            <radialGradient id="rz-globe-ocean" cx="38%" cy="30%" r="78%">
              <stop offset="0%" stopColor="hsl(var(--globe-ocean-light))" />
              <stop offset="55%" stopColor="hsl(var(--globe-ocean))" />
              <stop offset="100%" stopColor="hsl(var(--globe-ocean-dark))" />
            </radialGradient>
            <radialGradient id="rz-globe-land" cx="42%" cy="32%" r="80%">
              <stop offset="0%" stopColor="hsl(var(--globe-land-light))" />
              <stop offset="55%" stopColor="hsl(var(--globe-land))" />
              <stop offset="100%" stopColor="hsl(var(--globe-land-dark))" />
            </radialGradient>
            <radialGradient id="rz-globe-highlight" cx="36%" cy="26%" r="55%">
              <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.55" />
              <stop offset="60%" stopColor="hsl(var(--card))" stopOpacity="0.08" />
              <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0" />
            </radialGradient>
            <clipPath id="rz-globe-clip">
              <circle cx={cx} cy={cy} r={radius} />
            </clipPath>
          </defs>

          <ellipse cx={cx} cy={cy + 38} rx={24} ry={5} fill="hsl(0 0% 10% / 0.08)" />
          <circle cx={cx} cy={cy} r={radius} fill="url(#rz-globe-ocean)" stroke="hsl(0 0% 10% / 0.25)" strokeWidth="0.6" />

          <g clipPath="url(#rz-globe-clip)">
            {continentPaths.map((c) => (
              <path key={c.name} d={c.d} fill="url(#rz-globe-land)" stroke="hsl(0 0% 10% / 0.35)" strokeWidth="0.3" strokeLinejoin="round" />
            ))}
            {latitudePaths.map((p, i) => (
              <path key={`lat-${i}`} d={p} fill="none" stroke="hsl(0 0% 10% / 0.08)" strokeWidth="0.3" />
            ))}
            {longitudePaths.map((p, i) => (
              <path key={`lng-${i}`} d={p} fill="none" stroke="hsl(0 0% 10% / 0.07)" strokeWidth="0.28" />
            ))}
            <circle cx={cx} cy={cy} r={radius} fill="url(#rz-globe-highlight)" />
          </g>
        </svg>

        {projectedPins.map(({ pin, x, y, depth }) => (
          <Button variant="ghost" size="icon"
            key={pin.id}
            type="button"
            className="rz-globe-pin"
            data-kind={pin.kind}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              opacity: depth > -0.1 ? 1 : 0.25,
              pointerEvents: depth > -0.1 ? "auto" : "none",
            }}
            aria-label={`${pin.title} — open spotlight`}
            onClick={() => setActiveId(pin.id)}
          />
        ))}

        {isDragging && <div className="rz-globe-spin-badge">Spin</div>}
      </div>

      {activePin && <SpotlightCard pin={activePin} onClose={() => setActiveId(null)} />}
    </div>
  );
}
