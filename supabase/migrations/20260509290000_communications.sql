-- Communications: announcements + changelog

-- System announcements shown to all users or a specific organisation.
CREATE TABLE IF NOT EXISTS public.announcements (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL CHECK (char_length(title) <= 200),
  body        TEXT        NOT NULL CHECK (char_length(body) <= 1000),
  type        TEXT        NOT NULL DEFAULT 'info'
                CHECK (type IN ('info', 'warning', 'maintenance')),
  target      TEXT        NOT NULL DEFAULT 'all'
                CHECK (target IN ('all', 'org')),
  org_id      UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements FORCE ROW LEVEL SECURITY;

-- Superadmin can do everything
DROP POLICY IF EXISTS "superadmin manage announcements" ON public.announcements;
CREATE POLICY "superadmin manage announcements"
  ON public.announcements FOR ALL TO authenticated
  USING      (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- Regular users can read active announcements targeting all or their org
DROP POLICY IF EXISTS "users read active announcements" ON public.announcements;
CREATE POLICY "users read active announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
    AND (
      target = 'all'
      OR (
        target = 'org' AND org_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      )
    )
  );

CREATE INDEX IF NOT EXISTS announcements_active_idx
  ON public.announcements (is_active, starts_at, ends_at);

-- Product changelog entries.
CREATE TABLE IF NOT EXISTS public.changelog (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version      TEXT        NOT NULL CHECK (char_length(version) <= 50),
  title        TEXT        NOT NULL CHECK (char_length(title) <= 200),
  body         TEXT        NOT NULL CHECK (char_length(body) <= 5000),
  is_published BOOLEAN     NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin manage changelog" ON public.changelog;
CREATE POLICY "superadmin manage changelog"
  ON public.changelog FOR ALL TO authenticated
  USING      (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "users read published changelog" ON public.changelog;
CREATE POLICY "users read published changelog"
  ON public.changelog FOR SELECT TO authenticated
  USING (is_published = true);

CREATE INDEX IF NOT EXISTS changelog_published_idx
  ON public.changelog (is_published, published_at DESC);
