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
