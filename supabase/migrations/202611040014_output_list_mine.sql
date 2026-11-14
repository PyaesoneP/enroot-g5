-- PR #42 review, finding 2: the gallery shows the newest 48 entries, so an
-- entry older than that lost its Remove button, although the share notice
-- promises removal "any time". This lists one owner's own entries, however
-- old, for a "Your bracelets" section. Same posture as 0013: service_role
-- only; the owner hash never leaves the database. The unique index on
-- (owner_hash, activity_id, payload) serves the owner lookup.

create or replace function public.output_list_mine(
  p_owner text,
  p_limit integer
)
returns table (id uuid, activity_id text, payload text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.activity_id, o.payload, o.created_at
    from public.outputs o
   where p_owner is not null and o.owner_hash = p_owner
   order by o.created_at desc, o.id
   limit greatest(1, least(coalesce(p_limit, 200), 200));
$$;

revoke execute on function public.output_list_mine(text, integer) from public, anon, authenticated;
grant execute on function public.output_list_mine(text, integer) to service_role;
