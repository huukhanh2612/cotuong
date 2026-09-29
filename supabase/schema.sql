-- =====================================================================
-- CỜ TƯỚNG - GIAI ĐOẠN 5 (+ NẠP THY MÂY, TAM ĐẤU): hồ sơ, ghép trận, Rank/Luyện Khí, lịch sử, SHOP & ADMIN, BXH TUẦN + ID NGƯỜI CHƠI, BẠN BÈ, PHÒNG RIÊNG (Elo + cược Khí/Thy Mây)
-- Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor > New query > Run.
-- File chạy lại nhiều lần được (idempotent).
-- =====================================================================

-- ---------- BẢNG ----------
create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Kỳ thủ',
  khi numeric not null default 12 check (khi>=0),      -- điểm Khí, khởi đầu 12 = Cấp 1 Linh Thai Sơ Kỳ
  rating int not null default 1000 check (rating>=0),  -- điểm Rank (Elo)
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.matchmaking_queue(
  user_id uuid primary key references auth.users(id) on delete cascade,
  mode text not null,
  bet int not null default 0,
  rating int not null,
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);

create table if not exists public.matches(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  red_id uuid not null references auth.users(id),
  black_id uuid not null references auth.users(id),
  mode text not null check (mode in ('casual','ranked','khi','room')),
  bet int not null default 0,
  status text not null default 'playing' check (status in ('playing','finished')),
  ply int not null default 0,                 -- số nước đã đi; chẵn = lượt Đỏ, lẻ = lượt Đen
  deadline timestamptz not null,              -- hạn đi nước tiếp theo
  winner text check (winner in ('red','black')),  -- null + status finished = hòa
  reason text,
  red_rating int, black_rating int,           -- điểm Rank trước trận
  red_rating_delta int not null default 0,
  black_rating_delta int not null default 0,
  red_khi_delta numeric not null default 0,
  black_khi_delta numeric not null default 0,
  ended_at timestamptz
);
create index if not exists matches_red_idx on public.matches(red_id,created_at desc);
create index if not exists matches_black_idx on public.matches(black_id,created_at desc);

create table if not exists public.match_moves(
  match_id uuid not null references public.matches(id) on delete cascade,
  ply int not null,
  fx int not null, fy int not null, tx int not null, ty int not null,
  created_at timestamptz not null default now(),
  primary key(match_id,ply)
);


-- ---------- SHOP & ADMIN: CỘT MỚI + BẢNG MỚI ----------
alter table public.profiles add column if not exists coins int not null default 0 check (coins>=0);            -- ví Thy Mây
alter table public.profiles add column if not exists win_streak int not null default 0 check (win_streak>=0);  -- chuỗi thắng Rank hiện tại
alter table public.profiles add column if not exists equipped jsonb not null default '{}'::jsonb;              -- {avatar,avatar_frame,name_frame,board} = id vật phẩm đang dùng
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.matches add column if not exists red_coin_delta int not null default 0;
alter table public.matches add column if not exists black_coin_delta int not null default 0;
alter table public.matches add column if not exists red_streak int not null default 0;
alter table public.matches add column if not exists black_streak int not null default 0;

-- ---------- GIAI ĐOẠN 5: ID người chơi, hiện diện, cột cho phòng riêng ----------
alter table public.profiles add column if not exists player_code text;      -- ID 8 chữ số để kết bạn / mời vào phòng
alter table public.profiles add column if not exists last_seen timestamptz; -- lần cuối online (để hiện chấm xanh cho bạn bè)
alter table public.matches add column if not exists bet_coins int not null default 0;   -- cược Thy Mây (chỉ phòng riêng)
alter table public.matches add column if not exists rated boolean not null default false; -- phòng riêng có tính Rank (Elo) không
alter table public.matches add column if not exists room_id uuid;
-- Bản cũ chỉ cho 3 chế độ: mở rộng thêm 'room' (phòng riêng)
alter table public.matches drop constraint if exists matches_mode_check;
alter table public.matches add constraint matches_mode_check check (mode in ('casual','ranked','khi','room'));

create or replace function public._gen_player_code() returns text
language plpgsql volatile security definer set search_path=public as $$
declare c text; n int:=0;
begin
  loop
    c:=(10000000+floor(random()*90000000))::bigint::text;   -- 8 chữ số, 10000000..99999999
    exit when not exists(select 1 from public.profiles where player_code=c);
    n:=n+1; if n>60 then raise exception 'Không tạo được ID người chơi'; end if;
  end loop;
  return c;
end $$;
revoke all on function public._gen_player_code() from public,anon,authenticated;

-- Cấp ID cho tài khoản cũ (từng dòng một để không trùng)
do $$ declare r record; begin
  for r in select id from public.profiles where player_code is null loop
    update public.profiles set player_code=public._gen_player_code() where id=r.id;
  end loop;
end $$;
create unique index if not exists profiles_player_code_key on public.profiles(player_code);
alter table public.profiles alter column player_code set default public._gen_player_code();
alter table public.profiles alter column player_code set not null;

create table if not exists public.shop_items(
  id text primary key,
  kind text not null check (kind in ('boost','avatar','avatar_frame','name_frame','board')),
  name text not null,
  description text not null default '',
  price int not null default 0 check (price>=0),
  data jsonb not null default '{}'::jsonb,   -- mô tả hiển thị / hiệu ứng, xem README
  active boolean not null default true,      -- false = ẩn khỏi cửa hàng (người đã mua vẫn giữ)
  sort int not null default 100,
  created_at timestamptz not null default now()
);
create table if not exists public.user_items(
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.shop_items(id) on delete restrict,
  qty int not null default 1 check (qty>=0),
  acquired_at timestamptz not null default now(),
  primary key(user_id,item_id)
);
create table if not exists public.active_boosts(
  user_id uuid not null references auth.users(id) on delete cascade,
  boost_kind text not null check (boost_kind in ('exp','khi')),
  mult numeric not null,
  expires_at timestamptz not null,
  item_id text references public.shop_items(id) on delete set null,
  primary key(user_id,boost_kind)
);
create table if not exists public.coin_log(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  balance int not null,
  reason text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists coin_log_user_idx on public.coin_log(user_id,created_at desc);
create table if not exists public.admin_log(
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce((select is_admin from public.profiles where id=auth.uid()),false);
$$;

-- ---------- TỰ TẠO HỒ SƠ KHI ĐĂNG KÝ ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,username)
  values(new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'username'),''), split_part(new.email,'@',1), 'Kỳ thủ'),24))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Tạo hồ sơ cho tài khoản đã tồn tại trước khi chạy file này
insert into public.profiles(id,username)
select u.id,left(coalesce(nullif(trim(u.raw_user_meta_data->>'username'),''),split_part(u.email,'@',1),'Kỳ thủ'),24)
from auth.users u on conflict (id) do nothing;

-- ---------- BẢNG XẾP HẠNG TUẦN (điểm Khí) ----------
-- Mỗi trận Luyện Khí kết thúc sẽ cộng Khí lời/lỗ ròng của từng người vào dòng của tuần hiện tại.
-- Tuần tính từ 00:00 Thứ Hai đến hết Chủ Nhật theo giờ Việt Nam; sang tuần mới tự có dòng mới (không cần cron).
create table if not exists public.weekly_khi(
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  gained numeric not null default 0,      -- Khí lời (+) hoặc lỗ (-) ròng trong tuần
  games int not null default 0,
  wins int not null default 0,
  updated_at timestamptz not null default now(),
  primary key(user_id,week_start)
);
create index if not exists weekly_khi_rank_idx on public.weekly_khi(week_start,gained desc);
alter table public.weekly_khi enable row level security;
revoke all on public.weekly_khi from authenticated, anon;

create or replace function public._week_start() returns date
language sql stable as $$
  select (date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh'))::date;
$$;

-- ---------- BẢO MẬT (RLS) ----------
alter table public.profiles enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.matches enable row level security;
alter table public.match_moves enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid()=id) with check (auth.uid()=id);
-- Người chơi chỉ được sửa tên; Khí/Rank/thắng thua chỉ đổi được qua hàm phía server
revoke update on public.profiles from authenticated, anon;
grant update(username) on public.profiles to authenticated;

drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select to authenticated using (auth.uid() in (red_id,black_id));
drop policy if exists moves_read on public.match_moves;
create policy moves_read on public.match_moves for select to authenticated
  using (exists(select 1 from public.matches m where m.id=match_id and auth.uid() in (m.red_id,m.black_id)));
-- matchmaking_queue: không có policy => client không truy cập trực tiếp được

revoke insert,update,delete on public.matches, public.match_moves, public.matchmaking_queue from authenticated, anon;


-- RLS cho bảng shop
alter table public.shop_items enable row level security;
alter table public.user_items enable row level security;
alter table public.active_boosts enable row level security;
alter table public.coin_log enable row level security;
alter table public.admin_log enable row level security;
drop policy if exists shop_items_read on public.shop_items;
create policy shop_items_read on public.shop_items for select to authenticated using (true);
drop policy if exists user_items_read on public.user_items;
create policy user_items_read on public.user_items for select to authenticated using (auth.uid()=user_id);
drop policy if exists active_boosts_read on public.active_boosts;
create policy active_boosts_read on public.active_boosts for select to authenticated using (auth.uid()=user_id);
drop policy if exists coin_log_read on public.coin_log;
create policy coin_log_read on public.coin_log for select to authenticated using (auth.uid()=user_id);
drop policy if exists admin_log_read on public.admin_log;
create policy admin_log_read on public.admin_log for select to authenticated using (public.is_admin());
revoke insert,update,delete on public.shop_items, public.user_items, public.active_boosts, public.coin_log, public.admin_log from authenticated, anon;

-- ---------- HÀM NỘI BỘ: CỘNG/TRỪ THY MÂY ----------
create or replace function public._add_coins(p_user uuid,p_delta int,p_reason text,p_note text default null) returns int
language plpgsql security definer set search_path=public as $$
declare nb int;
begin
  update public.profiles set coins=coins+p_delta where id=p_user returning coins into nb;
  if not found then raise exception 'Không tìm thấy người chơi'; end if;
  insert into public.coin_log(user_id,delta,balance,reason,note) values(p_user,p_delta,nb,p_reason,p_note);
  return nb;
end $$;
revoke all on function public._add_coins(uuid,int,text,text) from public,anon,authenticated;

create or replace function public._require_admin() returns void
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'Bạn không có quyền quản trị'; end if;
end $$;
revoke all on function public._require_admin() from public,anon,authenticated;

