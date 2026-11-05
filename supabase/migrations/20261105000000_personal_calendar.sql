create table public.personal_calendar_access (
  owner_id uuid primary key references auth.users on delete cascade,
  partner_id uuid references auth.users on delete set null
);

do $$
begin
  insert into public.personal_calendar_access (owner_id)
  select u.id from auth.users u
  join public.site_settings s on s.key = 'business'
    and lower(u.email) = lower(s.value->>'email')
  where u.email_confirmed_at is not null;
  if not found then
    raise exception 'The confirmed CleanFreaks owner account is required';
  end if;
end;
$$;

create table public.personal_calendar_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  category text not null check (category in ('Task','Dinner','Bill','Event','Holiday','Cleaning','Pet care','Self-care','Date night')),
  starts_on date not null,
  repeat text not null default 'none' check (repeat in ('none','weekly','monthly','yearly')),
  amount numeric(12,2) check (amount >= 0 and category = 'Bill'),
  notes text not null default '' check (char_length(notes) <= 2000)
);

create table public.personal_calendar_done (
  item_id uuid references public.personal_calendar_items on delete cascade,
  occurs_on date not null,
  primary key (item_id, occurs_on)
);

alter table public.personal_calendar_access enable row level security;
alter table public.personal_calendar_items enable row level security;
alter table public.personal_calendar_done enable row level security;

revoke all on public.personal_calendar_access, public.personal_calendar_items, public.personal_calendar_done from public, anon, authenticated;
grant select, update(partner_id) on public.personal_calendar_access to authenticated;
grant select, insert, update, delete on public.personal_calendar_items to authenticated;
grant select, insert, delete on public.personal_calendar_done to authenticated;

create policy calendar_access_read on public.personal_calendar_access for select to authenticated
using ((select auth.uid()) in (owner_id, partner_id));
create policy calendar_access_share on public.personal_calendar_access for update to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy calendar_items_members on public.personal_calendar_items for all to authenticated
using (exists (select 1 from public.personal_calendar_access))
with check (exists (select 1 from public.personal_calendar_access));
create policy calendar_done_members on public.personal_calendar_done for all to authenticated
using (exists (select 1 from public.personal_calendar_access))
with check (exists (select 1 from public.personal_calendar_access));
