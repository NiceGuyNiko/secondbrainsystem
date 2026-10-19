-- Restored verbatim from production migration history, READ-ONLY extraction.
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique,
 created_at timestamptz not null default now(),
 constraint username_format check (username ~ '^[a-z0-9_]{3,24}$')
);
create table if not exists public.user_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 title text not null,
 item_type text not null check (item_type in ('project','task','resource','block','event','thought')),
 content jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists user_items_user_id_idx on public.user_items(user_id);
alter table public.profiles enable row level security;
alter table public.user_items enable row level security;
create policy "Profile owners can read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Profile owners can insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Profile owners can update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Item owners can read" on public.user_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "Item owners can insert" on public.user_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Item owners can update" on public.user_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Item owners can delete" on public.user_items for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.profiles, public.user_items from anon;
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update,delete on public.user_items to authenticated;
