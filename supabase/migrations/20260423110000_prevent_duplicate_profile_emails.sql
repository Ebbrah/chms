-- Prevent duplicate account identities by email at the profile layer.
-- This guard is case-insensitive and allows null/blank emails.

CREATE OR REPLACE FUNCTION public.prevent_duplicate_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR BTRIM(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id <> NEW.id
      AND p.email IS NOT NULL
      AND LOWER(BTRIM(p.email)) = LOWER(BTRIM(NEW.email))
  ) THEN
    RAISE EXCEPTION 'An account with this email already exists.'
      USING ERRCODE = 'unique_violation';
  END IF;

  NEW.email := LOWER(BTRIM(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_profile_email ON public.profiles;

CREATE TRIGGER trg_prevent_duplicate_profile_email
BEFORE INSERT OR UPDATE OF email ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_profile_email();
