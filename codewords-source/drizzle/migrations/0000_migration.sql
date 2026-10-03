-- Profiles
create table public.profiles (
  id uuid primary key,
  username text not null,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Per-player stats, split by role
create table public.player_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  op_games int not null default 0,
  op_wins int not null default 0,
  op_correct int not null default 0,
  op_wrong int not null default 0,
  op_bystander int not null default 0,
  op_assassin int not null default 0,
  sm_games int not null default 0,
  sm_wins int not null default 0,
  sm_clues int not null default 0,
  sm_cards_cleared int not null default 0,
  sm_assassin int not null default 0
);
grant select on public.player_stats to authenticated;
grant all on public.player_stats to service_role;
alter table public.player_stats enable row level security;
create policy "Stats readable by signed-in users" on public.player_stats for select to authenticated using (true);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''), nullif(new.raw_user_meta_data->>'full_name',''), split_part(new.email,'@',1)));
  insert into public.player_stats (user_id) values (new.id);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Games
create table public.games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'lobby',          -- lobby | playing | finished
  starting_team text,
  current_team text,
  phase text,                                     -- clue | guess
  clue_word text,
  clue_count int,
  guesses_left int,
  winner text,
  win_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.games to authenticated;
grant all on public.games to service_role;
alter table public.games enable row level security;
create policy "Games readable by signed-in users" on public.games for select to authenticated using (true);

