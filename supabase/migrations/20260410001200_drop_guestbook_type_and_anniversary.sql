-- Remove voice/video type support from guestbook (text-only going forward)
ALTER TABLE guestbook_messages DROP COLUMN IF EXISTS type;

-- Remove anniversary entries table (feature removed from the site)
DROP TABLE IF EXISTS anniversary_entries CASCADE;
