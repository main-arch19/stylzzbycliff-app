-- ════════════════════════════════════════════════════════════════
-- StylzzByCliff — Migration 011: Broadcast email log
--
-- Audit trail for the "message all customers" composer on the barber
-- dashboard. The send-broadcast Edge Function inserts one row per blast
-- (who sent it, subject/body, and how many customers it reached).
-- Inserts happen with the service role inside the function; staff read.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS broadcasts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  subject          TEXT NOT NULL,
  body             TEXT NOT NULL,
  recipient_count  INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created
  ON broadcasts(created_at DESC);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- Staff (barber/admin) can review the broadcast history.
CREATE POLICY "broadcasts: staff read"
  ON broadcasts FOR SELECT
  USING (get_my_role() IN ('barber','admin'));
