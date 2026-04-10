import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";

const projects = [
  {
    title: "The Mask",
    artist: "Ooak",
    tag: "Audio & Visual",
    type: "Music Video",
    href: "https://www.youtube.com/watch?v=Ht1RPGlJBZg",
    image: "/images/ooak-the-mask-thumb.png",
    video: "/videos/ooak-the-mask.mp4",
  },
  {
    title: "Mansa Musa",
    artist: "MONEE FINGAZ",
    tag: "Audio & Visual",
    type: "Music Video",
    href: "https://www.youtube.com/watch?v=w9dYE595cBw",
    image: "/images/fingaz-mansa-musa-thumb.png",
    video: "/videos/fingaz-mansa-musa.mp4",
  },
  {
    title: "Holy Water",
    artist: "Cozal",
    tag: "Audio & Visual",
    type: "Music Video",
    href: "https://www.youtube.com/watch?v=VPLyATcs7fE",
    image: "/images/cozal-holy-water-thumb.png",
    video: "/videos/cozal-holy-water.mp4",
  },
  {
    title: "LeLongLegs",
    artist: "Indolestic",
    tag: "Digital",
    type: "Web Series",
    href: "https://www.lelonglegs.lol/",
    image: "https://cdn.prod.website-files.com/68953b64959803ee0c77db20/690e9e1a5aa06bee135ced3c_admin-ajax%20(19).png",
  },
  {
    title: "FATE",
    artist: "DUBZY33",
    tag: "Audio & Visual",
    type: "Music Video",
    href: "https://www.youtube.com/watch?v=EPnVN9riFtI",
    image: "https://cdn.prod.website-files.com/68953b64959803ee0c77db20/690e9daf5a1bbda0a4020231_admin-ajax%20(18).png",
  },
  {
    title: "BK Whiskey MMA",
    artist: "BK Whiskey",
    tag: "Commercial",
    type: "Commercial",
    href: "https://www.instagram.com/p/DKvf2jXMbRs",
    image: "https://cdn.prod.website-files.com/68953b64959803ee0c77db20/690e99e0d03b856155a51475_admin-ajax%20(14).png",
  },
  {
    title: "True North Transparency",
    artist: "True North Transparency",
    tag: "Visual",
    type: "Web Series",
    href: "https://www.youtube.com/watch?v=u9iOP4qH2MI",
    image: "https://cdn.prod.website-files.com/68953b64959803ee0c77db20/69aef6d8134a3f18311f8d27_admin-ajax.png",
  },
  {
    title: "Bombaaa",
    artist: "MONEE FINGAZ X 1CUZZMN",
    tag: "Audio & Visual",
    type: "Music Video",
    href: "https://www.youtube.com/watch?v=QSFF9jI8f4g",
    image: "https://cdn.prod.website-files.com/68953b64959803ee0c77db20/690e9d4b828465eeb8dd63ce_admin-ajax%20(17).png",
    video: "/videos/fingaz-bombaaa-v2.mp4",
  },
];

const ProjectCard = ({ project: p, index: i, inView }: { project: typeof projects[number]; index: number; inView: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);

    if (p.video && videoRef.current) {
      const video = videoRef.current;

      if (video.readyState < 2) {
        video.load();
      } else {
        video.currentTime = Math.min(0.15, video.duration || 0);
      }

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
      {/* Image */}
      <img
        src={p.image}
        alt={`${p.title} — ${p.artist}`}
        loading="lazy"
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${
          p.video && isHovered ? "opacity-0" : "opacity-100 group-hover:scale-105"
        }`}
      />

      {/* Video overlay */}
      {p.video && (
        <video
          ref={videoRef}
          src={p.video}
          poster={p.image}
          muted
          playsInline
          loop
          preload="auto"
          onCanPlay={() => {
            if (isHovered && videoRef.current) {
              if (videoRef.current.currentTime < 0.15) {
                videoRef.current.currentTime = Math.min(0.15, videoRef.current.duration || 0);
              }
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
      {/* Header */}
      <div className="container mx-auto px-6 lg:px-16 mb-10">
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

      {/* Horizontal scroll strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="overflow-x-auto scrollbar-hide"
      >
        <div className="flex gap-4 px-6 lg:px-16 pb-4" style={{ width: "max-content" }}>
          {projects.map((p, i) => (
            <ProjectCard key={p.title} project={p} index={i} inView={inView} />
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default SelectedWork;
