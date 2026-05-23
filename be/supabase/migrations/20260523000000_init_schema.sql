-- Supabase PostgreSQL Migration: 20260523000000_init_schema.sql
-- Description: Database schema initialization, RLS configuration, Realtime setups, and Calculation/Assignment Procedures.

-- Create custom schema tables
CREATE TABLE IF NOT EXISTS public.users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname VARCHAR(255) NOT NULL,
    is_host BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.bill_rooms (
    room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(10) UNIQUE NOT NULL,
    host_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
    host_email VARCHAR(255) NOT NULL,
    split_mode VARCHAR(50) DEFAULT 'EQUAL' NOT NULL CHECK (split_mode IN ('EQUAL', 'ITEM_BASED')),
    payment_method_type VARCHAR(50) CHECK (payment_method_type IN ('DUITNOW_QR', 'BANK_TRANSFER', 'TNG_QR')),
    payment_method_detail TEXT,
    qr_code_url TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED')),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.receipts (
    receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.bill_rooms(room_id) ON DELETE CASCADE NOT NULL,
    image_url TEXT,
    subtotal NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    tax_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    service_charge NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    total_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.receipt_items (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID REFERENCES public.receipts(receipt_id) ON DELETE CASCADE NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    quantity INTEGER DEFAULT 1 NOT NULL CHECK (quantity >= 1)
);

CREATE TABLE IF NOT EXISTS public.item_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.receipt_items(item_id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (item_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.participant_bills (
    bill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.bill_rooms(room_id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
    amount_to_pay NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    payment_status VARCHAR(20) DEFAULT 'PENDING' NOT NULL CHECK (payment_status IN ('PENDING', 'PAID', 'VERIFIED')),
    proof_image_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (room_id, user_id)
);

-- Indexing for optimized joins and lookups
CREATE INDEX IF NOT EXISTS idx_bill_rooms_code ON public.bill_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_receipts_room ON public.receipts(room_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON public.receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_item_assignments_item ON public.item_assignments(item_id);
CREATE INDEX IF NOT EXISTS idx_item_assignments_user ON public.item_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_participant_bills_room ON public.participant_bills(room_id);
CREATE INDEX IF NOT EXISTS idx_participant_bills_user ON public.participant_bills(user_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_bills ENABLE ROW LEVEL SECURITY;

-- RLS Policies Setup

-- Security Definer Helpers to prevent infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.participant_bills
        WHERE room_id = p_room_id AND user_id = p_user_id
    ) OR EXISTS (
        SELECT 1 FROM public.bill_rooms
        WHERE room_id = p_room_id AND host_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.share_room(p_user_id_1 UUID, p_user_id_2 UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.participant_bills pb1
        JOIN public.participant_bills pb2 ON pb1.room_id = pb2.room_id
        WHERE pb1.user_id = p_user_id_1 AND pb2.user_id = p_user_id_2
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users policies
DROP POLICY IF EXISTS "Users are readable by themselves or room members" ON public.users;
CREATE POLICY "Users are readable by themselves or room members" ON public.users
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.share_room(user_id, auth.uid())
    );

DROP POLICY IF EXISTS "Users can create their own profile" ON public.users;
CREATE POLICY "Users can create their own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = user_id);

-- BillRooms policies
DROP POLICY IF EXISTS "Rooms are readable by host or joined participants" ON public.bill_rooms;
CREATE POLICY "Rooms are readable by host or joined participants" ON public.bill_rooms
    FOR SELECT USING (
        host_id = auth.uid() OR 
        public.is_room_member(room_id, auth.uid())
    );

DROP POLICY IF EXISTS "Rooms can be created by authenticated/anonymous hosts" ON public.bill_rooms;
CREATE POLICY "Rooms can be created by authenticated/anonymous hosts" ON public.bill_rooms
    FOR INSERT WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "Rooms can be modified by the host" ON public.bill_rooms;
CREATE POLICY "Rooms can be modified by the host" ON public.bill_rooms
    FOR UPDATE USING (host_id = auth.uid());

-- Receipts policies
DROP POLICY IF EXISTS "Receipts are viewable by host or room participants" ON public.receipts;
CREATE POLICY "Receipts are viewable by host or room participants" ON public.receipts
    FOR SELECT USING (
        public.is_room_member(room_id, auth.uid())
    );

DROP POLICY IF EXISTS "Receipts can be managed by the host" ON public.receipts;
CREATE POLICY "Receipts can be managed by the host" ON public.receipts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.bill_rooms br 
            WHERE br.room_id = receipts.room_id AND br.host_id = auth.uid()
        )
    );

-- ReceiptItems policies
DROP POLICY IF EXISTS "Receipt items are viewable by host or room participants" ON public.receipt_items;
CREATE POLICY "Receipt items are viewable by host or room participants" ON public.receipt_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.receipts r 
            WHERE r.receipt_id = receipt_items.receipt_id AND 
            public.is_room_member(r.room_id, auth.uid())
        )
    );

DROP POLICY IF EXISTS "Receipt items can be managed by the host" ON public.receipt_items;
CREATE POLICY "Receipt items can be managed by the host" ON public.receipt_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.receipts r 
            JOIN public.bill_rooms br ON r.room_id = br.room_id
            WHERE r.receipt_id = receipt_items.receipt_id AND br.host_id = auth.uid()
        )
    );

