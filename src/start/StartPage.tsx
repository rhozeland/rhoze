import { useState, useMemo, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Music2, Activity, Minus, Plus, Info, ArrowRight, CalendarClock, Search, X, ExternalLink, Play } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import logoWhite from "@/assets/logo-white.webp";
import ClientDashboard from "@/start/ClientDashboard";

type Pkg = {
  id: string; slug: string; name: string; kind: string; category: string | null;
  description: string | null; price_cents: number; credits: number;
  credits_cost: number; min_quantity: number;
  billing_interval: string | null; sort_order: number;
};

type Category = "visual" | "audio" | "development";

const CATEGORIES: { id: Category; label: string; Icon: typeof Camera }[] = [
  { id: "visual", label: "Visual", Icon: Camera },
  { id: "audio", label: "Audio", Icon: Music2 },
  { id: "development", label: "Development", Icon: Activity },
];

const CREDIT_VALUE_CENTS = 7500; // 1 credit = $75 baseline
const DEPOSIT_PERCENT = 0.30;    // 30% deposit to begin
const DEPOSIT_MIN_CENTS = 5000;  // Stripe min
const SCOPE_CALL_URL = "/book.html";

// Tier accent colors — match the Spark/Bloom/Glow/Play chips on the homepage
const TIER_ACCENTS: Record<string, string> = {
  spark: "hsl(212 80% 55%)",
  bloom: "hsl(335 78% 56%)",
  glow:  "hsl(24 90% 52%)",
  play:  "hsl(42 88% 48%)",
  default: "hsl(var(--primary))",
};

type ServiceDetail = {
  scope: string;
  deliverables: string[];
  revisions: string;
  turnaround: string;
  notIncluded?: string[];
};

type ServiceExample = { title: string; artist: string; thumb?: string; href?: string; video?: string };

