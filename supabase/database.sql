-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES
-- ============================================================================
-- Ensure profiles has a role column with allowed values
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT
  CHECK (role IN ('admin', 'permit_writer', 'inspector'))
  DEFAULT 'inspector';

-- ============================================================================
-- SAFE WORK PERMITS - BASE TABLE
-- ============================================================================
-- Create table if it doesn't exist (minimal baseline)
CREATE TABLE IF NOT EXISTS public.safe_work_permits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- NOTE: You are mixing a custom YY#### number in the app with SERIAL here.
  -- Keeping SERIAL as you already had it; you can migrate later if desired.
  permit_number SERIAL,

  date_issued DATE NOT NULL,
  time_issued TIME NOT NULL,
  -- legacy names (will be renamed below if present): date_expired/time_expired
  date_expired DATE,
  time_expired TIME,

  facility TEXT NOT NULL,
  location TEXT NOT NULL,
  contractor TEXT NOT NULL,
  description_of_work TEXT,

  -- Grouped selections
  permit_types JSONB,
  ppe_requirements JSONB,

  -- Additional sections
  additional_ppe JSONB,
  hazard_reduction JSONB,
  equipment_condition JSONB,
  energy_control JSONB,
  special_conditions JSONB,
  additional_documents JSONB,
  air_monitoring JSONB,
  instrument_info JSONB,
  signatures JSONB,

  -- Ownership & lifecycle
  created_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ============================================================================
-- SAFE WORK PERMITS - COLUMN RENAMES & ADDITIONS
-- 1) Rename legacy columns (only if needed)
-- 2) Add missing columns (only if needed)
-- 3) Set safe JSONB defaults for new/older rows
-- ============================================================================

-- Rename date_expired -> date_expires, time_expired -> time_expires, idempotent
DO $$
BEGIN
  -- date_expired -> date_expires
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='safe_work_permits' AND column_name='date_expired'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='safe_work_permits' AND column_name='date_expires'
  ) THEN
    ALTER TABLE public.safe_work_permits RENAME COLUMN date_expired TO date_expires;
  END IF;

  -- time_expired -> time_expires
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='safe_work_permits' AND column_name='time_expired'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='safe_work_permits' AND column_name='time_expires'
  ) THEN
    ALTER TABLE public.safe_work_permits RENAME COLUMN time_expired TO time_expires;
  END IF;
END$$;

-- Add missing columns used by the app today
ALTER TABLE public.safe_work_permits
  ADD COLUMN IF NOT EXISTS date_expires DATE,
  ADD COLUMN IF NOT EXISTS time_expires TIME,
  ADD COLUMN IF NOT EXISTS air_monitoring_initials JSONB,
  ADD COLUMN IF NOT EXISTS air_monitoring_headers JSONB,
  ADD COLUMN IF NOT EXISTS confined_hazard_assessment JSONB,
  ADD COLUMN IF NOT EXISTS confined_rescue_plan JSONB,
  ADD COLUMN IF NOT EXISTS confined_entrants JSONB,
  ADD COLUMN IF NOT EXISTS confined_attendants JSONB,
  ADD COLUMN IF NOT EXISTS confined_rescue_team JSONB,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Ensure JSONB columns have safe defaults (older rows won’t break in UI)
ALTER TABLE public.safe_work_permits
  ALTER COLUMN permit_types                SET DEFAULT '{}'::jsonb,
  ALTER COLUMN ppe_requirements            SET DEFAULT '{}'::jsonb,
  ALTER COLUMN additional_ppe              SET DEFAULT '{}'::jsonb,
  ALTER COLUMN hazard_reduction            SET DEFAULT '{}'::jsonb,
  ALTER COLUMN equipment_condition         SET DEFAULT '{}'::jsonb,
  ALTER COLUMN energy_control              SET DEFAULT '{}'::jsonb,
  ALTER COLUMN special_conditions          SET DEFAULT '{}'::jsonb,
  ALTER COLUMN additional_documents        SET DEFAULT '{}'::jsonb,
  ALTER COLUMN air_monitoring              SET DEFAULT '{}'::jsonb,
  ALTER COLUMN air_monitoring_initials     SET DEFAULT '{}'::jsonb,
  ALTER COLUMN air_monitoring_headers      SET DEFAULT '{}'::jsonb,
  ALTER COLUMN instrument_info             SET DEFAULT '{}'::jsonb,
  ALTER COLUMN signatures                  SET DEFAULT '{}'::jsonb,
  ALTER COLUMN confined_hazard_assessment  SET DEFAULT '{}'::jsonb,
  ALTER COLUMN confined_rescue_plan        SET DEFAULT '{}'::jsonb,
  ALTER COLUMN confined_entrants           SET DEFAULT '{}'::jsonb,
  ALTER COLUMN confined_attendants         SET DEFAULT '{}'::jsonb,
  ALTER COLUMN confined_rescue_team        SET DEFAULT '{}'::jsonb;

