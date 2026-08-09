const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const STATISTICS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics";
const VERSION = "60.5.0";

type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
type SyncLot = {
  lot_id: string;
  company_id: string;
  lot_name: string;
  crop: string | null;
  hectares: number | null;
  geometry: unknown;
  latest_observed_to: string | null;
};

const sentinel2Evalscript = `//VERSION=3
function setup(){return{input:[{bands:["B04","B05","B08","SCL","dataMask"]}],output:[{id:"ndvi",bands:1,sampleType:"FLOAT32"},{id:"ndre",bands:1,sampleType:"FLOAT32"},{id:"msavi",bands:1,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]};}
function evaluatePixel(s){const ndvi=(s.B08+s.B04)===0?0:(s.B08-s.B04)/(s.B08+s.B04);const ndre=(s.B08+s.B05)===0?0:(s.B08-s.B05)/(s.B08+s.B05);const t=2*s.B08+1;const msavi=(t-Math.sqrt(Math.max(0,t*t-8*(s.B08-s.B04))))/2;const invalid=[0,1,3,8,9,10].includes(s.SCL);return{ndvi:[ndvi],ndre:[ndre],msavi:[msavi],dataMask:[s.dataMask===1&&!invalid?1:0]};}`;

const sentinel1Evalscript = `//VERSION=3
function setup(){return{input:[{bands:["VV","VH","dataMask"]}],output:[{id:"vv",bands:1,sampleType:"FLOAT32"},{id:"vh",bands:1,sampleType:"FLOAT32"},{id:"ratio",bands:1,sampleType:"FLOAT32"},{id:"rvi",bands:1,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]};}
function evaluatePixel(s){const ratio=s.VV>0?s.VH/s.VV:0;const rvi=(s.VV+s.VH)>0?4*s.VH/(s.VV+s.VH):0;return{vv:[s.VV],vh:[s.VH],ratio:[ratio],rvi:[rvi],dataMask:[s.dataMask]};}`;

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function finiteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
function geometryFromGeojson(value: any): Geometry | null {
  let v = value;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return null; } }
  const g = v?.type === "Feature" ? v.geometry : v;
  return g && ["Polygon", "MultiPolygon"].includes(g.type) && Array.isArray(g.coordinates) ? g : null;
}
function subtractDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return isoDate(d);
}
function maxDate(a: string, b: string): string { return a > b ? a : b; }

function observations(raw: any) {
  return (Array.isArray(raw?.data) ? raw.data : []).map((x: any) => {
    const stats = x.outputs?.ndvi?.bands?.B0?.stats;
    const sampleCount = finiteNumber(stats?.sampleCount);
    const noDataCount = finiteNumber(stats?.noDataCount);
    const invalid = sampleCount !== null && noDataCount !== null && noDataCount >= sampleCount;
    return {
      observed_from: x.interval?.from ?? null,
      observed_to: x.interval?.to ?? null,
      ndvi: invalid ? null : finiteNumber(x.outputs?.ndvi?.bands?.B0?.stats?.mean),
      ndre: invalid ? null : finiteNumber(x.outputs?.ndre?.bands?.B0?.stats?.mean),
      msavi: invalid ? null : finiteNumber(x.outputs?.msavi?.bands?.B0?.stats?.mean),
      sample_count: sampleCount === null ? null : Math.round(sampleCount),
      no_data_count: noDataCount === null ? null : Math.round(noDataCount),
      raw: x,
    };
  });
}

function radarObservations(raw: any) {
  return (Array.isArray(raw?.data) ? raw.data : []).map((x: any) => {
    const stats = x.outputs?.vv?.bands?.B0?.stats;
    const sampleCount = finiteNumber(stats?.sampleCount);
    const noDataCount = finiteNumber(stats?.noDataCount);
    const invalid = sampleCount !== null && noDataCount !== null && noDataCount >= sampleCount;
    return {
      observed_from: x.interval?.from ?? null,
      observed_to: x.interval?.to ?? null,
      vv_mean: invalid ? null : finiteNumber(x.outputs?.vv?.bands?.B0?.stats?.mean),
      vh_mean: invalid ? null : finiteNumber(x.outputs?.vh?.bands?.B0?.stats?.mean),
      vh_vv_ratio: invalid ? null : finiteNumber(x.outputs?.ratio?.bands?.B0?.stats?.mean),
      radar_vegetation_index: invalid ? null : finiteNumber(x.outputs?.rvi?.bands?.B0?.stats?.mean),
      sample_count: sampleCount === null ? null : Math.round(sampleCount),
      no_data_count: noDataCount === null ? null : Math.round(noDataCount),
      raw: x,
    };
  });
}

