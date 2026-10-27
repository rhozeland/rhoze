import { useState, type ReactNode } from 'react';
import { Minus, Plus, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import './public-project-canvas.css';

/** Displays public project records only; never reads private workspace Board items. */
export default function PublicProjectCanvas({ children }: { children: ReactNode }) {
  const [zoom, setZoom] = useState(100);
  return <section className="rz-public-canvas" aria-label="Project details">
    <div className="rz-public-canvas-scroll"><div className="rz-public-canvas-content" style={{ zoom: zoom / 100 }}>{children}</div></div>
    <div className="rz-public-canvas-tools" role="toolbar" aria-label="Zoom">
      <span>Zoom</span>
      <Button variant="outline" size="icon" aria-label="Zoom out" title="Zoom out" disabled={zoom <= 70} onClick={() => setZoom(v => Math.max(70, v - 10))}><Minus size={15}/></Button>
      <output aria-live="polite">{zoom}%</output>
      <Button variant="outline" size="icon" aria-label="Zoom in" title="Zoom in" disabled={zoom >= 130} onClick={() => setZoom(v => Math.min(130, v + 10))}><Plus size={15}/></Button>
      <Button variant="outline" size="icon" aria-label="Reset zoom" title="Reset zoom" onClick={() => setZoom(100)}><Maximize2 size={15}/></Button>
    </div>
  </section>;
}