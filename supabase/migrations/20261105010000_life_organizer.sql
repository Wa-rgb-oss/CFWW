alter table public.personal_calendar_items
  alter column starts_on drop not null,
  add column starts_at time,
  add column ends_at time,
  add column assignee text check (assignee in ('Wade', 'Annabella', 'Both')),
  add column undated_done boolean not null default false,
  add constraint organizer_schedule_valid check (
    (starts_on is not null or (repeat = 'none' and starts_at is null and category in ('Task','Cleaning','Pet care','Self-care')))
    and (ends_at is null or (starts_at is not null and ends_at > starts_at))
  );
