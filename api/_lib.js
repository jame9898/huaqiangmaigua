// 公共工具：CORS、Upstash Redis REST 客户端、日期工具、输入校验
// 部署到 Vercel 后，环境变量由 Upstash 集成自动注入：
//   KV_REST_API_URL        Upstash REST endpoint
//   KV_REST_API_TOKEN      Upstash REST token
// 兼容旧命名 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN。

const REDIS_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function preflight(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

function jsonError(res, status, msg) {
  res.status(status).json({ ok: false, error: msg });
}

function jsonOk(res, data) {
  res.status(200).json(Object.assign({ ok: true }, data));
}

async function redis(command) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("Redis 未配置：请在 Vercel 项目里启用 Upstash 集成");
  }
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + REDIS_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error("Redis " + r.status + ": " + t);
  }
  const data = await r.json();
  if (data && data.error) throw new Error("Redis error: " + data.error);
  return data && data.result !== undefined ? data.result : data;
}

function todayKey(d) {
  const dt = d instanceof Date ? d : new Date();
  const shifted = new Date(dt.getTime() + 8 * 3600 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function validateDate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function pad3(n) {
  const x = Math.max(0, Math.floor(Number(n) || 0));
  return String(x).padStart(3, "0");
}

function sanitizeVariety(v) {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 24);
}

const VALID_VERDICTS = ["raw", "ripe", "over"];
const VERDICT_TEXT = { raw: "生瓜", ripe: "熟瓜", over: "过熟" };

module.exports = {
  applyCors,
  preflight,
  jsonError,
  jsonOk,
  redis,
  todayKey,
  validateDate,
  pad3,
  sanitizeVariety,
  VALID_VERDICTS,
  VERDICT_TEXT,
};
