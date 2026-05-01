
-- Invitation-tabel: admins genererer en kode, personale bruger koden ved signup
CREATE TABLE public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'employee',
  created_by uuid NOT NULL,
  used_by uuid,
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_code ON public.organization_invites (code) WHERE used_at IS NULL;
CREATE INDEX idx_invites_org ON public.organization_invites (organization_id);

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- Admins kan se og oprette koder til deres organisation
CREATE POLICY "admins manage invites"
ON public.organization_invites
FOR ALL
TO authenticated
USING (is_org_admin(auth.uid(), organization_id))
WITH CHECK (is_org_admin(auth.uid(), organization_id));

-- Authenticated brugere kan slå en gyldig kode op (for at indløse den)
CREATE POLICY "anyone can lookup unused codes"
ON public.organization_invites
FOR SELECT
TO authenticated
USING (used_at IS NULL AND expires_at > now());

-- Brugeren kan markere sin egen indløsning
CREATE POLICY "user can redeem own invite"
ON public.organization_invites
FOR UPDATE
TO authenticated
USING (used_at IS NULL AND expires_at > now())
WITH CHECK (used_by = auth.uid());

-- Function: indløs en invite-kode
CREATE OR REPLACE FUNCTION public.redeem_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite organization_invites%ROWTYPE;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT * INTO v_invite FROM organization_invites
  WHERE code = _code AND used_at IS NULL AND expires_at > now()
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Ugyldig eller udløbet kode';
  END IF;

  -- Marker som brugt
  UPDATE organization_invites SET used_by = v_user, used_at = now() WHERE id = v_invite.id;

  -- Tilføj som medlem (hvis ikke allerede)
  INSERT INTO organization_members (organization_id, user_id, role, status)
  VALUES (v_invite.organization_id, v_user, v_invite.role, 'active')
  ON CONFLICT DO NOTHING;

  RETURN v_invite.organization_id;
END;
$$;
