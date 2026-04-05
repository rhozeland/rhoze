import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Heart, Palette, Users, Flame } from "lucide-react";

const values = [
  {
    icon: Palette,
    title: "For Creatives",
    desc: "Artists, designers, musicians — if you create, Rhoze is your launchpad.",
    color: "bg-rhoze-pink",
  },
  {
    icon: Heart,
    title: "For the Trenches",
    desc: "Real support for real people. Grants, causes, and community-first economics.",
    color: "bg-rhoze-lavender",
  },
  {
    icon: Users,
    title: "By the People",
    desc: "Ownership isn't a buzzword here. It's the blueprint. Revenue flows back to you.",
    color: "bg-rhoze-peach",
  },
  {
    icon: Flame,
    title: "Built Different",
    desc: "Clothing drops, services marketplace, artist tools — backed by a deflationary flywheel.",
    color: "bg-primary/10",
  },
];

const About = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="about" className="py-32 px-6" ref={ref}>
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl sm:text-5xl font-semibold font-display mb-4 text-foreground">
            What is Rhoze?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg font-body">
            The problem is ownership. The solution is giving it all back — a chance to finally own something meaningful and fuel more growth, together.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {values.map((v, i) => (
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 * i }}
              className="group p-8 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all hover:shadow-lift"
            >
              <div className={`w-12 h-12 rounded-xl ${v.color} flex items-center justify-center mb-5`}>
                <v.icon className="text-foreground/70" size={22} />
              </div>
              <h3 className="text-xl font-medium font-display mb-2 text-foreground">{v.title}</h3>
              <p className="text-muted-foreground font-body leading-relaxed">{v.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default About;