// Curated samples drawn from /projects.html — real client work, no asset hosting needed.
const SERVICE_EXAMPLES: Record<string, ServiceExample[]> = {
  // ---- Visual ----
  "photo-shoot": [
    { title: "U Outta Know", artist: "YOUNG $TEELO", thumb: "/images/steelo-u-outta-know-thumb.webp", video: "/videos/steelo-u-outta-know.mp4", href: "https://www.youtube.com/watch?v=JL85Aej4Je4" },
    { title: "Salar Gholami", artist: "BK Whiskey", thumb: "/images/bk-salar-thumb.webp", video: "/videos/bk-salar.mp4", href: "https://www.instagram.com/p/DDr6K4fJTOJ/" },
    { title: "Milad Zareian", artist: "BK Whiskey", thumb: "/images/bk-milad-thumb.webp", video: "/videos/bk-milad.mp4", href: "https://www.instagram.com/p/DINIm3lMhZj/" },
  ],
  "content-edit": [
    { title: "Songwriting Camp Documentary", artist: "Global Masterminds", thumb: "/images/global-masterminds-doc-thumb.webp", video: "/videos/global-masterminds-doc.mp4", href: "https://www.youtube.com/watch?v=mHP4M-CIMls" },
    { title: "iiMPCT Media", artist: "iiMPCT Media", thumb: "/images/iimpct-media-thumb.webp", href: "https://www.youtube.com/@iimpctmedia" },
    { title: "United MMA Sponsorship", artist: "BK Whiskey", thumb: "/images/bk-whiskey-mma-thumb.webp", video: "/videos/bk-whiskey-mma.mp4", href: "https://www.instagram.com/p/DKvf2jXMbRs" },
  ],
  "commercial-edit": [
    { title: "United MMA Sponsorship", artist: "BK Whiskey", thumb: "/images/bk-whiskey-mma-thumb.webp", video: "/videos/bk-whiskey-mma.mp4", href: "https://www.instagram.com/p/DKvf2jXMbRs" },
    { title: "iiMPCT Media", artist: "iiMPCT Media", thumb: "/images/iimpct-media-thumb.webp", href: "https://www.youtube.com/@iimpctmedia" },
    { title: "Songwriting Camp Documentary", artist: "Global Masterminds", thumb: "/images/global-masterminds-doc-thumb.webp", video: "/videos/global-masterminds-doc.mp4", href: "https://www.youtube.com/watch?v=mHP4M-CIMls" },
  ],
  "short-form-edit": [
    { title: "Runner's Club Vol. 1", artist: "Runner's Club", thumb: "/images/rc1-thumb.webp", video: "/videos/rc1.mp4", href: "https://www.instagram.com/p/DJ90KlZIg3r/" },
    { title: "Runner's Club Vol. 2", artist: "Runner's Club", thumb: "/images/rc2-thumb.webp", video: "/videos/rc2.mp4", href: "https://www.instagram.com/p/DS0oshoASn1/" },
    { title: "Bombaaa", artist: "MONEE FINGAZ", thumb: "/images/fingaz-bombaaa-thumb.webp", video: "/videos/fingaz-bombaaa.mp4", href: "https://www.youtube.com/watch?v=QSFF9jI8f4g" },
  ],
  "mv-edit": [
    { title: "The Mask", artist: "Ooak", thumb: "/images/ooak-the-mask-thumb.webp", video: "/videos/ooak-the-mask.mp4", href: "https://www.youtube.com/watch?v=Ht1RPGlJBZg" },
    { title: "Mansa Musa", artist: "MONEE FINGAZ", thumb: "/images/fingaz-mansa-musa-thumb.webp", video: "/videos/fingaz-mansa-musa.mp4", href: "https://www.youtube.com/watch?v=w9dYE595cBw" },
    { title: "Feel Like A Superhero", artist: "MONEE FINGAZ", thumb: "/images/fingaz-superhero-thumb.webp", video: "/videos/fingaz-superhero.mp4", href: "https://www.youtube.com/watch?v=_4FotFv6VWc" },
  ],
  // ---- Audio ----
  "audio-recording": [
    { title: "Saint Flair West", artist: "Ooak", thumb: "/images/ooak-saint-flair-west-thumb.webp", href: "https://www.youtube.com/playlist?list=OLAK5uy_nEqURlEWs2C0dJXjln2XYNJS2KjS3kHSM" },
    { title: "Surfin'", artist: "Straightdizzy", thumb: "/images/surfin-thumb.webp", href: "https://open.spotify.com/track/1kiOOHclAXCBH6w6MWyZ63?si=157021a0c33e4a8f" },
    { title: "Gotta Go", artist: "Straightdizzy", thumb: "/images/straightdizzy-gotta-go-thumb.webp", video: "/videos/straightdizzy-gotta-go.mp4", href: "https://www.youtube.com/watch?v=nLlh8k-Uwdg" },
  ],
  "mixing": [
    { title: "Holy Water", artist: "Cozal", thumb: "/images/cozal-holy-water-thumb.webp", video: "/videos/cozal-holy-water.mp4", href: "https://www.youtube.com/watch?v=VPLyATcs7fE" },
    { title: "Night Come", artist: "Luckz", thumb: "/images/luckz-night-come-thumb.webp", video: "/videos/luckz-night-come.mp4", href: "https://www.youtube.com/watch?v=pDO4sTpWKng" },
    { title: "Withdrawals", artist: "Semiah", thumb: "/images/semiah-withdrawals-thumb.webp", video: "/videos/semiah-withdrawals.mp4", href: "https://www.youtube.com/watch?v=Y1v-IBb2aIA" },
  ],
  "mastering": [
    { title: "For The Dot", artist: "Luckz", thumb: "/images/luckz-forthedot-thumb.webp", video: "/videos/luckz-forthedot.mp4", href: "https://www.youtube.com/watch?v=VKzcwcNTlaU" },
    { title: "Figure It Out", artist: "Meesch", thumb: "/images/meesch-figure-it-out-thumb.webp", video: "/videos/meesch-figure-it-out.mp4", href: "https://music.apple.com/ca/album/figure-it-out-single/1750641530" },
    { title: "Privilege", artist: "Jevy", thumb: "/images/jevy-privilege-thumb.webp", href: "https://open.spotify.com/track/48FdIGtXonO8Wll38PUIi0" },
  ],
  "podcast": [
    { title: "Songwriting Camp Documentary", artist: "Global Masterminds", thumb: "/images/global-masterminds-doc-thumb.webp", video: "/videos/global-masterminds-doc.mp4", href: "https://www.youtube.com/watch?v=mHP4M-CIMls" },
    { title: "FUS", artist: "Rhozeland", thumb: "/images/rhozeland-fus-thumb.webp", href: "https://www.youtube.com/watch?v=WULC2OD8EFs" },
    { title: "89/32", artist: "Rhozeland", thumb: "/images/rhozeland-89-32-thumb.webp", href: "/projects.html" },
  ],
  // ---- Development ----
  "design": [
    { title: "Hacking The Tower", artist: "ETHDenver", thumb: "/images/ethdenver-hacking-tower-thumb.webp", href: "/projects.html" },
    { title: "FUS", artist: "Rhozeland", thumb: "/images/rhozeland-fus-thumb.webp", href: "https://www.youtube.com/watch?v=WULC2OD8EFs" },
    { title: "iiMPCT Media", artist: "iiMPCT Media", thumb: "/images/iimpct-media-thumb.webp", href: "https://www.youtube.com/@iimpctmedia" },
  ],
  "graphic-design": [
    { title: "FUS", artist: "Rhozeland", thumb: "/images/rhozeland-fus-thumb.webp", href: "https://www.youtube.com/watch?v=WULC2OD8EFs" },
    { title: "Saint Flair West", artist: "Ooak", thumb: "/images/ooak-saint-flair-west-thumb.webp", href: "https://www.youtube.com/playlist?list=OLAK5uy_nEqURlEWs2C0dJXjln2XYNJS2KjS3kHSM" },
    { title: "89/32", artist: "Rhozeland", thumb: "/images/rhozeland-89-32-thumb.webp", href: "/projects.html" },
  ],
  "web-development": [
    { title: "iiMPCT Media", artist: "iiMPCT Media", thumb: "/images/iimpct-media-thumb.webp", href: "https://www.youtube.com/@iimpctmedia" },
    { title: "Toronto Palapa Tours", artist: "Toronto Palapa Tours", thumb: "https://cdn.prod.website-files.com/68953b64959803ee0c77db20/690e962a828465eeb8dcd60e_admin-ajax%20(7).webp", href: "https://torontopalapa.tours/" },
    { title: "Indo LeLongLegs", artist: "Indoléstic", thumb: "https://cdn.prod.website-files.com/68953b64959803ee0c77db20/690e9e1a5aa06bee135ced3c_admin-ajax%20(19).png", href: "https://www.lelonglegs.lol/" },
  ],
  "uiux-development": [
    { title: "Server Incognito", artist: "Indoléstic", thumb: "https://cdn.prod.website-files.com/68953b64959803ee0c77db20/68ac7c1a22a5a13554dd92dd_AdobeExpress-ServerIncognito1-ezgif.com-resize.gif", href: "https://vectorfestival.org/window-activation" },
    { title: "iiMPCT Media", artist: "iiMPCT Media", thumb: "/images/iimpct-media-thumb.webp", href: "https://www.youtube.com/@iimpctmedia" },
    { title: "Toronto Palapa Tours", artist: "Toronto Palapa Tours", thumb: "https://cdn.prod.website-files.com/68953b64959803ee0c77db20/690e962a828465eeb8dcd60e_admin-ajax%20(7).webp", href: "https://torontopalapa.tours/" },
  ],
  "consult": [
    { title: "Songwriting Camp", artist: "Global Masterminds", thumb: "/images/global-masterminds-doc-thumb.webp", video: "/videos/global-masterminds-doc.mp4", href: "https://www.youtube.com/watch?v=mHP4M-CIMls" },
    { title: "MMA Sponsorship", artist: "BK Whiskey", thumb: "/images/bk-whiskey-mma-thumb.webp", video: "/videos/bk-whiskey-mma.mp4", href: "https://www.instagram.com/p/DKvf2jXMbRs" },
    { title: "iiMPCT Media", artist: "iiMPCT Media", thumb: "/images/iimpct-media-thumb.webp", href: "https://www.youtube.com/@iimpctmedia" },
  ],
};