-- ---------- HÀM NỘI BỘ: KẾT THÚC TRẬN & TÍNH ĐIỂM ----------
-- Luật Thy Mây (Rank): mỗi trận Rank nhận 1 Thy Mây (thắng/thua/hòa đều nhận, với điều kiện trận có từ 6 nước trở lên
-- để chống cày bằng cách xin thua ngay). Thắng liên tiếp từ 3 trận Rank trở lên: mỗi trận thắng nhận x2 (2 Thy Mây).
-- Thua reset chuỗi về 0, hòa giữ nguyên chuỗi.
-- Thẻ EXP: nhân điểm Rank người THẮNG nhận được. Thẻ Khí: nhân số Khí lời của người THẮNG ở Luyện Khí (người thua vẫn chỉ mất đúng mức cược).
create or replace function public._settle(p_match uuid,p_winner text,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare m public.matches; rr int; br int; ea numeric; sr numeric;
  d_r int:=0; d_b int:=0; k_r numeric:=0; k_b numeric:=0; pay_r numeric:=0; pay_b numeric:=0;
  bm numeric:=1; st_r int:=0; st_b int:=0; c_r int:=0; c_b int:=0; rc_r int:=0; rc_b int:=0;
  coin_min_plies constant int:=6;
  week_min_plies constant int:=6;   -- ván Luyện Khí dưới số nước này không tính vào bảng xếp hạng tuần (chống đổi Khí bằng cách xin thua ngay)
  ws date:=public._week_start();
begin
  select * into m from public.matches where id=p_match for update;
  if not found or m.status<>'playing' then return; end if;

  if m.mode='ranked' or (m.mode='room' and m.rated) then   -- phòng riêng có bật "tính Rank" cũng tính Elo
    select rating,win_streak into rr,st_r from public.profiles where id=m.red_id;
    select rating,win_streak into br,st_b from public.profiles where id=m.black_id;
    ea:=1/(1+power(10,(br-rr)/400.0));
    sr:=case p_winner when 'red' then 1 when 'black' then 0 else 0.5 end;
    d_r:=round(32*(sr-ea));
    d_r:=greatest(d_r,-rr);           -- không xuống dưới 0
    d_b:=-d_r;
    d_b:=greatest(d_b,-br);
    -- Thẻ EXP, chuỗi thắng và Thy Mây thưởng chỉ áp dụng cho Đấu Rank thường (phòng riêng chỉ tính Elo, chống cày với tài khoản phụ)
    if m.mode='ranked' then
    if p_winner='red' and d_r>0 then
      select coalesce(max(mult),1) into bm from public.active_boosts where user_id=m.red_id and boost_kind='exp' and expires_at>now();
      d_r:=round(d_r*bm);
    elsif p_winner='black' and d_b>0 then
      select coalesce(max(mult),1) into bm from public.active_boosts where user_id=m.black_id and boost_kind='exp' and expires_at>now();
      d_b:=round(d_b*bm);
    end if;
    -- Chuỗi thắng & Thy Mây
    if p_winner='red' then st_r:=st_r+1; st_b:=0;
    elsif p_winner='black' then st_b:=st_b+1; st_r:=0; end if;
    if m.ply>=coin_min_plies then
      c_r:=case when p_winner='red' and st_r>=3 then 2 else 1 end;
      c_b:=case when p_winner='black' and st_b>=3 then 2 else 1 end;
    end if;
    end if;   -- hết nhánh Rank thường
  elsif m.mode='khi' then
    -- Mỗi người đã bị giữ cọc m.bet khi vào trận: thắng nhận lại cọc + lời (lời = cọc x thẻ Khí), hòa hoàn cọc
    if p_winner='red' then
      select coalesce(max(mult),1) into bm from public.active_boosts where user_id=m.red_id and boost_kind='khi' and expires_at>now();
      k_r:=m.bet*bm; pay_r:=m.bet+k_r; k_b:=-m.bet;
    elsif p_winner='black' then
      select coalesce(max(mult),1) into bm from public.active_boosts where user_id=m.black_id and boost_kind='khi' and expires_at>now();
      k_b:=m.bet*bm; pay_b:=m.bet+k_b; k_r:=-m.bet;
    else pay_r:=m.bet; pay_b:=m.bet; end if;
  end if;

  -- Phòng riêng: cược Khí / Thy Mây (cọc đã bị giữ khi vào phòng). Thắng nhận lại cọc của mình + cọc đối thủ, hòa hoàn cọc.
  -- Không áp thẻ nhân và không cộng bảng xếp hạng tuần cho phòng riêng.
  if m.mode='room' then
    if m.bet>0 then
      if p_winner='red' then pay_r:=2*m.bet; k_r:=m.bet; k_b:=-m.bet;
      elsif p_winner='black' then pay_b:=2*m.bet; k_b:=m.bet; k_r:=-m.bet;
      else pay_r:=m.bet; pay_b:=m.bet; end if;
    end if;
    if m.bet_coins>0 then
      if p_winner='red' then rc_r:=2*m.bet_coins; c_r:=m.bet_coins; c_b:=-m.bet_coins;
      elsif p_winner='black' then rc_b:=2*m.bet_coins; c_b:=m.bet_coins; c_r:=-m.bet_coins;
      else rc_r:=m.bet_coins; rc_b:=m.bet_coins; end if;
    end if;
  end if;

  update public.profiles set rating=rating+d_r, khi=khi+pay_r,
    win_streak=case when m.mode='ranked' then st_r else win_streak end,
    wins=wins+case when p_winner='red' then 1 else 0 end,
    losses=losses+case when p_winner='black' then 1 else 0 end,
    draws=draws+case when p_winner is null then 1 else 0 end
  where id=m.red_id;
  update public.profiles set rating=rating+d_b, khi=khi+pay_b,
    win_streak=case when m.mode='ranked' then st_b else win_streak end,
    wins=wins+case when p_winner='black' then 1 else 0 end,
    losses=losses+case when p_winner='red' then 1 else 0 end,
    draws=draws+case when p_winner is null then 1 else 0 end
  where id=m.black_id;

  -- Bảng xếp hạng tuần: cộng Khí lời/lỗ ròng của trận Luyện Khí (đã gồm thẻ Khí)
  if m.mode='khi' and m.ply>=week_min_plies then
    insert into public.weekly_khi(user_id,week_start,gained,games,wins)
      values(m.red_id,ws,k_r,1,case when p_winner='red' then 1 else 0 end)
      on conflict (user_id,week_start) do update
      set gained=public.weekly_khi.gained+excluded.gained,games=public.weekly_khi.games+1,
          wins=public.weekly_khi.wins+excluded.wins,updated_at=now();
    insert into public.weekly_khi(user_id,week_start,gained,games,wins)
      values(m.black_id,ws,k_b,1,case when p_winner='black' then 1 else 0 end)
      on conflict (user_id,week_start) do update
      set gained=public.weekly_khi.gained+excluded.gained,games=public.weekly_khi.games+1,
          wins=public.weekly_khi.wins+excluded.wins,updated_at=now();
  end if;

  if m.mode='ranked' and c_r>0 then perform public._add_coins(m.red_id,c_r,'ranked','Trận Rank'||case when p_winner='red' and st_r>=3 then ' • chuỗi thắng '||st_r||' (x2)' else '' end); end if;
  if m.mode='ranked' and c_b>0 then perform public._add_coins(m.black_id,c_b,'ranked','Trận Rank'||case when p_winner='black' and st_b>=3 then ' • chuỗi thắng '||st_b||' (x2)' else '' end); end if;

  if rc_r>0 then perform public._add_coins(m.red_id,rc_r,'room_payout',case when p_winner='red' then 'Thắng cược phòng riêng' else 'Hoàn cược phòng riêng (hòa)' end); end if;
  if rc_b>0 then perform public._add_coins(m.black_id,rc_b,'room_payout',case when p_winner='black' then 'Thắng cược phòng riêng' else 'Hoàn cược phòng riêng (hòa)' end); end if;

  update public.matches set status='finished',winner=p_winner,reason=p_reason,ended_at=now(),
    red_rating_delta=d_r,black_rating_delta=d_b,red_khi_delta=k_r,black_khi_delta=k_b,
    red_coin_delta=c_r,black_coin_delta=c_b,
    red_streak=case when m.mode='ranked' then st_r else 0 end,
    black_streak=case when m.mode='ranked' then st_b else 0 end
  where id=p_match;
end $$;
revoke all on function public._settle(uuid,text,text) from public,anon,authenticated;

-- ---------- GHÉP TRẬN ----------
-- Client gọi lặp lại (mỗi ~3 giây) cho tới khi nhận được id trận.
create or replace function public.find_match(p_mode text,p_bet int default 0) returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); me public.profiles; my_join timestamptz; opp record; mid uuid;
  red uuid; blk uuid; waited numeric; win_ int; move_seconds constant int:=150;
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  if p_mode not in ('casual','ranked','khi') then raise exception 'Chế độ không hợp lệ'; end if;
  if p_mode='khi' then
    if p_bet not in (2,10,50,500,900) then raise exception 'Mức cược không hợp lệ'; end if;
  else p_bet:=0; end if;

  perform pg_advisory_xact_lock(74151);   -- xếp hàng ghép trận tuần tự, tránh ghép đôi trùng

  select id into mid from public.matches where status='playing' and uid in (red_id,black_id) limit 1;
  if mid is not null then delete from public.matchmaking_queue where user_id=uid; return mid; end if;
  if exists(select 1 from public.tam_matches where status='playing' and uid=any(players)) then
    raise exception 'Bạn đang trong một ván Tam đấu chưa kết thúc'; end if;

  delete from public.matchmaking_queue where seen_at < now()-interval '12 seconds';

  select * into me from public.profiles where id=uid;
  if not found then raise exception 'Chưa có hồ sơ'; end if;
  if p_mode='khi' and me.khi<p_bet then raise exception 'Không đủ Khí để cược'; end if;

  insert into public.matchmaking_queue(user_id,mode,bet,rating) values(uid,p_mode,p_bet,me.rating)
  on conflict (user_id) do update set
    joined_at=case when matchmaking_queue.mode=excluded.mode and matchmaking_queue.bet=excluded.bet then matchmaking_queue.joined_at else now() end,
    mode=excluded.mode,bet=excluded.bet,rating=excluded.rating,seen_at=now();
  select joined_at into my_join from public.matchmaking_queue where user_id=uid;

  select q.user_id,q.joined_at into opp
  from public.matchmaking_queue q join public.profiles p on p.id=q.user_id
  where q.user_id<>uid and q.mode=p_mode and q.bet=p_bet
    and (p_mode<>'khi' or p.khi>=p_bet)
    and (p_mode<>'ranked' or abs(q.rating-me.rating) <=
         100 + 10*floor(extract(epoch from (now()-least(q.joined_at,my_join)))))  -- chờ càng lâu, biên độ Rank càng rộng
  order by q.joined_at limit 1;

  if opp.user_id is null then return null; end if;

  if random()<0.5 then red:=uid; blk:=opp.user_id; else red:=opp.user_id; blk:=uid; end if;
  insert into public.matches(red_id,black_id,mode,bet,deadline,red_rating,black_rating)
  values(red,blk,p_mode,p_bet,now()+make_interval(secs=>move_seconds),
         (select rating from public.profiles where id=red),(select rating from public.profiles where id=blk))
  returning id into mid;

  if p_mode='khi' then   -- giữ cọc
    update public.profiles set khi=khi-p_bet where id in (red,blk);
  end if;
  delete from public.matchmaking_queue where user_id in (red,blk);
  return mid;
