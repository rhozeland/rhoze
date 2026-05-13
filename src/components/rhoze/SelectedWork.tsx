import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Music, Camera, Video } from "lucide-react";

const projects = [
  {
    title: "Just Call Me",
    artist: "Ess B",
    tag: "Audio & Visual",
    type: "Music Video",
    icons: ["music", "camera"],
    href: "https://www.youtube.com/watch?v=2Nuyr57Xe3o",
    image: "/images/ess-b-just-call-me-thumb.jpg",
    video: "/videos/ess-b-just-call-me.mp4",
  },
  {
    title: "The Mask",
    artist: "Ooak",
    tag: "Audio & Visual",
    type: "Music Video",
    icons: ["music", "camera"],
    href: "https://www.youtube.com/watch?v=Ht1RPGlJBZg",
    image: "/images/ooak-the-mask-thumb.png",
    video: "/videos/ooak-the-mask.mp4",
  },
  {
    title: "Mansa Musa",
    artist: "MONEE FINGAZ",
    tag: "Audio & Visual",
    type: "Music Video",
    icons: ["music", "camera"],
    href: "https://www.youtube.com/watch?v=w9dYE595cBw",
    image: "/images/fingaz-mansa-musa-thumb.png",
    video: "/videos/fingaz-mansa-musa.mp4",
  },
  {
    title: "Bombaaa",
    artist: "MONEE FINGAZ X 1CUZZMN",
    tag: "Audio & Visual",
    type: "Music Video",
    icons: ["music", "camera"],
    href: "https://www.youtube.com/watch?v=QSFF9jI8f4g",
    image: "https://cdn.prod.website-files.com/68953b64959803ee0c77db20/690e9d4b828465eeb8dd63ce_admin-ajax%20(17).png",
    video: "/videos/fingaz-bombaaa-v2.mp4",
  },
  {
    title: "Feel Like A Superhero",
    artist: "MONEE FINGAZ",
    tag: "Audio & Visual",
    type: "Music Video",
    icons: ["music", "camera"],
    href: "https://www.youtube.com/watch?v=Ht1RPGlJBZg",
    image: "/images/fingaz-superhero-thumb.png",
  },
  {
    title: "Holy Water",
    artist: "Cozal",
    tag: "Audio & Visual",
    type: "Music Video",
    icons: ["music", "camera"],
    href: "https://www.youtube.com/watch?v=VPLyATcs7fE",
    image: "/images/cozal-holy-water-thumb.png",
    video: "/videos/cozal-holy-water.mp4",
  },
  {
    title: "FATE",
    artist: "DUBZY33",
    tag: "Audio & Visual",
    type: "Music Video",
    icons: ["music", "camera"],
    href: "https://www.youtube.com/watch?v=EPnVN9riFtI",
    image: "https://cdn.prod.website-files.com/68953b64959803ee0c77db20/690e9daf5a1bbda0a4020231_admin-ajax%20(18).png",
  },
  {
    title: "iiMPCT Media",
    artist: "iiMPCT Media",
    tag: "Visual",
    type: "Web Series",
    icons: ["camera"],
    href: "https://www.youtube.com/@iimpctmedia",
    image: "/images/iimpct-media-thumb.png",
  },
  {
    title: "United MMA Sponsorship",
    artist: "BK Whiskey",
    tag: "Commercial",
    type: "Commercial",
    icons: ["camera"],
    href: "https://www.instagram.com/p/DKvf2jXMbRs",
    image: "/images/bk-whiskey-mma-thumb.png",
    video: "/videos/bk-whiskey-mma.mp4",
  },
  {
    title: "Telephone",
    artist: "Runner's Club",
    tag: "Audio & Visual",
    type: "Music Video",
    icons: ["music", "camera"],
    href: "https://www.youtube.com/watch?v=Ht1RPGlJBZg",
    image: "/images/rc1-thumb.jpg",
  },
  {
    title: "Nothing At All",
    artist: "Semiah",
    tag: "Audio & Visual",
    type: "Music Video",
    icons: ["music", "camera"],
    href: "https://www.youtube.com/watch?v=Ht1RPGlJBZg",
    image: "/images/semiah-withdrawals-thumb.png",
  },
  {
    title: "Photoshoot",
    artist: "YOUNG $TEELO",
    tag: "Audio & Visual",
    type: "Music Video",
    icons: ["music", "camera"],
    href: "https://www.youtube.com/watch?v=Ht1RPGlJBZg",
    image: "/images/steelo-photoshoot-2.png",
  },
  {
    title: "LeLongLegs",
    artist: "Indolestic",
    tag: "Digital",
    type: "Web Series",
    icons: ["camera"],
    href: "https://www.lelonglegs.lol/",
    image: "https://cdn.prod.website-files.com/68953b64959803ee0c77db20/690e9e1a5aa06bee135ced3c_admin-ajax%20(19).png",
  },
  {
    title: "Withdrawals",
    artist: "Semiah",
    tag: "Audio & Visual",
    type: "Music Video",
    icons: ["music", "camera"],
    href: "https://www.youtube.com/watch?v=Y1v-IBb2aIA",
    image: "/images/semiah-withdrawals-thumb.png",
    video: "/videos/semiah-withdrawals.mp4",
  },
  {
    title: "Sensimelia",
    artist: "JulzMadeThisOne",
    tag: "Audio",
    type: "Full Release",
    icons: ["music"],
    href: "https://open.spotify.com/album/09tM0lhctM6aEfwG4mYmN5",
    image: "/images/julz-sensimelia.png",
  },
  {
    title: "Baby Blue",
    artist: "Godfrey Noir",
    tag: "Audio",
    type: "Single",
    icons: ["music"],
    href: "https://www.youtube.com/watch?v=7-nqVh05kZ8",
    image: "/images/godfrey-noir-baby-blue.png",
  },
  {
    title: "U OUTTA KNOW",
    artist: "YOUNG $TEELO",
    tag: "Audio & Visual",
    type: "Music Video",
    icons: ["music", "camera"],
    href: "https://www.youtube.com/watch?v=JL85Aej4Je4",
    image: "/images/steelo-u-outta-know-thumb.jpg",
  },
  {
    title: "Saint Flair West",
    artist: "Ooak",
    tag: "Audio",
    type: "EP",
    icons: ["music"],
    href: "https://www.youtube.com/playlist?list=OLAK5uy_nEqURlEWs2C0dJXjln2XYNJS2KjS3kHSM",
    image: "/images/ooak-saint-flair-west-thumb.png",
  },
  {
    title: "Server Incognito",
    artist: "Indoléstic",
    tag: "Visual",
    type: "Art Installation",
    icons: ["camera"],
    href: "https://vectorfestival.org/window-activation",
    image: "https://cdn.prod.website-files.com/68953b64959803ee0c77db20/68ac7c1a22a5a13554dd92dd_AdobeExpress-ServerIncognito1-ezgif.com-resize.gif",
  },
  {
    title: "Surfin'",
    artist: "MARV x Straightdizzy",
    tag: "Audio",
    type: "Single",
    icons: ["music"],
    href: "https://open.spotify.com/track/1kiOOHclAXCBH6w6MWyZ63",
    image: "/images/surfin-thumb.png",
  },
  {
    title: "Night Come",
    artist: "Luckz ft. MARV",
    tag: "Audio & Visual",
    type: "Music Video",
    icons: ["music", "camera"],
    href: "https://www.youtube.com/watch?v=pDO4sTpWKng",
    image: "/images/luckz-night-come-thumb.png",
    video: "/videos/luckz-night-come.mp4",
  },
  {
    title: "Lucky Charm",
    artist: "Carina",
    tag: "Visual",
    type: "Reel",
    icons: ["camera"],
    href: "https://www.instagram.com/p/DXdWvKNDsOA/",
    image: "/images/carina-lucky-charm-thumb.jpg",
    video: "/videos/carina-lucky-charm.mp4",
  },
];

