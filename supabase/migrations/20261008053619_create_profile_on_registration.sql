-- Restored verbatim from production migration history, READ-ONLY extraction.
create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare desired text;
begin
 desired := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
 if desired !~ '^[a-z0-9_]{3,24}$' then
   raise exception 'Username must contain 3-24 lowercase letters, numbers or underscores';
 end if;
 insert into public.profiles(id,username) values(new.id,desired);
 return new;
end;
$$;
create trigger on_auth_user_created_profile after insert on auth.users
for each row execute function public.create_profile_for_new_user();