end $$;

create or replace function public.cancel_queue() returns void
language sql security definer set search_path=public as $$
  delete from public.matchmaking_queue where user_id=auth.uid();
$$;

-- ---------- ĐI QUÂN ----------
create or replace function public.make_move(p_match uuid,p_ply int,p_fx int,p_fy int,p_tx int,p_ty int) returns void
language plpgsql security definer set search_path=public as $$
declare m public.matches; uid uuid:=auth.uid(); move_seconds constant int:=150;
begin
  select * into m from public.matches where id=p_match for update;
  if not found then raise exception 'Không tìm thấy trận'; end if;
  if uid is null or uid not in (m.red_id,m.black_id) then raise exception 'Bạn không thuộc trận này'; end if;
  if m.status<>'playing' then raise exception 'Trận đã kết thúc'; end if;
  if p_ply<>m.ply then raise exception 'Lệch nước đi, hãy tải lại'; end if;
  if (m.ply%2=0 and uid<>m.red_id) or (m.ply%2=1 and uid<>m.black_id) then raise exception 'Chưa đến lượt bạn'; end if;
  if now()>m.deadline then raise exception 'Đã hết giờ'; end if;
  if p_fx not between 0 and 8 or p_tx not between 0 and 8 or p_fy not between 0 and 9 or p_ty not between 0 and 9
     or (p_fx=p_tx and p_fy=p_ty) then raise exception 'Nước đi không hợp lệ'; end if;
  insert into public.match_moves(match_id,ply,fx,fy,tx,ty) values(p_match,p_ply,p_fx,p_fy,p_tx,p_ty);
  update public.matches set ply=ply+1,deadline=now()+make_interval(secs=>move_seconds) where id=p_match;
end $$;

-- ---------- KẾT THÚC TRẬN ----------
-- Xin thua: người gọi thua.
create or replace function public.resign_match(p_match uuid) returns void
language plpgsql security definer set search_path=public as $$
declare m public.matches; uid uuid:=auth.uid();
begin
  select * into m from public.matches where id=p_match for update;
  if not found or uid is null or uid not in (m.red_id,m.black_id) then raise exception 'Bạn không thuộc trận này'; end if;
  if m.status<>'playing' then return; end if;
  perform public._settle(p_match,case when uid=m.red_id then 'black' else 'red' end,'Xin thua');
end $$;

-- Hết giờ: bên đang tới lượt mà quá hạn sẽ thua. Ai trong trận cũng gọi được, server tự kiểm tra hạn.
create or replace function public.claim_timeout(p_match uuid) returns void
language plpgsql security definer set search_path=public as $$
declare m public.matches; uid uuid:=auth.uid();
begin
  select * into m from public.matches where id=p_match for update;
  if not found or uid is null or uid not in (m.red_id,m.black_id) then raise exception 'Bạn không thuộc trận này'; end if;
  if m.status<>'playing' or now()<=m.deadline then return; end if;
  perform public._settle(p_match,case when m.ply%2=0 then 'black' else 'red' end,'Hết giờ');
end $$;

-- Kết thúc theo luật (chiếu bí, hết nước, hòa lặp thế...): bên vừa đi nước cuối báo kết quả.
create or replace function public.finish_match(p_match uuid,p_result text,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare m public.matches; uid uuid:=auth.uid(); mover uuid;
begin
  select * into m from public.matches where id=p_match for update;
  if not found or uid is null or uid not in (m.red_id,m.black_id) then raise exception 'Bạn không thuộc trận này'; end if;
  if m.status<>'playing' then return; end if;
  if p_result not in ('win','draw') then raise exception 'Kết quả không hợp lệ'; end if;
  if m.ply<1 then raise exception 'Trận chưa có nước đi'; end if;
  mover:=case when m.ply%2=1 then m.red_id else m.black_id end;   -- người đi nước cuối
  if uid<>mover then raise exception 'Chỉ bên vừa đi nước cuối được báo kết quả'; end if;
  perform public._settle(p_match,
    case when p_result='draw' then null when mover=m.red_id then 'red' else 'black' end,
    left(coalesce(p_reason,'Kết thúc theo luật'),80));
end $$;

-- ---------- LỊCH SỬ ----------
drop function if exists public.my_history(int);   -- đổi cột trả về nên phải xóa hàm cũ
create or replace function public.my_history(p_limit int default 50)
returns table(id uuid,mode text,bet int,my_color text,opponent text,opponent_rating int,result text,reason text,
              rating_delta int,khi_delta numeric,coin_delta int,plies int,ended_at timestamptz,bet_coins int,rated boolean)
language sql stable security definer set search_path=public as $$
  select m.id,m.mode,m.bet,
    case when m.red_id=auth.uid() then 'red' else 'black' end,
    p.username,
    case when m.red_id=auth.uid() then m.black_rating else m.red_rating end,
    case when m.winner is null then 'draw'
         when (m.winner='red')=(m.red_id=auth.uid()) then 'win' else 'loss' end,
    m.reason,
    case when m.red_id=auth.uid() then m.red_rating_delta else m.black_rating_delta end,
    case when m.red_id=auth.uid() then m.red_khi_delta else m.black_khi_delta end,
    case when m.red_id=auth.uid() then m.red_coin_delta else m.black_coin_delta end,
    m.ply,m.ended_at,m.bet_coins,(m.mode='ranked' or m.rated)
  from public.matches m
  join public.profiles p on p.id=case when m.red_id=auth.uid() then m.black_id else m.red_id end
  where m.status='finished' and auth.uid() in (m.red_id,m.black_id)
  order by m.ended_at desc nulls last
  limit least(greatest(p_limit,1),200);
$$;

-- =====================================================================
-- BẢNG XẾP HẠNG TUẦN
-- p_offset: 0 = tuần này, 1 = tuần trước, ... (tối đa 52). Trả về top p_limit và luôn kèm dòng của chính người gọi (is_me).
-- Xếp theo Khí lời ròng trong tuần; bằng điểm thì ai thắng nhiều hơn, rồi ít trận hơn, rồi tài khoản lập sớm hơn đứng trước.
-- =====================================================================
drop function if exists public.weekly_leaderboard(int,int);
create or replace function public.weekly_leaderboard(p_offset int default 0,p_limit int default 50)
returns table(pos bigint,player_id uuid,username text,equipped jsonb,khi numeric,gained numeric,games int,wins int,
              is_me boolean,wk_start date,wk_end timestamptz)
language sql stable security definer set search_path=public as $$
  with w as (
    select public._week_start()-7*greatest(least(coalesce(p_offset,0),52),0) as ws
  ), r as (
    select row_number() over (order by k.gained desc,k.wins desc,k.games asc,p.created_at asc) as rk,
           k.user_id as uid,p.username as uname,p.equipped as eq,p.khi as total_khi,
           k.gained as g,k.games as gm,k.wins as wn
    from public.weekly_khi k
    join public.profiles p on p.id=k.user_id
    join w on k.week_start=w.ws
  )
  select r.rk,r.uid,r.uname,r.eq,r.total_khi,r.g,r.gm,r.wn,(r.uid=auth.uid()),
         (select ws from w),(((select ws from w)+7)::timestamp at time zone 'Asia/Ho_Chi_Minh')
  from r
  where r.rk<=least(greatest(coalesce(p_limit,50),1),100) or r.uid=auth.uid()
  order by r.rk;
$$;

-- =====================================================================
-- SHOP: MUA / DÙNG THẺ / TRANG BỊ
-- =====================================================================
create or replace function public.buy_item(p_item text) returns void
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); it public.shop_items; pr public.profiles;
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  select * into it from public.shop_items where id=p_item;
  if not found or not it.active then raise exception 'Vật phẩm không tồn tại hoặc đã ngừng bán'; end if;
  select * into pr from public.profiles where id=uid for update;
  if it.kind<>'boost' and exists(select 1 from public.user_items where user_id=uid and item_id=p_item and qty>0) then
    raise exception 'Bạn đã sở hữu vật phẩm này';
  end if;
  if pr.coins<it.price then raise exception 'Không đủ Thy Mây (cần %, bạn có %)',it.price,pr.coins; end if;
  if it.price>0 then perform public._add_coins(uid,-it.price,'purchase','Mua '||it.name); end if;
  insert into public.user_items(user_id,item_id,qty) values(uid,p_item,1)
  on conflict (user_id,item_id) do update set qty=public.user_items.qty+1;
end $$;

-- Dùng thẻ hiệu ứng (EXP / Khí): kích hoạt ngay, chạy theo thời gian thực của server
create or replace function public.use_boost(p_item text) returns void
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); it public.shop_items; ui public.user_items; bk text; bmult numeric; bmin int;
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  select * into it from public.shop_items where id=p_item;
  if not found or it.kind<>'boost' then raise exception 'Đây không phải thẻ hiệu ứng'; end if;
  perform 1 from public.profiles where id=uid for update;   -- tuần tự hóa các lần dùng thẻ của cùng một người
  select * into ui from public.user_items where user_id=uid and item_id=p_item for update;
  if not found or ui.qty<1 then raise exception 'Bạn không có thẻ này'; end if;
  bk:=it.data->>'boost'; bmult:=(it.data->>'mult')::numeric; bmin:=round((it.data->>'minutes')::numeric)::int;
  if bk not in ('exp','khi') or bmult is null or bmin is null then raise exception 'Thẻ cấu hình sai, hãy báo quản trị viên'; end if;
  if exists(select 1 from public.active_boosts where user_id=uid and boost_kind=bk and expires_at>now()) then
    raise exception 'Bạn đang có thẻ % còn hiệu lực, hãy chờ hết hạn rồi dùng thẻ mới',case when bk='exp' then 'EXP' else 'Khí' end;
  end if;
  insert into public.active_boosts(user_id,boost_kind,mult,expires_at,item_id)
  values(uid,bk,bmult,now()+make_interval(mins=>bmin),p_item)
  on conflict (user_id,boost_kind) do update set mult=excluded.mult,expires_at=excluded.expires_at,item_id=excluded.item_id;
  update public.user_items set qty=qty-1 where user_id=uid and item_id=p_item;
  delete from public.user_items where user_id=uid and item_id=p_item and qty<=0;
