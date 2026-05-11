-- push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users manage own push subs"
    ON public.push_subscriptions
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- staff_messages
CREATE TABLE IF NOT EXISTS public.staff_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('all', 'user', 'group')),
  recipient_id UUID,
  message TEXT NOT NULL CHECK (char_length(message) <= 500),
  is_urgent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.staff_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admins send messages"
    ON public.staff_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = staff_messages.organization_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'active'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff read relevant messages"
    ON public.staff_messages
    FOR SELECT
    TO authenticated
    USING (
      -- admins see all in their org
      EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = staff_messages.organization_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'active'
      )
      OR
      -- staff see messages addressed to all
      (
        recipient_type = 'all'
        AND EXISTS (
          SELECT 1 FROM public.organization_members
          WHERE organization_id = staff_messages.organization_id
            AND user_id = auth.uid()
            AND status = 'active'
        )
      )
      OR
      -- staff see messages addressed to them directly
      (recipient_type = 'user' AND recipient_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_staff_messages_org_id ON public.staff_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_messages_created_at ON public.staff_messages(created_at);

-- staff_message_reads
CREATE TABLE IF NOT EXISTS public.staff_message_reads (
  message_id UUID NOT NULL REFERENCES public.staff_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.staff_message_reads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users manage own reads"
    ON public.staff_message_reads
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- indkrydsning_codes
CREATE TABLE IF NOT EXISTS public.indkrydsning_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL DEFAULT 'Indgang',
  code TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.indkrydsning_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public read active indkrydsning codes"
    ON public.indkrydsning_codes
    FOR SELECT
    USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "admins manage indkrydsning codes"
    ON public.indkrydsning_codes
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = indkrydsning_codes.organization_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'active'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = indkrydsning_codes.organization_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'active'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_indkrydsning_codes_code ON public.indkrydsning_codes(code);
CREATE INDEX IF NOT EXISTS idx_indkrydsning_codes_org ON public.indkrydsning_codes(organization_id);

-- notifications table (in-app notification bell)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users see own notifications"
    ON public.notifications
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, is_read, created_at DESC);