const iconMap: Record<string, typeof Music> = {
  music: Music,
  camera: Camera,
  video: Video,
};

const ProjectCard = ({ project: p, index: i, inView }: { project: typeof projects[number]; index: number; inView: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (p.video && videoRef.current) {
      const video = videoRef.current;
      video.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (p.video && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <motion.a
      href={p.href}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.1 + i * 0.06 }}
      className="relative group flex-shrink-0 w-[300px] sm:w-[340px] h-[220px] sm:h-[260px] rounded-xl overflow-hidden block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <img
        src={p.image}
        alt={`${p.title} — ${p.artist}`}
        loading="lazy"
        decoding="async"
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${
          p.video && isHovered ? "opacity-0" : "opacity-100 group-hover:scale-105"
        }`}
      />

      {p.video && (
        <video
          ref={videoRef}
          src={p.video}
          poster={p.image}
          muted
          playsInline
          loop
          preload="metadata"
          onCanPlay={() => {
            if (isHovered && videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
          }}
          className={`pointer-events-none absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isHovered ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Type tag */}
      <span className="absolute top-3 right-14 text-[10px] font-semibold tracking-wider uppercase text-white/70 bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
        {p.type}
      </span>

      {/* Arrow */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
        <div className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center">
          <ArrowUpRight size={14} className="text-white" />
        </div>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
        <div className="flex items-center gap-1.5 mb-1">
          {p.icons?.map((icon) => {
            const Icon = iconMap[icon];
            return Icon ? <Icon key={icon} size={12} className="text-white/55" /> : null;
          })}
          <span className="text-[10px] font-semibold tracking-wider uppercase text-white/55">{p.tag}</span>
        </div>
        <h3 className="text-white font-semibold text-base leading-tight">{p.title}</h3>
        <p className="text-white/50 text-xs mt-0.5">{p.artist}</p>
      </div>
    </motion.a>
  );
};

