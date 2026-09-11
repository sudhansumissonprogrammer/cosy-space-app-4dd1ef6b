create table if not exists public.store_telegram_config (
  store_id uuid primary key references public.stores(id) on delete cascade,
  chat_id text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.store_telegram_config to authenticated;
grant all on public.store_telegram_config to service_role;

alter table public.store_telegram_config enable row level security;

drop policy if exists "Owners manage their telegram config" on public.store_telegram_config;
create policy "Owners manage their telegram config"
on public.store_telegram_config
for all
to authenticated
using (exists (select 1 from public.stores s where s.id = store_telegram_config.store_id and s.owner_id = auth.uid()))
with check (exists (select 1 from public.stores s where s.id = store_telegram_config.store_id and s.owner_id = auth.uid()));

drop policy if exists "Admins manage telegram config" on public.store_telegram_config;
create policy "Admins manage telegram config"
on public.store_telegram_config
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));