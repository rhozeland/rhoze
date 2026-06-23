import { ArrowUpRight } from "lucide-react";

const drops = [
  {
    href: "/projects.html",
    image: "/images/ooak-saint-flair-west-thumb.webp",
    kicker: "Album · Ooak",
    title: "Saint Flair West",
    desc: "Full-length rollout — art direction, visual world.",
  },
  {
    href: "/projects.html",
    image: "/images/rhozeland-fus-thumb.webp",
    kicker: "EP · Rhozeland",
    title: "FUS",
    desc: "Original sound from the collective. Streaming now.",
  },
  {
    href: "/leaderboard.html",
    image: "/images/timeline-2023.webp",
    kicker: "Community · Live",
    title: "Weekly Leaderboard",
    desc: "Earn $RHOZE for moving the movement.",
  },
];

const Hero = () => {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background px-4 pb-8 pt-28 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl border border-foreground bg-card shadow-[8px_8px_0_0_hsl(var(--foreground))]">
        <div className="flex flex-col gap-2 border-b border-foreground px-4 py-3 text-[0.64rem] font-black uppercase tracking-[0.18em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <strong className="text-foreground">Rhozeland · Selected direction</strong>
          <span>Kinetic technical editorial · Live homepage</span>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,8fr)_minmax(280px,4fr)]">
          <article className="border-b border-foreground p-4 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="bg-foreground px-2.5 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] text-background">
                A New Era
              </span>
              <span className="text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Today · Toronto / LA · Solana
              </span>
            </div>

            <h1 className="mb-6 max-w-[12ch] text-[2.55rem] font-black uppercase leading-[0.94] tracking-normal text-foreground sm:text-[4rem] lg:text-[4.9rem]">
              Launch <span className="text-transparent [-webkit-text-stroke:1.4px_hsl(var(--foreground))]">culture.</span>
              <br /> Own the upside.
            </h1>

            <div className="relative mb-5 aspect-video overflow-hidden border border-foreground/20 bg-foreground">
              <iframe
                className="absolute inset-0 h-full w-full"
                src="https://www.youtube.com/embed/9rxMdl_mQws?autoplay=1&mute=1&rel=0&modestbranding=1&loop=1&playlist=9rxMdl_mQws"
                title="The Rhozeland Documentary"
                allow="autoplay; encrypted-media"
                allowFullScreen
                loading="lazy"
              />
              <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 bg-foreground/75 px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.16em] text-background">
                <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden="true" /> Featured · Documentary
              </span>
            </div>

            <p className="max-w-[62ch] text-base font-semibold leading-relaxed text-muted-foreground">
              From a circle of friends in 2016 to the recording, content, and launch infrastructure for the new{" "}
              <em className="font-black text-foreground">independent creative economy</em> — studio, $RHOZE token,
              and a live community under one roof.
            </p>
          </article>

          <aside className="flex flex-col" aria-label="Rhozeland ecosystem snapshot">
            <div className="border-b border-foreground p-5">
              <div className="mb-4 flex items-end justify-between gap-3">
                <span className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Ecosystem
                </span>
                <span className="rounded bg-primary/15 px-2 py-1 text-[0.62rem] font-black tracking-[0.06em] text-primary">
                  + Active
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
                <div className="border-l-2 border-foreground pl-3">
                  <div className="mb-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-muted-foreground">$RHOZE</div>
                  <div className="text-2xl font-black leading-none text-foreground">Live</div>
                </div>
                <div className="border-l-2 border-border pl-3">
                  <div className="mb-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-muted-foreground">Supply</div>
                  <div className="text-2xl font-black leading-none text-foreground">1B · Locked</div>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4 text-[0.68rem] font-black uppercase tracking-[0.18em] text-muted-foreground">Latest Drops</div>
              <div className="space-y-0">
                {drops.map((drop) => (
                  <a key={drop.title} href={drop.href} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 border-t border-border py-3 first:border-t-0">
                    <span className="h-16 w-16 bg-cover bg-center grayscale transition-all hover:grayscale-0" style={{ backgroundImage: `url('${drop.image}')` }} />
                    <span>
                      <span className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-muted-foreground">{drop.kicker}</span>
                      <strong className="mt-1 block text-sm font-black uppercase leading-tight text-foreground">{drop.title}</strong>
                      <span className="mt-1 block text-xs leading-snug text-muted-foreground">{drop.desc}</span>
                    </span>
                  </a>
                ))}
              </div>
              <a href="/projects.html" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-foreground">
                See all projects <ArrowUpRight size={15} />
              </a>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default Hero;
