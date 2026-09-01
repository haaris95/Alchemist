-- AIchemist's source of truth is a board document.  Every browser and WebMCP
-- mutation updates the same document, while memberships and invites control access.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'New collaborator' check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  document jsonb not null default '{}'::jsonb,
  ai_autonomy boolean not null default true,
  last_ai_pitched_at timestamptz,
  last_human_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table if not exists public.board_invites (
  token uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists boards_owner_id_idx on public.boards(owner_id);
create index if not exists board_members_user_id_idx on public.board_members(user_id);
create index if not exists board_invites_board_id_idx on public.board_invites(board_id);
create index if not exists boards_ai_autonomy_idx on public.boards(ai_autonomy, last_human_activity_at, last_ai_pitched_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at before update on public.boards
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'New collaborator'), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_board_member(target_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.board_members
    where board_id = target_board_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_board_editor(target_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.board_members
    where board_id = target_board_id
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

create or replace function public.is_board_owner(target_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.boards
    where id = target_board_id and owner_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.board_invites enable row level security;

create policy "Profiles are visible to signed-in users" on public.profiles
for select to authenticated using (true);
create policy "Users can update their own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Members can read a board" on public.boards
for select to authenticated using (public.is_board_member(id));
create policy "Users can create boards they own" on public.boards
for insert to authenticated with check (owner_id = auth.uid());
create policy "Editors can update board documents" on public.boards
for update to authenticated using (public.is_board_editor(id)) with check (public.is_board_editor(id));
create policy "Owners can delete boards" on public.boards
for delete to authenticated using (owner_id = auth.uid());

create policy "Members can see a board's members" on public.board_members
for select to authenticated using (public.is_board_member(board_id));
create policy "Owners can add members" on public.board_members
for insert to authenticated with check (public.is_board_owner(board_id));
create policy "Owners can change membership" on public.board_members
for update to authenticated using (public.is_board_owner(board_id)) with check (public.is_board_owner(board_id));
create policy "Owners can remove members" on public.board_members
for delete to authenticated using (public.is_board_owner(board_id));

create policy "Owners can manage board invites" on public.board_invites
for all to authenticated using (public.is_board_owner(board_id)) with check (public.is_board_owner(board_id));

create or replace function public.accept_board_invite(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_board_id uuid;
  invited_role text;
begin
  if auth.uid() is null then raise exception 'Sign in before accepting an invite'; end if;
  select board_id, role into invited_board_id, invited_role
  from public.board_invites
  where token = invite_token and (expires_at is null or expires_at > now());
  if invited_board_id is null then raise exception 'Invite is invalid or expired'; end if;
  insert into public.board_members (board_id, user_id, role)
  values (invited_board_id, auth.uid(), invited_role)
  on conflict (board_id, user_id) do nothing;
  return invited_board_id;
end;
$$;

grant execute on function public.accept_board_invite(uuid) to authenticated;

-- Run this migration before enabling real-time. This makes board-document updates
-- available to authenticated collaborators through Supabase Realtime.
alter publication supabase_realtime add table public.boards;
