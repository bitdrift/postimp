-- Allow web-only signups without a phone number
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
