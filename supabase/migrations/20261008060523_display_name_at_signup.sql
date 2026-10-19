-- Restored verbatim from production migration history, READ-ONLY extraction.
create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare desired text; generated text;
begin
 desired := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username', ''));
 if char_length(desired) < 3 or char_length(desired) > 80 then
   raise exception 'Display name must be between 3 and 80 characters';
 end if;
 generated := 'user_' || substr(replace(new.id::text, '-', ''), 1, 19);
 insert into public.profiles(id,username,display_name) values(new.id,generated,desired);
 return new;
end;
$$;
alter table public.profiles drop constraint if exists display_name_length;
alter table public.profiles add constraint display_name_length check (display_name is null or char_length(btrim(display_name)) between 3 and 80);