end $$;

create or replace function public.equip_item(p_item text) returns void
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); it public.shop_items;
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  select * into it from public.shop_items where id=p_item;
  if not found then raise exception 'Vật phẩm không tồn tại'; end if;
  if it.kind='boost' then raise exception 'Thẻ hiệu ứng không trang bị được, hãy dùng thẻ'; end if;
  if not exists(select 1 from public.user_items where user_id=uid and item_id=p_item and qty>0) then
    raise exception 'Bạn chưa sở hữu vật phẩm này';
  end if;
  update public.profiles set equipped=coalesce(equipped,'{}'::jsonb)||jsonb_build_object(it.kind,p_item) where id=uid;
end $$;

create or replace function public.unequip_slot(p_slot text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if p_slot not in ('avatar','avatar_frame','name_frame','board') then raise exception 'Ô trang bị không hợp lệ'; end if;
  update public.profiles set equipped=coalesce(equipped,'{}'::jsonb)-p_slot where id=auth.uid();
end $$;

-- =====================================================================
-- ADMIN
-- =====================================================================
create or replace function public.admin_list_players(p_search text default '',p_limit int default 50)
returns table(id uuid,username text,email text,khi numeric,rating int,coins int,win_streak int,wins int,losses int,draws int,is_admin boolean,created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public._require_admin();
  return query
    select p.id,p.username,u.email::text,p.khi,p.rating,p.coins,p.win_streak,p.wins,p.losses,p.draws,p.is_admin,p.created_at
    from public.profiles p join auth.users u on u.id=p.id
    where coalesce(p_search,'')='' or p.username ilike '%'||p_search||'%' or u.email ilike '%'||p_search||'%'
    order by p.created_at desc
    limit least(greatest(p_limit,1),200);
end $$;

-- Chỉnh Rank / Khí / Thy Mây của một người chơi. p_mode: 'set' = đặt thành, 'add' = cộng (số âm để trừ). Kết quả không bao giờ âm.
create or replace function public.admin_adjust(p_user uuid,p_field text,p_mode text,p_value numeric) returns void
language plpgsql security definer set search_path=public as $$
declare cur numeric; nv numeric; nm text;
begin
  perform public._require_admin();
  if p_mode not in ('add','set') then raise exception 'Chế độ không hợp lệ'; end if;
  if p_value is null then raise exception 'Thiếu giá trị'; end if;
  select username into nm from public.profiles where id=p_user;
  if not found then raise exception 'Không tìm thấy người chơi'; end if;
  if p_field='rating' then
    select rating into cur from public.profiles where id=p_user for update;
    nv:=least(greatest(case when p_mode='set' then p_value else cur+p_value end,0),100000);
    update public.profiles set rating=round(nv)::int where id=p_user;
  elsif p_field='khi' then
    select khi into cur from public.profiles where id=p_user for update;
    nv:=least(greatest(case when p_mode='set' then p_value else cur+p_value end,0),1000000000000000);
    update public.profiles set khi=nv where id=p_user;
  elsif p_field='coins' then
    select coins into cur from public.profiles where id=p_user for update;
    nv:=least(greatest(case when p_mode='set' then p_value else cur+p_value end,0),100000000);
    if round(nv)::int<>cur::int then
      perform public._add_coins(p_user,round(nv)::int-cur::int,'admin','Quản trị viên chỉnh');
    end if;
  else raise exception 'Trường không hợp lệ'; end if;
  insert into public.admin_log(admin_id,action,detail)
  values(auth.uid(),'adjust',jsonb_build_object('target',p_user,'name',nm,'field',p_field,'mode',p_mode,'value',p_value,'before',cur,'after',nv));
end $$;

create or replace function public.admin_player_items(p_user uuid) returns table(item_id text,qty int)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public._require_admin();
  return query select ui.item_id,ui.qty from public.user_items ui where ui.user_id=p_user and ui.qty>0 order by ui.acquired_at desc;
end $$;

create or replace function public.admin_grant_item(p_user uuid,p_item text,p_qty int default 1) returns void
language plpgsql security definer set search_path=public as $$
declare it public.shop_items; nm text; q int;
begin
  perform public._require_admin();
  select * into it from public.shop_items where id=p_item;
  if not found then raise exception 'Vật phẩm không tồn tại'; end if;
  select username into nm from public.profiles where id=p_user;
  if not found then raise exception 'Không tìm thấy người chơi'; end if;
  q:=case when it.kind='boost' then least(greatest(coalesce(p_qty,1),1),99) else 1 end;
  insert into public.user_items(user_id,item_id,qty) values(p_user,p_item,q)
  on conflict (user_id,item_id) do update set qty=case when it.kind='boost' then public.user_items.qty+q else 1 end;
  insert into public.admin_log(admin_id,action,detail)
  values(auth.uid(),'grant_item',jsonb_build_object('target',p_user,'name',nm,'item',it.name,'qty',q));
end $$;

create or replace function public.admin_revoke_item(p_user uuid,p_item text) returns void
language plpgsql security definer set search_path=public as $$
declare it public.shop_items; nm text;
begin
  perform public._require_admin();
  select * into it from public.shop_items where id=p_item;
  if not found then raise exception 'Vật phẩm không tồn tại'; end if;
  select username into nm from public.profiles where id=p_user;
  delete from public.user_items where user_id=p_user and item_id=p_item;
  update public.profiles set equipped=coalesce(equipped,'{}'::jsonb)-it.kind
    where id=p_user and equipped->>it.kind=p_item;
  insert into public.admin_log(admin_id,action,detail)
  values(auth.uid(),'revoke_item',jsonb_build_object('target',p_user,'name',nm,'item',it.name));
end $$;

-- Thêm mới (p_id null) hoặc sửa vật phẩm ngay trong game. Trả về id vật phẩm.
create or replace function public.admin_save_item(p_id text,p_kind text,p_name text,p_desc text,p_price int,p_data jsonb,p_active boolean,p_sort int default 100) returns text
language plpgsql security definer set search_path=public as $$
declare v_id text:=nullif(trim(coalesce(p_id,'')),''); old_kind text; bmult numeric; bmin numeric;
begin
  perform public._require_admin();
  if p_kind not in ('boost','avatar','avatar_frame','name_frame','board') then raise exception 'Loại vật phẩm không hợp lệ'; end if;
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'Tên vật phẩm cần tối thiểu 2 ký tự'; end if;
  if p_price is null or p_price<0 or p_price>1000000 then raise exception 'Giá phải từ 0 đến 1.000.000 Thy Mây'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Dữ liệu vật phẩm không hợp lệ'; end if;
  if p_kind='boost' then
    if coalesce(p_data->>'boost','') not in ('exp','khi') then raise exception 'Thẻ phải thuộc loại exp hoặc khi'; end if;
    begin bmult:=(p_data->>'mult')::numeric; bmin:=(p_data->>'minutes')::numeric;
    exception when others then raise exception 'Hệ số và số phút phải là số'; end;
    if bmult is null or bmult<1 or bmult>100 then raise exception 'Hệ số nhân phải từ 1 đến 100'; end if;
    if bmin is null or bmin<1 or bmin>10080 then raise exception 'Thời gian phải từ 1 đến 10080 phút'; end if;
  end if;
  if (p_data ? 'img') and coalesce(p_data->>'img','') !~* '^https?://' then raise exception 'Ảnh phải là đường dẫn bắt đầu bằng http(s)://'; end if;

  if v_id is null then
    v_id:='it_'||substr(replace(gen_random_uuid()::text,'-',''),1,10);
    insert into public.shop_items(id,kind,name,description,price,data,active,sort)
    values(v_id,p_kind,trim(p_name),coalesce(trim(p_desc),''),p_price,p_data,coalesce(p_active,true),coalesce(p_sort,100));
  else
    select kind into old_kind from public.shop_items where id=v_id;
    if not found then raise exception 'Không tìm thấy vật phẩm để sửa'; end if;
    if old_kind<>p_kind then raise exception 'Không đổi được loại của vật phẩm đã tạo'; end if;
    update public.shop_items set name=trim(p_name),description=coalesce(trim(p_desc),''),price=p_price,data=p_data,
      active=coalesce(p_active,true),sort=coalesce(p_sort,100) where id=v_id;
  end if;
  insert into public.admin_log(admin_id,action,detail)
  values(auth.uid(),'save_item',jsonb_build_object('id',v_id,'name',trim(p_name),'kind',p_kind,'price',p_price,'active',coalesce(p_active,true)));
  return v_id;
end $$;

create or replace function public.admin_delete_item(p_id text) returns void
language plpgsql security definer set search_path=public as $$
declare nm text;
begin
  perform public._require_admin();
  select name into nm from public.shop_items where id=p_id;
  if not found then raise exception 'Không tìm thấy vật phẩm'; end if;
  if exists(select 1 from public.user_items where item_id=p_id) then
    raise exception 'Đã có người sở hữu vật phẩm này. Hãy ẩn khỏi cửa hàng thay vì xóa.';
  end if;
  delete from public.shop_items where id=p_id;
  insert into public.admin_log(admin_id,action,detail) values(auth.uid(),'delete_item',jsonb_build_object('id',p_id,'name',nm));
end $$;

-- =====================================================================
-- VẬT PHẨM MẪU (chỉ thêm nếu chưa có; sửa giá / ẩn / thêm vật phẩm ngay trong game, chạy lại file này không ghi đè)
-- Giá đề xuất theo tốc độ kiếm: 1 Thy Mây / trận Rank, chuỗi thắng >= 3 thì 2 / trận.
-- =====================================================================
insert into public.shop_items(id,kind,name,description,price,data,sort) values
 ('boost_exp_x2_30','boost','Thẻ x2 EXP (30 phút)','Trong 30 phút, mỗi trận Rank thắng nhận gấp đôi điểm Rank.',20,'{"boost":"exp","mult":2,"minutes":30}',10),
 ('boost_khi_x2_30','boost','Thẻ x2 Khí (30 phút)','Trong 30 phút, thắng Luyện Khí nhận gấp đôi Khí lời.',30,'{"boost":"khi","mult":2,"minutes":30}',20),
 ('boost_khi_x4_30','boost','Thẻ x4 Khí (30 phút)','Trong 30 phút, thắng Luyện Khí nhận gấp bốn Khí lời.',60,'{"boost":"khi","mult":4,"minutes":30}',30),
 ('av_long','avatar','Long Vương','Rồng xanh trấn giữ bàn cờ.',60,'{"glyph":"🐉","bg":"#1f5a3a","fg":"#ffffff"}',10),
 ('av_ho','avatar','Bạch Hổ','Mãnh hổ Tây phương.',60,'{"glyph":"🐯","bg":"#7a4a12","fg":"#ffffff"}',20),
 ('av_holy','avatar','Hồ Ly','Nhanh trí, khó đoán.',80,'{"glyph":"🦊","bg":"#a3421a","fg":"#ffffff"}',30),
 ('av_gautruc','avatar','Kỳ Sĩ Gấu Trúc','Ung dung mà thâm sâu.',100,'{"glyph":"🐼","bg":"#2b2b2b","fg":"#ffffff"}',40),
 ('av_kythanh','avatar','Kỳ Thánh','Ấn vàng của bậc thầy cờ.',150,'{"glyph":"聖","bg":"#5a1710","fg":"#f5d77a"}',50),
 ('avf_vang','avatar_frame','Khung Vàng Kim','Viền vàng sáng.',80,'{"c1":"#f7e08a","c2":"#b8862d","width":3,"glow":"#f5d77a","pulse":false}',10),
 ('avf_lam','avatar_frame','Khung Lam Ngọc','Viền xanh ngọc mát mắt.',100,'{"c1":"#7be0ff","c2":"#2b6cc4","width":3,"glow":"#5fc8ff","pulse":false}',20),
 ('avf_hong','avatar_frame','Khung Hồng Liên','Viền đỏ rực, phát sáng nhấp nháy.',150,'{"c1":"#ff7a66","c2":"#a1261d","width":4,"glow":"#ff5a44","pulse":true}',30),
 ('avf_tu','avatar_frame','Khung Tử Điện','Viền tím điện, phát sáng nhấp nháy.',200,'{"c1":"#d9a3ff","c2":"#5b2bc4","width":4,"glow":"#b06bff","pulse":true}',40),
 ('nf_kim','name_frame','Tên Kim Tự','Tên chữ vàng óng ánh.',60,'{"c1":"#ffe08a","c2":"#e0a82e","glow":"#e0a82e","pre":"","post":""}',10),
 ('nf_bang','name_frame','Tên Băng Hàn','Tên xanh băng giá.',80,'{"c1":"#c8f1ff","c2":"#4fb0ff","glow":"#7cc8ff","pre":"❄ ","post":" ❄"}',20),
 ('nf_huyet','name_frame','Tên Huyết Nguyệt','Tên đỏ máu, khí thế bức người.',120,'{"c1":"#ff9d8a","c2":"#d1291b","glow":"#ff4a36","pre":"✦ ","post":" ✦"}',30),
 ('bd_ngoc','board','Sân Ngọc Bích','Bàn cờ ngọc xanh dịu.',150,'{"w1":"#a6dcb7","w2":"#5fa57c","w3":"#8fcaa2","line":"#1f4a33","text":"#1d4a35","vig":"#0f2a1c","grain":0.25,"frame1":"#2f5b45","frame2":"#173626","frame3":"#264d3a","ring":"#8fd0a6"}',10),
 ('bd_muc','board','Sân Mặc Kim','Nền mực đen, đường kẻ vàng.',200,'{"w1":"#3a3d45","w2":"#23262c","w3":"#30333b","line":"#d6bd7a","text":"#d6bd7a","vig":"#000000","grain":0.08,"frame1":"#1c1e24","frame2":"#0d0e11","frame3":"#181a1f","ring":"#8a7a4a"}',20),
 ('bd_tuyet','board','Sân Băng Tuyết','Bàn cờ phủ tuyết trắng xanh.',250,'{"w1":"#eaf4fb","w2":"#a9c8e0","w3":"#cfe2f1","line":"#2d4f6b","text":"#2d4f6b","vig":"#3d6a8f","grain":0.15,"frame1":"#5b86a8","frame2":"#2f5273","frame3":"#4a7597","ring":"#cfe6f7"}',30)
on conflict (id) do nothing;

-- =====================================================================
-- NẠP THY MÂY (chuyển khoản thủ công, admin duyệt)
-- Người chơi tạo lệnh nạp -> chuyển khoản vào tài khoản của chủ game kèm nội dung "NAP<mã lệnh>"
-- -> lệnh hiện ở tab "Nạp tiền" của Quản trị -> admin đối chiếu sao kê rồi bấm Duyệt (cộng Thy Mây) hoặc Từ chối.
-- Bảng quy đổi nằm trong hàm _topup_coins: 10.000đ = 5 Thy Mây, 20.000đ = 11 Thy Mây (cứ mỗi 20.000đ tặng thêm 1).
-- Mức nạp: bội số của 10.000đ, từ 10.000đ đến 1.000.000đ mỗi lệnh (đổi ở hằng số bên dưới).
-- =====================================================================
create table if not exists public.topup_orders(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null check (amount>=10000 and amount<=1000000),
  coins int not null check (coins>0),                 -- số Thy Mây chốt lúc tạo lệnh (đổi bảng giá không ảnh hưởng lệnh cũ)
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  note text,                                          -- lý do từ chối / ghi chú của admin
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);
create index if not exists topup_user_idx on public.topup_orders(user_id,created_at desc);
create index if not exists topup_status_idx on public.topup_orders(status,created_at);
alter table public.topup_orders enable row level security;
drop policy if exists topup_read_own on public.topup_orders;
create policy topup_read_own on public.topup_orders for select to authenticated using (auth.uid()=user_id);
revoke insert,update,delete on public.topup_orders from authenticated, anon;

-- Quy đổi tiền -> Thy Mây: 5 Thy Mây mỗi 10.000đ, cộng thêm 1 cho mỗi 20.000đ (10k=5, 20k=11, 30k=16, 40k=22 ... 1tr=550)
create or replace function public._topup_coins(p_amount int) returns int
language sql immutable as $$
  select (p_amount/10000)*5 + (p_amount/20000);
$$;
revoke all on function public._topup_coins(int) from public,anon,authenticated;

create or replace function public.create_topup(p_amount int) returns bigint
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); v_id bigint;
  c_min constant int:=10000; c_max constant int:=1000000; c_step constant int:=10000; c_pending constant int:=3;
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  if p_amount is null or p_amount<c_min or p_amount>c_max or p_amount%c_step<>0 then
    raise exception 'Số tiền nạp phải là bội số của 10.000đ, từ 10.000đ đến 1.000.000đ';
  end if;
  perform 1 from public.profiles where id=uid for update;   -- khóa hồ sơ để không tạo vượt số lệnh chờ khi bấm dồn
  if (select count(*) from public.topup_orders where user_id=uid and status='pending')>=c_pending then
    raise exception 'Bạn đang có % lệnh chờ duyệt. Hãy chờ duyệt hoặc hủy bớt trước khi tạo lệnh mới',c_pending;
  end if;
  insert into public.topup_orders(user_id,amount,coins) values(uid,p_amount,public._topup_coins(p_amount)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.cancel_topup(p_id bigint) returns void
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  update public.topup_orders set status='cancelled',decided_at=now() where id=p_id and user_id=uid and status='pending';
  if not found then raise exception 'Không hủy được (lệnh không tồn tại hoặc đã được xử lý)'; end if;
end $$;

create or replace function public.admin_list_topups(p_status text default 'pending',p_limit int default 100)
returns table(id bigint,user_id uuid,username text,email text,amount int,coins int,status text,note text,created_at timestamptz,decided_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public._require_admin();
  return query
    select o.id,o.user_id,p.username,u.email::text,o.amount,o.coins,o.status,o.note,o.created_at,o.decided_at
    from public.topup_orders o join public.profiles p on p.id=o.user_id join auth.users u on u.id=o.user_id
    where coalesce(p_status,'')='' or p_status='all' or o.status=p_status
    order by case when o.status='pending' then 0 else 1 end, o.created_at desc
    limit least(greatest(p_limit,1),300);
end $$;

create or replace function public.admin_approve_topup(p_id bigint) returns void
language plpgsql security definer set search_path=public as $$
declare o public.topup_orders; nm text;
begin
  perform public._require_admin();
  select * into o from public.topup_orders where id=p_id for update;
  if not found then raise exception 'Không tìm thấy lệnh nạp'; end if;
  if o.status<>'pending' then raise exception 'Lệnh này đã được xử lý (%), không duyệt lại được',o.status; end if;
  select username into nm from public.profiles where id=o.user_id;
  perform public._add_coins(o.user_id,o.coins,'topup','Nạp '||to_char(o.amount,'FM999G999G999')||'đ • NAP'||o.id);
  update public.topup_orders set status='approved',decided_at=now(),decided_by=auth.uid() where id=p_id;
  insert into public.admin_log(admin_id,action,detail)
  values(auth.uid(),'topup_approve',jsonb_build_object('order',p_id,'target',o.user_id,'name',nm,'amount',o.amount,'coins',o.coins));
end $$;

create or replace function public.admin_reject_topup(p_id bigint,p_note text default null) returns void
language plpgsql security definer set search_path=public as $$
declare o public.topup_orders; nm text;
begin
  perform public._require_admin();
  select * into o from public.topup_orders where id=p_id for update;
  if not found then raise exception 'Không tìm thấy lệnh nạp'; end if;
  if o.status<>'pending' then raise exception 'Lệnh này đã được xử lý (%)',o.status; end if;
  select username into nm from public.profiles where id=o.user_id;
  update public.topup_orders set status='rejected',note=nullif(trim(coalesce(p_note,'')),''),decided_at=now(),decided_by=auth.uid() where id=p_id;
  insert into public.admin_log(admin_id,action,detail)
  values(auth.uid(),'topup_reject',jsonb_build_object('order',p_id,'target',o.user_id,'name',nm,'amount',o.amount,'note',p_note));
end $$;

-- =====================================================================
-- TÀI KHOẢN ADMIN
-- 1) Đăng ký một tài khoản bình thường trong game.
-- 2) Đổi email bên dưới thành đúng email đó.
-- 3) Chạy lại file này (hoặc chỉ khối này). Đăng nhập lại là thấy mục "Quản trị" ở trang chủ.
-- (Không tự cấp quyền khi đăng ký, để không ai giành được quyền admin bằng cách đăng ký trước.)
-- =====================================================================
do $$ declare v_email constant text:='admin@example.com';
begin
  if v_email<>'admin@example.com' then
    update public.profiles set is_admin=true where id in (select id from auth.users where lower(email)=lower(v_email));
  end if;
