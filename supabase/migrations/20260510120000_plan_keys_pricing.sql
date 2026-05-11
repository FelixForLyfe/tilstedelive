-- Custom pricing on plan keys
ALTER TABLE public.plan_keys
  ADD COLUMN IF NOT EXISTS price_dkk    INT NULL,  -- override price (absolute)
  ADD COLUMN IF NOT EXISTS discount_pct INT NULL    -- percentage off base price (0-100)
    CHECK (discount_pct IS NULL OR (discount_pct >= 0 AND discount_pct <= 100));
