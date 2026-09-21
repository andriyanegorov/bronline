DROP FUNCTION IF EXISTS public.upgrade_inventory_item(uuid, bigint, numeric);
DROP FUNCTION IF EXISTS public.upgrade_inventory_item(integer, bigint, numeric);
DROP FUNCTION IF EXISTS public.upgrade_inventory_item(integer, integer, numeric);

-- 1) История апгрейда
CREATE TABLE IF NOT EXISTS public.upgrader_history (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    source_inventory_id INTEGER NOT NULL,
    source_item_name TEXT NOT NULL,
    source_rarity TEXT NOT NULL,
    source_item_value NUMERIC(14,2) NOT NULL,
    target_item_name TEXT,
    target_rarity TEXT,
    target_item_value NUMERIC(14,2),
    multiplier NUMERIC(10,2) NOT NULL DEFAULT 1.2,
    success BOOLEAN NOT NULL,
    chance NUMERIC(5,4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Функция апгрейда
CREATE OR REPLACE FUNCTION public.upgrade_inventory_item(
    p_user_id INTEGER,
    p_inventory_id INTEGER,
    p_multiplier NUMERIC DEFAULT 1.2
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    source_item RECORD;
    target_item RECORD;
    target_name TEXT := NULL;
    target_rarity TEXT := NULL;
    target_value NUMERIC(14,2) := NULL;
    chance NUMERIC := 0.12;
    did_success BOOLEAN;
    new_inventory_id INTEGER;
BEGIN
    IF p_user_id IS NULL OR p_inventory_id IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'user_id и inventory_id обязательны'
        );
    END IF;

    IF p_multiplier IS NULL OR p_multiplier <= 0 THEN
        p_multiplier := 1.2;
    END IF;

    SELECT *
    INTO source_item
    FROM public.inventory
    WHERE id = p_inventory_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Предмет не найден у пользователя'
        );
    END IF;

    -- Честный шанс по множителю:
    -- 1.2x ≈ 83%, 1.5x ≈ 67%, 2x ≈ 50%, 5x ≈ 20%
    chance := 1 / p_multiplier;

    IF chance < 0.05 THEN
        chance := 0.05;
    END IF;

    IF chance > 0.95 THEN
        chance := 0.95;
    END IF;

    did_success := random() < chance;

    IF did_success THEN
        SELECT *
        INTO target_item
        FROM public.items
        WHERE item_value >= source_item.item_value * p_multiplier * 0.8
          AND item_value <= source_item.item_value * p_multiplier * 1.2
                ORDER BY ABS(item_value - (source_item.item_value * p_multiplier)), item_value, id
        LIMIT 1;

        IF target_item IS NULL THEN
            SELECT *
            INTO target_item
            FROM public.items
            ORDER BY ABS(item_value - (source_item.item_value * p_multiplier))
            LIMIT 1;
        END IF;

        IF target_item IS NULL THEN
            RETURN jsonb_build_object(
                'ok', false,
                'error', 'В каталоге нет подходящего предмета'
            );
        END IF;

        target_name := target_item.name;
        target_rarity := target_item.rarity;
        target_value := target_item.item_value;

        DELETE FROM public.inventory
        WHERE id = p_inventory_id;

<<<<<<< HEAD
        INSERT INTO public.inventory (
            user_id,
            item_name,
            rarity,
            item_value,
            image_url,
            quantity,
            created_at
        )
        VALUES (
            p_user_id,
            target_item.name,
            target_item.rarity,
            target_item.item_value,
            target_item.image_url,
            1,
            NOW()
        )
        RETURNING id INTO new_inventory_id;
    ELSE
        target_name := NULL;
        target_rarity := NULL;
        target_value := NULL;
        DELETE FROM public.inventory
        WHERE id = p_inventory_id;
        new_inventory_id := NULL;
    END IF;
=======
create or replace function public.sell_inventory_item(p_inventory_id integer, p_user_id integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
	inventory_row public.inventory;
	new_balance integer;
begin
	if p_inventory_id is null or p_user_id is null then
		raise exception 'Inventory item and user are required';
	end if;

	select * into inventory_row
	from public.inventory
	where id = p_inventory_id and user_id = p_user_id
	for update;

	if inventory_row.id is null then
		raise exception 'Inventory item not found';
	end if;

	update public.free_case_claims
	set inventory_id = null
	where inventory_id = inventory_row.id and user_id = p_user_id;

	delete from public.inventory
	where id = inventory_row.id and user_id = p_user_id;

	update public.profiles
	set balance = coalesce(balance, 0) + coalesce(inventory_row.item_value, 0),
		updated_at = now()
	where id = p_user_id
	returning balance into new_balance;

	return coalesce(new_balance, 0);
end;
$$;

create or replace function public.sell_inventory_items(p_user_id integer, p_inventory_ids integer[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
	deleted_total integer;
	new_balance integer;
begin
	if p_user_id is null or p_inventory_ids is null or array_length(p_inventory_ids, 1) is null then
		return coalesce((select balance from public.profiles where id = p_user_id), 0);
	end if;

	update public.free_case_claims
	set inventory_id = null
	where user_id = p_user_id
	  and inventory_id in (select unnest(p_inventory_ids));

	with deleted as (
		delete from public.inventory
		where user_id = p_user_id
		  and id = any(p_inventory_ids)
		returning item_value
	)
	select coalesce(sum(item_value), 0) into deleted_total
	from deleted;

	update public.profiles
	set balance = coalesce(balance, 0) + deleted_total,
		updated_at = now()
	where id = p_user_id
	returning balance into new_balance;

	return coalesce(new_balance, 0);
end;
$$;

grant execute on function public.sell_inventory_item(integer, integer) to anon, authenticated;
grant execute on function public.sell_inventory_items(integer, integer[]) to anon, authenticated;

insert into public.free_case_events (id) values (1) on conflict (id) do nothing;
alter table public.free_case_events enable row level security;
alter table public.free_case_items enable row level security;
alter table public.free_case_claims enable row level security;
>>>>>>> 9977d9143a52ad70c2fcfbe730c7edd8c268ad22

    INSERT INTO public.upgrader_history (
        user_id,
        source_inventory_id,
        source_item_name,
        source_rarity,
        source_item_value,
        target_item_name,
        target_rarity,
        target_item_value,
        multiplier,
        success,
        chance
    )
    VALUES (
        p_user_id,
        p_inventory_id,
        source_item.item_name,
        source_item.rarity,
        source_item.item_value,
        target_name,
        target_rarity,
        target_value,
        p_multiplier,
        did_success,
        chance
    );

    RETURN jsonb_build_object(
        'ok', true,
        'success', did_success,
        'chance', chance,
        'multiplier', p_multiplier,
        'source', jsonb_build_object(
            'inventory_id', source_item.id,
            'item_name', source_item.item_name,
            'rarity', source_item.rarity,
            'item_value', source_item.item_value
        ),
        'target', CASE
            WHEN did_success THEN jsonb_build_object(
                'inventory_id', new_inventory_id,
                'item_name', target_item.name,
                'rarity', target_item.rarity,
                'item_value', target_item.item_value
            )
            ELSE jsonb_build_object(
                'inventory_id', NULL,
                'item_name', NULL,
                'rarity', NULL,
                'item_value', NULL
            )
        END
    );
END;
$$;