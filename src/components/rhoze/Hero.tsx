import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { Camera, AudioLines, Activity, CalendarDays } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const pillars = [
  {
    href: "/projects.html",
    label: "Visual",
    desc: "Film, photo, art direction.",
    Icon: Camera,
    gradient: "linear-gradient(135deg, hsl(28 100% 88%), hsl(20 95% 78%))",
  },
  {
    href: "/projects.html",
    label: "Audio",
    desc: "Music, podcasts, sound.",
    Icon: AudioLines,
    gradient: "linear-gradient(135deg, hsl(220 100% 92%), hsl(230 95% 84%))",
  },
  {
    href: "/start.html",
    label: "Development",
    desc: "Tools, web3, the app.",
    Icon: Activity,
    gradient: "linear-gradient(135deg, hsl(50 100% 88%), hsl(45 95% 78%))",
  },
  {
    href: "/events.html",
    label: "Events",
    desc: "Live sessions & meetups.",
    Icon: CalendarDays,
    gradient: "linear-gradient(135deg, hsl(340 100% 92%), hsl(330 95% 84%))",
  },
];

const eventArchive = [
  { title: "Emote Temple 2.0", date: "Jul 22, 2026", tag: "Upcoming · Powered by $RHOZE", href: "https://luma.com/hiamge0p", featured: true },
  { title: "World IT Show 2026", date: "Apr 22–25, 2026", tag: "Exhibition · Seoul", href: "https://www.sourcefromontario.com/en/page/delegate/138483/rhozeland#attendees" },
  { title: "RHOZE Creative Social", date: "Mar 20, 2026", tag: "Social · Toronto", href: "https://luma.com/embed/event/evt-cLEaltiJY1AHWVY/simple" },
  { title: "Create The Future Summit", date: "Aug 14, 2025", tag: "Summit", href: "https://lu.ma/ea42t9n7" },
  { title: "UNSCRIPTED!", date: "Jun 27, 2025", tag: "Music", href: "https://torontomusicians.myshopify.com/products/toronto-musicians-unscripted" },
  { title: "FLVMELAND 3", date: "May 30, 2025", tag: "Culture", href: "https://www.universe.com/events/flvmeland-3-tickets-41CWLH" },
];

const tickerItems = [
  { tag: "Leaderboard", label: "Weekly snapshot · live", href: "/leaderboard.html" },
  { tag: "Next Event", label: "Land Sessions · LA", href: "/events.html" },
  { tag: "Live Chart", label: "$RHOZE on Solana", href: "#chart" },
  { tag: "Drop", label: "Saint Flair West · Ooak", href: "/projects.html" },
  { tag: "Podcast", label: "Rhoze Podcast Ep. 6", href: "https://www.youtube.com/@Rhozeland" },
];

type Video = { id: string; title: string; published?: string; live?: boolean };

const fallbackVideos: Video[] = [
  { id: "9rxMdl_mQws", title: "How Rhozeland Started: The Story", published: "Featured", live: false },
  { id: "Pc6TTaGEoIA", title: "Rhoze Podcast Ep. 6", published: "Latest", live: false },
  { id: "mRu1YrGEznY", title: "Rhoze Podcast Ep. 5", published: "Recent", live: false },
  { id: "tPISGwjo6Vk", title: "Rhoze Podcast Ep. 4", published: "Recent", live: false },
  { id: "q9cZCbjAZ18", title: "A Week With Rhozeland", published: "Recent", live: false },
  { id: "hzb8rHOAAaM", title: "Rhoze Podcast Ep. 2", published: "Recent", live: false },
];

const storyItems = [
  { year: "2016", title: "The origin story", desc: "A circle of friends sharing music, art, and culture.", image: "/images/timeline-2016.webp" },
  { year: "2021", title: "Building the hub", desc: "A digital home connecting creators, projects, and resources.", image: "/images/timeline-2021.webp" },
  { year: "2023", title: "Studio launch", desc: "A physical space to record, produce, and collaborate.", image: "/images/timeline-2023.webp" },
  { year: "Today", title: "A New Era", desc: "A living record of the creators, space, and movement.", image: "/images/documentary-thumbnail.webp" },
];

