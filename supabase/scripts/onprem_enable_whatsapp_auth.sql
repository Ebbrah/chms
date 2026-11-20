-- Run on the EXISTING on-prem database (VM .36) after WhatsApp auth migrations
-- are applied. Safe to re-run. Does not touch cloud / Ebenezer production.
--
-- Switches the public parish to WhatsApp OTP (the same auth_mode Ebenezer uses).
-- Login and join then ask for a phone number and a 6-digit WhatsApp code.
-- Members who already signed up with email use /join/<slug>/sasisha-whatsapp
-- once, to attach the WhatsApp number on their profile.

UPDATE public.organizations
SET settings = COALESCE(settings, '{}'::jsonb) || '{"auth_mode":"whatsapp"}'::jsonb
WHERE slug = 'klc';

-- Confirm:
-- SELECT slug, settings ->> 'auth_mode' AS auth_mode FROM public.organizations WHERE slug = 'klc';