end $$;


-- =====================================================================
-- GIAI ĐOẠN 5: BẠN BÈ (kết bạn bằng ID) + PHÒNG RIÊNG
-- =====================================================================

-- Hiện diện: client gọi mỗi ~40 giây; online = thấy trong 75 giây gần nhất
create or replace function public.touch_presence() returns void
language sql security definer set search_path=public as $$
  update public.profiles set last_seen=now() where id=auth.uid();
$$;

create table if not exists public.friendships(
  user_lo uuid not null references auth.users(id) on delete cascade,
  user_hi uuid not null references auth.users(id) on delete cascade,
  requester uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key(user_lo,user_hi),
  check (user_lo<user_hi),
  check (requester in (user_lo,user_hi))
);
create index if not exists friendships_hi_idx on public.friendships(user_hi);
alter table public.friendships enable row level security;
drop policy if exists friendships_read on public.friendships;
create policy friendships_read on public.friendships for select to authenticated using (auth.uid() in (user_lo,user_hi));
revoke insert,update,delete on public.friendships from authenticated, anon;

-- Gửi lời mời theo ID. Nếu bên kia đã mời mình trước thì tự chấp nhận. Trả về 'sent' hoặc 'accepted'.
create or replace function public.send_friend_request(p_code text) returns text
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); t uuid; lo uuid; hi uuid; f public.friendships; cnt int;
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  select id into t from public.profiles where player_code=regexp_replace(coalesce(p_code,''),'\s','','g');
  if t is null then raise exception 'Không tìm thấy người chơi có ID này'; end if;
  if t=uid then raise exception 'Đây là ID của chính bạn'; end if;
  lo:=case when uid<t then uid else t end; hi:=case when uid<t then t else uid end;
  select * into f from public.friendships where user_lo=lo and user_hi=hi for update;
  if found then
    if f.status='accepted' then raise exception 'Hai bạn đã là bạn bè'; end if;
    if f.requester=uid then raise exception 'Bạn đã gửi lời mời rồi, hãy chờ họ chấp nhận'; end if;
    update public.friendships set status='accepted' where user_lo=lo and user_hi=hi;
    return 'accepted';
  end if;
  select count(*) into cnt from public.friendships where requester=uid and status='pending';
  if cnt>=30 then raise exception 'Bạn đang có quá nhiều lời mời chờ (tối đa 30)'; end if;
  select count(*) into cnt from public.friendships where status='accepted' and uid in (user_lo,user_hi);
  if cnt>=200 then raise exception 'Danh sách bạn bè đã đầy (tối đa 200)'; end if;
  insert into public.friendships(user_lo,user_hi,requester) values(lo,hi,uid);
  return 'sent';
