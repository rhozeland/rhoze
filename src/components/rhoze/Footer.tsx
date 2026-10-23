import ThemeToggle from '@/components/ThemeToggle';

const Footer = () => {
  return (
    <footer className="site-footer py-8 px-6 border-t border-border">
      <div className="container mx-auto max-w-6xl flex flex-wrap gap-4 items-center justify-between">
        <p className="text-sm text-muted-foreground font-body">
          © {new Date().getFullYear()} Rhozeland. All rights reserved.
        </p>
        <div className="flex flex-wrap items-center gap-6">
          <a
            href="/team.html#/portal"
            className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors font-body"
            title="Portal"
          >
            Portal
          </a>
          {[["/discover.html","Discover"],["/create.html","Create"],["/rewards","Rewards"],["/about.html","Our story"],["/waitlist","Join the waitlist"],["mailto:collab@rhozeland.com","Project inquiries"]].map(([href,label])=><a key={href} href={href} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-body">{label}</a>)}
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
};

export default Footer;