-- Normalize existing status to canonical 'closed' if any variants were used in the past
UPDATE public.safe_work_permits
SET status = 'closed'
WHERE lower(status) IN ('closed','complete','completed');

-- ============================================================================
-- SAFE WORK PERMITS - FOREIGN KEYS (created_by, updated_by) -> profiles(id)
-- Avoid duplicate constraint names by checking pg_constraint
-- ============================================================================
DO $$
BEGIN
  -- created_by FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'safe_work_permits_created_by_fkey'
       AND conrelid = 'public.safe_work_permits'::regclass
  ) THEN
    ALTER TABLE public.safe_work_permits
      ADD CONSTRAINT safe_work_permits_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;

  -- updated_by FK
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'safe_work_permits_updated_by_fkey'
       AND conrelid = 'public.safe_work_permits'::regclass
  ) THEN
    ALTER TABLE public.safe_work_permits
      ADD CONSTRAINT safe_work_permits_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END$$;

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_swp_created_by   ON public.safe_work_permits (created_by);
CREATE INDEX IF NOT EXISTS idx_swp_updated_by   ON public.safe_work_permits (updated_by);
CREATE INDEX IF NOT EXISTS idx_swp_status       ON public.safe_work_permits (status);
CREATE INDEX IF NOT EXISTS idx_swp_permit_num   ON public.safe_work_permits (permit_number);
CREATE INDEX IF NOT EXISTS idx_swp_date_issued  ON public.safe_work_permits (date_issued);

-- ============================================================================
-- BUSINESS RULES AS DB TRIGGERS
-- 1) Freeze date_issued/time_issued on UPDATE (prevents “reusing” permits)
-- 2) Block updates when status='closed' (hard lock regardless of UI)
-- ============================================================================

-- 1) Freeze issued fields on UPDATE
CREATE OR REPLACE FUNCTION public.freeze_issued_fields()
RETURNS trigger AS $$
BEGIN
  NEW.date_issued := OLD.date_issued;
  NEW.time_issued := OLD.time_issued;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_freeze_issued_fields ON public.safe_work_permits;
CREATE TRIGGER trg_freeze_issued_fields
BEFORE UPDATE ON public.safe_work_permits
FOR EACH ROW
EXECUTE FUNCTION public.freeze_issued_fields();

-- 2) Block any UPDATE when closed
CREATE OR REPLACE FUNCTION public.block_update_when_closed()
RETURNS trigger AS $$
BEGIN
  IF (OLD.status = 'closed') THEN
    RAISE EXCEPTION 'Permit is closed and cannot be modified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_update_when_closed ON public.safe_work_permits;
CREATE TRIGGER trg_block_update_when_closed
BEFORE UPDATE ON public.safe_work_permits
FOR EACH ROW
EXECUTE FUNCTION public.block_update_when_closed();

-- ============================================================================
-- INSPECTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_type TEXT NOT NULL,
  inspector TEXT NOT NULL,
  project_title TEXT,
  entity_receiving_inspection TEXT,
  date_of_inspection DATE NOT NULL,
  ppe_checks JSONB,
  comments TEXT,
  created_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Index helpful for “mine only”
CREATE INDEX IF NOT EXISTS idx_insp_created_by ON public.inspections (created_by);

-- ============================================================================
-- RLS ENABLE
-- ============================================================================
ALTER TABLE public.safe_work_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - PERMITS
-- ============================================================================
DROP POLICY IF EXISTS permit_select ON public.safe_work_permits;
DROP POLICY IF EXISTS permit_insert ON public.safe_work_permits;
DROP POLICY IF EXISTS permit_update ON public.safe_work_permits;

-- Read: any authenticated user can read
CREATE POLICY permit_select ON public.safe_work_permits
  FOR SELECT USING (auth.role() = 'authenticated');

-- Insert: only admin or permit_writer
CREATE POLICY permit_insert ON public.safe_work_permits
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','permit_writer'))
  );

-- Update: only admin or permit_writer
-- NOTE: The hard lock when status='closed' is enforced by the trigger above.
CREATE POLICY permit_update ON public.safe_work_permits
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','permit_writer'))
  );

-- ============================================================================
-- RLS POLICIES - INSPECTIONS
-- ============================================================================
DROP POLICY IF EXISTS insp_select ON public.inspections;
DROP POLICY IF EXISTS insp_insert ON public.inspections;

-- Read: any authenticated
CREATE POLICY insp_select ON public.inspections
  FOR SELECT USING (auth.role() = 'authenticated');

-- Insert: admin or inspector
CREATE POLICY insp_insert ON public.inspections
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','inspector'))
  );