-- ItemAssignments policies
DROP POLICY IF EXISTS "Item assignments are viewable by host or room participants" ON public.item_assignments;
CREATE POLICY "Item assignments are viewable by host or room participants" ON public.item_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.receipt_items ri 
            JOIN public.receipts r ON ri.receipt_id = r.receipt_id
            WHERE ri.item_id = item_assignments.item_id AND 
            public.is_room_member(r.room_id, auth.uid())
        )
    );

DROP POLICY IF EXISTS "Item assignments can be created by the participant themselves" ON public.item_assignments;
CREATE POLICY "Item assignments can be created by the participant themselves" ON public.item_assignments
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Item assignments can be deleted by the participant themselves" ON public.item_assignments;
CREATE POLICY "Item assignments can be deleted by the participant themselves" ON public.item_assignments
    FOR DELETE USING (user_id = auth.uid());

-- ParticipantBills policies
DROP POLICY IF EXISTS "Participant bills are viewable by host or room participants" ON public.participant_bills;
CREATE POLICY "Participant bills are viewable by host or room participants" ON public.participant_bills
    FOR SELECT USING (
        user_id = auth.uid() OR 
        public.is_room_member(room_id, auth.uid())
    );

DROP POLICY IF EXISTS "Participant bills can be created by the participant themselves" ON public.participant_bills;
CREATE POLICY "Participant bills can be created by the participant themselves" ON public.participant_bills
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Participant bills can be updated by the participant or host" ON public.participant_bills;
CREATE POLICY "Participant bills can be updated by the participant or host" ON public.participant_bills
    FOR UPDATE USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.bill_rooms br 
            WHERE br.room_id = participant_bills.room_id AND br.host_id = auth.uid()
        )
    );

-- Realtime Configuration inside DO block for safety
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bill_rooms;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participant_bills;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.item_assignments;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;


-- Dynamic Bill Calculation Database Function
-- Implements highly parallelizable room calculation with row level locking (FOR UPDATE)
-- and standard subtraction-based rounding error adjustment (Malaysian sen rounding mismatch)
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
    v_base_amount NUMERIC(10, 2);
    v_sum_non_absorbers NUMERIC(10, 2) := 0.00;
    v_absorber_id UUID;
    v_user_subtotal NUMERIC(10, 2);
    v_user_amount NUMERIC(10, 2);
    r_user RECORD;
