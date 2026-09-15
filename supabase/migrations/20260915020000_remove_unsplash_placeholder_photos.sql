-- Remove the placeholder photo rows that originated from supabase/seed.sql.
--
-- These rows point at images.unsplash.com stock images rather than the couple's
-- media. They were never cleaned out of production, so the gallery renders
-- broken tiles and every attempt to load one logs a CSP violation:
--
--   Connecting to 'https://images.unsplash.com/photo-...' violates the
--   following Content Security Policy directive: "connect-src 'self'
--   https://*.supabase.co https://*.netlify.app
--   https://media.wedding.theporadas.com ..."
--
-- connect-src deliberately does not (and should not) allow images.unsplash.com,
-- so the right fix is to remove the placeholder data -- not to widen the policy
-- and serve stock photos on a real wedding site.
--
-- Matching on the URL host instead of hard-coded ids keeps this idempotent and
-- correct in every environment (production, staging, a local db reset). Running
-- it twice deletes nothing the second time.

delete from public.photos
where url like 'https://images.unsplash.com/%'
   or thumbnail like 'https://images.unsplash.com/%';
