-- Fix 1: location_qr_codes had USING (true) allowing cross-org reads.
-- Replace with org-membership check so only members of that org can read its locations.
DROP POLICY IF EXISTS "authenticated read qr locations" ON public.location_qr_codes;

CREATE POLICY "org members read qr locations"
  ON public.location_qr_codes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = location_qr_codes.organization_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Fix 2: shift_swaps "parties see own swaps" uses OR with a nullable column.
-- When requested_to IS NULL (open swap request), the OR short-circuits correctly for
-- the requester (requested_by = auth.uid() is TRUE), but other org members cannot
-- see open swap requests at all. Fix by also exposing open swaps to org members.
DROP POLICY IF EXISTS "parties see own swaps" ON public.shift_swaps;

CREATE POLICY "parties see own swaps"
  ON public.shift_swaps FOR SELECT
  USING (
    requested_by = auth.uid()
    OR requested_to = auth.uid()
    OR (
      -- Open swap requests (no specific recipient) visible to all org members
      requested_to IS NULL
      AND EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_id = shift_swaps.organization_id
          AND user_id = auth.uid()
          AND status = 'active'
      )
    )
  );
