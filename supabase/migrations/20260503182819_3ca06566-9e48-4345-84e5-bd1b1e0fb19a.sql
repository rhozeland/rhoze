update public.service_packages set name='Bloom', sort_order=20 where slug='bronze';
update public.service_packages set name='Glow',  sort_order=30 where slug='gold';
update public.service_packages set name='Play',  sort_order=40 where slug='diamond';

insert into public.service_packages (slug, name, kind, price_cents, credits, sort_order, description, stripe_price_id)
values ('spark', 'Spark', 'subscription', 0, 0, 10,
        'Pay-as-you-go — no monthly commitment. Buy credits or scope one-off projects whenever you need them.',
        null)
on conflict (slug) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  credits = excluded.credits,
  sort_order = excluded.sort_order,
  description = excluded.description;