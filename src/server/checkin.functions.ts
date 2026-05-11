import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

function decodeJwtUserId(accessToken: string): string {
  const parts = accessToken.split(".");
  if (parts.length !== 3) throw new Error("Ugyldig session.");
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    if (!payload?.sub) throw new Error();
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) throw new Error("Session udløbet.");
    return payload.sub as string;
  } catch (e: any) {
    throw new Error(e?.message ?? "Ugyldig session.");
  }
}

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(pin, salt, 100000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPin(pin: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    const derived = pbkdf2Sync(pin, salt, 100000, 32, "sha256").toString("hex");
    return timingSafeEqual(Buffer.from(derived), Buffer.from(hash));
  } catch {
    return false;
  }
}

function generateCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export const generateQrLocation = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        orgId: z.string().uuid(),
        locationName: z.string().min(1).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = decodeJwtUserId(data.accessToken);

    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", data.orgId)
      .eq("status", "active")
      .single();

    if (membership?.role !== "admin") {
      throw new Error("Kun administratorer kan oprette QR-lokationer.");
    }

    let code: string = "";
    for (let i = 0; i < 10; i++) {
      code = generateCode();
      const { data: existing } = await (supabaseAdmin as any)
        .from("location_qr_codes")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (!existing) break;
    }

    const { data: location, error } = await (supabaseAdmin as any)
      .from("location_qr_codes")
      .insert({ organization_id: data.orgId, location_name: data.locationName, code })
      .select("id, code, location_name, pin_hash, pin_updated_at, created_at")
      .single();

    if (error) throw new Error(error.message);
    return location as QrLocation;
  });

export const deleteQrLocation = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        locationId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = decodeJwtUserId(data.accessToken);

    const { data: location } = await (supabaseAdmin as any)
      .from("location_qr_codes")
      .select("organization_id")
      .eq("id", data.locationId)
      .single();

    if (!location) throw new Error("Lokation ikke fundet.");

    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", location.organization_id)
      .eq("status", "active")
      .single();

    if (membership?.role !== "admin") throw new Error("Kun administratorer kan slette lokationer.");

    const { error } = await (supabaseAdmin as any)
      .from("location_qr_codes")
      .delete()
      .eq("id", data.locationId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setLocationPin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        locationId: z.string().uuid(),
        pin: z.string().regex(/^\d{4,6}$/, "PIN skal være 4-6 cifre."),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = decodeJwtUserId(data.accessToken);

    const { data: location } = await (supabaseAdmin as any)
      .from("location_qr_codes")
      .select("organization_id")
      .eq("id", data.locationId)
      .single();

    if (!location) throw new Error("Lokation ikke fundet.");

    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", location.organization_id)
      .eq("status", "active")
      .single();

    if (membership?.role !== "admin") throw new Error("Kun administratorer kan sætte PIN.");

    const pin_hash = hashPin(data.pin);
    const { error } = await (supabaseAdmin as any)
      .from("location_qr_codes")
      .update({ pin_hash, pin_updated_at: new Date().toISOString() })
      .eq("id", data.locationId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const qrCheckin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        code: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = decodeJwtUserId(data.accessToken);

    const { data: location } = await (supabaseAdmin as any)
      .from("location_qr_codes")
      .select("id, organization_id, location_name")
      .eq("code", data.code.toUpperCase())
      .single();

    if (!location) throw new Error("Ugyldig QR-kode.");

    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", location.organization_id)
      .eq("status", "active")
      .single();

    if (!membership) throw new Error("Du er ikke tilknyttet denne organisation.");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: openCheckin } = await (supabaseAdmin as any)
      .from("staff_checkins")
      .select("id, checked_in_at")
      .eq("user_id", userId)
      .eq("organization_id", location.organization_id)
      .is("checked_out_at", null)
      .gte("checked_in_at", today.toISOString())
      .maybeSingle();

    if (openCheckin) {
      await (supabaseAdmin as any)
        .from("staff_checkins")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("id", openCheckin.id);
      return { action: "checkout" as const, locationName: location.location_name as string };
    }

    await (supabaseAdmin as any).from("staff_checkins").insert({
      organization_id: location.organization_id,
      user_id: userId,
      location_id: location.id,
      checkin_type: "qr",
    });
    return { action: "checkin" as const, locationName: location.location_name as string };
  });

