import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Grid2X2, Monitor, NotebookPen, PanelLeft, Play, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlideLayout, slides, type Slide } from "./slides";

function readIndex() {
  const value = Number(new URLSearchParams(location.search).get("slide") || 1);
  return Math.max(0, Math.min(slides.length - 1, Number.isFinite(value) ? Math.floor(value) - 1 : 0));
}
function ScaledSlide({ slide, index }: { slide: Slide; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale,setScale] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new ResizeObserver(([entry]) => setScale(Math.min(entry.contentRect.width / 1920, entry.contentRect.height / 1080)));
    obs.observe(el); return () => obs.disconnect();
  },[]);
  return <div className="scaled-stage" ref={ref}><div className="slide-wrapper" style={{ "--scale": scale } as React.CSSProperties}><SlideLayout slide={slide} index={index} /></div></div>;
}

export default function PitchApp() {
  const params = new URLSearchParams(location.search);
  const printing = params.has("print");
  const presenter = params.has("presenter");
  const [index,setIndex] = useState(readIndex);
  const [sidebar,setSidebar] = useState(true);
  const [grid,setGrid] = useState(false);
  const [notes,setNotes] = useState(false);
  const [presenting,setPresenting] = useState(false);
  const [idle,setIdle] = useState(false);
  const [seconds,setSeconds] = useState(0);
  const [customNotes,setCustomNotes] = useState<Record<string,string>>(() => { try { return JSON.parse(localStorage.getItem("rhozeland-pitch-notes") || "{}"); } catch { return {}; } });
  const channel = useRef<BroadcastChannel>();
  const touchStart = useRef<number | null>(null);
  const current = slides[index] || slides[0];
  const go = useCallback((next: number) => {
    const n=Math.max(0,Math.min(slides.length-1,next));setIndex(n);setGrid(false);
    const url=new URL(location.href);url.searchParams.set("slide",String(n+1));history.replaceState(null,"",url);
    channel.current?.postMessage({index:n});
  },[]);
  useEffect(() => {
    document.title=`${index+1}/${slides.length} — ${current.title} | Rhozeland`;
  },[index,current.title]);
  useEffect(() => {
    channel.current = new BroadcastChannel("rhozeland-pitch");
    channel.current.onmessage = (e) => { if (Number.isInteger(e.data?.index) && e.data.index >= 0 && e.data.index < slides.length) { setIndex(e.data.index); const u=new URL(location.href);u.searchParams.set("slide",String(e.data.index+1));history.replaceState(null,"",u); } };
    return () => channel.current?.close();
  },[]);
  useEffect(() => { if(!presenter) return; const timer=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(timer); },[presenter]);
  useEffect(() => { const changed=()=>setPresenting(!!document.fullscreenElement);document.addEventListener("fullscreenchange",changed);return()=>document.removeEventListener("fullscreenchange",changed); },[]);
  useEffect(() => {
    const onKey = (e:KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("textarea,input")) return;
      if (["ArrowRight","ArrowDown"," "].includes(e.key)){e.preventDefault();go(index+1);}
      if (["ArrowLeft","ArrowUp"].includes(e.key)){e.preventDefault();go(index-1);}
      if(e.key.toLowerCase()==="g")setGrid(v=>!v);
      if(e.key==="Escape") {setGrid(false);setPresenting(false);}
    };
    window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);
  },[go,index]);
  useEffect(() => { if(!presenting)return;let timer:ReturnType<typeof setTimeout>;const move=()=>{setIdle(false);clearTimeout(timer);timer=setTimeout(()=>setIdle(true),2200);};move();window.addEventListener("mousemove",move);return()=>{clearTimeout(timer);window.removeEventListener("mousemove",move);}; },[presenting]);
  const present = async () => { setPresenting(true); try { await document.documentElement.requestFullscreen(); } catch { /* inline fullscreen remains usable */ } };
  const touchProps = {onTouchStart:(e:React.TouchEvent)=>{touchStart.current=e.touches[0]?.clientX??null;},onTouchEnd:(e:React.TouchEvent)=>{const end=e.changedTouches[0]?.clientX; if(touchStart.current!==null&&end!==undefined&&Math.abs(end-touchStart.current)>45)go(index+(end<touchStart.current?1:-1));touchStart.current=null;}};
  const thumbnail = (s:Slide,i:number) => <Button key={s.id} variant="ghost" className={`pitch-thumb ${i===index?"active":""}`} onClick={()=>go(i)} aria-label={`Go to slide ${i+1}: ${s.title}`}><ScaledSlide slide={s} index={i}/><span className="pitch-thumb-num">{i+1}</span></Button>;
  const speakerNotes = customNotes[current.id] ?? current.notes;
  if(printing)return <main className="print-deck">{slides.map((s,i)=><SlideLayout key={s.id} slide={s} index={i}/>)}</main>;
  if(presenter)return <main className="presenter-view"><div {...touchProps}><ScaledSlide slide={current} index={index}/></div><div><ScaledSlide slide={slides[Math.min(index+1,slides.length-1)]} index={Math.min(index+1,slides.length-1)}/></div><div className="presenter-notes">{speakerNotes}</div><div><div className="presenter-timer">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")}</div><div className="pitch-tools"><Button variant="outline" size="icon" aria-label="Previous slide" onClick={()=>go(index-1)}><ArrowLeft/></Button><Button variant="outline" size="icon" aria-label="Next slide" onClick={()=>go(index+1)}><ArrowRight/></Button></div></div></main>;
  if(presenting)return <main className={`pitch-fullscreen ${idle?"idle":""}`} {...touchProps}><ScaledSlide slide={current} index={index}/>{!idle&&<Button variant="ghost" size="icon" aria-label="Exit presentation" title="Exit presentation" className="absolute right-4 top-4 text-background" onClick={()=>{setPresenting(false);if(document.fullscreenElement)document.exitFullscreen();}}><X/></Button>}</main>;
  return <main className="pitch-app"><header className="pitch-toolbar"><a className="pitch-brand" href="/pitch.html"><img src="/images/logo-white.webp" alt="Rhozeland"/><span>Rhozeland</span><small>Studio → Platform · Colosseum 2026</small></a><div className="pitch-tools"><Button variant="ghost" size="icon" aria-label="Toggle slide strip" title="Slide strip" onClick={()=>setSidebar(v=>!v)}><PanelLeft/></Button><Button variant="ghost" size="icon" aria-label="Slide overview" title="Slide overview" onClick={()=>setGrid(v=>!v)}><Grid2X2/></Button><Button variant="ghost" size="icon" aria-label="Speaker notes" title="Speaker notes" onClick={()=>setNotes(v=>!v)}><NotebookPen/></Button><Button variant="ghost" size="icon" aria-label="Open presenter view" title="Presenter view" onClick={()=>window.open(`/pitch.html?presenter&slide=${index+1}`,"rhozeland-presenter")}><Monitor/></Button><Button variant="ghost" size="icon" aria-label="Export PDF" title="Export PDF" onClick={()=>{const w=window.open('/pitch.html?print','rhozeland-print');if(w)w.addEventListener('load',()=>w.print(),{once:true});}}><Printer/></Button><Button variant="outline" onClick={present}><Play size={15}/>Present</Button></div></header><div className="pitch-body">{sidebar&&!grid&&<nav className="pitch-sidebar" aria-label="Slides">{slides.map(thumbnail)}</nav>}<section className="pitch-stage" {...touchProps}>{grid?<div className="pitch-grid">{slides.map(thumbnail)}</div>:<ScaledSlide slide={current} index={index}/>} {notes&&<aside className="pitch-notes"><textarea aria-label="Speaker notes for current slide" value={speakerNotes} onChange={e=>{const n={...customNotes,[current.id]:e.target.value};setCustomNotes(n);localStorage.setItem('rhozeland-pitch-notes',JSON.stringify(n));}}/></aside>}</section></div><footer className="pitch-bottom"><span>{current.title}</span><div className="pitch-tools"><Button variant="ghost" size="icon" aria-label="Previous slide" disabled={index===0} onClick={()=>go(index-1)}><ArrowLeft/></Button><span>{index+1} / {slides.length}</span><Button variant="ghost" size="icon" aria-label="Next slide" disabled={index===slides.length-1} onClick={()=>go(index+1)}><ArrowRight/></Button></div></footer></main>;
}