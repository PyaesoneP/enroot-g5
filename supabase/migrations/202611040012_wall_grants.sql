-- PR #41 review, finding 3: 0011 granted service_role only SELECT and
-- DELETE on wall_posts and said writes go through wall_post() alone. That
-- held on the local replay (deny-by-default) but not live: Supabase's
-- default privileges had already given service_role every table privilege
-- (checked 2026-11-04: INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER too).
-- Revoke the extras so the server key cannot write rows that skip
-- wall_post()'s checks. The definer functions run as their owner
-- (postgres), and the Table Editor uses postgres too, so neither is affected.

revoke insert, update, truncate, references, trigger
  on table public.wall_posts from service_role;
grant select, delete on table public.wall_posts to service_role;
