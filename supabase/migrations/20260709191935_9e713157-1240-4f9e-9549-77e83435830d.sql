CREATE TABLE public.news_ticker_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  headline text NOT NULL,
  href text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.news_ticker_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news_ticker_items TO authenticated;
GRANT ALL ON public.news_ticker_items TO service_role;

ALTER TABLE public.news_ticker_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active news ticker items"
  ON public.news_ticker_items FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert news ticker items"
  ON public.news_ticker_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update news ticker items"
  ON public.news_ticker_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete news ticker items"
  ON public.news_ticker_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER news_ticker_items_updated_at
  BEFORE UPDATE ON public.news_ticker_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.news_ticker_items (label, headline, href, sort_order) VALUES
  ('New Release', 'Cozal — "Sefra" music video out now', 'https://www.youtube.com/watch?v=WLpDRh8JsxY', 10),
  ('Podcast', 'Rhoze Podcast Ep. 6 · Ooak & Michael', 'https://www.youtube.com/@Rhozeland', 20),
  ('Exhibition', 'Indoléstic · Server Incognito at Vector Festival', 'https://vectorfestival.org/window-activation', 30),
  ('Hackathon', 'Submitted to Solana Coliseum Frontier', '/about.html', 40),
  ('Release', 'Cozal — "Holy Water" music video out now', 'https://www.youtube.com/watch?v=VPLyATcs7fE', 50),
  ('Community', 'Weekly leaderboard snapshot live', '/leaderboard.html', 60);