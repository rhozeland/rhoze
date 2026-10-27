import { useEffect, useState, useRef } from "react";
import { Award, ArrowUpRight, Sparkles, Folder, Heart, Users, Zap, Banknote, ShoppingBag, CalendarClock, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { passLevel, earnedBadges, type CreatorProgress } from "./pass-logic";
import "./pass.css";
const db = supabase as any;
export function ProfileProgress({ userId }: { userId: string }) {
  const [p, setP] = useState<CreatorProgress | null>(null);
  useEffect(() => { let live = true; db.rpc("creator_progress", { p_user_id: userId }).then(({data}: any) => { if(live) setP(data); }); return () => { live = false; }; }, [userId]);
  if (!p || !p.contributions) return null;
  const level = passLevel(p.xp);
  return <div className="rz-profile-progress"><span><Award size={14} />{level.title} · Level {level.level}</span><b>{Number(p.xp).toLocaleString()} XP</b>{earnedBadges(p).map(b => <span key={b} title={`Earned: ${b}`}><Sparkles size={12} />{b}</span>)}</div>;
}
export function CreatorPass({ userId }: { userId: string }) {
  const card = useRef<HTMLElement>(null);
  const move = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--tilt-x', `${-(e.clientY - bounds.top - bounds.height / 2) / bounds.height * 10}deg`);
    e.currentTarget.style.setProperty('--tilt-y', `${(e.clientX - bounds.left - bounds.width / 2) / bounds.width * 12}deg`);
  };
  const reset = () => { card.current?.style.setProperty('--tilt-x', '0deg'); card.current?.style.setProperty('--tilt-y', '0deg'); };
  const [p, setP] = useState<CreatorProgress | null>(null);
  const [name, setName] = useState("Your Creator Pass");
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all([db.rpc("creator_progress", {p_user_id:userId}), supabase.auth.getUser()]).then(([progress, account]: any[]) => {
      if (!live) return; setError(!!progress.error); setP(progress.data);
      const meta = account.data?.user?.user_metadata;
      if (meta?.display_name || meta?.full_name) setName(meta.display_name || meta.full_name);
    }); return () => {live = false;};
  },[userId]);
  const level = passLevel(p?.xp ?? 0);
  return <section ref={card} onPointerMove={move} onPointerLeave={reset} className="rz-creator-pass" aria-label="Creator Pass">
    <header><span className="rz-pass-emblem"><img src="/images/logo-white.webp" alt="" /></span><div><small>RHOZELAND · CREATOR PASS</small><h2>{name}</h2></div><span className="rz-pass-award" title="Contribution rank"><Award size={26}/></span></header>
    {error ? <p role="alert">Your pass couldn’t load. Please refresh to try again.</p> : <>
      <div className="rz-pass-level"><span>{level.title} <b>Level {level.level}</b></span><strong>{p ? Number(p.xp).toLocaleString() : "…"} XP</strong></div>
      <progress max={100} value={p ? level.progress : 0} aria-label="Progress to next level" />
      <small>{p ? level.next === null ? "Highest level reached" : `${level.remaining} XP to Level ${level.level + 1}` : "Loading your progress…"}</small>
      <div className="rz-pass-stats"><div><Folder size={19}/><b>{p?.projects ?? "—"}</b><span>Projects</span></div><div><Heart size={19}/><b>{p?.likes ?? "—"}</b><span>Supported</span></div><div><Users size={19}/><b>{p?.applications ?? "—"}</b><span>Applications</span></div><div><Zap size={19}/><b>{p?.contributions ?? "—"}</b><span>Contributions</span></div></div>
      <div className="rz-pass-badges">{p && earnedBadges(p).map(b => <span key={b}><Sparkles size={13}/>{b}</span>)}{p && !p.contributions && <small>Your first contribution starts your collection.</small>}</div>
    </>}
    <footer><a href="/me?settings=1">Edit profile <ArrowUpRight size={14}/></a><a href="/discover.html">Discover projects <ArrowUpRight size={14}/></a></footer>
  </section>;
}