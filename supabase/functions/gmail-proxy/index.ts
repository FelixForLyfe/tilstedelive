import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // ── Auth: verify caller is superadmin ────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as any)?.role !== "superadmin") return json({ error: "Forbidden" }, 403);

  // ── Gmail access token ───────────────────────────────────────────────────────
  let gmailToken: string;
  try {
    gmailToken = await getGmailToken();
  } catch (err: any) {
    return json({ error: "Gmail ikke konfigureret: " + err.message }, 503);
  }

  // ── Dispatch ─────────────────────────────────────────────────────────────────
  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    switch (body.action) {
      case "list":
        return json(await listInbox(gmailToken, body));
      case "get":
        return json(await getMessage(gmailToken, body.id, supabaseAdmin));
      case "send":
        return json(await sendMessage(gmailToken, body));
      case "markRead":
        return json(await markRead(gmailToken, body.id));
      default:
        return json({ error: "Unknown action: " + body.action }, 400);
    }
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});

// ── Gmail OAuth token ─────────────────────────────────────────────────────────

async function getGmailToken(): Promise<string> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Sæt GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET og GMAIL_REFRESH_TOKEN i Supabase secrets",
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "Ukendt Google OAuth-fejl");
  }
  return data.access_token;
}

// ── List inbox ────────────────────────────────────────────────────────────────

async function listInbox(
  token: string,
  { maxResults = 25, pageToken }: { maxResults?: number; pageToken?: string },
) {
  const qs = new URLSearchParams({ maxResults: String(maxResults), labelIds: "INBOX" });
  if (pageToken) qs.set("pageToken", pageToken);

  const listRes = await gmailFetch(token, `/messages?${qs}`);
  if (!listRes.messages?.length) return { messages: [], nextPageToken: null, unreadCount: 0 };

  const messages = await Promise.all(
    (listRes.messages as { id: string }[]).map((m) => fetchSummary(token, m.id)),
  );

  // Unread count from INBOX label metadata
  const labelData = await gmailFetch(token, "/labels/INBOX");

  return {
    messages,
    nextPageToken: listRes.nextPageToken ?? null,
    unreadCount: labelData.messagesUnread ?? 0,
  };
}

async function fetchSummary(token: string, id: string) {
  const msg = await gmailFetch(
    token,
    `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID`,
  );
  const hdrs: { name: string; value: string }[] = msg.payload?.headers ?? [];
  return {
    id: msg.id as string,
    threadId: msg.threadId as string,
    subject: hdr(hdrs, "Subject") || "(ingen emne)",
    from: hdr(hdrs, "From"),
    date: hdr(hdrs, "Date"),
    snippet: (msg.snippet as string) ?? "",
    isUnread: (msg.labelIds as string[] | undefined)?.includes("UNREAD") ?? false,
    messageId: hdr(hdrs, "Message-ID"),
  };
}

// ── Get full message ──────────────────────────────────────────────────────────

async function getMessage(token: string, id: string, supabaseAdmin: any) {
  const msg = await gmailFetch(token, `/messages/${id}?format=full`);
  const hdrs: { name: string; value: string }[] = msg.payload?.headers ?? [];

  const from = hdr(hdrs, "From");
  const fromEmail = parseEmail(from);

  // Org lookup: find if this sender is a known user in any organisation
  let orgName: string | null = null;
  if (fromEmail) {
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserByEmail(fromEmail);
      if (authUser?.user?.id) {
        const { data: member } = await supabaseAdmin
          .from("organization_members")
          .select("organizations(name)")
          .eq("user_id", authUser.user.id)
          .limit(1)
          .maybeSingle();
        orgName = (member as any)?.organizations?.name ?? null;
      }
    } catch {
      // Non-fatal — org lookup is best-effort
    }
  }

  const body = extractBody(msg.payload);

  return {
    id: msg.id as string,
    threadId: msg.threadId as string,
    subject: hdr(hdrs, "Subject") || "(ingen emne)",
    from,
    to: hdr(hdrs, "To"),
    date: hdr(hdrs, "Date"),
    body,
    isUnread: (msg.labelIds as string[] | undefined)?.includes("UNREAD") ?? false,
    messageId: hdr(hdrs, "Message-ID"),
    references: hdr(hdrs, "References"),
    orgName,
  };
}

// ── Send / reply ──────────────────────────────────────────────────────────────

async function sendMessage(
  token: string,
  { to, subject, body, inReplyTo, references }: {
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string;
    references?: string;
  },
) {
  const lines = [
    "From: support@tilstede.live",
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(references
      ? [`References: ${references} ${inReplyTo ?? ""}`.trim()]
      : inReplyTo
        ? [`References: ${inReplyTo}`]
        : []),
    "",
    body,
  ];

  const raw = encodeBase64Url(lines.join("\r\n"));

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { id: data.id as string };
}

// ── Mark as read ──────────────────────────────────────────────────────────────

async function markRead(token: string, id: string) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
    },
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { ok: true };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function gmailFetch(token: string, path: string) {
  const base = "https://gmail.googleapis.com/gmail/v1/users/me";
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
  return data;
}

function hdr(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseEmail(from: string): string | null {
  return from.match(/<([^>]+)>/)?.[1] ?? from.match(/([^\s]+@[^\s]+)/)?.[1] ?? null;
}

function extractBody(payload: any): { text: string; html: string } {
  let text = "";
  let html = "";

  function decode(data: string): string {
    try {
      const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      return "";
    }
  }

  function walk(part: any) {
    if (!part) return;
    if (part.mimeType === "text/plain" && part.body?.data) text = decode(part.body.data);
    else if (part.mimeType === "text/html" && part.body?.data) html = decode(part.body.data);
    else if (part.parts) (part.parts as any[]).forEach(walk);
  }

  walk(payload);
  return { text, html };
}

function encodeBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
