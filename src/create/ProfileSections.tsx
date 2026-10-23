import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export default function ProfileSections({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState<string[]>([]);
  const [active, setActive] = useState('');
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const refresh = () => {
      const nodes = Array.from(element.children).filter(node => node.matches('.rz-pf-sec'));
      const labels = nodes.map(node => node.querySelector('h2')?.childNodes[0]?.textContent?.trim() || 'Overview');
      setSections(previous => JSON.stringify(previous) === JSON.stringify(labels) ? previous : labels);
      setActive(previous => labels.includes(previous) ? previous : labels.includes('Projects') ? 'Projects' : labels[0] || '');
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    for (const node of Array.from(element.children)) {
      if (!(node instanceof HTMLElement) || !node.matches('.rz-pf-sec')) continue;
      const label = node.querySelector('h2')?.childNodes[0]?.textContent?.trim() || 'Overview';
      node.hidden = label !== active;
      node.setAttribute('role', 'tabpanel');
      node.setAttribute('aria-label', label);
    }
  }, [active, sections]);
  return <div className="rz-profile-sections">
    {sections.length > 1 && <nav className="rz-profile-tabs" aria-label="Profile sections">{sections.map(label => <Button key={label} variant="ghost" aria-pressed={active === label} onClick={() => setActive(label)}>{label}</Button>)}</nav>}
    <div ref={root} className="rz-profile-panels">{children}</div>
  </div>;
}