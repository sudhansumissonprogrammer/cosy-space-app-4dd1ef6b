create or replace function public.get_store_source_config(p_store_id uuid)
returns table (source_platform text, source_base_url text)
language sql
stable
security definer
set search_path = public
as $$
  select s.source_platform, s.source_base_url
  from public.stores s
  where s.id = p_store_id
    and (s.owner_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role))
$$;

revoke all on function public.get_store_source_config(uuid) from public;
grant execute on function public.get_store_source_config(uuid) to authenticated;
grant execute on function public.get_store_source_config(uuid) to service_role;