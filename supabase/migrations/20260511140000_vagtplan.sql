-- =============================================================================
-- Vagtplan (shift scheduling) tables
-- =============================================================================

-- Staff availability (weekly recurring)
CREATE TABLE IF NOT EXISTS public.staff_availability (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  day_of_week     int         NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Monday
  start_time      time        NOT NULL,
  end_time        time        NOT NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, user_id, day_of_week)
);
ALTER TABLE public.staff_availability
  ADD CONSTRAINT staff_availability_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS staff_availability_org_idx  ON public.staff_availability(organization_id);
CREATE INDEX IF NOT EXISTS staff_availability_user_idx ON public.staff_availability(user_id);
ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage own availability"   ON public.staff_availability FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins see org availability"     ON public.staff_availability FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = staff_availability.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- Shift templates (reusable shift blueprints)
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  start_time      time        NOT NULL,
  end_time        time        NOT NULL,
  role            text,
  color           text        DEFAULT '#6366f1',
  created_at      timestamptz DEFAULT now(),
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS shift_templates_org_idx ON public.shift_templates(organization_id);
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage shift templates"   ON public.shift_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = shift_templates.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = shift_templates.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'));
CREATE POLICY "staff read shift templates"      ON public.shift_templates FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = shift_templates.organization_id
      AND user_id = auth.uid() AND status = 'active'));

-- Shifts (individual scheduled shifts)
CREATE TABLE IF NOT EXISTS public.shifts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id)        ON DELETE CASCADE,
  location_id     uuid        REFERENCES public.location_qr_codes(id)             ON DELETE SET NULL,
  template_id     uuid        REFERENCES public.shift_templates(id)               ON DELETE SET NULL,
  role            text,
  color           text        DEFAULT '#6366f1',
  date            date        NOT NULL,
  start_time      time        NOT NULL,
  end_time        time        NOT NULL,
  required_staff  int         NOT NULL DEFAULT 1,
  is_open         boolean     DEFAULT false,
  notes           text,
  status          text        DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
  created_at      timestamptz DEFAULT now(),
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS shifts_org_date_idx ON public.shifts(organization_id, date);
CREATE INDEX IF NOT EXISTS shifts_date_idx     ON public.shifts(date);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage shifts"            ON public.shifts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = shifts.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = shifts.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'));
-- Staff see open/published shifts in their org
CREATE POLICY "staff read org published shifts" ON public.shifts FOR SELECT
  USING (status IN ('published', 'cancelled')
    AND EXISTS (SELECT 1 FROM public.organization_members
      WHERE organization_id = shifts.organization_id
        AND user_id = auth.uid() AND status = 'active'));
-- Staff see their own assigned shifts regardless of status
CREATE POLICY "staff read own assigned shifts"  ON public.shifts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shift_assignments
    WHERE shift_id = shifts.id AND user_id = auth.uid()));

-- Shift assignments (staff → shift mapping)
CREATE TABLE IF NOT EXISTS public.shift_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id        uuid        NOT NULL REFERENCES public.shifts(id)         ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id)            ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id)  ON DELETE CASCADE,
  status          text        DEFAULT 'assigned'
                              CHECK (status IN ('assigned', 'confirmed', 'declined', 'swapped')),
  assigned_at     timestamptz DEFAULT now(),
  assigned_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (shift_id, user_id)
);
ALTER TABLE public.shift_assignments
  ADD CONSTRAINT shift_assignments_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS shift_assignments_shift_idx ON public.shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS shift_assignments_user_idx  ON public.shift_assignments(user_id);
