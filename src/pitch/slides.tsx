import type { ReactNode } from "react";
import home from "@/assets/pitch/homepage.asset.json";
import directory from "@/assets/pitch/directory.asset.json";
import discover from "@/assets/pitch/discover-framed.asset.json";
import idea from "@/assets/pitch/create.asset.json";
import scope from "@/assets/pitch/scope.asset.json";
import workspace from "@/assets/pitch/workspace.asset.json";
import exclusive from "@/assets/pitch/exclusive-board.asset.json";

export type Slide = { id: string; title: string; notes: string; content: ReactNode; theme?: string };
const art = (name: string) => `/images/${name}.webp`;
const capture = (asset: { url: string }) => location.hostname === "localhost" ? new URL(asset.url, "https://rhoze.lovable.app").href : asset.url;
const work = [
  { name: "Mansa Musa", creator: "MONEE FINGAZ", image: "fingaz-mansa-musa-thumb" },
  { name: "Holy Water", creator: "COZAL", image: "cozal-holy-water-thumb" },
  { name: "Portrait series", creator: "YOUNG $TEELO", image: "steelo-photoshoot-2" },
  { name: "Saint Flair West", creator: "OOAK", image: "ooak-saint-flair-west-thumb" },
];

export const slides: Slide[] = [
  {
    id: "rhozeland", title: "Rhozeland — A creator-owned content house", theme: "dark",
    notes: "Rhozeland is a working creative studio building a practical platform for artists, brands and the people who support them. We start with real production, not a token sale. This deck reflects the October 12, 2026 submission build; planned features are marked explicitly.",
    content: <><div className="cover-copy"><span className="slide-label">Studio → Platform</span><h1 className="slide-title-lg">Rhozeland.</h1><h2 className="slide-subtitle rose-text" style={{ marginTop: 24 }}>A creator-owned<br />content house.</h2><p className="slide-body">Shoot. Produce. Launch.<br />A practical home for making work together.</p><p className="slide-caption muted-text">Colosseum submission · October 2026<br />Toronto & beyond</p></div><div className="cover-work"><figure><img src={art(work[0].image)} alt="MONEE FINGAZ — Mansa Musa" /></figure><figure><img src={art(work[1].image)} alt="COZAL — Holy Water" /></figure><figure><img src={art(work[3].image)} alt="OOAK — Saint Flair West" /></figure></div></>,
  },
  {
    id: "working-studio", title: "Built from a working studio",
    notes: "The studio is the starting point. These are actual selected creative works from the Rhozeland portfolio, not customer acquisition figures or evidence of platform revenue. The platform grows out of the coordination problems we experience in production.",
    content: <><span className="slide-kicker">Our starting point</span><h2 className="slide-title slide-heading" style={{ marginTop: 20 }}>We already make the work.</h2><div className="work-grid">{work.map(w => <figure key={w.name}><img src={art(w.image)} alt={`${w.name} by ${w.creator}`} /><figcaption className="slide-caption">{w.name}<small>{w.creator}</small></figcaption></figure>)}</div><div className="work-statement"><p className="slide-body-lg">Music, visuals and brand production.<br />Now bringing the people, plan and release into one place.</p><span className="slide-label">Real work. Real starting point.</span></div></>,
  },
  {
    id: "problem", title: "Making the work is only half the job",
    notes: "The pain is coordination: the brief, finding collaborators, setting scope and budget, tracking deliverables, and keeping supporters close to the process. We are not claiming to solve fundraising or replace every production tool.",
    content: <><div className="problem-layout"><div><span className="slide-kicker">The production problem</span><h2 className="slide-title" style={{ marginTop: 22 }}>Good ideas.<br />Scattered process.</h2><div className="editorial-rows"><div className="editorial-row"><b>01</b><div><strong>The brief gets lost.</strong><p>Ideas, scope and expectations live in separate conversations.</p></div></div><div className="editorial-row"><b>02</b><div><strong>The right team is hard to find.</strong><p>Finding a creator is not the same as getting a project made.</p></div></div><div className="editorial-row"><b>03</b><div><strong>Fans only see the finish.</strong><p>The process and the people behind the release stay out of view.</p></div></div></div></div><img src={art("timeline-2023")} alt="Rhozeland studio production" /></div></>,
  },
  {
    id: "platform", title: "One place to create, collaborate and release", theme: "wash",
    notes: "The live public website connects project creation, discovery, public creator profiles and published releases. The practical studio relationship remains central. A supporter path sits alongside creation rather than turning every project into a crowdfunding campaign.",
    content: <><div className="product-split"><div><span className="status-dot">Live website</span><h2 className="slide-title">From idea<br />to release.</h2><p className="slide-body-lg">A project is the centre.<br />Not another social feed.</p><div className="steps-list"><div><b>01</b><span>Create a focused brief.</span></div><div><b>02</b><span>Choose who makes it.</span></div><div><b>03</b><span>Manage the work.</span></div><div><b>04</b><span>Publish and share.</span></div></div><p className="side-note">Live homepage capture.<br />Coin purchases are external—not project payments.</p></div><img className="screen-fit" src={capture(home)} alt="Rhozeland live homepage with project artwork and creator flow" /></div></>,
  },
  {
    id: "create", title: "A shared four-step project flow",
    notes: "Artists and brands use the same four steps. Idea captures the brief and description with optional AI assistance. Scope sets a budget or records that a quote is needed. Makers selects Rhozeland, your own team, or open roles. Review checks the roadmap and optional coin before publishing. This slide uses the real empty form, not a fabricated project.",
    content: <><div className="product-split"><div><span className="status-dot">Live creator flow</span><h2 className="slide-title">Start small.<br />Make it real.</h2><div className="steps-list"><div><b>01</b><span><strong>Idea</strong><br />Brief + description</span></div><div><b>02</b><span><strong>Scope</strong><br />Budget or quote request</span></div><div><b>03</b><span><strong>Makers</strong><br />Rhozeland, own team or roles</span></div><div><b>04</b><span><strong>Review</strong><br />Roadmap + publish</span></div></div><p className="side-note">AI helps write the brief and roadmap.<br />A coin is optional, not the starting point.</p></div><div className="create-screen"><img src={idea.url} alt="Actual step one of the Rhozeland project wizard" /><img src={scope.url} alt="Actual scope step with need-a-quote option" /></div></div></>,
  },
  {
    id: "workspace", title: "The work behind the release",
    notes: "This is an actual signed-in owner workspace from an existing project. We verified Save plan and readback after refresh without changing the plan. The current tabs are Overview, Plan, Team & chat, and Money. Team & chat links to Messages; it is not an embedded collaborative chat room. The workspace is owner-only today. Dedicated Files and collaborator access are future work. Public visibility controls exist, but full field-level privacy enforcement has not been independently audited in this submission package.",
    content: <><span className="status-dot">Live owner workspace · signed-in capture</span><h2 className="slide-title slide-heading">A plan you can work from.</h2><div className="workspace-layout"><img className="workspace-screen" src={workspace.url} alt="Actual owner plan with editable milestones and Save plan" /><div className="workspace-notes"><div><strong>Overview + Plan</strong><p>Project details, deliverables, milestone amounts and completion.</p></div><div><strong>Team & chat</strong><p>Choose makers, list roles and open Messages.</p></div><div><strong>Money</strong><p>Edit the budget split and attach an existing coin.</p></div><p className="side-note">Owner-only today.<br />Save + reload verified.<br />Collaborator access and a dedicated Files tab are next.</p></div></div></>,
  },
  {
    id: "discover", title: "Discover the people and the projects", theme: "wash",
    notes: "Discover is a real drag-to-spin, gently rotating globe with project and creator pins and a filterable release feed. Pin positions currently use a Toronto fallback rather than verified global locations, so we do not claim a geographically accurate international network. Project cards open the shared release pop-up.",
    content: <><div className="full-product"><div><span className="status-dot">Live Discover</span><h2 className="slide-title">A window<br />into the work.</h2><p className="slide-body-lg">Creators and projects.<br />One shared discovery space.</p><div className="editorial-rows"><div className="editorial-row"><b>↗</b><p>Spin the globe and select a project or creator.</p></div><div className="editorial-row"><b>↗</b><p>Filter by music, film, art, fashion and brand campaigns.</p></div><div className="editorial-row"><b>↗</b><p>Open a release without losing your place.</p></div></div><p className="side-note">Current pin locations use a Toronto fallback.<br />Screenshot: live projects, not audience metrics.</p></div><img className="screen-fit" src={discover.url} alt="Current Rhozeland Discover globe and six published projects" /></div></>,
  },
  {
    id: "creators", title: "Find a person, not just a profile",
    notes: "The public creator directory supports category and name search, profile pages, rates, samples, links, invitations and messages. The screenshot visibly includes sample profiles: their ratings and project counts are sample content, not platform traction. Public discovery is separated from private account and payroll data.",
    content: <><div className="full-product"><div><span className="status-dot">Live public directory</span><h2 className="slide-title">Find the<br />right maker.</h2><p className="slide-body-lg">Browse the work.<br />Start a conversation.<br />Build the team.</p><div className="editorial-rows"><div className="editorial-row"><b>01</b><p>Search by name and discipline.</p></div><div className="editorial-row"><b>02</b><p>Review samples, rates and profiles.</p></div><div className="editorial-row"><b>03</b><p>Invite, message or apply to an open role.</p></div></div><p className="side-note">Directory includes clearly labelled sample profiles.<br />Sample ratings are not traction.</p></div><img className="screen-fit" src={directory.url} alt="Live creator directory, including profiles visibly marked sample" /></div></>,
  },
  {
    id: "supporters", title: "Let supporters into the process",
    notes: "Supporters can like published projects and access holder-only content for releases with an attached Solana token. This screenshot shows the real locked mood board. We do not simulate a connected holder wallet or claim an unlocked feed was tested with a funded wallet. The supporter home also contains liked projects, wallet holdings and rewards; the account used for this package is still at profile onboarding, so those personalised views are not presented as verified screenshots.",
    content: <><div className="full-product"><div><span className="status-dot">Live locked Exclusive feed</span><h2 className="slide-title">Closer to<br />the process.</h2><p className="slide-body-lg">Follow the project.<br />See the work take shape.</p><div className="editorial-rows"><div className="editorial-row"><b>♡</b><p>Like projects and keep a personal collection.</p></div><div className="editorial-row"><b>↗</b><p>Open holder-only updates, media and creator-shared files.</p></div><div className="editorial-row"><b>✓</b><p>Earn recorded rewards for contributing.</p></div></div><p className="side-note">Actual locked state shown.<br />Coin purchases happen externally on Pump.fun.<br />No fundraising totals claimed.</p></div><img className="screen-fit" src={exclusive.url} alt="Actual locked Rhozeland Exclusive mood board showing public artwork and holder-only teasers" /></div></>,
  },
  {
    id: "solana", title: "Solana is the access layer", theme: "dark",
    notes: "The implementation uses real Phantom and Solflare wallet adapters. A signed message proves control of the wallet; the server verifies the signature and timestamp and checks the SPL token balance before returning private posts and signed media links. Signing the message moves no funds. This is source-verified implementation; a real funded-holder wallet signature journey is not part of the verified captures. Coin trades are handled by Pump.fun. The app does not automatically distribute project funds or reward tokens.",
    content: <><span className="slide-kicker">Why Solana</span><h2 className="slide-title" style={{ marginTop: 25 }}>A wallet opens the door.<br /><span className="rose-text">It doesn't replace the studio.</span></h2><div className="solana-flow"><div className="solana-node"><div className="node-num">01</div><h3>Connect</h3><p>Phantom or Solflare.<br />An existing project token lives in the supporter's wallet.</p></div><div className="solana-node"><div className="node-num">02</div><h3>Prove ownership</h3><p>Sign a free message.<br />The server verifies the signature and checks the token balance.</p></div><div className="solana-node"><div className="node-num">03</div><h3>Access the work</h3><p>Eligible holders receive private updates and temporary media links.</p></div></div><div className="solana-bottom"><p className="slide-caption muted-text">Mainnet balance reads + signature-gated access are implemented.<br />No automatic payouts, token transfers or escrow in this project flow.</p><div className="token-lockup"><img src="/images/logo-color.webp" alt="Rhozeland cube" />$RHOZE</div></div></>,
  },
  {
    id: "rewards", title: "Reward participation, not speculation", theme: "rose",
    notes: "These are the configured platform reward amounts, not user balances or token payouts: 500 for publishing, 25 for liking, and 100 for a role application. Awards are inserted by database triggers with one award per user/action/reference. Rewards are an internal ledger today; cash value, discounts, redemption and wallet withdrawal are not live. No incentive yield or investment claim is being made.",
    content: <><span className="slide-kicker">Platform rewards · implemented ledger</span><h2 className="slide-title" style={{ marginTop: 26 }}>Doing things counts.</h2><p className="slide-body-lg" style={{ marginTop: 25 }}>A record of contribution to the creative community.</p><div className="reward-grid"><div><div className="reward-number">500</div><div className="reward-unit">$RHOZE reward units</div><h3>Publish a release</h3><p>Bring a project into the public catalogue.</p></div><div><div className="reward-number">25</div><div className="reward-unit">$RHOZE reward units</div><h3>Like a project</h3><p>Show up for work you want to follow.</p></div><div><div className="reward-number">100</div><div className="reward-unit">$RHOZE reward units</div><h3>Apply to a role</h3><p>Offer your skills to a project team.</p></div></div><div className="reward-note"><p className="slide-body">Recorded automatically, once per qualifying action.<br /><strong>Internal rewards today. Not on-chain tokens or cash.</strong></p><span className="slide-label">Discounts + withdrawals: planned</span></div></>,
  },
  {
    id: "business", title: "The studio is the business",
    notes: "The current commercial starting point is the traditional agency/studio relationship: scoped work, quotes or estimates, invoices and deposits. No rates, revenue or margin figures are claimed here. The current project wizard can record a quote request and choose Rhozeland as maker, but that selection does not yet create an end-to-end production order or checkout. Integrated quote approval, deposits, milestones and final payments are next. Schools, subscriptions and token-based discounts are exploratory, not existing revenue streams.",
    content: <><span className="slide-kicker">Business model</span><h2 className="slide-title" style={{ marginTop: 25 }}>Production first.<br />Platform around it.</h2><div className="business-grid"><div className="business-col"><span className="tag">Existing studio model</span><h3>Paid creative work.</h3><p>Recording, visual production, creative direction and brand projects.</p><p>Scope → quote → invoice → deposit.<br />A familiar studio relationship.</p><div className="business-image"><img src={art("timeline-2023")} alt="Rhozeland studio" /><p>The platform helps organise the work around that relationship.</p></div></div><div className="business-col next"><span className="tag">Next product layer</span><h3>Bring approval and payment in.</h3><p>Request Rhozeland as producer.<br />Approve a quote.<br />Pay a deposit and milestones.</p><p className="muted-text">Not live end-to-end yet.</p><p className="side-note">Schools, subscriptions and reward discounts remain future experiments—not current revenue.</p></div></div></>,
  },
  {
    id: "team", title: "The people behind the work",
    notes: "These are the four core team members and the roles supplied in Rhozeland's brand records. We do not assign founder titles, engineering credentials, hours worked or employment status beyond the verified roles. The team's actual time commitment, legal status and funding history must be answered by the team in the submission form.",
    content: <><span className="slide-kicker">The team</span><h2 className="slide-title" style={{ marginTop: 25 }}>People who make things.</h2><div className="team-grid">{[
      ["Michael Lé", "Visual Specialist", "Indoléstic", "team-michael"],
      ["Marvin Ceron", "Creative Lead", "MARV", "team-marvin"],
      ["David Migueles", "Sound Specialist", "Straightdizzy", "team-david"],
      ["Daniel Charles", "Full Stack Developer", "", "team-daniel"],
    ].map(([name,role,alias,img]) => <figure key={name}><img src={art(img)} alt={name} /><figcaption>{name}<small>{role}</small>{alias && <small>Also known as {alias}</small>}</figcaption></figure>)}</div><p className="slide-body team-brief">Production experience and a live software build.<br />The same people, connected by the same creative process.</p></>,
  },
  {
    id: "next", title: "Make the next project here", theme: "dark",
    notes: "The next priorities are deliberate: quote approval and project payments; collaborator permissions and project files; then education and rewards redemption experiments. Those are future milestones, not promises of shipped functionality. End on the real live website, invitation to create, and official contact. No user or funding numbers are invented.",
    content: <><div className="closing-top"><div><span className="slide-kicker">The next chapter</span><h2 className="slide-title" style={{ marginTop: 28 }}>Make the next<br />project here.</h2><p className="slide-body-lg" style={{ marginTop: 26 }}>A working studio becoming a shared home<br />for creators and supporters.</p></div><img className="closing-logo" src="/images/logo-white.webp" alt="Rhozeland cube logo" /></div><div className="roadmap-strip"><div><b>LIVE BUILD</b><h3>Create + discover</h3><p>Briefs, public projects, creators, owner plans and holder access.</p></div><div><b>NEXT</b><h3>Approve + produce</h3><p>Quotes, deposits, collaborator access and project files.</p></div><div><b>LATER · EXPLORATORY</b><h3>Learn + redeem</h3><p>Creator schools, subscriptions and reward redemption.</p></div></div><div className="closing-links"><a href="https://rhozeland.com" target="_blank" rel="noreferrer">rhozeland.com ↗</a><a href="mailto:collab@rhozeland.com">collab@rhozeland.com</a></div></>,
  },
];

export function SlideLayout({ slide, index }: { slide: Slide; index: number }) {
  const isDark = slide.theme === "dark";
  return <article className={`slide-content ${slide.theme || ""}`} aria-label={`Slide ${index + 1}: ${slide.title}`}>
    <header className="slide-mast"><div className="slide-lockup"><img src={`/images/logo-${isDark ? "white" : "black"}.webp`} alt="" />Rhozeland</div><span className="slide-chrome">CREATIVE STUDIO / CREATOR PLATFORM</span></header>
    {slide.content}
    <footer className="slide-foot"><span>RHOZELAND · COLOSSEUM 2026</span><span>rhozeland.com</span><span>{String(index + 1).padStart(2,"0")} / {slides.length}</span></footer>
  </article>;
}