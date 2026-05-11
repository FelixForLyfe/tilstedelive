-- QR code locations
CREATE TABLE IF NOT EXISTS public.location_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_name text NOT NULL DEFAULT 'Indgang',
  code text NOT NULL UNIQUE,
  pin_hash text,
  pin_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_qr_codes_org_idx ON public.location_qr_codes(organization_id);
CREATE INDEX IF NOT EXISTS location_qr_codes_code_idx ON public.location_qr_codes(code);

ALTER TABLE public.location_qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage qr locations"
  ON public.location_qr_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = location_qr_codes.organization_id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = location_qr_codes.organization_id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    )
  );

CREATE POLICY "authenticated read qr locations"
  ON public.location_qr_codes FOR SELECT
  TO authenticated
  USING (true);

-- Staff check-ins
CREATE TABLE IF NOT EXISTS public.staff_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.location_qr_codes(id) ON DELETE SET NULL,
  checkin_type text NOT NULL CHECK (checkin_type IN ('qr', 'pin')),
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz,
  notes text
);

CREATE INDEX IF NOT EXISTS staff_checkins_org_idx ON public.staff_checkins(organization_id);
CREATE INDEX IF NOT EXISTS staff_checkins_user_idx ON public.staff_checkins(user_id);
CREATE INDEX IF NOT EXISTS staff_checkins_location_idx ON public.staff_checkins(location_id);
CREATE INDEX IF NOT EXISTS staff_checkins_checked_in_at_idx ON public.staff_checkins(checked_in_at);

ALTER TABLE public.staff_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own checkins"
  ON public.staff_checkins FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins see org checkins"
  ON public.staff_checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = staff_checkins.organization_id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    )
  );

-- PIN brute force tracking
CREATE TABLE IF NOT EXISTS public.pin_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.location_qr_codes(id) ON DELETE CASCADE,
  user_id uuid,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS pin_attempts_loc_user_idx ON public.pin_attempts(location_id, user_id, attempted_at);

ALTER TABLE public.pin_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no direct access to pin attempts"
  ON public.pin_attempts FOR ALL
  USING (false);
