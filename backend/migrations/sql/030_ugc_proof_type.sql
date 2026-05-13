-- 030: add proof_type to ugc_submissions
-- Distinguishes URL submissions from screenshot uploads.
-- Also records that AR_FILTER is now student-submitted (screenshot) not booth-verified.

ALTER TABLE ugc_submissions
  ADD COLUMN IF NOT EXISTS proof_type TEXT DEFAULT 'url';

-- Back-fill: mark any existing AR_FILTER rows as screenshot type.
UPDATE ugc_submissions
SET proof_type = 'screenshot'
WHERE source_type = 'AR_FILTER' AND proof_type = 'url';

NOTIFY pgrst, 'reload schema';