export const pinCheckin = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        locationId: z.string().uuid(),
        pin: z.string().regex(/^\d{4,6}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = decodeJwtUserId(data.accessToken);

    const { data: location } = await (supabaseAdmin as any)
      .from("location_qr_codes")
      .select("id, organization_id, location_name, pin_hash")
      .eq("id", data.locationId)
      .single();

    if (!location) throw new Error("Lokation ikke fundet.");
    if (!location.pin_hash) throw new Error("Ingen PIN er opsat for denne lokation.");

    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", location.organization_id)
      .eq("status", "active")
      .single();

    if (!membership) throw new Error("Du er ikke tilknyttet denne organisation.");

    // Brute force: 5 failed attempts in 15 min → locked
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await (supabaseAdmin as any)
      .from("pin_attempts")
      .select("id", { count: "exact", head: true })
      .eq("location_id", data.locationId)
      .eq("user_id", userId)
      .eq("success", false)
      .gte("attempted_at", windowStart);

    if ((count ?? 0) >= 5) {
      throw new Error("For mange fejlede forsøg. Prøv igen om 15 minutter.");
    }

    const ok = verifyPin(data.pin, location.pin_hash);
    await (supabaseAdmin as any)
      .from("pin_attempts")
      .insert({ location_id: data.locationId, user_id: userId, success: ok });

    if (!ok) throw new Error("Forkert PIN. Prøv igen.");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: openCheckin } = await (supabaseAdmin as any)
      .from("staff_checkins")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", location.organization_id)
      .is("checked_out_at", null)
      .gte("checked_in_at", today.toISOString())
      .maybeSingle();

    if (openCheckin) {
      await (supabaseAdmin as any)
        .from("staff_checkins")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("id", openCheckin.id);
      return { action: "checkout" as const, locationName: location.location_name as string };
    }

    await (supabaseAdmin as any).from("staff_checkins").insert({
      organization_id: location.organization_id,
      user_id: userId,
      location_id: location.id,
      checkin_type: "pin",
    });
    return { action: "checkin" as const, locationName: location.location_name as string };
  });

export type QrLocation = {
  id: string;
  code: string;
  location_name: string;
  pin_hash: string | null;
  pin_updated_at: string | null;
  created_at: string;
};

export type StaffCheckin = {
  id: string;
  checkin_type: "qr" | "pin";
  checked_in_at: string;
  checked_out_at: string | null;
  location: { location_name: string } | null;
  user: { full_name: string | null; email: string | null } | null;
};

export const getOrgCheckins = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        orgId: z.string().uuid(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = decodeJwtUserId(data.accessToken);

    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", data.orgId)
      .eq("status", "active")
      .single();

    if (membership?.role !== "admin") throw new Error("Kun administratorer kan se tjek-ind oversigten.");

    let query = (supabaseAdmin as any)
      .from("staff_checkins")
      .select(
        "id, checkin_type, checked_in_at, checked_out_at, location:location_qr_codes(location_name), user:profiles(full_name, email)",
      )
      .eq("organization_id", data.orgId)
      .order("checked_in_at", { ascending: false })
      .limit(500);

    if (data.from) query = query.gte("checked_in_at", data.from);
    if (data.to) query = query.lte("checked_in_at", data.to);

    const { data: checkins, error } = await query;
    if (error) throw new Error(error.message);
    return checkins as StaffCheckin[];
  });

export const exportCheckinsCSV = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        orgId: z.string().uuid(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const userId = decodeJwtUserId(data.accessToken);

    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", data.orgId)
      .eq("status", "active")
      .single();

    if (membership?.role !== "admin") throw new Error("Kun administratorer kan eksportere.");

    let query = (supabaseAdmin as any)
      .from("staff_checkins")
      .select(
        "id, checkin_type, checked_in_at, checked_out_at, location:location_qr_codes(location_name), user:profiles(full_name, email)",
      )
      .eq("organization_id", data.orgId)
      .order("checked_in_at", { ascending: false });

    if (data.from) query = query.gte("checked_in_at", data.from);
    if (data.to) query = query.lte("checked_in_at", data.to);

    const { data: checkins, error } = await query;
    if (error) throw new Error(error.message);

    const rows = [
      ["Navn", "Email", "Lokation", "Type", "Tjek ind", "Tjek ud", "Varighed (min)"],
      ...(checkins as StaffCheckin[]).map((c) => {
        const dur =
          c.checked_out_at
            ? String(Math.round((new Date(c.checked_out_at).getTime() - new Date(c.checked_in_at).getTime()) / 60000))
            : "";
        return [
          c.user?.full_name ?? "",
          c.user?.email ?? "",
          c.location?.location_name ?? "",
          c.checkin_type === "qr" ? "QR-kode" : "PIN",
          new Date(c.checked_in_at).toLocaleString("da-DK"),
          c.checked_out_at ? new Date(c.checked_out_at).toLocaleString("da-DK") : "",
          dur,
        ];
      }),
    ];

    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    return { csv };
  });
