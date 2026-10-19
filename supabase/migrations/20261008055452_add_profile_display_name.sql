-- Restored verbatim from production migration history, READ-ONLY extraction.
alter table public.profiles add column if not exists display_name text; alter table public.profiles add constraint display_name_length check (display_name is null or char_length(display_name) between 1 and 80);
