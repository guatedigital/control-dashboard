-- Create table for authorized accounts
-- This table will store accounts that are authorized to access the dashboard
CREATE TABLE IF NOT EXISTS authorized_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_authorized_accounts_email ON authorized_accounts(email);
CREATE INDEX IF NOT EXISTS idx_authorized_accounts_active ON authorized_accounts(is_active);

-- Insert the authorized email address
INSERT INTO authorized_accounts (email, name, is_active)
VALUES ('info@intercambioinmobiliario.com', 'Authorized Account', true)
ON CONFLICT (email) DO UPDATE SET is_active = true;

-- Enable Row Level Security
ALTER TABLE authorized_accounts ENABLE ROW LEVEL SECURITY;

-- Note: Service role key bypasses RLS automatically
-- The following policies are for direct client access (if needed)

-- Allow authenticated users to check if they are authorized
CREATE POLICY "Authenticated users can check their authorization" ON authorized_accounts
  FOR SELECT USING (auth.email() = email);

