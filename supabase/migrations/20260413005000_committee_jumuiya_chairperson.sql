-- Add simple chairperson name fields for committee and jumuiya setup screens.

ALTER TABLE public.committees
ADD COLUMN IF NOT EXISTS chairperson_name text;

ALTER TABLE public.households
ADD COLUMN IF NOT EXISTS chairperson_name text;
