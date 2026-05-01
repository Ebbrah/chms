-- Store committee/jumuiya chairperson references by user id to avoid name ambiguity.

ALTER TABLE public.committees
ADD COLUMN IF NOT EXISTS chairperson_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.households
ADD COLUMN IF NOT EXISTS chairperson_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_committees_chairperson_user_id
ON public.committees (chairperson_user_id);

CREATE INDEX IF NOT EXISTS idx_households_chairperson_user_id
ON public.households (chairperson_user_id);
