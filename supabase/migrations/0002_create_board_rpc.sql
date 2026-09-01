-- Create a board and its initial owner membership in one transaction.
-- This deliberately runs as the database owner, but only after checking the
-- caller's authenticated JWT via auth.uid(). It avoids bootstrapping an owner
-- membership through a policy that itself requires an existing owner.
create or replace function public.create_board(
  board_title text,
  board_document jsonb,
  board_ai_autonomy boolean default true
)
returns table (
  id uuid,
  title text,
  ai_autonomy boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_board public.boards%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in before creating a board';
  end if;

  insert into public.boards (owner_id, title, document, ai_autonomy)
  values (auth.uid(), board_title, board_document, board_ai_autonomy)
  returning * into created_board;

  insert into public.board_members (board_id, user_id, role)
  values (created_board.id, auth.uid(), 'owner');

  return query
  select created_board.id, created_board.title, created_board.ai_autonomy, created_board.created_at, created_board.updated_at;
end;
$$;

grant execute on function public.create_board(text, jsonb, boolean) to authenticated;
