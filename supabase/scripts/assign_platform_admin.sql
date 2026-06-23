-- Assign a user as platform admin (run once in Supabase SQL editor).
-- Replace the email with your auth account email.

INSERT INTO public.platform_admins (user_id)
SELECT u.id
FROM auth.users u
WHERE lower(u.email) = lower('chmsadmin@gmail.com')
ON CONFLICT (user_id) DO NOTHING;

-- Verify:
-- SELECT pa.user_id, u.email FROM public.platform_admins pa JOIN auth.users u ON u.id = pa.user_id;
