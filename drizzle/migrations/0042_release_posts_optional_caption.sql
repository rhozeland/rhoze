DO $$ DECLARE c text; BEGIN
  SELECT conname INTO c FROM pg_constraint WHERE conrelid='public.release_posts'::regclass AND pg_get_constraintdef(oid) LIKE '%char_length(body) >= 1%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.release_posts DROP CONSTRAINT %I', c); END IF;
END $$;
ALTER TABLE public.release_posts ALTER COLUMN body SET DEFAULT '';
ALTER TABLE public.release_posts ADD CONSTRAINT release_posts_body_or_media CHECK (char_length(body) <= 5000 AND (char_length(body) >= 1 OR media_path IS NOT NULL OR link_url IS NOT NULL));