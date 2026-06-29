// 共享工具：CORS、日期、输入校验、KV 读写
// Cloudflare Pages Functions 运行在 V8 worker 环境，无 Node 内置模块
// KV 绑定名约定为 KV（在 Cloudflare 后台 Pages → Settings → Functions → KV namespace bindings 绑定）

export function applyCors(headers) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

export function jsonResponse(data, status = 200) {
  const h = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  applyCors(h);
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function jsonError(status, msg) {
  return jsonResponse({ ok: false, error: msg }, status);
}

export function jsonOk(data) {
  return jsonResponse(Object.assign({ ok: true }, data));
}

export function preflight() {
  const h = new Headers();
  applyCors(h);
  return new Response(null, { status: 204, headers: h });
}

export function todayKey(d) {
  const dt = d instanceof Date ? d : new Date();
  // 北京时间 = UTC+8
  const shifted = new Date(dt.getTime() + 8 * 3600 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function validateDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function pad3(n) {
  const x = Math.max(0, Math.floor(Number(n) || 0));
  return String(x).padStart(3, "0");
}

export function sanitizeVariety(v) {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 24);
}

export const VALID_VERDICTS = ["raw", "ripe", "over"];
export const VERDICT_TEXT = { raw: "生瓜", ripe: "熟瓜", over: "过熟" };

// KV 句柄：env.KV
// 兼容 Cloudflare 后台 UI bug：如果绑定变量名意外带了首尾空格（例如 "KV "），
// 这里自动扫一遍 env，找任何 trim 后等于 "KV" 的键。
export function getKV(env) {
  if (env && env.KV) return env.KV;
  if (env) {
    for (const k of Object.keys(env)) {
      if (k && k.trim() === "KV") {
        const v = env[k];
        if (v && typeof v.get === "function" && typeof v.put === "function") {
          return v;
        }
      }
    }
  }
  throw new Error("KV 未绑定：请在 Cloudflare Pages → Settings → Bindings 添加变量名 KV（注意别带空格）");
}

// 注意：Cloudflare KV 没有原子 INCR / LPUSH，下面是“读—改—写”，小流量拍打场景足够
// 同一秒内多人上传可能出现编号竞争，重号概率极低；如果未来要严格序号，可换 D1 / Durable Objects
export async function nextUserNumber(kv, date) {
  const key = `counter:${date}`;
  const cur = parseInt((await kv.get(key)) || "0", 10);
  const next = (Number.isFinite(cur) ? cur : 0) + 1;
  // TTL 35 天：自动清理过期日期
  await kv.put(key, String(next), { expirationTtl: 60 * 60 * 24 * 35 });
  return next;
}

export async function appendRecord(kv, date, record) {
  const key = `uploads:${date}`;
  let arr = [];
  try {
    const raw = await kv.get(key);
    if (raw) arr = JSON.parse(raw);
    if (!Array.isArray(arr)) arr = [];
  } catch (_) {
    arr = [];
  }
  arr.unshift(record);
  // 一天最多保留 500 条，防止 value 撑爆
  if (arr.length > 500) arr.length = 500;
  await kv.put(key, JSON.stringify(arr), { expirationTtl: 60 * 60 * 24 * 35 });
  return arr.length;
}

export async function readRecords(kv, date, limit) {
  const key = `uploads:${date}`;
  const raw = await kv.get(key);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return limit && limit > 0 ? arr.slice(0, limit) : arr;
  } catch (_) {
    return [];
  }
}