create table public.game_players (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team text not null default 'red',      -- red | blue
  role text not null default 'operative',-- operative | spymaster
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
grant select on public.game_players to authenticated;
grant all on public.game_players to service_role;
alter table public.game_players enable row level security;
create policy "Players readable by signed-in users" on public.game_players for select to authenticated using (true);

-- Public board (no secret colours until revealed)
create table public.cards (
  game_id uuid not null references public.games(id) on delete cascade,
  idx int not null,
  word text not null,
  revealed boolean not null default false,
  revealed_kind text,
  revealed_by uuid,
  primary key (game_id, idx)
);
grant select on public.cards to authenticated;
grant all on public.cards to service_role;
alter table public.cards enable row level security;
create policy "Cards readable by signed-in users" on public.cards for select to authenticated using (true);

-- Secret key (spymasters only, or everyone once finished)
create table public.card_keys (
  game_id uuid not null references public.games(id) on delete cascade,
  idx int not null,
  kind text not null,    -- red | blue | bystander | assassin
  primary key (game_id, idx)
);
grant select on public.card_keys to authenticated;
grant all on public.card_keys to service_role;
alter table public.card_keys enable row level security;

create or replace function public.can_see_key(_game uuid, _uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from game_players where game_id=_game and user_id=_uid and role='spymaster')
      or exists (select 1 from games where id=_game and status='finished');
$$;
create policy "Spymasters see key" on public.card_keys for select to authenticated using (public.can_see_key(game_id, auth.uid()));

-- Clue log
create table public.clues (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  team text not null,
  spymaster_id uuid not null,
  word text not null,
  count int not null,
  created_at timestamptz not null default now()
);
grant select on public.clues to authenticated;
grant all on public.clues to service_role;
alter table public.clues enable row level security;
create policy "Clues readable by signed-in users" on public.clues for select to authenticated using (true);

alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_players;
alter publication supabase_realtime add table public.cards;
alter publication supabase_realtime add table public.clues;

-- ===== Game actions =====
create or replace function public.create_game()
returns text language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _code text; _gid uuid;
begin
  if _uid is null then raise exception 'Not signed in'; end if;
  loop
    _code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ', (floor(random()*24)+1)::int, 1), '') from generate_series(1,5));
    exit when not exists (select 1 from games where code=_code);
  end loop;
  insert into games (code, host_id) values (_code, _uid) returning id into _gid;
  insert into game_players (game_id, user_id, team, role) values (_gid, _uid, 'red', 'spymaster');
  return _code;
end; $$;

create or replace function public.join_game(_code text)
returns text language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _g games; _red int; _blue int;
begin
  if _uid is null then raise exception 'Not signed in'; end if;
  select * into _g from games where code = upper(trim(_code));
  if not found then raise exception 'No game with that code'; end if;
  if exists (select 1 from game_players where game_id=_g.id and user_id=_uid) then return _g.code; end if;
  if _g.status <> 'lobby' then raise exception 'That game has already started'; end if;
  select count(*) filter (where team='red'), count(*) filter (where team='blue') into _red, _blue from game_players where game_id=_g.id;
  insert into game_players (game_id, user_id, team, role) values (_g.id, _uid, case when _red <= _blue then 'red' else 'blue' end, 'operative');
  return _g.code;
end; $$;

create or replace function public.choose_seat(_game uuid, _team text, _role text)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid();
begin
  if _team not in ('red','blue') or _role not in ('operative','spymaster') then raise exception 'Invalid seat'; end if;
  if not exists (select 1 from games where id=_game and status='lobby') then raise exception 'Game already started'; end if;
  if not exists (select 1 from game_players where game_id=_game and user_id=_uid) then raise exception 'Not in this game'; end if;
  if _role='spymaster' and exists (select 1 from game_players where game_id=_game and team=_team and role='spymaster' and user_id<>_uid) then
    raise exception 'That team already has a spymaster';
  end if;
  update game_players set team=_team, role=_role where game_id=_game and user_id=_uid;
end; $$;

create or replace function public.leave_game(_game uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from game_players gp using games g where gp.game_id=_game and gp.user_id=auth.uid() and g.id=gp.game_id and g.status='lobby';
end; $$;

create or replace function public.start_game(_game uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _g games; _start text; _other text;
  _words text[] := array['AFRICA','AGENT','AIR','ALIEN','AMAZON','ANGEL','ANTARCTICA','APPLE','ARM','BACK','BAND','BANK','BARK','BAT','BATTERY','BEACH','BEAR','BED','BELL','BERLIN','BERRY','BILL','BLOCK','BOARD','BOLT','BOMB','BOND','BOOT','BOTTLE','BOW','BOX','BRIDGE','BRUSH','BUCK','BUG','CANADA','CAP','CAPITAL','CAR','CARD','CASINO','CAST','CAT','CELL','CENTAUR','CHANGE','CHARGE','CHECK','CHEST','CHINA','CHOCOLATE','CHURCH','CIRCLE','CLIFF','CLOAK','CLUB','CODE','COLD','COMIC','COMPOUND','CONCERT','CONDUCTOR','COTTON','COURT','COVER','CRANE','CRASH','CROWN','CYCLE','DANCE','DAY','DEATH','DECK','DEGREE','DIAMOND','DICE','DINOSAUR','DISEASE','DOCTOR','DOG','DRAFT','DRAGON','DRESS','DRILL','DROP','DUCK','DWARF','EAGLE','EGYPT','ENGINE','EYE','FACE','FAIR','FALL','FAN','FENCE','FIELD','FIGHTER','FIGURE','FILE','FILM','FIRE','FISH','FLUTE','FLY','FOOT','FORCE','FOREST','FORK','FRANCE','GAME','GAS','GENIUS','GERMANY','GHOST','GIANT','GLASS','GLOVE','GOLD','GRACE','GRASS','GREECE','GREEN','GROUND','HAM','HAND','HAWK','HEAD','HEART','HELICOPTER','HOLE','HOLLYWOOD','HONEY','HOOD','HOOK','HORN','HORSE','HOSPITAL','HOTEL','ICE','INDIA','IRON','IVORY','JACK','JAM','JET','JUPITER','KANGAROO','KETCHUP','KEY','KID','KING','KIWI','KNIFE','KNIGHT','LAB','LAP','LASER','LAWYER','LEAD','LEMON','LIGHT','LIMOUSINE','LINE','LINK','LION','LOCK','LOG','LONDON','LUCK','MAIL','MAMMOTH','MAPLE','MARBLE','MARCH','MASS','MATCH','MERCURY','MEXICO','MICROSCOPE','MILLIONAIRE','MINE','MINT','MISSILE','MODEL','MOLE','MOON','MOSCOW','MOUNT','MOUSE','MUG','NAIL','NEEDLE','NET','NIGHT','NINJA','NOTE','NOVEL','NURSE','NUT','OCTOPUS','OIL','OLIVE','OPERA','ORANGE','ORGAN','PALM','PAN','PANTS','PAPER','PARACHUTE','PARK','PART','PASS','PASTE','PENGUIN','PHOENIX','PIANO','PIE','PILOT','PIN','PIPE','PIRATE','PISTOL','PIT','PITCH','PLANE','PLASTIC','PLATE','PLATYPUS','PLAY','PLOT','POINT','POISON','POLE','POLICE','POOL','PORT','POST','PRESS','PRINCESS','PUMPKIN','PUPIL','PYRAMID','QUEEN','RABBIT','RACKET','RAY','REVOLUTION','RING','ROBIN','ROBOT','ROCK','ROME','ROOT','ROSE','ROULETTE','ROUND','ROW','RULER','SATELLITE','SATURN','SCALE','SCHOOL','SCIENTIST','SCORPION','SCREEN','SCUBA','SEAL','SERVER','SHADOW','SHAKESPEARE','SHARK','SHIP','SHOE','SHOP','SHOT','SINK','SKYSCRAPER','SLIP','SLUG','SMUGGLER','SNOW','SNOWMAN','SOCK','SOLDIER','SOUL','SOUND','SPACE','SPELL','SPIDER','SPIKE','SPINE','SPOT','SPRING','SPY','SQUARE','STADIUM','STAFF','STAR','STATE','STICK','STOCK','STRAW','STREAM','STRIKE','STRING','SUB','SUIT','SUPERHERO','SWING','SWITCH','TABLE','TABLET','TAG','TAIL','TAP','TEACHER','TELESCOPE','TEMPLE','THEATER','THIEF','THUMB','TICK','TIE','TIME','TOKYO','TOOTH','TORCH','TOWER','TRACK','TRAIN','TRIANGLE','TRIP','TRUNK','TUBE','TURKEY','UNDERTAKER','UNICORN','VACUUM','VAN','VET','WAKE','WALL','WAR','WASHER','WASHINGTON','WATCH','WATER','WAVE','WEB','WELL','WHALE','WHIP','WIND','WITCH','WORM','YARD'];
  _picked text[]; _kinds text[]; i int;
begin
  select * into _g from games where id=_game for update;
  if _g.host_id <> auth.uid() then raise exception 'Only the host can start'; end if;
  if _g.status <> 'lobby' then raise exception 'Game already started'; end if;
  if (select count(*) from game_players where game_id=_game and role='spymaster') <> 2
     or not exists (select 1 from game_players where game_id=_game and team='red' and role='spymaster')
     or not exists (select 1 from game_players where game_id=_game and team='blue' and role='spymaster') then
    raise exception 'Each team needs exactly one spymaster';
  end if;
  if not exists (select 1 from game_players where game_id=_game and team='red' and role='operative')
     or not exists (select 1 from game_players where game_id=_game and team='blue' and role='operative') then
    raise exception 'Each team needs at least one operative';
  end if;
  _start := case when random() < 0.5 then 'red' else 'blue' end;
  _other := case when _start='red' then 'blue' else 'red' end;
  select array_agg(w) into _picked from (select w from unnest(_words) w order by random() limit 25) s;
  select array_agg(k order by random()) into _kinds from (
    select _start k from generate_series(1,9)
    union all select _other from generate_series(1,8)
    union all select 'bystander' from generate_series(1,7)
    union all select 'assassin'
  ) s;
  for i in 1..25 loop
    insert into cards (game_id, idx, word) values (_game, i-1, _picked[i]);
    insert into card_keys (game_id, idx, kind) values (_game, i-1, _kinds[i]);
  end loop;
  update games set status='playing', starting_team=_start, current_team=_start, phase='clue', updated_at=now() where id=_game;
end; $$;

create or replace function public.give_clue(_game uuid, _word text, _count int)
returns void language plpgsql security definer set search_path = public as $$
declare _g games; _w text := upper(trim(_word));
begin
  select * into _g from games where id=_game for update;
  if _g.status <> 'playing' or _g.phase <> 'clue' then raise exception 'Not time for a clue'; end if;
  if not exists (select 1 from game_players where game_id=_game and user_id=auth.uid() and team=_g.current_team and role='spymaster') then
    raise exception 'Only the active spymaster can give a clue';
  end if;
  if _w = '' or _w ~ '\s' then raise exception 'Clue must be a single word'; end if;
  if _count < 0 or _count > 9 then raise exception 'Number must be 0-9'; end if;
  if exists (select 1 from cards where game_id=_game and not revealed and word=_w) then raise exception 'Clue cannot be a word on the board'; end if;
  insert into clues (game_id, team, spymaster_id, word, count) values (_game, _g.current_team, auth.uid(), _w, _count);
  update player_stats set sm_clues = sm_clues + 1 where user_id = auth.uid();
  update games set phase='guess', clue_word=_w, clue_count=_count,
    guesses_left = case when _count = 0 then 25 else _count + 1 end, updated_at=now() where id=_game;
end; $$;

create or replace function public.finish_game(_game uuid, _winner text, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update games set status='finished', winner=_winner, win_reason=_reason, phase=null, updated_at=now() where id=_game;
  update player_stats s set
    op_games = op_games + case when gp.role='operative' then 1 else 0 end,
    op_wins  = op_wins  + case when gp.role='operative' and gp.team=_winner then 1 else 0 end,
    sm_games = sm_games + case when gp.role='spymaster' then 1 else 0 end,
    sm_wins  = sm_wins  + case when gp.role='spymaster' and gp.team=_winner then 1 else 0 end
  from game_players gp where gp.game_id=_game and gp.user_id = s.user_id;
end; $$;
revoke execute on function public.finish_game(uuid, text, text) from public, anon, authenticated;

create or replace function public.switch_turn(_game uuid)
returns void language sql security definer set search_path = public as $$
  update games set current_team = case when current_team='red' then 'blue' else 'red' end,
    phase='clue', clue_word=null, clue_count=null, guesses_left=null, updated_at=now() where id=_game;
$$;
revoke execute on function public.switch_turn(uuid) from public, anon, authenticated;

create or replace function public.make_guess(_game uuid, _idx int)
returns text language plpgsql security definer set search_path = public as $$
declare _g games; _uid uuid := auth.uid(); _kind text; _team text; _opp text; _sm uuid;
begin
  select * into _g from games where id=_game for update;
  if _g.status <> 'playing' or _g.phase <> 'guess' then raise exception 'Not time to guess'; end if;
  _team := _g.current_team; _opp := case when _team='red' then 'blue' else 'red' end;
  if not exists (select 1 from game_players where game_id=_game and user_id=_uid and team=_team and role='operative') then
    raise exception 'Only operatives on the active team can guess';
  end if;
  if exists (select 1 from cards where game_id=_game and idx=_idx and revealed) then raise exception 'Card already revealed'; end if;
  select kind into _kind from card_keys where game_id=_game and idx=_idx;
  if _kind is null then raise exception 'No such card'; end if;
  update cards set revealed=true, revealed_kind=_kind, revealed_by=_uid where game_id=_game and idx=_idx;
  select user_id into _sm from game_players where game_id=_game and team=_team and role='spymaster';

  if _kind = _team then
    update player_stats set op_correct = op_correct + 1 where user_id=_uid;
    update player_stats set sm_cards_cleared = sm_cards_cleared + 1 where user_id=_sm;
    if not exists (select 1 from card_keys k join cards c using (game_id, idx) where k.game_id=_game and k.kind=_team and not c.revealed) then
      perform finish_game(_game, _team, 'found_all'); return _kind;
    end if;
    update games set guesses_left = guesses_left - 1, updated_at=now() where id=_game;
    if _g.guesses_left - 1 <= 0 then perform switch_turn(_game); end if;
  elsif _kind = _opp then
    update player_stats set op_wrong = op_wrong + 1 where user_id=_uid;
    if not exists (select 1 from card_keys k join cards c using (game_id, idx) where k.game_id=_game and k.kind=_opp and not c.revealed) then
      perform finish_game(_game, _opp, 'found_all'); return _kind;
    end if;
    perform switch_turn(_game);
  elsif _kind = 'bystander' then
    update player_stats set op_bystander = op_bystander + 1 where user_id=_uid;
    perform switch_turn(_game);
  else
    update player_stats set op_assassin = op_assassin + 1 where user_id=_uid;
    update player_stats set sm_assassin = sm_assassin + 1 where user_id=_sm;
    perform finish_game(_game, _opp, 'assassin');
  end if;
  return _kind;
end; $$;

create or replace function public.end_turn(_game uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _g games;
begin
  select * into _g from games where id=_game for update;
  if _g.status <> 'playing' or _g.phase <> 'guess' then raise exception 'Not time to end turn'; end if;
  if not exists (select 1 from game_players where game_id=_game and user_id=auth.uid() and team=_g.current_team and role='operative') then
    raise exception 'Only active operatives can end the turn';
  end if;
  perform switch_turn(_game);
end; $$;

revoke execute on function public.create_game() from public, anon;
revoke execute on function public.join_game(text) from public, anon;
revoke execute on function public.choose_seat(uuid,text,text) from public, anon;
revoke execute on function public.leave_game(uuid) from public, anon;
revoke execute on function public.start_game(uuid) from public, anon;
revoke execute on function public.give_clue(uuid,text,int) from public, anon;
revoke execute on function public.make_guess(uuid,int) from public, anon;
revoke execute on function public.end_turn(uuid) from public, anon;
grant execute on function public.create_game(), public.join_game(text), public.choose_seat(uuid,text,text), public.leave_game(uuid), public.start_game(uuid), public.give_clue(uuid,text,int), public.make_guess(uuid,int), public.end_turn(uuid) to authenticated;