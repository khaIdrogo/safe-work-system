-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles with roles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('admin', 'permit_writer', 'inspector')) DEFAULT 'inspector';

-- Safe work permits table (complete)
CREATE TABLE IF NOT EXISTS safe_work_permits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  permit_number SERIAL,
  date_issued DATE NOT NULL,
  time_issued TIME NOT NULL,
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

  created_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Inspections table (Field Safety Inspection)
CREATE TABLE IF NOT EXISTS inspections (
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

-- RLS enable
ALTER TABLE safe_work_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

-- Policies for permits
DROP POLICY IF EXISTS permit_select ON safe_work_permits;
DROP POLICY IF EXISTS permit_insert ON safe_work_permits;
DROP POLICY IF EXISTS permit_update ON safe_work_permits;

CREATE POLICY permit_select ON safe_work_permits
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY permit_insert ON safe_work_permits
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','permit_writer'))
  );

CREATE POLICY permit_update ON safe_work_permits
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','permit_writer'))
  );

-- Policies for inspections (read for authenticated, insert for admin/inspector)
DROP POLICY IF EXISTS insp_select ON inspections;
DROP POLICY IF EXISTS insp_insert ON inspections;

CREATE POLICY insp_select ON inspections
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY insp_insert ON inspections
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','inspector'))
  );