const Hero = () => {
  const [videos, setVideos] = useState<Video[]>(fallbackVideos);
  const [featured, setFeatured] = useState<Video>(fallbackVideos[0]);
  const railRef = useRef<HTMLDivElement>(null);
  const liveLabel = featured.live ? featured.title : "Offline";
  const displayTickerItems = tickerItems.map((item) =>
    item.tag === "Podcast" ? { ...item, label: featured.title } : item,
  );

  useEffect(() => {
    let alive = true;
    supabase.functions
      .invoke("youtube-feed")
      .then(({ data, error }) => {
        if (!alive || error || !Array.isArray(data?.videos) || !data.videos.length) return;
        const next = data.videos.slice(0, 8) as Video[];
        setVideos(next);
        setFeatured(next[0]);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const railVideos = videos.filter((video) => video.id !== featured.id).slice(0, 8);

  const playVideo = (video: Video) => {
    setFeatured(video);
  };

  const scrollRail = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(260, rail.clientWidth * 0.72), behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden border-b border-border bg-background px-4 pb-8 pt-28 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl border border-foreground bg-card shadow-[8px_8px_0_0_hsl(var(--foreground))]">
        <div className="grid border-b border-foreground text-[0.64rem] font-black uppercase tracking-[0.18em] text-muted-foreground md:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3 md:border-b-0 md:border-r">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
            <span>Network</span>
            <strong className="text-sm tracking-normal text-foreground">Rhozeland · Solana</strong>
          </div>
          <div className="relative flex items-center overflow-hidden py-3">
            <div
              className="flex gap-8 whitespace-nowrap will-change-transform"
              style={{ animation: "ticker-scroll 45s linear infinite" }}
            >
              {[...displayTickerItems, { tag: "Live Stream", label: liveLabel, href: "https://www.youtube.com/@Rhozeland/streams" }, ...displayTickerItems, { tag: "Live Stream", label: liveLabel, href: "https://www.youtube.com/@Rhozeland/streams" }].map((t, i) => (
                <a
                  key={`${t.tag}-${i}`}
                  href={t.href}
                  {...(t.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="inline-flex items-center gap-2 px-3"
                >
                  <span className="border border-border px-2 py-0.5 text-foreground">{t.tag}</span>
                  <span className="tracking-normal normal-case text-muted-foreground">{t.label}</span>
                </a>
              ))}
            </div>
            <span className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent" />
          </div>
        </div>

        <div className="border-b border-foreground bg-card px-4 py-4 sm:px-6">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-muted-foreground">Our Story</span>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-foreground sm:text-base">
                From a circle of friends in 2016 to a studio, channel, and launchpad for bold creators today.
              </p>
            </div>
            <a href="/about.html" className="inline-flex items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.14em] text-foreground">
              Full story <ArrowUpRight size={13} />
            </a>
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            {storyItems.map((item) => (
              <div
                key={item.year}
                className="group relative grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3 border border-border bg-background/40 p-2 text-left transition-colors hover:border-foreground hover:bg-muted"
              >
                <span className="relative block aspect-square overflow-hidden border border-border bg-muted">
                  <img src={item.image} alt={`${item.year} Rhozeland story`} className="h-full w-full object-cover grayscale transition duration-300 group-hover:grayscale-0" loading="lazy" />
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-black leading-none text-foreground">{item.year}</span>
                  <span className="mt-1 block text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{item.title}</span>
                </span>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 border border-foreground bg-card px-3 py-2 text-[0.7rem] font-medium leading-snug text-foreground shadow-[4px_4px_0_0_hsl(var(--foreground))] group-hover:block"
                >
                  {item.desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,8fr)_minmax(280px,4fr)]">
          <article className="border-b border-foreground p-4 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="bg-foreground px-2.5 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-background">
                The Channel
              </span>
              <span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                New every Sunday · Toronto / LA
              </span>
            </div>

            <h1 className="mb-6 max-w-[16ch] text-[2.55rem] font-black leading-[0.98] tracking-normal text-foreground sm:text-[4rem] lg:text-[4.9rem]">
              This week on <span className="text-transparent [-webkit-text-stroke:1.4px_hsl(var(--foreground))]">Rhozeland.</span>
            </h1>

            <div className="relative mb-5 aspect-video overflow-hidden border border-foreground/20 bg-foreground">
              <iframe
                key={featured.id}
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube.com/embed/${featured.id}?autoplay=1&rel=0&modestbranding=1`}
                title={featured.title}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
              <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 bg-foreground/75 px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.16em] text-background">
                <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden="true" /> {featured.live ? "Live Now" : "Now Playing"} · {featured.published || "YouTube"}
              </span>
            </div>

            <p className="max-w-[62ch] text-base font-semibold leading-relaxed text-muted-foreground">
              <em className="font-black text-foreground">{featured.title}</em> — podcasts, documentaries, and live streams from the Rhozeland channel. New episode every Sunday.
            </p>

            <div className="mt-6 border-t border-border pt-4" aria-label="Recent videos">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-muted-foreground">Recent Videos</span>
                <a href="https://www.youtube.com/@Rhozeland" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-foreground">
                  Full channel <ArrowUpRight size={13} />
                </a>
              </div>
              <div className="relative">
                <button type="button" aria-label="Scroll videos left" onClick={() => scrollRail(-1)} className="absolute -left-2 top-1/3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-foreground bg-card text-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]">
                  <ArrowLeft size={15} />
                </button>
                <button type="button" aria-label="Scroll videos right" onClick={() => scrollRail(1)} className="absolute -right-2 top-1/3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-foreground bg-card text-foreground shadow-[2px_2px_0_0_hsl(var(--foreground))]">
                  <ArrowRight size={15} />
                </button>
                <div ref={railRef} className="scrollbar-hide flex snap-x gap-3 overflow-x-auto pb-2">
                  {railVideos.map((video) => (
                    <button key={video.id} type="button" onClick={() => playVideo(video)} className="w-[72%] flex-none snap-start text-left sm:w-56 lg:w-60">
                      <span className="relative block aspect-video overflow-hidden border border-border bg-muted">
                        <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt={video.title} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" loading="lazy" />
                        <span className="absolute bottom-2 right-2 bg-foreground px-2 py-1 text-[0.5rem] font-black uppercase tracking-[0.14em] text-background">{video.live ? "● Live" : "▶ Watch"}</span>
                      </span>
                      <span className="mt-2 block text-[0.55rem] font-black uppercase tracking-[0.16em] text-muted-foreground">{video.live ? "Live · YouTube" : `Video · ${video.published || "YouTube"}`}</span>
                      <span className="mt-1 line-clamp-2 block text-sm font-black leading-tight text-foreground">{video.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <aside className="flex flex-col" aria-label="Rhozeland ecosystem snapshot">
            <div className="border-b border-foreground p-5">
              <div className="mb-4 flex items-end justify-between gap-3">
                <span className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  $RHOZE · Live on Solana
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
                <div className="border-l-2 border-foreground pl-3">
                  <div className="mb-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-muted-foreground">$RHOZE</div>
                  <div className="text-2xl font-black leading-none text-foreground">Available</div>
                </div>
                <div className="border-l-2 border-border pl-3">
                  <div className="mb-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-muted-foreground">Network</div>
                  <div className="text-2xl font-black leading-none text-foreground">Solana</div>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4 text-[0.68rem] font-black uppercase tracking-[0.18em] text-muted-foreground">Explore Rhozeland</div>
              <div className="grid grid-cols-2 gap-3">
                {pillars.map(({ href, label, desc, Icon, gradient }) => {
                  const isEvents = label === "Events";
                  return (
                    <div key={label} className="group relative">
                      <a
                        href={href}
                        className="relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border border-foreground/10 p-3 shadow-[3px_3px_0_0_hsl(var(--foreground))] transition-transform hover:-translate-y-0.5"
                        style={{ backgroundImage: gradient }}
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-background/70 text-foreground backdrop-blur-sm">
                          <Icon size={16} strokeWidth={2.2} />
                        </span>
                        <span>
                          <span className="block text-sm font-black uppercase tracking-[0.08em] text-foreground">{label}</span>
                          <span className="mt-0.5 block text-[0.62rem] font-semibold leading-snug text-foreground/70">{desc}</span>
                        </span>
                        {isEvents ? (
                          <span className="absolute right-2 top-2 rounded-full bg-foreground px-1.5 py-0.5 text-[0.5rem] font-black uppercase tracking-[0.14em] text-background">
                            {eventArchive.length}
                          </span>
                        ) : null}
                      </a>
                      {isEvents ? (
                        <div
                          role="tooltip"
                          className="pointer-events-none absolute right-0 top-full z-30 mt-2 hidden w-72 origin-top-right border border-foreground bg-card p-3 shadow-[6px_6px_0_0_hsl(var(--foreground))] group-hover:block sm:pointer-events-auto"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[0.55rem] font-black uppercase tracking-[0.18em] text-muted-foreground">Events · Archive & Upcoming</span>
                            <a href="/events.html" className="text-[0.55rem] font-black uppercase tracking-[0.14em] text-foreground">All →</a>
                          </div>
                          <ul className="divide-y divide-border">
                            {eventArchive.map((ev) => (
                              <li key={ev.title}>
                                <a
                                  href={ev.href}
                                  {...(ev.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                                  className={`flex items-start gap-2 py-2 hover:bg-muted/60 ${ev.featured ? "-mx-3 border-l-2 border-foreground bg-muted/40 px-3" : ""}`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      {ev.featured ? (
                                        <span className="rounded bg-foreground px-1 py-0.5 text-[0.5rem] font-black uppercase tracking-[0.14em] text-background">★ New</span>
                                      ) : null}
                                      <span className="text-[0.55rem] font-black uppercase tracking-[0.14em] text-muted-foreground">{ev.tag}</span>
                                    </div>
                                    <div className="mt-0.5 truncate text-xs font-black text-foreground">{ev.title}</div>
                                    <div className="text-[0.62rem] font-semibold text-muted-foreground">{ev.date}</div>
                                  </div>
                                  <ArrowUpRight size={12} className="mt-1 shrink-0 text-foreground opacity-60" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
      <style>{`@keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </section>
  );
};

export default Hero;
