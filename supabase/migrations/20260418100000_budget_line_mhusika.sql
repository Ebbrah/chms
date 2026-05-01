-- Stakeholder / responsible party for a budget line (Mhusika).
ALTER TABLE public.budget_lines
ADD COLUMN IF NOT EXISTS mhusika text;
