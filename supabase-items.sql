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