-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('admin','permit_writer','inspector')) DEFAULT 'inspector',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- ============================================================================
-- CREATE MISSING COLUMNS (CRITICAL FIX)
-- ============================================================================
ALTER TABLE public.safe_work_permits
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_by UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS signatures_drawn JSONB DEFAULT '{}'::jsonb;

-- Add missing FKs safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'swp_deleted_by_fkey'
  ) THEN
    ALTER TABLE public.safe_work_permits
    ADD CONSTRAINT swp_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.profiles(id);
  END IF;
END$$;

-- ============================================================================
-- PERMIT COUNTERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.permit_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- ============================================================================
-- PERMIT NUMBER FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_permit_number()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  yr INTEGER := EXTRACT(YEAR FROM now());
  yy INTEGER := yr % 100;
  next_num INTEGER;
BEGIN
  LOOP
    UPDATE public.permit_counters
    SET last_number = last_number + 1
    WHERE year = yr
    RETURNING last_number INTO next_num;

    IF FOUND THEN EXIT; END IF;

    BEGIN
      INSERT INTO public.permit_counters (year, last_number)
      VALUES (yr, 1)
      RETURNING last_number INTO next_num;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
    END;
  END LOOP;

  RETURN (yy * 10000) + next_num;
END;
$$;

-- ============================================================================
-- SAFE WORK PERMITS TABLE (ONLY CREATES IF NEW)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.safe_work_permits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  permit_number INTEGER UNIQUE,

  date_issued DATE NOT NULL,
  time_issued TIME NOT NULL,
  date_expires DATE,
  time_expires TIME,

  facility TEXT NOT NULL,
  location TEXT NOT NULL,
  contractor TEXT NOT NULL,
  description_of_work TEXT,

  permit_types JSONB DEFAULT '{}'::jsonb,
  ppe_requirements JSONB DEFAULT '{}'::jsonb,
  additional_ppe JSONB DEFAULT '{}'::jsonb,
  hazard_reduction JSONB DEFAULT '{}'::jsonb,
  equipment_condition JSONB DEFAULT '{}'::jsonb,
  energy_control JSONB DEFAULT '{}'::jsonb,
  special_conditions JSONB DEFAULT '{}'::jsonb,
  additional_documents JSONB DEFAULT '{}'::jsonb,

  air_monitoring JSONB DEFAULT '{}'::jsonb,
  air_monitoring_initials JSONB DEFAULT '{}'::jsonb,
  air_monitoring_headers JSONB DEFAULT '{}'::jsonb,

  instrument_info JSONB DEFAULT '{}'::jsonb,

  confined_hazard_assessment JSONB DEFAULT '{}'::jsonb,
  confined_rescue_plan JSONB DEFAULT '{}'::jsonb,
  confined_entrants JSONB DEFAULT '{}'::jsonb,
  confined_attendants JSONB DEFAULT '{}'::jsonb,
  confined_rescue_team JSONB DEFAULT '{}'::jsonb,

  signatures JSONB DEFAULT '{}'::jsonb,
  signatures_drawn JSONB DEFAULT '{}'::jsonb,

  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),

  is_deleted BOOLEAN DEFAULT FALSE,

  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  deleted_by UUID REFERENCES public.profiles(id),

  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- AUTO PERMIT NUMBER TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_permit_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.permit_number IS NULL THEN
    NEW.permit_number := public.generate_permit_number();
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_permit_number') THEN
    CREATE TRIGGER trg_set_permit_number
    BEFORE INSERT ON public.safe_work_permits
    FOR EACH ROW
    EXECUTE FUNCTION public.set_permit_number();
  END IF;
END$$;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at') THEN
    CREATE TRIGGER trg_set_updated_at
    BEFORE UPDATE ON public.safe_work_permits
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

-- ============================================================================
-- SOFT DELETE FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.soft_delete_permit(p_id UUID, p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.safe_work_permits
  SET is_deleted = TRUE,
      deleted_by = p_user,
      deleted_at = timezone('utc', now())
  WHERE id = p_id;
END;
$$;

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_swp_status ON public.safe_work_permits(status);
CREATE INDEX IF NOT EXISTS idx_swp_created_by ON public.safe_work_permits(created_by);
CREATE INDEX IF NOT EXISTS idx_swp_deleted ON public.safe_work_permits(is_deleted);

-- ============================================================================
-- VIEWS
-- ============================================================================
CREATE OR REPLACE VIEW public.v_active_permits AS
SELECT * FROM public.safe_work_permits
WHERE is_deleted = FALSE;

CREATE OR REPLACE VIEW public.v_open_permits AS
SELECT * FROM public.safe_work_permits
WHERE status = 'open' AND is_deleted = FALSE;

CREATE OR REPLACE VIEW public.v_closed_permits AS
SELECT * FROM public.safe_work_permits
WHERE status = 'closed' AND is_deleted = FALSE;

-- ============================================================================
-- DONE ✅
-- ============================================================================