BEGIN
    -- 1. Lock the room and get split details to serialize concurrent operations
    SELECT split_mode, host_id INTO v_split_mode, v_absorber_id
    FROM public.bill_rooms
    WHERE room_id = p_room_id
    FOR UPDATE;

    -- 2. Get receipt details
    SELECT receipt_id, total_amount, subtotal, tax_amount, service_charge
    INTO v_receipt_id, v_total_amount, v_subtotal, v_tax_amount, v_service_charge
    FROM public.receipts
    WHERE room_id = p_room_id
    LIMIT 1;

    -- If no receipt has been uploaded yet, initialize everyone's amount to 0
    IF v_receipt_id IS NULL THEN
        UPDATE public.participant_bills
        SET amount_to_pay = 0.00
        WHERE room_id = p_room_id;
        RETURN;
    END IF;

    -- Get total count of active participants in the room
    SELECT COUNT(*) INTO v_total_people
    FROM public.participant_bills
    WHERE room_id = p_room_id;

    IF v_total_people = 0 THEN
        RETURN;
    END IF;

    -- CASE A: EQUAL SPLIT
    IF v_split_mode = 'EQUAL' THEN
        -- Non-absorbers pay standard rounded split amount
        v_base_amount := ROUND(v_total_amount / v_total_people, 2);

        -- Double check absorber exists in room, else fallback to any room participant
        IF NOT EXISTS (SELECT 1 FROM public.participant_bills WHERE room_id = p_room_id AND user_id = v_absorber_id) THEN
            SELECT user_id INTO v_absorber_id FROM public.participant_bills WHERE room_id = p_room_id LIMIT 1;
        END IF;

        -- Update non-absorbers
        UPDATE public.participant_bills
        SET amount_to_pay = v_base_amount, updated_at = now()
        WHERE room_id = p_room_id AND user_id <> v_absorber_id;

        -- Sum non-absorbers amounts
        SELECT COALESCE(SUM(amount_to_pay), 0.00) INTO v_sum_non_absorbers
        FROM public.participant_bills
        WHERE room_id = p_room_id AND user_id <> v_absorber_id;

        -- Absorber absorbs the rounding discrepancy by subtraction
        UPDATE public.participant_bills
        SET amount_to_pay = v_total_amount - v_sum_non_absorbers, updated_at = now()
        WHERE room_id = p_room_id AND user_id = v_absorber_id;

    -- CASE B: ITEM BASED SPLIT
    ELSIF v_split_mode = 'ITEM_BASED' THEN
        -- Calculate Malaysian local extra tax rate
        IF v_subtotal > 0 THEN
            v_extra_rate := (v_tax_amount + v_service_charge) / v_subtotal;
        ELSE
            v_extra_rate := 0.00;
        END IF;

        -- Identify the absorber.
        -- Priority 1: Host, but only if they have selected at least one item.
        -- Priority 2: The last user in participant list who has selected at least one item.
        v_absorber_id := NULL;

        SELECT ia.user_id INTO v_absorber_id
        FROM public.item_assignments ia
        JOIN public.receipt_items ri ON ia.item_id = ri.item_id
        WHERE ri.receipt_id = v_receipt_id AND ia.user_id = (SELECT host_id FROM public.bill_rooms WHERE room_id = p_room_id)
        LIMIT 1;

        IF v_absorber_id IS NULL THEN
            -- Host is not participating or hasn't selected items. Pick the last active participant who has items selected.
            SELECT ia.user_id INTO v_absorber_id
            FROM public.item_assignments ia
            JOIN public.receipt_items ri ON ia.item_id = ri.item_id
            WHERE ri.receipt_id = v_receipt_id
            ORDER BY ia.created_at DESC
            LIMIT 1;
        END IF;

        -- If absolutely nobody has assigned items yet, set everyone's pay to 0
        IF v_absorber_id IS NULL THEN
            UPDATE public.participant_bills
            SET amount_to_pay = 0.00, updated_at = now()
            WHERE room_id = p_room_id;
            RETURN;
        END IF;

        -- Calculate and update amounts for non-absorber participants
        FOR r_user IN 
            SELECT DISTINCT user_id FROM public.participant_bills 
            WHERE room_id = p_room_id AND user_id <> v_absorber_id
        LOOP
            v_user_subtotal := 0.00;

            -- Sum over this user's assigned items: (price * quantity) / N
            -- N is the number of participants sharing the item
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

        -- Non-participating users (those who selected no items and are not the absorber) automatically get 0.00.
        -- Ensure they are set to 0.00 if they don't have assignments
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

        -- Update the absorber user using subtraction to absorb all rounding inaccuracies
        UPDATE public.participant_bills
        SET amount_to_pay = v_total_amount - v_sum_non_absorbers, updated_at = now()
        WHERE room_id = p_room_id AND user_id = v_absorber_id;

    END IF;
END;
$$ LANGUAGE plpgsql;

-- Transactional Assignment & Calculation Database Function
-- Safely lock room FOR UPDATE, reset and batch assignments, and re-calculate in a single database transaction.
-- Perfect to fully eliminate race conditions under high concurrent item selections.
CREATE OR REPLACE FUNCTION public.assign_items_and_calculate(
    p_room_id UUID,
    p_user_id UUID,
    p_selected_item_ids UUID[]
)
RETURNS VOID AS $$
BEGIN
    -- 1. Serialized Row Lock on current bill room
    PERFORM 1 FROM public.bill_rooms WHERE room_id = p_room_id FOR UPDATE;

    -- 2. Clean out user's old assignments inside the scope of this room's receipt items
    DELETE FROM public.item_assignments 
    WHERE user_id = p_user_id 
      AND item_id IN (
          SELECT ri.item_id 
          FROM public.receipt_items ri
          JOIN public.receipts r ON ri.receipt_id = r.receipt_id
          WHERE r.room_id = p_room_id
      );

    -- 3. Re-assign user to newly checked items
    IF array_length(p_selected_item_ids, 1) > 0 THEN
        INSERT INTO public.item_assignments (item_id, user_id)
        SELECT unnest(p_selected_item_ids), p_user_id;
    END IF;

    -- 4. Calculate everything synchronously inside this atomic transaction
    PERFORM public.calculate_bill_room(p_room_id);
END;
$$ LANGUAGE plpgsql;