async function getToken(id: string, secret: string): Promise<string> {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Autenticación Copernicus ${r.status}: ${text}`);
  const data = JSON.parse(text);
  if (!data.access_token) throw new Error("Copernicus no devolvió access_token");
  return data.access_token;
}

async function getSentinel2Stats(access: string, geometry: Geometry, from: string, to: string, cloud: number) {
  const payload = {
    input: {
      bounds: { geometry, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } },
      data: [{ type: "sentinel-2-l2a", dataFilter: { mosaickingOrder: "leastCC", maxCloudCoverage: cloud } }],
    },
    aggregation: {
      timeRange: { from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` },
      aggregationInterval: { of: "P1D" }, evalscript: sentinel2Evalscript, resx: 10, resy: 10,
    },
  };
  const r = await fetch(STATISTICS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Statistical API ${r.status}: ${text}`);
  return JSON.parse(text);
}

async function getSentinel1Stats(access: string, geometry: Geometry, from: string, to: string) {
  const payload = {
    input: {
      bounds: { geometry, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } },
      data: [{
        type: "sentinel-1-grd",
        dataFilter: { mosaickingOrder: "mostRecent", acquisitionMode: "IW", polarization: "DV" },
        processing: { orthorectify: true, backCoeff: "GAMMA0_TERRAIN", demInstance: "COPERNICUS_30", speckleFilter: { type: "LEE", windowSizeX: 5, windowSizeY: 5 } },
      }],
    },
    aggregation: {
      timeRange: { from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` },
      aggregationInterval: { of: "P1D" }, evalscript: sentinel1Evalscript, resx: 10, resy: 10,
    },
  };
  const r = await fetch(STATISTICS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Statistical API Sentinel-1 ${r.status}: ${text}`);
  return JSON.parse(text);
}

async function supabaseRest(url: string, key: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase REST ${r.status} en ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function syncAll(body: any, env: { url: string; key: string; access: string }) {
  const cloud = Math.max(0, Math.min(100, Number(body.maxCloudCoverage ?? 60)));
  const days = Math.max(1, Math.min(365, Number(body.days ?? 60)));
  const to = body.to || isoDate(new Date());
  const baseFrom = body.from || subtractDays(to, days);
  const companyId = body.company_id || null;
  const incremental = body.incremental !== false;
  const overlapDays = Math.max(0, Math.min(15, Number(body.overlapDays ?? 3)));
  const requested = Array.isArray(body.missions) ? body.missions : ["sentinel-1", "sentinel-2"];
  const syncS1 = requested.includes("sentinel-1");
  const syncS2 = requested.includes("sentinel-2");

  const lots: SyncLot[] = await supabaseRest(env.url, env.key, "rpc/satellite_lots_for_sync", {
    method: "POST",
    body: JSON.stringify({ p_company_id: companyId }),
  });

  if (!Array.isArray(lots)) throw new Error("La RPC satellite_lots_for_sync no devolvió una lista");
  if (lots.length === 0) return { ok: false, mode: "sync_all", error: "No se encontraron lotes para sincronizar", lots_total: 0 };

  const runCompanyId = companyId || lots[0]?.company_id || null;
  const runRows = await supabaseRest(env.url, env.key, "satellite_sync_runs", {
    method: "POST",
    body: JSON.stringify({
      company_id: runCompanyId, date_from: baseFrom, date_to: to,
      lots_total: lots.length, status: "running", details: { version: VERSION, incremental, overlapDays, missions: requested },
    }),
  });
  const runId = runRows?.[0]?.id;
  const results: any[] = [];
  let lotsOk = 0, lotsFailed = 0, observationsSaved = 0, radarObservationsSaved = 0, lotsWithoutGeometry = 0;

  for (const lot of lots) {
    try {
      const geometry = geometryFromGeojson(lot.geometry);
      if (!geometry) {
        lotsWithoutGeometry++;
        throw new Error("El lote no tiene geometría GeoJSON válida");
      }

      let lotFrom = baseFrom;
      if (incremental && lot.latest_observed_to) {
        const overlapFrom = subtractDays(lot.latest_observed_to, overlapDays);
        lotFrom = maxDate(baseFrom, overlapFrom);
      }
      if (lotFrom > to) lotFrom = to;

      const rows = syncS2 ? observations(await getSentinel2Stats(env.access, geometry, lotFrom, to, cloud))
        .filter((o: any) => o.observed_from && o.observed_to)
        .map((o: any) => ({
          company_id: lot.company_id,
          lot_id: lot.lot_id,
          source: "Sentinel-2 L2A",
          ...o,
          cloud_coverage_limit: cloud,
        })) : [];

      if (rows.length > 0) {
        const saved = await supabaseRest(
          env.url,
          env.key,
          "satellite_observations?on_conflict=lot_id,observed_from,observed_to,source",
          { method: "POST", body: JSON.stringify(rows) },
        );
        observationsSaved += Array.isArray(saved) ? saved.length : rows.length;
      }

      const radarFrom = maxDate(baseFrom, subtractDays(to, Math.min(days, 45)));
      const radarRows = syncS1 ? radarObservations(await getSentinel1Stats(env.access, geometry, radarFrom, to))
        .filter((o: any) => o.observed_from && o.observed_to)
        .map((o: any) => ({
          company_id: lot.company_id, lot_id: lot.lot_id, source: "Sentinel-1 GRD", ...o,
          acquisition_mode: "IW", polarization: "DV",
        })) : [];
      if (radarRows.length > 0) {
        const savedRadar = await supabaseRest(
          env.url, env.key,
          "satellite_radar_observations?on_conflict=lot_id,observed_from,observed_to,source",
          { method: "POST", body: JSON.stringify(radarRows) },
        );
        radarObservationsSaved += Array.isArray(savedRadar) ? savedRadar.length : radarRows.length;
      }

      lotsOk++;
      results.push({
        lot_id: lot.lot_id, lot_name: lot.lot_name, ok: true,
        from: lotFrom, to, sentinel_2_scenes: rows.length,
        sentinel_2_valid: rows.filter((r: any) => r.ndvi !== null).length,
        sentinel_1_scenes: radarRows.length,
        sentinel_1_valid: radarRows.filter((r: any) => r.vv_mean !== null).length,
      });
    } catch (error) {
      lotsFailed++;
      results.push({
        lot_id: lot.lot_id, lot_name: lot.lot_name, ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const status = lotsFailed === 0 ? "success" : lotsOk > 0 ? "partial" : "failed";
  if (runId) {
    await supabaseRest(env.url, env.key, `satellite_sync_runs?id=eq.${encodeURIComponent(runId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        finished_at: new Date().toISOString(), status,
        lots_ok: lotsOk, lots_failed: lotsFailed, observations_saved: observationsSaved,
        error_message: lotsFailed ? `${lotsFailed} lote(s) con error` : null,
        details: { version: VERSION, incremental, overlapDays, missions: requested, radar_observations_saved: radarObservationsSaved, lots_without_geometry: lotsWithoutGeometry, results },
      }),
    });
  }

  return {
    ok: lotsFailed === 0,
    version: VERSION,
    mode: "sync_all",
    from: baseFrom,
    to,
    incremental,
    lots_total: lots.length,
    lots_ok: lotsOk,
    lots_failed: lotsFailed,
    lots_without_geometry: lotsWithoutGeometry,
    observations_saved: observationsSaved,
    radar_observations_saved: radarObservationsSaved,
    results,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const clientId = Deno.env.get("COPERNICUS_CLIENT_ID")?.trim();
    const clientSecret = Deno.env.get("COPERNICUS_CLIENT_SECRET")?.trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

    if (req.method === "GET") return respond({
      ok: true, function: "satellite-sync", version: VERSION,
      credentialsConfigured: Boolean(clientId && clientSecret),
      databaseConfigured: Boolean(supabaseUrl && serviceKey),
      missions: ["Sentinel-1 GRD", "Sentinel-2 L2A"],
      modes: ["health", "manual", "sync_all"],
    });
    if (req.method !== "POST") return respond({ ok: false, error: "Método no permitido" }, 405);
    if (!clientId || !clientSecret) return respond({ ok: false, error: "Faltan Secrets de Copernicus" }, 500);

    let body: any;
    try { body = await req.json(); } catch { return respond({ ok: false, error: "JSON inválido" }, 400); }
    const access = await getToken(clientId, clientSecret);

    if (body.mode === "sync_all") {
      if (!supabaseUrl || !serviceKey) return respond({ ok: false, error: "Faltan variables internas de Supabase" }, 500);
      const result = await syncAll(body, { url: supabaseUrl, key: serviceKey, access });
      return respond(result, result.ok || result.lots_ok > 0 ? 200 : 422);
    }

    const cloud = Math.max(0, Math.min(100, Number(body.maxCloudCoverage ?? 40)));
    const geometry = geometryFromGeojson(body.geometry);
    if (!geometry || !body.from || !body.to) return respond({ ok: false, error: "Enviar geometry, from y to" }, 400);
    if (body.mission === "sentinel-1") {
      const raw = await getSentinel1Stats(access, geometry, body.from, body.to);
      return respond({ ok: true, version: VERSION, source: "Sentinel-1 GRD", observations: radarObservations(raw), raw });
    }
    const raw = await getSentinel2Stats(access, geometry, body.from, body.to, cloud);
    return respond({ ok: true, version: VERSION, source: "Sentinel-2 L2A", observations: observations(raw), raw });
  } catch (error) {
    console.error("satellite-sync", error);
    return respond({
      ok: false,
      version: VERSION,
      stage: "unhandled",
      error: error instanceof Error ? error.message : String(error),
      hint: "Abrir Logs de la Edge Function si se necesita el detalle técnico completo.",
    }, 500);
  }
});
