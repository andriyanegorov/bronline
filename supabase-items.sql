-- Allow the admin panel to read promo codes for the management list.
drop policy if exists "Promo codes are readable in admin panel" on public.promo_codes;
create policy "Promo codes are readable in admin panel"
	on public.promo_codes for select
	using (true);

-- Referral system: one invited profile can be attached only once.
create table if not exists public.referrals (
	id bigint generated always as identity primary key,
	referrer_id integer not null references public.profiles(id),
	referred_user_id integer not null references public.profiles(id),
	reward_amount integer not null default 100 check (reward_amount >= 0),
	created_at timestamp with time zone not null default now(),
	rewarded_at timestamp with time zone not null default now(),
	constraint referrals_referred_user_unique unique (referred_user_id),
	constraint referrals_not_self check (referrer_id <> referred_user_id)
);

create index if not exists referrals_referrer_id_idx on public.referrals(referrer_id);
alter table public.referrals enable row level security;

create or replace function public.claim_referral(
	p_referred_user_id integer,
	p_referral_code text,
	p_reward_amount integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	referral_id bigint;
	referrer_profile_id integer;
	reward integer := greatest(coalesce(p_reward_amount, 100), 0);
begin
	if p_referred_user_id is null or p_referral_code !~ '^ref_[0-9]+$' then
		return jsonb_build_object('claimed', false, 'reason', 'invalid_code');
	end if;

	referrer_profile_id := substring(p_referral_code from 5)::integer;
	if referrer_profile_id = p_referred_user_id
	   or not exists (select 1 from public.profiles where id = referrer_profile_id)
	   or not exists (select 1 from public.profiles where id = p_referred_user_id) then
		return jsonb_build_object('claimed', false, 'reason', 'invalid_referrer');
	end if;

	insert into public.referrals (referrer_id, referred_user_id, reward_amount)
	values (referrer_profile_id, p_referred_user_id, reward)
	on conflict (referred_user_id) do nothing
	returning id into referral_id;

	if referral_id is null then
		return jsonb_build_object('claimed', false, 'reason', 'already_claimed');
	end if;

	update public.profiles
	set balance = coalesce(balance, 0) + reward,
		updated_at = now()
	where id = referrer_profile_id;

	return jsonb_build_object('claimed', true, 'referral_id', referral_id, 'reward_amount', reward);
end;
$$;

create or replace function public.get_referral_stats(p_user_id integer)
returns jsonb
language sql
security definer
set search_path = public
as $$
	select jsonb_build_object(
		'referral_code', 'ref_' || p_user_id,
		'referrals_count', count(*)::integer,
		'earned_amount', coalesce(sum(reward_amount), 0)::integer
	)
	from public.referrals
	where referrer_id = p_user_id;
$$;

grant execute on function public.claim_referral(integer, text, integer) to anon, authenticated;
grant execute on function public.get_referral_stats(integer) to anon, authenticated;

-- Free Case event configuration and claims.
create table if not exists public.free_case_events (
	id integer primary key default 1 check (id = 1),
	daily_limit integer not null default 50 check (daily_limit > 0),
	claimed_count integer not null default 0 check (claimed_count >= 0),
	cycle_started_at timestamp with time zone not null default now(),
	reset_at timestamp with time zone not null default (now() + interval '24 hours'),
	updated_at timestamp with time zone not null default now()
);

create table if not exists public.free_case_items (
	id bigint generated always as identity primary key,
	item_id bigint not null references public.items(id),
	chance numeric not null default 0 check (chance >= 0),
	created_at timestamp with time zone not null default now(),
	constraint free_case_items_item_unique unique (item_id)
);

alter table public.free_case_items add column if not exists rarity text;
alter table public.free_case_items add column if not exists chance numeric not null default 0 check (chance >= 0);
update public.free_case_items f set rarity = i.rarity from public.items i where i.id = f.item_id and f.rarity is null;

create table if not exists public.free_case_claims (
	id bigint generated always as identity primary key,
	cycle_started_at timestamp with time zone not null,
	user_id integer not null references public.profiles(id),
	item_id bigint not null references public.items(id),
	claimed_at timestamp with time zone not null default now(),
	constraint free_case_claims_user_cycle_unique unique (cycle_started_at, user_id)
);

insert into public.free_case_events (id) values (1) on conflict (id) do nothing;
alter table public.free_case_events enable row level security;
alter table public.free_case_items enable row level security;
alter table public.free_case_claims enable row level security;

create or replace function public.get_free_case_state(p_user_id integer default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	event_row public.free_case_events;
	items_count integer;
begin
	select * into event_row from public.free_case_events where id = 1;
	if event_row.reset_at <= now() then
		update public.free_case_events
		set claimed_count = 0, cycle_started_at = now(), reset_at = now() + interval '24 hours', updated_at = now()
		where id = 1
		returning * into event_row;
	end if;
	select count(*)::integer into items_count from public.free_case_items;
	return jsonb_build_object(
		'daily_limit', event_row.daily_limit,
		'claimed_count', event_row.claimed_count,
		'reset_at', event_row.reset_at,
		'items_count', items_count,
		'claimed', p_user_id is not null and exists (select 1 from public.free_case_claims where cycle_started_at = event_row.cycle_started_at and user_id = p_user_id)
	);
end;
$$;

create or replace function public.claim_free_case(p_user_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	event_row public.free_case_events;
	selected_item public.items;
	claim_id bigint;
	total_chance numeric;
	random_value numeric;
	running_chance numeric := 0;
	selected_item_id bigint;
	selected_rarity text;
begin
	select * into event_row from public.free_case_events where id = 1 for update;
	if event_row.reset_at <= now() then
		update public.free_case_events
		set claimed_count = 0, cycle_started_at = now(), reset_at = now() + interval '24 hours', updated_at = now()
		where id = 1
		returning * into event_row;
	end if;
	if not exists (select 1 from public.profiles where id = p_user_id) then
		return jsonb_build_object('claimed', false, 'reason', 'profile_not_found');
	end if;
	if exists (select 1 from public.free_case_claims where cycle_started_at = event_row.cycle_started_at and user_id = p_user_id) then
		return jsonb_build_object('claimed', false, 'reason', 'already_claimed', 'reset_at', event_row.reset_at);
	end if;
	if event_row.claimed_count >= event_row.daily_limit then
		return jsonb_build_object('claimed', false, 'reason', 'limit_reached', 'reset_at', event_row.reset_at);
	end if;
	if not exists (select 1 from public.free_case_items) then
		return jsonb_build_object('claimed', false, 'reason', 'empty_event');
	end if;

	select coalesce(sum(chance), 0) into total_chance from public.free_case_items;
	random_value := random() * case when total_chance > 0 then total_chance else (select count(*) from public.free_case_items) end;
	for selected_item_id, selected_rarity in
		select f.item_id, coalesce(f.rarity, i.rarity)
		from public.free_case_items f
		join public.items i on i.id = f.item_id
		order by f.id
	loop
		select running_chance + case when total_chance > 0 then chance else 1 end into running_chance from public.free_case_items where item_id = selected_item_id;
		if random_value <= running_chance then
			select * into selected_item from public.items where id = selected_item_id;
			exit;
		end if;
	end loop;

	insert into public.free_case_claims (cycle_started_at, user_id, item_id)
	values (event_row.cycle_started_at, p_user_id, selected_item.id)
	returning id into claim_id;
	update public.free_case_events set claimed_count = claimed_count + 1, updated_at = now() where id = 1;
	insert into public.inventory (user_id, item_name, rarity, item_value, image_url, quantity)
	values (p_user_id, selected_item.name, selected_rarity, selected_item.item_value, selected_item.image_url, 1);
	return jsonb_build_object('claimed', true, 'claim_id', claim_id, 'item_id', selected_item.id, 'item_name', selected_item.name, 'rarity', selected_rarity, 'item_value', selected_item.item_value, 'image_url', selected_item.image_url, 'reset_at', event_row.reset_at);
end;
$$;

create or replace function public.get_free_case_items()
returns jsonb
language sql
security definer
set search_path = public
as $$
	select coalesce(jsonb_agg(jsonb_build_object(
		'id', i.id,
		'name', i.name,
		'rarity', coalesce(f.rarity, i.rarity),
		'chance', f.chance,
		'item_value', i.item_value,
		'image_url', i.image_url
	) order by f.id), '[]'::jsonb)
	from public.free_case_items f
	join public.items i on i.id = f.item_id;
$$;

create or replace function public.get_recent_free_case_wins(p_limit integer default 5)
returns jsonb
language sql
security definer
set search_path = public
as $$
	select coalesce(jsonb_agg(jsonb_build_object(
		'id', claim.id,
		'item_name', item.name,
		'rarity', coalesce(claim_item.rarity, item.rarity),
		'item_value', item.item_value,
		'opened_at', claim.claimed_at,
		'user_id', claim.user_id,
		'case_name', 'FREE CASE',
		'case_image', './data/case_logo/free.png',
		'item_image', item.image_url,
		'username', profile.username,
		'avatar_url', profile.avatar_url,
		'premium', profile.premium,
		'admin', profile.admin
	) order by claim.claimed_at desc), '[]'::jsonb)
	from (select * from public.free_case_claims order by claimed_at desc limit greatest(coalesce(p_limit, 5), 1)) claim
	join public.items item on item.id = claim.item_id
	left join public.free_case_items claim_item on claim_item.item_id = claim.item_id
	left join public.profiles profile on profile.id = claim.user_id
	;
$$;

drop function if exists public.save_free_case_settings(integer, bigint[]);
create or replace function public.save_free_case_settings(p_daily_limit integer, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
	if p_daily_limit is null or p_daily_limit < 1 then raise exception 'Лимит должен быть больше нуля'; end if;
	update public.free_case_events set daily_limit = p_daily_limit, updated_at = now() where id = 1;
	delete from public.free_case_items where id is not null;
	insert into public.free_case_items (item_id, rarity, chance)
	select distinct (entry->>'item_id')::bigint,
		coalesce(nullif(entry->>'rarity', ''), item_row.rarity),
		greatest(coalesce(nullif(entry->>'chance', '')::numeric, 0), 0)
	from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) entry
	join public.items item_row on item_row.id = (entry->>'item_id')::bigint;
	return public.get_free_case_state(null);
end;
$$;

create or replace function public.reset_free_case_event()
returns jsonb
language sql
security definer
set search_path = public
as $$
	update public.free_case_events
	set claimed_count = 0, cycle_started_at = now(), reset_at = now() + interval '24 hours', updated_at = now()
	where id = 1
	returning jsonb_build_object('daily_limit', daily_limit, 'claimed_count', claimed_count, 'reset_at', reset_at);
$$;

grant execute on function public.get_free_case_state(integer) to anon, authenticated;
grant execute on function public.claim_free_case(integer) to anon, authenticated;
grant execute on function public.get_free_case_items() to anon, authenticated;
grant execute on function public.get_recent_free_case_wins(integer) to anon, authenticated;
grant execute on function public.save_free_case_settings(integer, jsonb) to anon, authenticated;
grant execute on function public.reset_free_case_event() to anon, authenticated;
