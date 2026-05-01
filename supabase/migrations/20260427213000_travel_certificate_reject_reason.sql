-- Add explicit rejection metadata for travel certificates.

ALTER TABLE public.travel_certificates
ADD COLUMN IF NOT EXISTS reject_reason text,
ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
ADD COLUMN IF NOT EXISTS rejected_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;
