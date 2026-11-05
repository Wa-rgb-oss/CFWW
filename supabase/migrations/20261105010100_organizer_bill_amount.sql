alter table public.personal_calendar_items drop constraint personal_calendar_items_check, add constraint organizer_bill_amount check (amount is null or (category = 'Bill' and amount >= 0));
