BEGIN;
ALTER TABLE personal_brandings ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
ALTER TABLE personal_brandings ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500);
ALTER TABLE personal_brandings ADD COLUMN IF NOT EXISTS background_color VARCHAR(7) NOT NULL DEFAULT '#050505';
ALTER TABLE personal_brandings ADD COLUMN IF NOT EXISTS surface_color VARCHAR(7) NOT NULL DEFAULT '#121416';
ALTER TABLE personal_brandings ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7) NOT NULL DEFAULT '#C0C0C0';
ALTER TABLE personal_brandings ADD COLUMN IF NOT EXISTS border_color VARCHAR(7) NOT NULL DEFAULT '#34373A';
ALTER TABLE personal_brandings ADD COLUMN IF NOT EXISTS text_color VARCHAR(7) NOT NULL DEFAULT '#F5F5F5';
ALTER TABLE personal_brandings ADD COLUMN IF NOT EXISTS muted_text_color VARCHAR(7) NOT NULL DEFAULT '#A7ABB0';
ALTER TABLE personal_brandings ADD COLUMN IF NOT EXISTS font_family VARCHAR(32) NOT NULL DEFAULT 'Inter';
ALTER TABLE personal_brandings ADD COLUMN IF NOT EXISTS modules JSON NOT NULL DEFAULT '{}';
UPDATE personal_brandings SET slug = trim(both '-' from regexp_replace(regexp_replace(lower(display_name), '^personal[[:space:]-]+', ''), '[^a-z0-9]+', '-', 'g')) WHERE slug IS NULL;
UPDATE personal_brandings SET slug = 'personal-' || substring(personal_id::text, 1, 8) WHERE slug = '';
WITH duplicates AS (
    SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY id) AS position
    FROM personal_brandings
)
UPDATE personal_brandings branding
SET slug = duplicates.slug || '-' || substring(branding.personal_id::text, 1, 8)
FROM duplicates
WHERE branding.id = duplicates.id AND duplicates.position > 1;
ALTER TABLE personal_brandings ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ix_personal_brandings_slug ON personal_brandings (slug);
COMMIT;
