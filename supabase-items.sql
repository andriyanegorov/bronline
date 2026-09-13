-- Allow the admin panel to read promo codes for the management list.
drop policy if exists "Promo codes are readable in admin panel" on public.promo_codes;
create policy "Promo codes are readable in admin panel"
	on public.promo_codes for select
	using (true);
