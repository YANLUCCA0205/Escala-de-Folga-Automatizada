// =============================================================================
// SUPABASE EDGE FUNCTION: `admin-users`
// Endpoint administrativo autenticado para provisionamento e governança RBAC.
// Variáveis de ambiente fornecidas automaticamente pelo runtime do Supabase:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_PUBLIC_URL (opcional)
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleAdminUsersRequest } from "./handler.mjs";

const ALLOWED_ORIGIN = Deno.env.get("APP_PUBLIC_URL") || "*";

function corsHeaders(origin: string | null) {
  const allow = ALLOWED_ORIGIN === "*" ? origin || "*" : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: corsHeaders(origin),
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ ok: false, error: "SERVER_MISCONFIGURED" }), {
      status: 500,
      headers: corsHeaders(origin),
    });
  }

  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "INVALID_JSON" }), {
      status: 400,
      headers: corsHeaders(origin),
    });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const redirectTo = Deno.env.get("APP_PUBLIC_URL") || origin || "";
  const { status, payload } = await handleAdminUsersRequest({
    serviceClient,
    bearerToken,
    body,
    redirectTo,
  });

  return new Response(JSON.stringify(payload), {
    status,
    headers: corsHeaders(origin),
  });
});
