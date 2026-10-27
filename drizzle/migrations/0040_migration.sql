alter table public.release_posts add column if not exists visibility text not null default 'holders';
alter table public.release_posts add column if not exists link_url text;
alter table public.release_posts drop constraint if exists release_posts_visibility_chk;
alter table public.release_posts add constraint release_posts_visibility_chk check (visibility in ('holders','public'));
alter table public.release_posts drop constraint if exists release_posts_link_chk;
alter table public.release_posts add constraint release_posts_link_chk check (link_url is null or (link_url ~* '^https://' and length(link_url) <= 600));
grant update (visibility) on public.release_posts to authenticated;
drop policy if exists "Owner updates post visibility" on public.release_posts;
create policy "Owner updates post visibility" on public.release_posts for update to authenticated
  using (exists (select 1 from public.releases r where r.id = release_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.releases r where r.id = release_id and r.user_id = auth.uid()));

-- Public teasers: only posts the owner marked public on published projects.
create or replace function public.release_public_posts(p_slug text)
returns table(id uuid, body text, media_path text, media_kind text, link_url text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.body, p.media_path, p.media_kind, p.link_url, p.created_at
  from public.release_posts p join public.releases r on r.id = p.release_id
  where r.slug = p_slug and r.status = 'published' and p.visibility = 'public'
  order by p.created_at desc limit 24;
$$;
grant execute on function public.release_public_posts(text) to anon, authenticated;

drop policy if exists "Anyone reads public teaser media" on storage.objects;
create policy "Anyone reads public teaser media" on storage.objects for select to anon, authenticated
  using (bucket_id = 'release-posts' and exists (
    select 1 from public.release_posts p join public.releases r on r.id = p.release_id
    where p.media_path = objects.name and p.visibility = 'public' and r.status = 'published'));