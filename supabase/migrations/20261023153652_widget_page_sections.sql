-- Named sections group placed widgets without duplicating or changing source records.
-- A placement's optional config.sectionId identifies a section on its own page.
create table public.aaa_page_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  page_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  position numeric not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id,id),
  foreign key(user_id,page_id) references public.aaa_library_pages(user_id,id) on delete cascade
);
create index aaa_page_sections_owner_page on public.aaa_page_sections(user_id,page_id,position);

alter table public.aaa_page_sections enable row level security;
create policy aaa_page_sections_owner on public.aaa_page_sections for all to authenticated
  using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.aaa_page_sections from public,anon;
grant select,insert,update,delete on public.aaa_page_sections to authenticated;
