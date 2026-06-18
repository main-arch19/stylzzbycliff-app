-- ════════════════════════════════════════════════════════════════
-- StylzzByCliff — Migration 008: Web Push subscriptions
--
-- Stores the browser PushSubscription per customer so an Edge Function
-- (send-push) can deliver appointment reminders, streak/decay nudges,
-- "spin available", and challenge-ending alerts.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,   -- unique per browser/device
  p256dh       TEXT NOT NULL,          -- public key from the subscription
  auth         TEXT NOT NULL,          -- auth secret from the subscription
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer
  ON push_subscriptions(customer_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions: own read"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "push_subscriptions: own insert"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "push_subscriptions: own delete"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = customer_id);

CREATE POLICY "push_subscriptions: admin all"
  ON push_subscriptions FOR ALL
  USING (get_my_role() = 'admin');