const SERVICE_DETAILS: Record<string, ServiceDetail> = {
  // ---- Visual ----
  "photo-shoot": {
    scope: "Half-day shoot, ~3 hours on location or in our studio. One creative direction, one outfit/setup family.",
    deliverables: ["Up to 40 color-graded stills (web + print res)", "Online gallery for selects", "Lifestyle, portrait, or product framing"],
    revisions: "One round of re-edits on selected images (color, crop, light retouch).",
    turnaround: "5–7 business days from shoot date.",
    notIncluded: ["Travel beyond 25 mi", "Heavy retouching / compositing", "Hair, makeup, or talent"],
  },
  "content-edit": {
    scope: "One polished long-form edit (3–8 minutes) from your supplied footage.",
    deliverables: ["Edited master in 4K or 1080p", "Color pass + sound balance", "Royalty-safe music if needed"],
    revisions: "Two rounds of timed revisions.",
    turnaround: "7–10 business days after footage delivery.",
    notIncluded: ["Original shooting", "Motion graphics beyond title cards", "Licensed music clearance"],
  },
  "commercial-edit": {
    scope: "One commercial-grade cut, 15–60 seconds, agency-ready.",
    deliverables: ["Master + 9:16 and 1:1 reframes", "Full color grade + sound design", "Logo / endcard treatment"],
    revisions: "Two revision rounds before final lock.",
    turnaround: "7–10 business days.",
    notIncluded: ["Concept board / storyboard from scratch (add Strategy consult)", "VFX-heavy compositing"],
  },
  "short-form-edit": {
    scope: "One vertical edit for Reels / TikTok / Shorts, ≤90 seconds.",
    deliverables: ["9:16 master with captions", "Hook variant for A/B testing", "Trend-aware pacing"],
    revisions: "Two revision rounds.",
    turnaround: "3–5 business days.",
    notIncluded: ["Account posting / scheduling", "Original shooting"],
  },
  "mv-edit": {
    scope: "One full music-video edit synced to a single track from your footage.",
    deliverables: ["Edited master in 4K or 1080p", "Color grade + transition design", "Mixdown sync to provided audio"],
    revisions: "Two revision rounds.",
    turnaround: "10–14 business days.",
    notIncluded: ["VFX / 3D shots", "On-set direction (book Photo shoot for capture)"],
  },
  // ---- Audio ----
  "audio-recording": {
    scope: "Two-hour tracking session in our room with engineer. Sold in 2-credit blocks; book more for longer sessions.",
    deliverables: ["Multi-track session files", "Rough monitor mix for reference", "Up to 3 vocalists / one band setup"],
    revisions: "Re-tracking inside the booked window is included; additional time is billed at the same rate.",
    turnaround: "Same-day session export; raw files within 48 hrs.",
    notIncluded: ["Mixing or mastering (separate credits)", "Beat / instrumental production"],
  },
  "mixing": {
    scope: "Mix one song to release standard. Stems in, mix-bus out.",
    deliverables: ["Stereo mix (WAV 24-bit)", "Instrumental + acapella stems", "Reference-matched balance"],
    revisions: "Two recall / revision rounds.",
    turnaround: "5–7 business days from stem delivery.",
    notIncluded: ["Mastering", "Vocal tuning beyond standard correction (add a credit for heavy comping)"],
  },
  "mastering": {
    scope: "Master one track for streaming + DSP delivery, loudness-matched per platform.",
    deliverables: ["Mastered WAV + MP3", "DDP / streaming-ready file", "LUFS-matched for Spotify / Apple"],
    revisions: "One revision round.",
    turnaround: "2–3 business days.",
    notIncluded: ["Stem mastering (counts as 2 credits)", "Mix corrections"],
  },
  "podcast": {
    scope: "Two-hour multi-mic podcast session, in-room or remote-coordinated.",
    deliverables: ["One edited episode (≤60 min)", "Level + noise pass per speaker", "Intro / outro stitch from your assets"],
    revisions: "One revision round per episode.",
    turnaround: "3–5 business days post-session.",
    notIncluded: ["Show artwork / branding (see Graphic design)", "Distribution upload"],
  },
  // ---- Development ----
  "design": {
    scope: "One hour of flexible design work — tweaks, layouts, or a small request.",
    deliverables: ["Editable source file (Figma / PSD / AI)", "Exported assets for web or print"],
    revisions: "Iterations within the booked hour are included.",
    turnaround: "Same or next business day.",
    notIncluded: ["Net-new brand identity (book a multi-credit block)"],
  },
  "graphic-design": {
    scope: "One social-asset graphic — cover art, flyer, or a single carousel slide.",
    deliverables: ["Final PNG / JPG at platform spec", "Editable source file on request"],
    revisions: "Two revision rounds.",
    turnaround: "2–3 business days.",
    notIncluded: ["Multi-slide carousels (1 credit per slide)", "Animated assets"],
  },
  "web-development": {
    scope: "Full small-site build, ≈4–6 pages, responsive and deployed.",
    deliverables: ["Live deployed site", "CMS-light content blocks", "Basic SEO + analytics setup"],
    revisions: "Two structured revision rounds before launch; copy edits welcomed throughout.",
    turnaround: "3–4 weeks from kickoff.",
    notIncluded: ["Custom backend / auth (scope separately)", "Logo or brand identity work", "Ongoing maintenance retainer"],
  },
  "uiux-development": {
    scope: "Two-week UI/UX sprint focused on one product surface.",
    deliverables: ["User flow map", "Wireframes for key screens", "Clickable Figma prototype"],
    revisions: "Two structured review rounds during the sprint.",
    turnaround: "Two weeks from kickoff.",
    notIncluded: ["Production front-end build (see Web development)", "User research recruitment"],
  },
  "consult": {
    scope: "One-hour strategy call — brand, roadmap, or release planning.",
    deliverables: ["Recorded session", "Written follow-up with priorities + next steps"],
    revisions: "Async follow-up questions for 7 days after the call.",
    turnaround: "Booked within 3 business days.",
    notIncluded: ["Execution work — pair with relevant service credits"],
  },
};

