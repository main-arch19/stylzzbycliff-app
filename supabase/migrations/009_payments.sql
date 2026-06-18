-- ════════════════════════════════════════════════════════════════
-- StylzzByCliff — Migration 009: Payments (tips / balance / deposit)
--
-- Bookings (and any deposit) happen on the external calendar; in-app
-- payments focus on post-cut tips and paying a remaining balance. We use
-- Stripe Checkout (hosted) so no card data touches the app. A deposit
-- column is included so the calendar can report deposit status via the
-- ingestion contract if it ever collects one.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_status TEXT NOT NULL DEFAULT 'none'
  CHECK (deposit_status IN ('none', 'pending', 'paid'));

CREATE TABLE IF NOT EXISTS payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id           UUID REFERENCES appointments(id) ON DELETE SET NULL,
  customer_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_cents             INTEGER NOT NULL CHECK (amount_cents > 0),
  type                     TEXT NOT NULL CHECK (type IN ('tip', 'balance', 'deposit')),
  status                   TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  stripe_session_id        TEXT,
  stripe_payment_intent_id TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_customer    ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment ON payments(appointment_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Customers see their own payments. Rows are created/updated by the
-- Stripe Edge Functions using the service-role key (bypasses RLS), so no
-- customer insert/update policy is granted.
CREATE POLICY "payments: own read"
  ON payments FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "payments: barber read"
  ON payments FOR SELECT
  USING (get_my_role() IN ('barber', 'admin'));

CREATE POLICY "payments: admin all"
  ON payments FOR ALL
  USING (get_my_role() = 'admin');
