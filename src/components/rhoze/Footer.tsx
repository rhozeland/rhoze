const Footer = () => {
  return (
    <footer className="py-12 px-6 border-t border-border">
      <div className="container mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-gradient-mint" />
          <span className="font-display text-lg font-medium text-foreground">Rhozeland</span>
        </div>
        <p className="text-sm text-muted-foreground font-body">
          © {new Date().getFullYear()} Rhozeland. All rights reserved.
        </p>
        <div className="flex items-center gap-6">
          <a
            href="https://dexscreener.com/solana/c4rrvr1gcneeyhwa6masbgycky7671rq3x4yfegm4rmf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors font-body"
          >
            DexScreener
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