end $$;

-- Chấp nhận lời mời của người p_other (chỉ bên được mời mới chấp nhận được)
create or replace function public.accept_friend(p_other uuid) returns void
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); lo uuid; hi uuid; n int;
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  lo:=case when uid<p_other then uid else p_other end; hi:=case when uid<p_other then p_other else uid end;
  update public.friendships set status='accepted'
    where user_lo=lo and user_hi=hi and status='pending' and requester=p_other;
  get diagnostics n=row_count;
  if n=0 then raise exception 'Không có lời mời để chấp nhận'; end if;
end $$;

-- Xóa bạn / từ chối lời mời / hủy lời mời đã gửi
create or replace function public.remove_friend(p_other uuid) returns void
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); lo uuid; hi uuid;
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  lo:=case when uid<p_other then uid else p_other end; hi:=case when uid<p_other then p_other else uid end;
  delete from public.friendships where user_lo=lo and user_hi=hi;
end $$;

-- Danh sách bạn + lời mời. relation: friend | incoming (họ mời mình) | outgoing (mình mời họ)
create or replace function public.my_friends()
returns table(id uuid,username text,player_code text,rating int,khi numeric,equipped jsonb,relation text,online boolean,in_match boolean)
language sql stable security definer set search_path=public as $$
  select p.id,p.username,p.player_code,p.rating,p.khi,p.equipped,
    case when f.status='accepted' then 'friend' when f.requester=auth.uid() then 'outgoing' else 'incoming' end,
    coalesce(p.last_seen>now()-interval '75 seconds',false),
    exists(select 1 from public.matches m where m.status='playing' and p.id in (m.red_id,m.black_id))
  from public.friendships f
  join public.profiles p on p.id=case when f.user_lo=auth.uid() then f.user_hi else f.user_lo end
  where auth.uid() in (f.user_lo,f.user_hi)
  order by case when f.status='pending' and f.requester<>auth.uid() then 0 when f.status='accepted' then 1 else 2 end,
           (p.last_seen>now()-interval '75 seconds') desc nulls last, p.username;
$$;

