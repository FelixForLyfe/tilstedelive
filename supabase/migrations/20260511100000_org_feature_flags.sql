CREATE TABLE IF NOT EXISTS public.org_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  aktiviteter boolean NOT NULL DEFAULT true,
  status boolean NOT NULL DEFAULT true,
  arbejdstidslog boolean NOT NULL DEFAULT true,
  hjemsendelser boolean NOT NULL DEFAULT true,
  opgaver boolean NOT NULL DEFAULT false,
  vagtplan boolean NOT NULL DEFAULT false,
  gulvoversigt boolean NOT NULL DEFAULT false,
  anonym_feedback boolean NOT NULL DEFAULT false,
  checkin_method text NOT NULL DEFAULT 'none' CHECK (checkin_method IN ('none', 'qr', 'pin', 'both')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own org flags"
  ON public.org_feature_flags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = org_feature_flags.organization_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

CREATE POLICY "admins upsert own org flags"
  ON public.org_feature_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = org_feature_flags.organization_id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = org_feature_flags.organization_id
        AND user_id = auth.uid()
        AND role = 'admin'
        AND status = 'active'
    )
  );