const SelectedWork = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="work" className="py-20 lg:py-28" ref={ref}>
      <div className="container mx-auto max-w-6xl px-6 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-3 block">
            Selected Work
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold font-display leading-[1.05] text-foreground mb-4">
            Projects across music,
            <br />
            culture, and digital product.
          </h2>
          <p className="text-muted-foreground max-w-lg text-sm sm:text-base leading-relaxed mb-5">
            Rhozeland handles audio, visuals, web, and launch systems for brands
            and artists building with intent — not just volume.
          </p>
          <a
            href="/projects.html"
            className="inline-flex items-center gap-2 text-foreground font-semibold text-sm hover:opacity-70 transition-opacity"
          >
            See all projects <ArrowUpRight size={14} />
          </a>
        </motion.div>
      </div>

      <ScrollingStrip inView={inView} />
    </section>
  );
};

export default SelectedWork;

/**
 * Horizontal strip with:
 *  - Native horizontal scroll (trackpad / touch swipe / mouse wheel via shift)
 *  - Click-and-drag to scroll
 *  - Continuous auto-scroll via rAF that snaps back at the halfway point of
 *    a duplicated track for seamless looping
 *  - Auto-scroll pauses on hover, focus, touch, and active drag
 */
const ScrollingStrip = ({ inView }: { inView: boolean }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pauseRef = useRef(false);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const movedRef = useRef(false);

  // Triple the list so the scroller can start in the middle copy and wrap both directions.
  const loop = [...projects, ...projects, ...projects];

  const getSegmentWidth = () => {
    const track = trackRef.current;
    return track ? track.scrollWidth / 3 : 0;
  };

  const normalizeScrollPosition = () => {
    const el = scrollerRef.current;
    const segmentWidth = getSegmentWidth();
    if (!el || !segmentWidth) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;

    if (el.scrollLeft <= 1) {
      el.scrollLeft += segmentWidth;
    } else if (el.scrollLeft >= maxScroll - 1) {
      el.scrollLeft -= segmentWidth;
    }
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const setInitialPosition = () => {
      const segmentWidth = getSegmentWidth();
      if (segmentWidth) {
        el.scrollLeft = segmentWidth;
      }
    };

    const frame = requestAnimationFrame(setInitialPosition);

    const handleResize = () => {
      const segmentWidth = getSegmentWidth();
      if (!segmentWidth) return;
      const relativeOffset = ((el.scrollLeft % segmentWidth) + segmentWidth) % segmentWidth;
      el.scrollLeft = segmentWidth + relativeOffset;
    };

    window.addEventListener("resize", handleResize);

    let raf = 0;
    let last = performance.now();
    const SPEED = 30; // px/sec — gentle drift

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!pauseRef.current && !draggingRef.current) {
        const segmentWidth = getSegmentWidth();
        let next = el.scrollLeft + SPEED * dt;
        if (segmentWidth && next >= segmentWidth * 2) {
          next -= segmentWidth;
        }
        el.scrollLeft = next;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = scrollerRef.current;
    if (!el) return;

    draggingRef.current = true;
    pauseRef.current = true;
    movedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartScrollRef.current = el.scrollLeft;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    if (!draggingRef.current) return;

    const el = scrollerRef.current;
    if (!el) return;

    const dx = e.clientX - dragStartXRef.current;
    if (Math.abs(dx) > 4) movedRef.current = true;
    el.scrollLeft = dragStartScrollRef.current - dx;

    const segmentWidth = getSegmentWidth();
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (segmentWidth && el.scrollLeft <= 1) {
      el.scrollLeft += segmentWidth;
      dragStartScrollRef.current = el.scrollLeft;
      dragStartXRef.current = e.clientX;
    } else if (segmentWidth && el.scrollLeft >= maxScroll - 1) {
      el.scrollLeft -= segmentWidth;
      dragStartScrollRef.current = el.scrollLeft;
      dragStartXRef.current = e.clientX;
    }
  };

  const endDrag = () => {
    draggingRef.current = false;
    pauseRef.current = false;
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (movedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      movedRef.current = false;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="relative"
      onMouseEnter={() => (pauseRef.current = true)}
      onMouseLeave={endDrag}
      onFocusCapture={() => (pauseRef.current = true)}
      onBlurCapture={() => (pauseRef.current = false)}
      onTouchStart={() => (pauseRef.current = true)}
      onTouchEnd={() => (pauseRef.current = false)}
    >
      <div
        ref={scrollerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onScroll={normalizeScrollPosition}
        onClickCapture={onClickCapture}
        className="overflow-x-auto overflow-y-hidden scrollbar-hide cursor-grab active:cursor-grabbing select-none"
        style={{ scrollBehavior: "auto", touchAction: "pan-x" }}
      >
        <div ref={trackRef} className="flex gap-4 pb-4 w-max px-6">
          {loop.map((p, i) => (
            <ProjectCard
              key={`${p.title}-${i}`}
              project={p}
              index={i % projects.length}
              inView={inView}
            />
          ))}
        </div>
      </div>
      {/* Soft edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />
    </motion.div>
  );
};