-- ---------- PHÒNG RIÊNG ----------
-- Chủ phòng tạo phòng với các tùy chọn: tính Rank (Elo) hay không, cược Khí, cược Thy Mây (mỗi thứ độc lập, để 0 = không cược).
-- Người vào phòng bằng mã 6 ký tự hoặc lời mời gửi cho bạn bè. Khi có người vào, ván bắt đầu ngay và cả hai bị giữ cọc.
-- Phòng "còn sống" nếu chủ phòng còn gọi room_status trong 120 giây gần nhất.
create table if not exists public.rooms(
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users(id) on delete cascade,
  guest_id uuid references auth.users(id) on delete set null,
  invited_id uuid references auth.users(id) on delete set null,
  rated boolean not null default false,
  bet_khi int not null default 0 check (bet_khi>=0),
  bet_coins int not null default 0 check (bet_coins>=0),
  status text not null default 'waiting' check (status in ('waiting','playing','closed')),
  match_id uuid,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create index if not exists rooms_host_idx on public.rooms(host_id,created_at desc);
alter table public.rooms enable row level security;
revoke all on public.rooms from authenticated, anon;   -- chỉ truy cập qua các hàm bên dưới

create or replace function public._gen_room_code() returns text
language plpgsql volatile security definer set search_path=public as $$
declare a constant text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; n int:=0; i int;
begin
  loop
    c:='';
    for i in 1..6 loop c:=c||substr(a,1+floor(random()*32)::int,1); end loop;
    exit when not exists(select 1 from public.rooms where code=c);
    n:=n+1; if n>60 then raise exception 'Không tạo được mã phòng'; end if;
  end loop;
  return c;
end $$;
revoke all on function public._gen_room_code() from public,anon,authenticated;

create or replace function public.create_room(p_rated boolean,p_bet_khi int,p_bet_coins int,p_invite uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); me public.profiles; rid uuid; c text; lo uuid; hi uuid;
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  p_bet_khi:=coalesce(p_bet_khi,0); p_bet_coins:=coalesce(p_bet_coins,0);
  if p_bet_khi<0 or p_bet_khi>1000000000 then raise exception 'Mức cược Khí không hợp lệ'; end if;
  if p_bet_coins<0 or p_bet_coins>1000000 then raise exception 'Mức cược Thy Mây không hợp lệ'; end if;
  select * into me from public.profiles where id=uid;
  if not found then raise exception 'Chưa có hồ sơ'; end if;
  if exists(select 1 from public.matches where status='playing' and uid in (red_id,black_id)) then
    raise exception 'Bạn đang trong một ván đấu'; end if;
  if me.khi<p_bet_khi then raise exception 'Bạn không đủ Khí để đặt mức cược này'; end if;
  if me.coins<p_bet_coins then raise exception 'Bạn không đủ Thy Mây để đặt mức cược này'; end if;
  if p_invite is not null then
    if p_invite=uid then raise exception 'Không thể mời chính mình'; end if;
    lo:=case when uid<p_invite then uid else p_invite end; hi:=case when uid<p_invite then p_invite else uid end;
    if not exists(select 1 from public.friendships where user_lo=lo and user_hi=hi and status='accepted') then
      raise exception 'Chỉ mời được người đã là bạn bè'; end if;
  end if;
  update public.rooms set status='closed' where host_id=uid and status='waiting';   -- mỗi người chỉ mở một phòng chờ
  delete from public.matchmaking_queue where user_id=uid;
  delete from public.rooms where status='closed' and created_at<now()-interval '1 day';
  c:=public._gen_room_code();
  insert into public.rooms(code,host_id,invited_id,rated,bet_khi,bet_coins)
    values(c,uid,p_invite,coalesce(p_rated,false),p_bet_khi,p_bet_coins) returning id into rid;
  return jsonb_build_object('id',rid,'code',c);
end $$;

-- Xem thông tin phòng trước khi vào (để người vào biết luật cược)
create or replace function public.room_info(p_code text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.rooms; h public.profiles;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  select * into r from public.rooms where code=upper(regexp_replace(coalesce(p_code,''),'\s','','g'));
  if not found then raise exception 'Không tìm thấy phòng với mã này'; end if;
  if r.status<>'waiting' or r.seen_at<now()-interval '120 seconds' then raise exception 'Phòng đã đóng hoặc đã bắt đầu'; end if;
  if r.invited_id is not null and r.invited_id<>auth.uid() and r.host_id<>auth.uid() then
    raise exception 'Phòng này chỉ dành cho người được mời'; end if;
  select * into h from public.profiles where id=r.host_id;
  return jsonb_build_object('id',r.id,'code',r.code,'host_id',h.id,'host_name',h.username,'host_code',h.player_code,
    'host_rating',h.rating,'host_equipped',h.equipped,'rated',r.rated,'bet_khi',r.bet_khi,'bet_coins',r.bet_coins,
    'invited',r.invited_id is not null,'mine',r.host_id=auth.uid());
end $$;

-- Vào phòng: kiểm tra đủ Khí/Thy Mây của cả hai, giữ cọc, tạo ván. Trả về id ván.
create or replace function public.join_room(p_code text) returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); r public.rooms; a public.profiles; b public.profiles; red uuid; blk uuid; mid uuid;
  move_seconds constant int:=150;
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  perform pg_advisory_xact_lock(74151);   -- cùng khóa với find_match để không bị ghép đôi trùng
  select * into r from public.rooms where code=upper(regexp_replace(coalesce(p_code,''),'\s','','g')) for update;
  if not found then raise exception 'Không tìm thấy phòng với mã này'; end if;
  if r.host_id=uid then raise exception 'Đây là phòng của chính bạn'; end if;
  if r.status<>'waiting' or r.seen_at<now()-interval '120 seconds' then raise exception 'Phòng đã đóng hoặc đã bắt đầu'; end if;
  if r.invited_id is not null and r.invited_id<>uid then raise exception 'Phòng này chỉ dành cho người được mời'; end if;
  if exists(select 1 from public.matches where status='playing' and uid in (red_id,black_id)) then
    raise exception 'Bạn đang trong một ván đấu khác'; end if;
  if exists(select 1 from public.tam_matches where status='playing' and uid=any(players)) then
    raise exception 'Bạn đang trong một ván Tam đấu chưa kết thúc'; end if;
  if exists(select 1 from public.matches where status='playing' and r.host_id in (red_id,black_id)) then
    raise exception 'Chủ phòng đang trong một ván đấu khác'; end if;
  perform 1 from public.profiles where id in (uid,r.host_id) order by id for update;
  select * into a from public.profiles where id=r.host_id;
  select * into b from public.profiles where id=uid;
  if a.khi<r.bet_khi then raise exception 'Chủ phòng không đủ Khí để cược'; end if;
  if b.khi<r.bet_khi then raise exception 'Bạn không đủ Khí (cần % Khí) để vào phòng này',r.bet_khi; end if;
  if a.coins<r.bet_coins then raise exception 'Chủ phòng không đủ Thy Mây để cược'; end if;
  if b.coins<r.bet_coins then raise exception 'Bạn không đủ Thy Mây (cần % Thy Mây) để vào phòng này',r.bet_coins; end if;

  if random()<0.5 then red:=r.host_id; blk:=uid; else red:=uid; blk:=r.host_id; end if;
  insert into public.matches(red_id,black_id,mode,bet,bet_coins,rated,room_id,deadline,red_rating,black_rating)
  values(red,blk,'room',r.bet_khi,r.bet_coins,r.rated,r.id,now()+make_interval(secs=>move_seconds),
         (select rating from public.profiles where id=red),(select rating from public.profiles where id=blk))
  returning id into mid;

  if r.bet_khi>0 then update public.profiles set khi=khi-r.bet_khi where id in (red,blk); end if;
  if r.bet_coins>0 then
    perform public._add_coins(red,-r.bet_coins,'room_bet','Cược phòng riêng '||r.code);
    perform public._add_coins(blk,-r.bet_coins,'room_bet','Cược phòng riêng '||r.code);
  end if;
  update public.rooms set status='playing',guest_id=uid,match_id=mid where id=r.id;
  delete from public.matchmaking_queue where user_id in (red,blk);
  return mid;
end $$;

-- Chủ phòng gọi định kỳ (~3 giây) để giữ phòng sống và biết khi có người vào
create or replace function public.room_status(p_room uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); r public.rooms; g public.profiles;
begin
  select * into r from public.rooms where id=p_room for update;
  if not found or uid is null or r.host_id<>uid then raise exception 'Không tìm thấy phòng'; end if;
  if r.status='waiting' then
    if r.seen_at<now()-interval '120 seconds' then
      update public.rooms set status='closed' where id=r.id; r.status:='closed';
    else
      update public.rooms set seen_at=now() where id=r.id;
    end if;
  end if;
  if r.guest_id is not null then select * into g from public.profiles where id=r.guest_id; end if;
  return jsonb_build_object('status',r.status,'match_id',r.match_id,'guest_name',g.username);
end $$;

create or replace function public.close_room(p_room uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  update public.rooms set status='closed' where id=p_room and host_id=auth.uid() and status='waiting';
end $$;

-- Lời mời vào phòng gửi cho tôi (từ bạn bè), còn hiệu lực
create or replace function public.my_room_invites()
returns table(code text,host_id uuid,host_name text,rated boolean,bet_khi int,bet_coins int)
language sql stable security definer set search_path=public as $$
  select r.code,r.host_id,p.username,r.rated,r.bet_khi,r.bet_coins
  from public.rooms r join public.profiles p on p.id=r.host_id
  where r.invited_id=auth.uid() and r.status='waiting' and r.seen_at>now()-interval '120 seconds'
  order by r.created_at desc;
$$;

-- =====================================================================
-- TAM ĐẤU: 3 người cùng đấu trên MỘT bàn cờ, cược Khí (500 / 1000 / 1500)
-- Bàn 13x13 giao điểm. Ghế 0 = Đỏ (dưới, đi lên), ghế 1 = Đen (trên, đi xuống), ghế 2 = Xanh (trái, đi sang phải).
-- Ghế được xáo ngẫu nhiên khi ghép trận. Lượt đi xoay vòng Đỏ -> Đen -> Xanh (bỏ qua người đã bị loại).
-- Luật rút gọn: KHÔNG có luật chiếu tướng. Ai bị ăn tướng, xin thua hoặc hết giờ thì bị loại và toàn bộ quân của họ rời bàn.
-- Còn lại một người thì người đó thắng. Server giữ bàn cờ, tự phát hiện ăn tướng và kiểm tra hình dạng nước đi.
-- Chia cược (tổng 3 phần): Nhất nhận 2 phần (lời 1 phần), Nhì nhận lại 1 phần (hòa vốn), Ba mất 1 phần. Tổng Khí không đổi.
-- Đi quá 450 nước mà chưa phân thắng bại thì hòa, hoàn cược cho cả ba.
-- Sửa hằng số: c_move_seconds / c_max_ply (trong tam_move, _tam_out), hệ số chia cược trong _tam_settle,
-- mức cược hợp lệ trong find_tam. Nhớ sửa src/tam.js cho khớp.
-- =====================================================================
create table if not exists public.tam_queue(
  user_id uuid primary key references auth.users(id) on delete cascade,
  bet int not null,
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
alter table public.tam_queue enable row level security;
revoke all on public.tam_queue from anon, authenticated;

create table if not exists public.tam_matches(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  players uuid[] not null,                          -- [Đỏ, Đen, Xanh]
  bet int not null,
  status text not null default 'playing' check (status in ('playing','finished')),
  board text not null,                              -- 169 ô x 2 ký tự: <ghế><loại quân> hoặc '..' (ô trống)
  turn int not null default 0 check (turn between 0 and 2),
  ply int not null default 0,
  deadline timestamptz not null,
  places int[] not null default '{0,0,0}',          -- hạng của từng ghế: 0 = còn trên bàn, 1 = nhất, 2 = nhì, 3 = ba
  elim int not null default 0,                      -- số người đã bị loại
  draw boolean not null default false,
  kds numeric[] not null default '{0,0,0}',         -- Khí lời/lỗ ròng của từng ghế (chỉ có khi trận đã kết thúc)
  last_move int[],                                  -- {ghế, fx, fy, tx, ty}
  reason text,
  ended_at timestamptz
);
create index if not exists tam_matches_players_idx on public.tam_matches using gin(players);
create index if not exists tam_matches_status_idx on public.tam_matches(status);
alter table public.tam_matches enable row level security;
drop policy if exists tam_matches_read on public.tam_matches;
create policy tam_matches_read on public.tam_matches for select to authenticated using (auth.uid()=any(players));
revoke insert,update,delete on public.tam_matches from anon, authenticated;

-- Chỉ số ô trong chuỗi bàn cờ từ tọa độ cục bộ của quân (u: cột 0..8 của đội hình, v: hàng 0 = hàng cuối .. 3 = hàng tốt)
create or replace function public._tam_idx(s int,u int,v int) returns int
language sql immutable as $$
  select case s when 0 then (12-v)*13+(4+u) when 1 then v*13+(4+u) else (2+u)*13+v end;
$$;

create or replace function public._tam_initial() returns text
language plpgsql immutable as $$
declare cells text[]:=array_fill('..'::text,array[169]);
  back text[]:=array['r','n','b','a','k','a','b','n','r']; s int; u int;
begin
  for s in 0..2 loop
    for u in 0..8 loop cells[public._tam_idx(s,u,0)+1]:=s::text||back[u+1]; end loop;
    cells[public._tam_idx(s,1,2)+1]:=s::text||'c';
    cells[public._tam_idx(s,7,2)+1]:=s::text||'c';
    for u in 0..4 loop cells[public._tam_idx(s,u*2,3)+1]:=s::text||'p'; end loop;
  end loop;
  return array_to_string(cells,'');
end $$;

-- Ghế kế tiếp còn trên bàn sau ghế p_from
create or replace function public._tam_next(p_places int[],p_from int) returns int
language sql immutable as $$
  select t.s from (select ((p_from+i)%3) as s,i from generate_series(1,3) i) t
  where p_places[t.s+1]=0 order by t.i limit 1;
$$;

create or replace function public._tam_seatname(s int) returns text
language sql immutable as $$ select case s when 0 then 'Đỏ' when 1 then 'Đen' else 'Xanh' end; $$;

-- Chốt ván: chia Khí theo hạng (hoặc hoàn cược nếu hòa)
create or replace function public._tam_settle(p_id uuid,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare m public.tam_matches; s int; pay numeric; kd numeric[]:='{0,0,0}';
  ws date:=public._week_start();
  c_weekly constant boolean:=false;   -- true = cộng Khí lời/lỗ của Tam đấu vào bảng xếp hạng tuần
  c_weekly_min_plies constant int:=9;
begin
  select * into m from public.tam_matches where id=p_id for update;
  if not found or m.status<>'playing' then return; end if;
  for s in 0..2 loop
    if m.draw then pay:=m.bet;
    else pay:=case m.places[s+1] when 1 then 2*m.bet when 2 then m.bet else 0 end; end if;
    kd[s+1]:=pay-m.bet;
    update public.profiles set khi=khi+pay where id=m.players[s+1];
    if c_weekly and m.ply>=c_weekly_min_plies then
      insert into public.weekly_khi(user_id,week_start,gained,games,wins)
        values(m.players[s+1],ws,kd[s+1],1,case when m.places[s+1]=1 then 1 else 0 end)
        on conflict (user_id,week_start) do update
        set gained=public.weekly_khi.gained+excluded.gained,games=public.weekly_khi.games+1,
            wins=public.weekly_khi.wins+excluded.wins,updated_at=now();
    end if;
  end loop;
  update public.tam_matches set status='finished',kds=kd,reason=p_reason,ended_at=now() where id=p_id;
end $$;

-- Loại một ghế khỏi ván (bị ăn tướng, xin thua, hết giờ). Nếu chỉ còn một người thì chốt ván.
create or replace function public._tam_out(p_id uuid,p_seat int,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare m public.tam_matches; b text; i int; pls int[]; alive int; last_s int; nt int;
  c_move_seconds constant int:=120;
begin
  select * into m from public.tam_matches where id=p_id for update;
  if not found or m.status<>'playing' or m.places[p_seat+1]<>0 then return; end if;
  pls:=m.places; pls[p_seat+1]:=3-m.elim;          -- người bị loại đầu tiên hạng 3, người thứ hai hạng 2
  b:=m.board;
  for i in 0..168 loop
    if substr(b,i*2+1,1)=p_seat::text then b:=overlay(b placing '..' from i*2+1 for 2); end if;
  end loop;
  select count(*) into alive from generate_series(1,3) g where pls[g]=0;
  if alive=1 then
    select g-1 into last_s from generate_series(1,3) g where pls[g]=0;
    pls[last_s+1]:=1;
    update public.tam_matches set board=b,places=pls,elim=elim+1 where id=p_id;
    perform public._tam_settle(p_id,p_reason);
  else
    nt:=m.turn;
    if m.turn=p_seat then nt:=public._tam_next(pls,p_seat); end if;
    update public.tam_matches set board=b,places=pls,elim=elim+1,turn=nt,
      deadline=case when m.turn=p_seat then now()+make_interval(secs=>c_move_seconds) else deadline end
    where id=p_id;
  end if;
end $$;
revoke all on function public._tam_idx(int,int,int),public._tam_initial(),public._tam_next(int[],int),
  public._tam_seatname(int),public._tam_settle(uuid,text),public._tam_out(uuid,int,text) from public,anon,authenticated;

-- Ghép trận 3 người cùng mức cược. Client gọi lặp lại (~3 giây/lần), trả {"match": id} hoặc {"waiting": số người đang chờ}.
create or replace function public.find_tam(p_bet int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); me public.profiles; mid uuid; others uuid[]; seats uuid[]; waiting int;
  c_move_seconds constant int:=120;
begin
  if uid is null then raise exception 'Chưa đăng nhập'; end if;
  if p_bet not in (500,1000,1500) then raise exception 'Mức cược không hợp lệ'; end if;
  perform pg_advisory_xact_lock(74151);   -- cùng khóa với find_match/join_room để không ai vào hai ván cùng lúc

  select id into mid from public.tam_matches where status='playing' and uid=any(players) limit 1;
  if mid is not null then delete from public.tam_queue where user_id=uid; return jsonb_build_object('match',mid); end if;
  if exists(select 1 from public.matches where status='playing' and uid in (red_id,black_id)) then
    raise exception 'Bạn đang trong một ván đấu khác chưa kết thúc'; end if;

  delete from public.tam_queue where seen_at < now()-interval '12 seconds';
  select * into me from public.profiles where id=uid;
  if not found then raise exception 'Chưa có hồ sơ'; end if;
  if me.khi<p_bet then raise exception 'Không đủ Khí để cược'; end if;

  insert into public.tam_queue(user_id,bet) values(uid,p_bet)
  on conflict (user_id) do update set
    joined_at=case when public.tam_queue.bet=excluded.bet then public.tam_queue.joined_at else now() end,
    bet=excluded.bet,seen_at=now();

  select array_agg(t.user_id) into others from (
    select q.user_id from public.tam_queue q join public.profiles p on p.id=q.user_id
    where q.user_id<>uid and q.bet=p_bet and p.khi>=p_bet
      and not exists(select 1 from public.matches mm where mm.status='playing' and q.user_id in (mm.red_id,mm.black_id))
    order by q.joined_at limit 2) t;
  select count(*) into waiting from public.tam_queue where bet=p_bet;
  if coalesce(array_length(others,1),0)<2 then return jsonb_build_object('waiting',waiting); end if;

  select array_agg(x order by random()) into seats from unnest(array[uid,others[1],others[2]]) x;
  insert into public.tam_matches(players,bet,board,deadline)
  values(seats,p_bet,public._tam_initial(),now()+make_interval(secs=>c_move_seconds)) returning id into mid;
  update public.profiles set khi=khi-p_bet where id=any(seats);      -- giữ cọc
  delete from public.tam_queue where user_id=any(seats);
  return jsonb_build_object('match',mid);
end $$;

create or replace function public.cancel_tam() returns void
language sql security definer set search_path=public as $$
  delete from public.tam_queue where user_id=auth.uid();
$$;

-- Đi quân. Server kiểm tra: đúng lượt, quân của mình, không ăn quân mình, hình dạng nước đi theo loại quân, không đi lùi với tốt.
-- (Chặn chân mã/mắt tượng, cung, sông và pháo ngồi do client kiểm tra, giống các chế độ khác.)
create or replace function public.tam_move(p_match uuid,p_ply int,p_fx int,p_fy int,p_tx int,p_ty int) returns void
language plpgsql security definer set search_path=public as $$
declare m public.tam_matches; uid uuid:=auth.uid(); seat int; b text; fi int; ti int; fc text; tc text; pt text;
  dx int; dy int; ax int; ay int; ok boolean; victim int;
  c_move_seconds constant int:=120; c_max_ply constant int:=450;
begin
  select * into m from public.tam_matches where id=p_match for update;
  if not found then raise exception 'Không tìm thấy trận'; end if;
  seat:=array_position(m.players,uid)-1;
  if uid is null or seat is null then raise exception 'Bạn không thuộc trận này'; end if;
  if m.status<>'playing' then raise exception 'Trận đã kết thúc'; end if;
  if p_ply<>m.ply then raise exception 'Lệch nước đi, hãy tải lại'; end if;
  if m.turn<>seat then raise exception 'Chưa đến lượt bạn'; end if;
  if now()>m.deadline then raise exception 'Đã hết giờ'; end if;
  if p_fx not between 0 and 12 or p_tx not between 0 and 12 or p_fy not between 0 and 12 or p_ty not between 0 and 12
     or (p_fx=p_tx and p_fy=p_ty) then raise exception 'Nước đi không hợp lệ'; end if;
  fi:=p_fy*13+p_fx; ti:=p_ty*13+p_tx;
  fc:=substr(m.board,fi*2+1,2); tc:=substr(m.board,ti*2+1,2);
  if substr(fc,1,1)<>seat::text then raise exception 'Đó không phải quân của bạn'; end if;
  if substr(tc,1,1)=seat::text then raise exception 'Không được ăn quân của mình'; end if;
  pt:=substr(fc,2,1); dx:=p_tx-p_fx; dy:=p_ty-p_fy; ax:=abs(dx); ay:=abs(dy);
  ok:=case pt
    when 'r' then dx=0 or dy=0
    when 'c' then dx=0 or dy=0
    when 'n' then (ax=1 and ay=2) or (ax=2 and ay=1)
    when 'b' then ax=2 and ay=2
    when 'a' then ax=1 and ay=1
    when 'k' then ax+ay=1
    when 'p' then ax+ay=1 and (case seat when 0 then dy<=0 when 1 then dy>=0 else dx>=0 end)
    else false end;
  if not ok then raise exception 'Nước đi không hợp lệ'; end if;

  b:=overlay(m.board placing fc from ti*2+1 for 2);
  b:=overlay(b placing '..' from fi*2+1 for 2);
  update public.tam_matches set board=b,ply=ply+1,turn=public._tam_next(m.places,seat),
    deadline=now()+make_interval(secs=>c_move_seconds),last_move=array[seat,p_fx,p_fy,p_tx,p_ty] where id=p_match;

  if tc<>'..' and substr(tc,2,1)='k' then     -- ăn tướng: loại chủ nhân của tướng
    victim:=substr(tc,1,1)::int;
    perform public._tam_out(p_match,victim,'Tướng '||public._tam_seatname(victim)||' bị '||public._tam_seatname(seat)||' ăn');
  end if;

  select * into m from public.tam_matches where id=p_match;
  if m.status='playing' and m.ply>=c_max_ply then
    update public.tam_matches set draw=true where id=p_match;
    perform public._tam_settle(p_match,'Hết số nước tối đa, hòa cờ');
  end if;
end $$;

-- Xin thua (bất cứ lúc nào, không cần đến lượt): người gọi bị loại.
create or replace function public.tam_resign(p_match uuid) returns void
language plpgsql security definer set search_path=public as $$
declare m public.tam_matches; uid uuid:=auth.uid(); seat int;
begin
  select * into m from public.tam_matches where id=p_match for update;
  seat:=array_position(m.players,uid)-1;
  if not found or uid is null or seat is null then raise exception 'Bạn không thuộc trận này'; end if;
  if m.status<>'playing' then return; end if;
  perform public._tam_out(p_match,seat,public._tam_seatname(seat)||' xin thua');
end $$;

-- Hết giờ: người đang tới lượt mà quá hạn bị loại. Ai trong trận cũng gọi được, server tự kiểm tra hạn.
create or replace function public.tam_claim_timeout(p_match uuid) returns void
language plpgsql security definer set search_path=public as $$
declare m public.tam_matches; uid uuid:=auth.uid();
begin
  select * into m from public.tam_matches where id=p_match for update;
  if not found or uid is null or array_position(m.players,uid) is null then raise exception 'Bạn không thuộc trận này'; end if;
  if m.status<>'playing' or now()<=m.deadline then return; end if;
  perform public._tam_out(p_match,m.turn,public._tam_seatname(m.turn)||' hết giờ');
end $$;

create or replace function public.my_tam_history(p_limit int default 10)
returns table(id uuid,created_at timestamptz,bet int,place int,khi_delta numeric,draw boolean,reason text,ply int)
language sql stable security definer set search_path=public as $$
  select m.id,m.created_at,m.bet,m.places[array_position(m.players,auth.uid())],
         m.kds[array_position(m.players,auth.uid())],m.draw,m.reason,m.ply
  from public.tam_matches m
  where auth.uid()=any(m.players) and m.status='finished'
  order by m.created_at desc limit least(greatest(p_limit,1),50);
$$;

-- ---------- QUYỀN GỌI HÀM ----------
do $$ declare f text; begin
  foreach f in array array[
    'find_match(text,int)','cancel_queue()','make_move(uuid,int,int,int,int,int)',
    'resign_match(uuid)','claim_timeout(uuid)','finish_match(uuid,text,text)','my_history(int)',
    'weekly_leaderboard(int,int)',
    'buy_item(text)','use_boost(text)','equip_item(text)','unequip_slot(text)','is_admin()',
    'admin_list_players(text,int)','admin_adjust(uuid,text,text,numeric)','admin_player_items(uuid)',
    'admin_grant_item(uuid,text,int)','admin_revoke_item(uuid,text)',
    'admin_save_item(text,text,text,text,int,jsonb,boolean,int)','admin_delete_item(text)',
    'touch_presence()','send_friend_request(text)','accept_friend(uuid)','remove_friend(uuid)','my_friends()',
    'create_room(boolean,int,int,uuid)','room_info(text)','join_room(text)','room_status(uuid)','close_room(uuid)','my_room_invites()',
    'create_topup(int)','cancel_topup(bigint)','admin_list_topups(text,int)','admin_approve_topup(bigint)','admin_reject_topup(bigint,text)',
    'find_tam(int)','cancel_tam()','tam_move(uuid,int,int,int,int,int)','tam_resign(uuid)','tam_claim_timeout(uuid)','my_tam_history(int)'
  ] loop
    execute format('revoke all on function public.%s from public,anon',f);
    execute format('grant execute on function public.%s to authenticated',f);
  end loop;
end $$;

-- ---------- REALTIME ----------
do $$ begin
  begin alter publication supabase_realtime add table public.matches; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.match_moves; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.tam_matches; exception when duplicate_object then null; end;
end $$;
