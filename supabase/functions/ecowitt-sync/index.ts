const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ECOWITT_REALTIME = "https://api.ecowitt.net/api/v3/device/real_time";
const VERSION = "36.2.0";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function firstNumber(...values: unknown[]): number | null {
  for (const value of values) { const n = num(value); if (n !== null) return n; }
  return null;
}
function nested(data: any, ...paths: string[]) {
  for (const path of paths) {
    let value = data;
    for (const key of path.split(".")) value = value?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
}
function reading(value: any): number | null {
  return firstNumber(value?.value, value?.list?.[0]?.value, value);
}
async function rest(url: string, key: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}
async function authenticatedUser(req: Request, url: string, anon: string) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("Sesión requerida");
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: auth } });
  if (!response.ok) throw new Error("Sesión inválida");
  return await response.json();
}
async function assertCompanyMember(url: string, service: string, companyId: string, userId: string) {
  const rows = await rest(url, service, `company_members?company_id=eq.${encodeURIComponent(companyId)}&user_id=eq.${encodeURIComponent(userId)}&select=id`);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("No pertenecés a esta empresa");
}
function ecowittRow(companyId: string, mac: string, payload: any) {
  const data = payload?.data || payload;
  const outdoor = nested(data, "outdoor", "temp_and_humidity.outdoor") || {};
  const rain = nested(data, "rainfall", "rainfall_piezo") || {};
  const wind = nested(data, "wind") || {};
  const solar = nested(data, "solar_and_uvi") || {};
  const pressure = nested(data, "pressure") || {};
  const epoch = firstNumber(data?.time, payload?.time);
  const observed = epoch ? new Date(epoch * (epoch < 1e12 ? 1000 : 1)).toISOString() : new Date().toISOString();
  return {
    company_id: companyId,
    station_code: `ecowitt:${mac.toUpperCase()}`,
    observed_at: observed,
    rain_mm: firstNumber(reading(rain?.daily), reading(rain?.event), reading(rain?.rain_rate), 0),
    temperature_avg_c: reading(outdoor?.temperature),
    relative_humidity_pct: reading(outdoor?.humidity),
    wind_speed_kmh: firstNumber(reading(wind?.wind_speed), reading(wind?.wind), reading(wind?.gust)),
    solar_radiation_mj_m2: (() => {
      const watts = reading(solar?.solar);
      return watts === null ? null : watts * 0.0864; // W/m² promedio diario equivalente a MJ/m²/día
    })(),
    atmospheric_pressure_hpa: firstNumber(reading(pressure?.relative), reading(pressure?.absolute)),
    source_reference: `Ecowitt Cloud API · ${VERSION}`,
    raw_payload: payload,
  };
}
async function fetchEcowitt(config: any) {
  const url = new URL(ECOWITT_REALTIME);
  url.searchParams.set("application_key", config.application_key);
  url.searchParams.set("api_key", config.api_key);
  url.searchParams.set("mac", config.device_mac);
  url.searchParams.set("call_back", "all");
  url.searchParams.set("temp_unitid", "1");
  url.searchParams.set("pressure_unitid", "3");
  url.searchParams.set("wind_speed_unitid", "7");
  url.searchParams.set("rainfall_unitid", "12");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Ecowitt ${response.status}: ${text}`);
  const payload = JSON.parse(text);
  if (Number(payload?.code ?? 0) !== 0) throw new Error(payload?.msg || payload?.message || "Ecowitt rechazó la consulta");
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Faltan variables de Supabase");
    const user = await authenticatedUser(req, supabaseUrl, anonKey);
    const body = await req.json();
    const action = String(body.action || "sync");
    const companyId = String(body.company_id || "");
    if (!companyId) throw new Error("company_id es obligatorio");
    await assertCompanyMember(supabaseUrl, serviceKey, companyId, user.id);

    if (action === "save_config") {
      const deviceMac = String(body.device_mac || "").trim().toUpperCase();
      const applicationKey = String(body.application_key || "").trim();
      const apiKey = String(body.api_key || "").trim();
      if (!deviceMac || !applicationKey || !apiKey) throw new Error("Completá MAC, Application Key y API Key");
      const existing = await rest(supabaseUrl, serviceKey, `ecowitt_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=*`);
      const previous = Array.isArray(existing) ? existing[0] : null;
      const row = {
        company_id: companyId,
        station_name: String(body.station_name || "La Magdalena"),
        device_mac: deviceMac,
        application_key: applicationKey.startsWith("••••") && previous ? previous.application_key : applicationKey,
        api_key: apiKey.startsWith("••••") && previous ? previous.api_key : apiKey,
        enabled: body.enabled !== false,
        sync_interval_minutes: Math.max(5, Math.min(1440, Number(body.sync_interval_minutes || 15))),
        history_days: Math.max(1, Math.min(90, Number(body.history_days || 7))),
        updated_at: new Date().toISOString(),
      };
      await rest(supabaseUrl, serviceKey, "ecowitt_integrations?on_conflict=company_id", { method: "POST", body: JSON.stringify(row) });
      return json({ ok: true, action, version: VERSION, station_name: row.station_name, mac_suffix: deviceMac.slice(-5) });
    }

    const configs = await rest(supabaseUrl, serviceKey, `ecowitt_integrations?company_id=eq.${encodeURIComponent(companyId)}&enabled=eq.true&select=*`);
    const config = Array.isArray(configs) ? configs[0] : null;
    if (!config) throw new Error("Primero configurá la conexión Ecowitt");
    try {
      const payload = await fetchEcowitt(config);
      const row = ecowittRow(companyId, config.device_mac, payload);
      await rest(supabaseUrl, serviceKey, "weather_station_observations?on_conflict=company_id,station_code,observed_at", { method: "POST", body: JSON.stringify(row) });
      await rest(supabaseUrl, serviceKey, `ecowitt_integrations?company_id=eq.${encodeURIComponent(companyId)}`, {
        method: "PATCH",
        body: JSON.stringify({ last_sync_at: new Date().toISOString(), last_success_at: new Date().toISOString(), last_error: null, last_payload: payload, updated_at: new Date().toISOString() }),
      });
      return json({ ok: true, action, version: VERSION, observation: { ...row, raw_payload: undefined } });
    } catch (error) {
      await rest(supabaseUrl, serviceKey, `ecowitt_integrations?company_id=eq.${encodeURIComponent(companyId)}`, {
        method: "PATCH",
        body: JSON.stringify({ last_sync_at: new Date().toISOString(), last_error: error instanceof Error ? error.message : String(error), updated_at: new Date().toISOString() }),
      });
      throw error;
    }
  } catch (error) {
    return json({ ok: false, version: VERSION, error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
