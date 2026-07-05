CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.live_dashboard_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_dashboard_content_section_key_format CHECK (section_key ~ '^[a-z0-9_]+$'),
  CONSTRAINT live_dashboard_content_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

GRANT SELECT ON public.live_dashboard_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.live_dashboard_content TO authenticated;
GRANT ALL ON public.live_dashboard_content TO service_role;

ALTER TABLE public.live_dashboard_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published live content is public"
ON public.live_dashboard_content
FOR SELECT
TO anon, authenticated
USING (is_published = true OR public.is_team_member(auth.uid()));

CREATE POLICY "Team can create live content"
ON public.live_dashboard_content
FOR INSERT
TO authenticated
WITH CHECK (public.is_team_member(auth.uid()));

CREATE POLICY "Team can update live content"
ON public.live_dashboard_content
FOR UPDATE
TO authenticated
USING (public.is_team_member(auth.uid()))
WITH CHECK (public.is_team_member(auth.uid()));

CREATE POLICY "Admins can delete live content"
ON public.live_dashboard_content
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_live_dashboard_content_updated_at
BEFORE UPDATE ON public.live_dashboard_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.live_dashboard_content (section_key, title, payload, is_published)
VALUES
('project_spotlight', 'Project Spotlight', '{
  "rotationSeconds": 7,
  "items": [
    {"title":"Sefra", "artist":"Cozal", "tag":"Music Video", "image":"/images/cozal-sefra-thumb.jpg", "video":"/videos/cozal-sefra.mp4"},
    {"title":"Just Call Me", "artist":"Ess B", "tag":"Single", "image":"/images/ess-b-just-call-me-thumb.webp"},
    {"title":"The Mask", "artist":"Ooak", "tag":"Release", "image":"/images/ooak-the-mask-thumb.webp"},
    {"title":"Mansa Musa", "artist":"Monee Fingaz", "tag":"Release", "image":"/images/fingaz-mansa-musa-thumb.webp"},
    {"title":"Feel Like Superhero", "artist":"Monee Fingaz", "tag":"Single", "image":"/images/fingaz-superhero-thumb.webp"},
    {"title":"Holy Water", "artist":"Cozal", "tag":"Release", "image":"/images/cozal-holy-water-thumb.webp"},
    {"title":"United MMA", "artist":"BK Whiskey", "tag":"Sponsorship", "image":"/images/bk-whiskey-mma-thumb.webp"},
    {"title":"Telephone", "artist":"Runner’s Club", "tag":"Release", "image":"/images/rc1-thumb.webp"}
  ]
}'::jsonb, true),
('social_feed', 'Social Feed', '{
  "showImages": false,
  "handles": {"x":"@rhozeland", "linkedin":"Rhozeland", "instagram":"@rhozeland"},
  "fallbackPosts": [
    {"who":"@rhozeland", "platform":"X", "time":"live", "message":"New release week — Sefra by Cozal is live on YouTube. Tap in.", "hot":true},
    {"who":"Rhozeland", "platform":"LI", "time":"today", "message":"Building the operating system for independent artists — recording, video, launch, rights, rewards."},
    {"who":"@rhozeland", "platform":"IG", "time":"1h", "message":"Behind the scenes from the latest creator sessions and Toy Box fittings."},
    {"who":"@rhozeland", "platform":"X", "time":"3h", "message":"$RHOZE supply is locked. Creator economy, transparent by default."}
  ]
}'::jsonb, true),
('did_you_know', 'Did You Know', '{
  "items": [
    {"category":"Ecosystem", "text":"Rhozeland is a creator-owned ecosystem — recording, content, and launch infrastructure for independent artists, all under one roof."},
    {"category":"Token", "text":"$RHOZE is designed around community participation: raids, memes, threads, videos, drops, and verified creator activity."},
    {"category":"Studio", "text":"The network covers recording, production, A&R, visuals, merch, and launch support — not just one lane."},
    {"category":"Team", "text":"Core team spans engineering, direction, A&R, video, community, design, and operations."},
    {"category":"Contact", "text":"For collabs, sponsorships, or sessions: collab@rhozeland.com."}
  ]
}'::jsonb, true),
('broadcast_schedule', 'Broadcast Schedule', '{
  "timezone":"UTC",
  "items": [
    {"day":"SUN", "title":"New Release · Video", "time":"20:00 UTC"},
    {"day":"MON", "title":"89-32 Podcast · Live", "time":"18:00 UTC"},
    {"day":"TUE", "title":"Artist Sessions", "time":"19:00 UTC"},
    {"day":"WED", "title":"Studio Stream", "time":"22:00 UTC"},
    {"day":"THU", "title":"Angry Mortgage", "time":"20:00 UTC"},
    {"day":"FRI", "title":"Raid · $RHOZE", "time":"17:00 UTC"}
  ]
}'::jsonb, true),
('clothing_rail', 'Clothing Rail', '{
  "eyebrow":"Toy Box · SS 26",
  "headline":"Wear the Ecosystem",
  "description":"Real people. Real fits. Rhozeland in-house apparel — built for the creator economy.",
  "cta":"Drop coming soon",
  "items": [
    {"name":"Editorial Fit", "price":"SS26", "type":"video", "src":"/__l5e/assets-v1/90b14679-dba6-4ff7-97a4-fccc9bdb91cd/fashion-ad.mp4", "tag":"Editorial"},
    {"name":"Toy Box Jacket", "price":"Preview", "type":"image", "src":"/__l5e/assets-v1/90b14679-dba6-4ff7-97a4-fccc9bdb91cd/woman-jacket.jpg", "tag":"Lookbook"},
    {"name":"Rhoze Hoodie", "price":"Preview", "type":"image", "src":"/__l5e/assets-v1/90b14679-dba6-4ff7-97a4-fccc9bdb91cd/woman-hoodie.jpg", "tag":"Lookbook"},
    {"name":"Street Set", "price":"Preview", "type":"image", "src":"/__l5e/assets-v1/90b14679-dba6-4ff7-97a4-fccc9bdb91cd/two-women.jpg", "tag":"Editorial"},
    {"name":"Drop Visual", "price":"Motion", "type":"video", "src":"/__l5e/assets-v1/90b14679-dba6-4ff7-97a4-fccc9bdb91cd/two-women.mp4", "tag":"Motion"}
  ]
}'::jsonb, true),
('latest_wire', 'Latest Wire', '{
  "items": [
    "Sefra by Cozal is live now on YouTube",
    "$RHOZE market data updates every 30 seconds",
    "Toy Box clothing lookbook in production",
    "Studio sessions booking through collab@rhozeland.com",
    "Weekly leaderboard snapshot published",
    "New artist spotlight rotates live across the broadcast"
  ]
}'::jsonb, true),
('app_panel', 'App Panel', '{
  "eyebrow":"Creator OS · Rhozeland App",
  "title":"Own Your Sound",
  "description":"The operating system for independent artists — verify IP, attach a creator coin, and back the artists you love.",
  "qrUrl":"https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=https%3A%2F%2Frhozeland.com%2Fstart",
  "qrCaption":"Scan to open",
  "socials":[
    {"label":"X", "url":"https://x.com/rhozeland"},
    {"label":"IG", "url":"https://instagram.com/rhozeland"},
    {"label":"LI", "url":"https://linkedin.com/company/rhozeland"},
    {"label":"YT", "url":"https://youtube.com/@rhozeland"},
    {"label":"TT", "url":"https://tiktok.com/@rhozeland"}
  ]
}'::jsonb, true)
ON CONFLICT (section_key) DO UPDATE
SET title = EXCLUDED.title,
    payload = EXCLUDED.payload,
    is_published = EXCLUDED.is_published,
    updated_at = now();