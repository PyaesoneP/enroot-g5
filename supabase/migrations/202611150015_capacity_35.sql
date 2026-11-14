-- Sign-ups are capped at 35 people (was 60). The order came to about 162
-- charms, and a bracelet takes four, so the table cannot serve 60.
-- submit_rsvp() (0008) reads event_config.capacity under a row lock and
-- counts PEOPLE (sum of group_size), so this one value is the whole limit.
--
-- Rows already stored are kept: if more than 35 people have signed up by
-- the time this runs, new sign-ups answer 'full' and nobody is removed.
alter table public.event_config alter column capacity set default 35;
update public.event_config set capacity = 35, updated_at = now() where id = true;
