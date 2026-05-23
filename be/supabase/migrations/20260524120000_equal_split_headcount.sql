-- Equal split: fixed headcount (not dynamic participant count)

ALTER TABLE public.bill_rooms
  ADD COLUMN IF NOT EXISTS equal_headcount INTEGER DEFAULT 2
    CHECK (equal_headcount >= 1 AND equal_headcount <= 99),
  ADD COLUMN IF NOT EXISTS equal_host_participates BOOLEAN DEFAULT TRUE NOT NULL;

CREATE OR REPLACE FUNCTION public.calculate_bill_room(p_room_id UUID)
RETURNS VOID AS $$
DECLARE
    v_split_mode VARCHAR(50);
    v_total_amount NUMERIC(10, 2);
    v_subtotal NUMERIC(10, 2);
    v_tax_amount NUMERIC(10, 2);
    v_service_charge NUMERIC(10, 2);
    v_extra_rate NUMERIC;
    v_receipt_id UUID;
    v_total_people INT;
    v_equal_headcount INT;
    v_host_participates BOOLEAN;
    v_base_amount NUMERIC(10, 2);
    v_sum_non_absorbers NUMERIC(10, 2) := 0.00;
    v_absorber_id UUID;
    v_user_subtotal NUMERIC(10, 2);
    v_user_amount NUMERIC(10, 2);
    r_user RECORD;
BEGIN
    SELECT split_mode, host_id, equal_headcount, equal_host_participates
    INTO v_split_mode, v_absorber_id, v_equal_headcount, v_host_participates
    FROM public.bill_rooms
    WHERE room_id = p_room_id
    FOR UPDATE;

    SELECT receipt_id, total_amount, subtotal, tax_amount, service_charge
    INTO v_receipt_id, v_total_amount, v_subtotal, v_tax_amount, v_service_charge
    FROM public.receipts
    WHERE room_id = p_room_id
    LIMIT 1;

    IF v_receipt_id IS NULL THEN
        UPDATE public.participant_bills
        SET amount_to_pay = 0.00
        WHERE room_id = p_room_id;
        RETURN;
    END IF;

    IF v_split_mode = 'EQUAL' THEN
        v_total_people := GREATEST(1, COALESCE(v_equal_headcount, 2));
        v_base_amount := ROUND(v_total_amount / v_total_people, 2);

        IF v_host_participates IS DISTINCT FROM FALSE THEN
            IF NOT EXISTS (SELECT 1 FROM public.participant_bills WHERE room_id = p_room_id AND user_id = v_absorber_id) THEN
                SELECT user_id INTO v_absorber_id FROM public.participant_bills WHERE room_id = p_room_id LIMIT 1;
            END IF;

            UPDATE public.participant_bills
            SET amount_to_pay = v_base_amount, updated_at = now()
            WHERE room_id = p_room_id AND user_id <> v_absorber_id;

            SELECT COALESCE(SUM(amount_to_pay), 0.00) INTO v_sum_non_absorbers
            FROM public.participant_bills
            WHERE room_id = p_room_id AND user_id <> v_absorber_id;

            UPDATE public.participant_bills
            SET amount_to_pay = v_total_amount - v_sum_non_absorbers, updated_at = now()
            WHERE room_id = p_room_id AND user_id = v_absorber_id;
        ELSE
            UPDATE public.participant_bills
            SET amount_to_pay = 0.00, updated_at = now()
            WHERE room_id = p_room_id AND user_id = v_absorber_id;

            UPDATE public.participant_bills
            SET amount_to_pay = v_base_amount, updated_at = now()
            WHERE room_id = p_room_id AND user_id <> v_absorber_id;
        END IF;

    ELSIF v_split_mode = 'ITEM_BASED' THEN
        SELECT COUNT(*) INTO v_total_people
        FROM public.participant_bills
        WHERE room_id = p_room_id;

        IF v_total_people = 0 THEN
            RETURN;
        END IF;

        IF v_subtotal > 0 THEN
            v_extra_rate := (v_tax_amount + v_service_charge) / v_subtotal;
        ELSE
            v_extra_rate := 0.00;
        END IF;

        v_absorber_id := NULL;

        SELECT ia.user_id INTO v_absorber_id
        FROM public.item_assignments ia
        JOIN public.receipt_items ri ON ia.item_id = ri.item_id
        WHERE ri.receipt_id = v_receipt_id AND ia.user_id = (SELECT host_id FROM public.bill_rooms WHERE room_id = p_room_id)
        LIMIT 1;

        IF v_absorber_id IS NULL THEN
            SELECT ia.user_id INTO v_absorber_id
            FROM public.item_assignments ia
            JOIN public.receipt_items ri ON ia.item_id = ri.item_id
            WHERE ri.receipt_id = v_receipt_id
            ORDER BY ia.created_at DESC
            LIMIT 1;
        END IF;

        IF v_absorber_id IS NULL THEN
            UPDATE public.participant_bills
            SET amount_to_pay = 0.00, updated_at = now()
            WHERE room_id = p_room_id;
            RETURN;
        END IF;

        FOR r_user IN
            SELECT DISTINCT user_id FROM public.participant_bills
            WHERE room_id = p_room_id AND user_id <> v_absorber_id
        LOOP
            v_user_subtotal := 0.00;

            SELECT COALESCE(SUM((ri.price * ri.quantity) / N.shares_count), 0.00)
            INTO v_user_subtotal
            FROM public.item_assignments ia
            JOIN public.receipt_items ri ON ia.item_id = ri.item_id
            JOIN (
                SELECT item_id, COUNT(*) as shares_count
                FROM public.item_assignments
                GROUP BY item_id
            ) N ON ri.item_id = N.item_id
            WHERE ri.receipt_id = v_receipt_id AND ia.user_id = r_user.user_id;

            v_user_amount := ROUND(v_user_subtotal * (1.00 + v_extra_rate), 2);
            v_sum_non_absorbers := v_sum_non_absorbers + v_user_amount;

            UPDATE public.participant_bills
            SET amount_to_pay = v_user_amount, updated_at = now()
            WHERE room_id = p_room_id AND user_id = r_user.user_id;
        END LOOP;

        UPDATE public.participant_bills
        SET amount_to_pay = 0.00, updated_at = now()
        WHERE room_id = p_room_id
          AND user_id <> v_absorber_id
          AND user_id NOT IN (
              SELECT DISTINCT ia.user_id
              FROM public.item_assignments ia
              JOIN public.receipt_items ri ON ia.item_id = ri.item_id
              WHERE ri.receipt_id = v_receipt_id
          );

        UPDATE public.participant_bills
        SET amount_to_pay = v_total_amount - v_sum_non_absorbers, updated_at = now()
        WHERE room_id = p_room_id AND user_id = v_absorber_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
