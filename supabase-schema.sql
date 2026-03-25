-- Inspector Roster Management Schema
-- Run this in your Supabase SQL editor to set up the database

-- Create inspector_roster table
CREATE TABLE IF NOT EXISTS inspector_roster (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inspector_id INTEGER NOT NULL,
  inspector_name TEXT NOT NULL,
  date DATE NOT NULL,
  region_code TEXT, -- R01, R02, etc.
  region_name TEXT, -- Brisbane/Logan/Ipswich, etc.
  status TEXT DEFAULT 'working' CHECK (status IN ('working', 'sick', 'rain', 'rdo', 'annual_leave', 'van_service')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT auth.jwt() ->> 'email',
  -- Ensure one record per inspector per date
  UNIQUE(inspector_id, date)
);

-- Add comments for documentation
COMMENT ON TABLE inspector_roster IS 'Stores daily roster assignments for property inspectors';
COMMENT ON COLUMN inspector_roster.inspector_id IS 'Pipedrive user ID of the inspector';
COMMENT ON COLUMN inspector_roster.status IS 'Inspector availability status: working, sick, rain, rdo (regular day off), annual_leave, van_service';
COMMENT ON COLUMN inspector_roster.region_code IS 'Assigned region code (R01-R09)';
COMMENT ON COLUMN inspector_roster.region_name IS 'Human readable region name';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_roster_date ON inspector_roster(date);
CREATE INDEX IF NOT EXISTS idx_roster_inspector ON inspector_roster(inspector_id);
CREATE INDEX IF NOT EXISTS idx_roster_region ON inspector_roster(region_code);
CREATE INDEX IF NOT EXISTS idx_roster_status ON inspector_roster(status);
CREATE INDEX IF NOT EXISTS idx_roster_inspector_date ON inspector_roster(inspector_id, date);

-- Enable Row Level Security (RLS)
ALTER TABLE inspector_roster ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to all authenticated users" 
  ON inspector_roster FOR SELECT 
  TO authenticated 
  USING (true);

-- Allow insert/update/delete for authenticated users
-- In production, you might want to restrict this to admin users only
CREATE POLICY "Allow write access to authenticated users" 
  ON inspector_roster FOR ALL 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_inspector_roster_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_inspector_roster_updated_at
  BEFORE UPDATE ON inspector_roster
  FOR EACH ROW
  EXECUTE FUNCTION update_inspector_roster_updated_at();

-- Create a view for easier querying with additional computed fields
CREATE OR REPLACE VIEW roster_view AS
SELECT 
  ir.*,
  -- Add day of week for easier filtering
  EXTRACT(DOW FROM ir.date) as day_of_week,
  TO_CHAR(ir.date, 'Day') as day_name,
  -- Calculate if it's a weekend
  CASE WHEN EXTRACT(DOW FROM ir.date) IN (0, 6) THEN true ELSE false END as is_weekend,
  -- Format date for display
  TO_CHAR(ir.date, 'DD Mon YYYY') as formatted_date
FROM inspector_roster ir;

-- Grant access to the view
GRANT SELECT ON roster_view TO authenticated;

-- Insert some sample data (optional - remove in production)
/*
INSERT INTO inspector_roster (inspector_id, inspector_name, date, region_code, region_name, status) VALUES
  (1, 'Ross Runnalls', '2026-03-17', 'R01', 'R01 - Brisbane/Logan/Ipswich', 'working'),
  (2, 'Ben Thompson', '2026-03-17', 'R04', 'R04 - Toowoomba', 'working'),
  (3, 'Travis Mills', '2026-03-17', 'R01', 'R01 - Brisbane/Logan/Ipswich', 'working'),
  (1, 'Ross Runnalls', '2026-03-18', 'R01', 'R01 - Brisbane/Logan/Ipswich', 'sick'),
  (2, 'Ben Thompson', '2026-03-18', 'R04', 'R04 - Toowoomba', 'rain');
*/

-- Enable real-time subscriptions (optional)
-- This allows the app to receive real-time updates when roster data changes
-- Run this if you want real-time functionality:
-- ALTER PUBLICATION supabase_realtime ADD TABLE inspector_roster;