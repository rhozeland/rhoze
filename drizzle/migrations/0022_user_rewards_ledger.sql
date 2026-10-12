-- $RHOZE rewards for public accounts (separate from team-portal rhoze_balances/rhoze_ledger)

create table if not exists public.user_rewards_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  amount bigint not null,
  ref_id uuid,
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);

create index if not exists idx_user_rewards_ledger_user on public.user_rewards_ledger (user_id, created_at desc);

grant select on public.user_rewards_ledger to authenticated;
grant all on public.user_rewards_ledger to service_role;

alter table public.user_rewards_ledger enable row level security;

create policy "Users read own reward entries"
  on public.user_rewards_ledger for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.rz_reward_amount(p_kind text)
returns bigint
language sql
immutable
set search_path = public
as $$
  select case p_kind
    when 'release_published' then 500::bigint
    when 'project_like' then 25::bigint
    when 'role_application' then 100::bigint
    else 0::bigint
  end;
$$;

create or replace function public.rz_award_release_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') and new.user_id is not null then
    insert into public.user_rewards_ledger (user_id, kind, amount, ref_id, reason)
    values (new.user_id, 'release_published', public.rz_reward_amount('release_published'), new.id, 'Release published')
    on conflict (user_id, kind, ref_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rz_award_release_published on public.releases;
create trigger trg_rz_award_release_published
  after update on public.releases
  for each row
  execute function public.rz_award_release_published();

create or replace function public.rz_award_project_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_rewards_ledger (user_id, kind, amount, ref_id, reason)
  values (new.user_id, 'project_like', public.rz_reward_amount('project_like'), new.release_id, 'Liked a project')
  on conflict (user_id, kind, ref_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_rz_award_project_like on public.project_likes;
create trigger trg_rz_award_project_like
  after insert on public.project_likes
  for each row
  execute function public.rz_award_project_like();

create or replace function public.rz_award_role_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.applicant_user_id is not null then
    insert into public.user_rewards_ledger (user_id, kind, amount, ref_id, reason)
    values (new.applicant_user_id, 'role_application', public.rz_reward_amount('role_application'), new.id, 'Submitted a role application')
    on conflict (user_id, kind, ref_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rz_award_role_application on public.release_applications;
create trigger trg_rz_award_role_application
  after insert on public.release_applications
  for each row
  execute function public.rz_award_role_application();

create or replace function public.my_rewards()
returns table (balance bigint, entries jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(amount) from public.user_rewards_ledger where user_id = auth.uid()), 0)::bigint as balance,
    coalesce((
      select jsonb_agg(row_to_json(e))
      from (
        select id, kind, amount, ref_id, reason, created_at
        from public.user_rewards_ledger
        where user_id = auth.uid()
        order by created_at desc
        limit 20
      ) e
    ), '[]'::jsonb) as entries;
$$;

revoke all on function public.my_rewards() from public, anon;
grant execute on function public.my_rewards() to authenticated;