CREATE INDEX IF NOT EXISTS shift_assignments_org_idx   ON public.shift_assignments(organization_id);
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage own assignments"    ON public.shift_assignments FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins manage all assignments"   ON public.shift_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = shift_assignments.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = shift_assignments.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- Shift swap requests
CREATE TABLE IF NOT EXISTS public.shift_swaps (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shift_id            uuid        NOT NULL REFERENCES public.shifts(id)        ON DELETE CASCADE,
  requested_by        uuid        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  requested_to        uuid        REFERENCES auth.users(id)                    ON DELETE SET NULL,
  status              text        DEFAULT 'pending'
                                  CHECK (status IN ('pending','accepted','declined','approved','rejected')),
  manager_approved_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shift_swaps_org_idx          ON public.shift_swaps(organization_id);
CREATE INDEX IF NOT EXISTS shift_swaps_shift_idx        ON public.shift_swaps(shift_id);
CREATE INDEX IF NOT EXISTS shift_swaps_requested_by_idx ON public.shift_swaps(requested_by);
CREATE INDEX IF NOT EXISTS shift_swaps_requested_to_idx ON public.shift_swaps(requested_to);
ALTER TABLE public.shift_swaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties see own swaps"           ON public.shift_swaps FOR SELECT
  USING (requested_by = auth.uid() OR requested_to = auth.uid());
CREATE POLICY "requester create swap"           ON public.shift_swaps FOR INSERT
  WITH CHECK (requested_by = auth.uid());
CREATE POLICY "parties update swap"             ON public.shift_swaps FOR UPDATE
  USING (requested_by = auth.uid() OR requested_to = auth.uid());
CREATE POLICY "admins manage all swaps"         ON public.shift_swaps FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = shift_swaps.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = shift_swaps.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- Absence requests
CREATE TABLE IF NOT EXISTS public.absence_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  date            date        NOT NULL,
  reason          text        CHECK (reason IN ('sygdom', 'ferie', 'fridag', 'andet')),
  notes           text,
  status          text        DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE public.absence_requests
  ADD CONSTRAINT absence_requests_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS absence_requests_org_date_idx ON public.absence_requests(organization_id, date);
CREATE INDEX IF NOT EXISTS absence_requests_user_idx     ON public.absence_requests(user_id);
ALTER TABLE public.absence_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage own absences"       ON public.absence_requests FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins manage all absences"      ON public.absence_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = absence_requests.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = absence_requests.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- Time bank (overtime balance tracking)
CREATE TABLE IF NOT EXISTS public.time_bank (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid          NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  hours           numeric(5,2)  NOT NULL,
  reason          text,
  type            text          CHECK (type IN ('overtime', 'time_off', 'adjustment')),
  created_at      timestamptz   DEFAULT now(),
  created_by      uuid          REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.time_bank
  ADD CONSTRAINT time_bank_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS time_bank_org_user_idx ON public.time_bank(organization_id, user_id);
ALTER TABLE public.time_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff see own time bank"         ON public.time_bank FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "admins manage time bank"         ON public.time_bank FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = time_bank.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = time_bank.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'));

-- Vagtplan settings per organisation
-- custom_roles stored as [{name, color}] objects for per-role colour support
CREATE TABLE IF NOT EXISTS public.vagtplan_settings (
  organization_id         uuid          PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  planning_period         text          DEFAULT 'weekly'
                                        CHECK (planning_period IN ('weekly','biweekly','monthly')),
  publish_deadline_days   int           DEFAULT 3,
  min_rest_hours          int           DEFAULT 11,
  max_weekly_hours        int           DEFAULT 48,
  min_notice_hours        int           DEFAULT 2,
  allow_self_swap         boolean       DEFAULT false,
  overtime_after_hours    numeric(4,2)  DEFAULT 37.0,
  weekend_rate_multiplier numeric(3,2)  DEFAULT 1.5,
  evening_rate_multiplier numeric(3,2)  DEFAULT 1.3,
  custom_roles            jsonb         DEFAULT '[{"name":"Medarbejder","color":"#6366f1"},{"name":"Kasseassistent","color":"#f59e0b"},{"name":"Lager","color":"#10b981"},{"name":"Manager","color":"#ef4444"}]'::jsonb,
  updated_at              timestamptz   DEFAULT now()
);
ALTER TABLE public.vagtplan_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage vagtplan settings" ON public.vagtplan_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = vagtplan_settings.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = vagtplan_settings.organization_id
      AND user_id = auth.uid() AND role = 'admin' AND status = 'active'));
CREATE POLICY "staff read vagtplan settings"    ON public.vagtplan_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = vagtplan_settings.organization_id
      AND user_id = auth.uid() AND status = 'active'));
