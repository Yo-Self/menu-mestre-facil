-- Migration: fix_whatsapp_phone_format
-- Description: Fix WhatsApp phone number format to comply with international standards
-- Add + prefix to existing phone numbers

UPDATE public.restaurants 
SET whatsapp_phone = '+' || whatsapp_phone
WHERE whatsapp_phone IS NOT NULL 
  AND whatsapp_phone ~ '^[1-9]\d{1,14}$'
  AND whatsapp_phone NOT LIKE '+%';

-- Verify the fix
SELECT id, name, whatsapp_phone 
FROM public.restaurants 
WHERE whatsapp_phone IS NOT NULL;