export default function StartPage() {
  const [step, setStep] = useState<"intro" | "build" | "review" | "checkout">("intro");
  const [path, setPath] = useState<"subscribe" | "project" | null>(null);
  const [activeCat, setActiveCat] = useState<Category>("visual");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [tierSlug, setTierSlug] = useState<string>("");
  const [detailsFor, setDetailsFor] = useState<Pkg | null>(null);
  const [search, setSearch] = useState("");
  const [contact, setContact] = useState({
    name: "", email: "", phone: "", scope: "",
    region: "North America" as "North America" | "International",
    agree: false,
  });

  const { data: pkgs } = useQuery<Pkg[]>({
    queryKey: ["start_packages_v2"],
    queryFn: async () => {
      // Anonymous visitors can't read stripe_price_id (server-resolved at checkout).
      const { data, error } = await supabase
        .from("service_packages")
        .select("id, slug, name, kind, category, description, price_cents, credits, credits_cost, min_quantity, billing_interval, sort_order")
        .eq("is_active", true)
        .order("sort_order")
        .order("price_cents");
      if (error) throw error;
      return data as Pkg[];
    },
  });

  const tiers = useMemo(() => (pkgs ?? []).filter(p => p.kind === "subscription"), [pkgs]);
  const services = useMemo(() => (pkgs ?? []).filter(p => p.kind === "a_la_carte"), [pkgs]);
  const inCat = useMemo(() => services.filter(s => s.category === activeCat), [services, activeCat]);

  const trimmedSearch = search.trim().toLowerCase();
  const isSearching = trimmedSearch.length > 0;
  const visibleServices = useMemo(() => {
    if (!isSearching) return inCat;
    return services.filter(s => {
      const hay = `${s.name} ${s.description ?? ""} ${s.category ?? ""}`.toLowerCase();
      return hay.includes(trimmedSearch);
    });
  }, [services, inCat, isSearching, trimmedSearch]);
  const matchCountByCat = useMemo(() => {
    if (!isSearching) return {} as Record<string, number>;
    return visibleServices.reduce<Record<string, number>>((acc, s) => {
      const k = s.category ?? "other";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  }, [visibleServices, isSearching]);

  const selected = useMemo(() => services.filter(s => (cart[s.id] ?? 0) > 0), [services, cart]);
  const totalCredits = useMemo(() => selected.reduce((sum, s) => sum + s.credits_cost * (cart[s.id] ?? 0), 0), [selected, cart]);
  const estimateCents = totalCredits * CREDIT_VALUE_CENTS;
  const depositCents = Math.max(DEPOSIT_MIN_CENTS, Math.round(estimateCents * DEPOSIT_PERCENT));

  const selectedTier = tiers.find(t => t.slug === tierSlug);
  const tierCreditValue = selectedTier && selectedTier.credits > 0 ? selectedTier.price_cents / selectedTier.credits : null;
  const subscriberSavings = tierCreditValue ? Math.max(0, estimateCents - totalCredits * tierCreditValue) : 0;

  const fmt = (c: number) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;

  function addToCart(pkg: Pkg) {
    setCart(c => ({ ...c, [pkg.id]: Math.max(c[pkg.id] ?? 0, pkg.min_quantity) }));
  }
  function changeQty(pkg: Pkg, delta: number) {
    setCart(c => {
      const cur = c[pkg.id] ?? 0;
      const next = cur + delta;
      if (next <= 0) { const { [pkg.id]: _, ...rest } = c; return rest; }
      return { ...c, [pkg.id]: Math.max(pkg.min_quantity, next) };
    });
  }

  // ---------- INTRO ----------
  if (step === "intro") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PaymentTestModeBanner />
        <div className="max-w-3xl mx-auto px-6 pt-6">
          <a href="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowRight size={12} className="rotate-180" /> Back to Rhozeland
          </a>
        </div>
        <div className="max-w-3xl mx-auto px-6 py-12 md:py-20 text-center space-y-7">
          <img src={logoWhite} alt="Rhozeland" className="h-12 md:h-14 mx-auto opacity-90 dark:opacity-100" />
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">Start a project</h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-lg mx-auto">
            Choose how you want to work.
          </p>

          <div className="grid md:grid-cols-2 gap-4 pt-4 text-left">
            <button
              onClick={() => { setPath("subscribe"); setStep("build"); }}
              className="group rounded-2xl p-6 border border-border bg-card hover:border-foreground/60 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 space-y-3"
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Best value</div>
              <div className="text-xl font-semibold">Subscribe</div>
              <p className="text-sm text-muted-foreground">Monthly credits to spend on anything — cheaper per credit.</p>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">1 credit = {fmt(CREDIT_VALUE_CENTS)}. Final scope confirmed on a kickoff call.</p>
              <div className="flex items-center gap-1 text-sm font-medium pt-2">Choose a plan <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" /></div>
            </button>
            <button
              onClick={() => { setPath("project"); setStep("build"); }}
              className="group rounded-2xl p-6 border border-border bg-card hover:border-foreground/60 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 space-y-3"
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">One-off</div>
              <div className="text-xl font-semibold">Scope a project</div>
              <p className="text-sm text-muted-foreground">Pick services, get an instant estimate, leave a refundable deposit.</p>
              <div className="flex items-center gap-1 text-sm font-medium pt-2">Build estimate <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" /></div>
            </button>
          </div>

          <div id="dashboard" className="pt-10 md:pt-14 border-t border-border/50 mt-10">
            <ClientDashboard />
          </div>
        </div>
      </div>
    );
  }

  // ---------- BUILD ----------
  if (step === "build") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PaymentTestModeBanner />
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
          <header className="space-y-3">
            <button onClick={() => setStep("intro")} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h1 className="text-2xl md:text-3xl font-semibold">
                {path === "subscribe" ? "Choose your plan" : "Build your estimate"}
              </h1>
              {path === "project" && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{totalCredits}</span> {totalCredits === 1 ? "credit" : "credits"} · est. <span className="font-medium text-foreground">{fmt(estimateCents)}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {path === "subscribe"
                ? "Each tier grants monthly credits you spend on any service in the catalog below. Unused credits roll over while your subscription is active — pick the size that matches your output."
                : "Select what you'd like delivered. We'll quote it in credits — you can convert to a subscription on the next step if you'd save money."}
            </p>

            {/* Credit anchor — make the unit unmistakable */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 mt-2">
              <div className="text-sm">
                <span className="font-semibold text-foreground">1 credit = {fmt(CREDIT_VALUE_CENTS)}</span>
                <span className="text-muted-foreground"> · 1 hr of focused work or one deliverable</span>
              </div>
              <a
                href={SCOPE_CALL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-4 hover:text-primary"
              >
                <CalendarClock size={13} /> Not sure? Book a free 15-min scope call
              </a>
            </div>
          </header>

          {/* SUBSCRIBE: tiers are the primary focus, services are a reference list */}
          {path === "subscribe" && (
            <>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {tiers.map(t => {
                  const perCredit = t.credits > 0 ? t.price_cents / t.credits : 0;
                  const isPicked = tierSlug === t.slug;
                  const accent = TIER_ACCENTS[t.slug] ?? TIER_ACCENTS.default;
                  const isFree = t.price_cents === 0;
                  const isPopular = t.slug === "glow";
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTierSlug(t.slug)}
                      className={`relative text-left border rounded-2xl p-5 transition-all hover:-translate-y-0.5 ${isPicked ? "ring-1" : "hover:border-foreground/40 hover:shadow-md"} ${isPopular ? "border-2 shadow-lg" : ""}`}
                      style={isPicked
                        ? { borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}`, background: `${accent}14` }
                        : isPopular ? { borderColor: accent } : undefined}
                    >
                      {isPopular && (
                        <span
                          className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-[0.14em] px-2.5 py-0.5 rounded-full text-background"
                          style={{ background: accent }}
                        >Most Popular</span>
                      )}
                      <div className="text-[11px] uppercase tracking-[0.18em] font-semibold" style={{ color: accent }}>{t.name}</div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-semibold">{isFree ? "Free" : fmt(t.price_cents)}</span>
                        {!isFree && <span className="text-xs text-muted-foreground">/mo</span>}
                      </div>
                      <div className="mt-1 text-sm">
                        {isFree ? "Pay-as-you-go" : `${t.credits} credits / month`}
                      </div>
                      {!isFree && (
                        <div className="text-xs text-muted-foreground">{fmt(perCredit)}/credit</div>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {isFree
                          ? "No commitment. Buy credits or scope a project anytime."
                          : `Best for ${t.credits >= 20 ? "full-stack teams" : t.credits >= 8 ? "active creators" : "steady output"}.`}
                      </div>
                      {!isFree && t.description && (
                        <div className="text-xs text-muted-foreground mt-3 leading-relaxed">{t.description}</div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Read-only service catalog — what credits unlock */}
              <div className="space-y-3 border-t border-border pt-6">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">What you can spend credits on</div>
                  <div className="text-[11px] text-muted-foreground">Tap any service for details</div>
                </div>
                {CATEGORIES.map(({ id, label, Icon }) => {
                  const items = services.filter(s => s.category === id);
                  if (items.length === 0) return null;
                  return (
                    <div key={id} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground pt-2">
                        <Icon size={13} /> {label}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-1.5">
                        {items.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setDetailsFor(s)}
                            className="text-left rounded-lg px-3 py-2 border border-border bg-card hover:border-primary/40 transition-colors flex items-baseline justify-between gap-3"
                          >
                            <span className="text-sm font-medium truncate">{s.name}</span>
                            <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                              {s.credits_cost} {s.credits_cost === 1 ? "cr" : "cr"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] text-muted-foreground pt-2">
                  Spend your monthly credits on any combination of these services. Unused credits roll over while your subscription stays active.
                </p>
              </div>
            </>
          )}

          {/* SCOPE A PROJECT: selectable services with live estimate */}
          {path === "project" && (
          <div className="space-y-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Services
            </div>

            {/* Search */}
            <div className="relative max-w-md mx-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services — e.g. mixing, reels, web, podcast"
                className="pl-9 pr-9 h-10"
              />
              {isSearching && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category pills (hidden while searching across all) */}
            {!isSearching && (
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-1 rounded-full bg-muted/40 p-1 border border-border">
                  {CATEGORIES.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => setActiveCat(id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${activeCat === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isSearching && (
              <div className="text-center text-xs text-muted-foreground">
                {visibleServices.length === 0
                  ? <>No matches for <span className="text-foreground font-medium">"{search}"</span></>
                  : <>{visibleServices.length} {visibleServices.length === 1 ? "match" : "matches"} across {Object.keys(matchCountByCat).length} {Object.keys(matchCountByCat).length === 1 ? "category" : "categories"}</>
                }
              </div>
            )}

            {/* Service chips */}
            <div className="grid sm:grid-cols-2 gap-2 pt-2">
              {visibleServices.map(s => {
                const qty = cart[s.id] ?? 0;
                const active = qty > 0;
                const creditLabel = `${s.credits_cost} ${s.credits_cost === 1 ? "credit" : "credits"}`;
                return (
                  <div
                    key={s.id}
                    onClick={() => addToCart(s)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addToCart(s); } }}
                    className={`relative text-left rounded-xl px-4 py-3 border transition-colors cursor-pointer ${active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
                  >
                    <div className="flex items-baseline justify-between gap-3 pr-7">
                      <span className="text-sm font-medium">
                        {s.name}
                        {isSearching && s.category && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
                            {s.category}
                          </span>
                        )}
                      </span>
                      <span className={`text-xs tabular-nums shrink-0 ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>{creditLabel}</span>
                    </div>
                    {s.min_quantity > 1 && (
                      <p className="text-[11px] text-muted-foreground mt-1">Sold in packs of {s.min_quantity}+</p>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDetailsFor(s); }}
                      aria-label={`See what you get for ${s.name}`}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline underline-offset-2"
                    >
                      <Info size={11} /> See what you get
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDetailsFor(s); }}
                      aria-label={`What this credit includes for ${s.name}`}
                      className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                );
              })}
              {visibleServices.length === 0 && !isSearching && (
                <div className="col-span-full text-center text-sm text-muted-foreground py-6">
                  More services coming to this category soon.
                </div>
              )}
            </div>
          </div>
          )}

          {/* Selected list (à la carte path mainly, but visible always) */}
          {selected.length > 0 && path === "project" && (
            <div className="space-y-2 border-t border-border pt-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Your selection</div>
              {selected.map(s => {
                const qty = cart[s.id] ?? 0;
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3 bg-card">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.credits_cost} {s.credits_cost === 1 ? "credit" : "credits"} each{s.min_quantity > 1 ? ` · min ${s.min_quantity}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeQty(s, -1)}><Minus size={14} /></Button>
                      <div className="w-6 text-center text-sm tabular-nums">{qty}</div>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeQty(s, 1)}><Plus size={14} /></Button>
                      <div className="w-20 text-right text-sm tabular-nums text-muted-foreground">{qty * s.credits_cost} {qty * s.credits_cost === 1 ? "credit" : "credits"}</div>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg p-3 mt-3">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>This is a self-service estimate. Final credit count is confirmed after a quick scoping call — your deposit is refundable within 7 days if scope shifts and you decide not to proceed.</span>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button
              onClick={() => setStep("review")}
              disabled={path === "subscribe" ? !tierSlug : selected.length === 0}
            >
              Continue <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </div>
        </div>
        <ServiceDetailsDialog pkg={detailsFor} onClose={() => setDetailsFor(null)} onAdd={(p) => { addToCart(p); setDetailsFor(null); }} fmt={fmt} />
      </div>
    );
  }

  // ---------- REVIEW ----------
  if (step === "review") {
    const canProceed = contact.name && contact.email && contact.agree;
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PaymentTestModeBanner />
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
          <button onClick={() => setStep("build")} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
          <h1 className="text-2xl md:text-3xl font-semibold">Your details</h1>

          {/* Summary */}
          <div className="border border-border rounded-2xl bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Order summary</div>
              <div className="text-[11px] text-muted-foreground">1 credit = {fmt(CREDIT_VALUE_CENTS)}</div>
            </div>

            {path === "subscribe" && selectedTier && (
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-baseline text-sm">
                  <div>
                    <div className="font-medium">{selectedTier.name} subscription</div>
                    {selectedTier.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">{selectedTier.description}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-medium">{fmt(selectedTier.price_cents)}/mo</div>
                    <div className="text-xs text-muted-foreground">{selectedTier.credits} credits / month</div>
                  </div>
                </div>
                <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Spend credits on any service in the catalog. Unused credits roll over while your subscription stays active.
                </div>
              </div>
            )}

            {path === "project" && (
              <>
                {/* Itemized deliverables */}
                <ul className="divide-y divide-border">
                  {selected.map(s => {
                    const qty = cart[s.id] ?? 0;
                    const lineCredits = qty * s.credits_cost;
                    const lineCents = lineCredits * CREDIT_VALUE_CENTS;
                    return (
                      <li key={s.id} className="px-5 py-3 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{s.name} <span className="text-muted-foreground font-normal">× {qty}</span></div>
                          {s.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
                          )}
                          <div className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                            {qty} × {s.credits_cost} {s.credits_cost === 1 ? "credit" : "credits"} = {lineCredits} {lineCredits === 1 ? "credit" : "credits"}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-medium tabular-nums">{lineCredits}</div>
                          <div className="text-[11px] text-muted-foreground tabular-nums">{fmt(lineCents)}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* Conversion + totals */}
                <div className="px-5 py-4 border-t border-border bg-muted/20 space-y-2">
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-muted-foreground">Total credits</span>
                    <span className="font-medium tabular-nums">{totalCredits} {totalCredits === 1 ? "credit" : "credits"}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-sm">
                    <span className="text-muted-foreground">Conversion ({totalCredits} × {fmt(CREDIT_VALUE_CENTS)})</span>
                    <span className="font-medium tabular-nums">{fmt(estimateCents)}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-base pt-2 border-t border-border">
                    <span className="font-semibold">Estimated total</span>
                    <span className="font-semibold tabular-nums">{fmt(estimateCents)}</span>
                  </div>
                </div>

                {/* Deposit */}
                <div className="px-5 py-3 border-t border-border flex justify-between items-baseline text-sm bg-primary/5">
                  <div>
                    <div className="font-medium">Deposit due today</div>
                    <div className="text-[11px] text-muted-foreground">30% to begin · refundable within 7 days</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold tabular-nums">{fmt(depositCents)}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">balance {fmt(estimateCents - depositCents)} at milestones</div>
                  </div>
                </div>

                {tiers.length > 0 && tierCreditValue && subscriberSavings > 0 && (
                  <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground bg-card">
                    💡 Subscribers on the cheapest qualifying tier would pay about <span className="text-foreground font-medium">{fmt(totalCredits * tierCreditValue)}</span> for the same scope — save {fmt(subscriberSavings)}.
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name *</Label><Input value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Region</Label>
                <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30 w-full min-w-0">
                  {(["North America", "International"] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setContact({ ...contact, region: r })}
                      className={`flex-1 min-w-0 px-2 py-1.5 text-xs sm:text-sm rounded-md transition-colors text-center whitespace-nowrap ${contact.region === r ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >{r === "North America" ? "N. America" : r}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tell us about the project</Label>
              <Textarea
                rows={4}
                value={contact.scope}
                onChange={e => setContact({ ...contact, scope: e.target.value })}
                placeholder="Goals, references, timeline, anything that helps us scope it accurately."
              />
              <p className="text-xs text-muted-foreground">The more detail you share, the more accurate our follow-up estimate will be.</p>
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox checked={contact.agree} onCheckedChange={v => setContact({ ...contact, agree: !!v })} />
              <span>
                {path === "project"
                  ? "I understand this is an initial estimate. The deposit secures the kickoff slot and is refundable within 7 days if we can't agree on scope. Remaining payments are due at agreed milestones. The more detail I share, the more accurate the follow-up estimate will be."
                  : "I understand my subscription renews monthly until I cancel. Unused credits roll over month-to-month while my subscription stays active, and expire if I cancel or my subscription lapses."}
              </span>
            </label>

            <div className="flex justify-end">
              <Button
                onClick={async () => {
                  // Capture as a CRM lead before payment so we keep the contact
                  // even if the visitor abandons checkout.
                  try {
                    await supabase.functions.invoke("submit-public-lead", {
                      body: {
                        source: "start",
                        name: contact.name,
                        email: contact.email,
                        phone: contact.phone || undefined,
                        region: contact.region,
                        message: contact.scope,
                        tags: [path === "subscribe" ? "intent:subscription" : "intent:project"],
                        fields:
                          path === "project"
                            ? {
                                "Total credits": totalCredits,
                                "Estimate": fmt(estimateCents),
                                "Deposit": fmt(depositCents),
                                "Selection": selected
                                  .map((s) => `${s.name} x${cart[s.id]}`)
                                  .join(", "),
                              }
                            : {
                                "Tier": selectedTier?.name,
                                "Monthly": selectedTier
                                  ? `${fmt(selectedTier.price_cents)}/mo`
                                  : undefined,
                              },
                      },
                    });
                  } catch (err) {
                    console.warn("lead capture failed (non-blocking)", err);
                  }
                  // Spark = free pay-as-you-go: skip Stripe checkout
                  if (path === "subscribe" && selectedTier?.price_cents === 0) {
                    window.location.href = "/start.html#/return?free=1";
                    return;
                  }
                  setStep("checkout");
                }}
                disabled={!canProceed}
              >
                {path === "subscribe"
                  ? (selectedTier?.price_cents === 0 ? "Create free account" : "Continue to payment")
                  : `Pay deposit ${fmt(depositCents)}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- CHECKOUT ----------
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">
        <Button variant="outline" size="sm" onClick={() => setStep("review")}>← Back</Button>
        <StripeEmbeddedCheckout
          {...(path === "subscribe"
            ? { subscriptionSlug: selectedTier?.slug ?? undefined }
            : { depositCents: depositCents })}
          customerEmail={contact.email}
          customerName={contact.name}
          customerPhone={contact.phone || undefined}
          customerCountry={undefined}
          message={
            path === "project"
              ? `Estimate: ${totalCredits} credits / ${fmt(estimateCents)}. Selection: ${selected.map(s => `${s.name} x${cart[s.id]}`).join(", ")}. Scope: ${contact.scope}`
              : contact.scope
          }
          returnUrl={`${window.location.origin}/start.html#/return?session_id={CHECKOUT_SESSION_ID}`}
        />
      </div>
    </div>
  );
}

function ServiceDetailsDialog({
  pkg,
  onClose,
  onAdd,
  fmt,
}: {
  pkg: Pkg | null;
  onClose: () => void;
  onAdd: (p: Pkg) => void;
  fmt: (c: number) => string;
}) {
  const open = !!pkg;
  const detail = pkg ? SERVICE_DETAILS[pkg.slug] : undefined;
  const examples = pkg ? SERVICE_EXAMPLES[pkg.slug] : undefined;
  const projectsHref = pkg?.category ? `/projects.html#${pkg.category}` : "/projects.html";
  const creditLabel = pkg ? `${pkg.credits_cost} ${pkg.credits_cost === 1 ? "credit" : "credits"}` : "";
  const dollarLabel = pkg ? fmt(pkg.credits_cost * CREDIT_VALUE_CENTS) : "";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        {pkg && (
          <>
            <DialogHeader>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{pkg.category}</div>
              <DialogTitle className="text-xl">{pkg.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                  {creditLabel} · {dollarLabel}
                </span>
                {pkg.min_quantity > 1 && (
                  <span className="text-xs text-muted-foreground">Sold in packs of {pkg.min_quantity}+</span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-2 text-sm">
              {detail && (
                <Section label="Turnaround">
                  <p className="text-muted-foreground">{detail.turnaround}</p>
                </Section>
              )}

              {examples && examples.length > 0 && (
                <Section label="Recent work">
                  <div className="grid grid-cols-3 gap-2">
                    {examples.map((ex, i) => {
                      return <RecentWorkCard key={i} ex={ex} />;
                    })}
                  </div>
                  <a
                    href={projectsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-primary hover:underline underline-offset-4"
                  >
                    See more in our work <ExternalLink size={11} />
                  </a>
                </Section>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-4 border-t border-border">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => onAdd(pkg)}>Add to estimate</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-medium">{label}</div>
      {children}
    </div>
  );
}

function RecentWorkCard({ ex }: { ex: ServiceExample }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hostLabel = useMemo(() => {
    if (!ex.href) return null;
    try {
      const h = new URL(ex.href, window.location.origin).hostname.replace(/^www\./, "");
      if (h.includes("youtube") || h.includes("youtu.be")) return "YouTube";
      if (h.includes("instagram")) return "Instagram";
      if (h.includes("spotify")) return "Spotify";
      if (h.includes("music.apple")) return "Apple Music";
      if (h.includes("soundcloud")) return "SoundCloud";
      if (h.includes("rhozeland")) return "Rhozeland";
      return h;
    } catch {
      return null;
    }
  }, [ex.href]);

  const handleEnter = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  };
  const handleLeave = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    try { v.currentTime = 0; } catch {}
  };

  const Wrap: any = ex.href ? "a" : "div";
  const wrapProps = ex.href ? { href: ex.href, target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <Wrap
      {...wrapProps}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="group relative block overflow-hidden rounded-lg border border-border bg-muted/40 hover:border-primary/40 transition-colors"
      title={ex.href ? `Opens ${hostLabel ?? "external link"} in a new tab` : undefined}
    >
      {ex.thumb && (
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={ex.thumb}
            alt={`${ex.title} — ${ex.artist}`}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {ex.video && (
            <video
              ref={videoRef}
              src={ex.video}
              muted
              playsInline
              loop
              preload="none"
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            />
          )}
          {ex.href && (
            <div className="pointer-events-none absolute inset-0 flex items-end justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="m-1.5 inline-flex items-center gap-1 rounded-full bg-background/90 backdrop-blur-sm border border-border px-1.5 py-0.5 text-[9px] font-medium text-foreground shadow-sm">
                {ex.video ? <Play size={9} className="fill-current" /> : <ExternalLink size={9} />}
                <span>{hostLabel ?? "Open"}</span>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="px-2 py-1.5">
        <div className="text-[11px] font-medium leading-tight truncate">{ex.title}</div>
        <div className="text-[10px] text-muted-foreground truncate">{ex.artist}</div>
      </div>
    </Wrap>
  );
}
