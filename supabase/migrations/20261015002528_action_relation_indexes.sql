-- Relation-first indexes support foreign-key checks across owner-scoped records.
-- Existing owner-first indexes remain useful for the application's RLS queries.
create index planning_event_ref_idx on public.planning_records(event_id) where event_id is not null;
create index planning_character_ref_idx on public.planning_records(character_id) where character_id is not null;
create index planning_goal_ref_idx on public.planning_records(goal_id) where goal_id is not null;
create index planning_project_ref_idx on public.planning_records(project_id) where project_id is not null;
create index planning_working_ref_idx on public.planning_records(working_id) where working_id is not null;
create index planning_workspace_ref_idx on public.planning_records(workspace_id) where workspace_id is not null;
create index thought_target_ref_idx on public.thought_connections(target_id);
create index thought_parent_ref_idx on public.thought_details(parent_id) where parent_id is not null;
create index thought_member_ref_idx on public.thought_memberships(thought_id);
create index thought_schedule_ref_idx on public.user_items(thought_id) where thought_id is not null;
