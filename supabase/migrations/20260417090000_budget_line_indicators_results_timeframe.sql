-- Add planning/monitoring fields to budget lines.
ALTER TABLE public.budget_lines
ADD COLUMN IF NOT EXISTS indicators text,
ADD COLUMN IF NOT EXISTS results text,
ADD COLUMN IF NOT EXISTS timeframe_start date,
ADD COLUMN IF NOT EXISTS timeframe_end date;

-- Optional: ensure timeframe_end is not before timeframe_start when both present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'budget_lines_timeframe_check'
  ) THEN
    ALTER TABLE public.budget_lines
    ADD CONSTRAINT budget_lines_timeframe_check
    CHECK (
      timeframe_start IS NULL
      OR timeframe_end IS NULL
      OR timeframe_end >= timeframe_start
    );
  END IF;
END $$;

