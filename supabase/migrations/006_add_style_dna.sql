-- ─── Style DNA: signature haircut + beard combo ───────────────────
-- Stores each customer's chosen "Style DNA" — a haircut and a beard
-- style that together define their signature look. Both are optional.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS style_dna_haircut TEXT,
  ADD COLUMN IF NOT EXISTS style_dna_beard   TEXT;
