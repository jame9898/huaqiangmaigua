// GET /api/records?date=YYYY-MM-DD&limit=50
// 默认 date=今天，limit 1–200。返回 { ok:true, date, total, records:[...] }（最新在前）
import {
  preflight, jsonOk, jsonError,
  getKV, todayKey, validateDate, readRecords,
} from "../_lib.js";

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const qDate = url.searchParams.get("date");
  const qLimit = url.searchParams.get("limit");
  const date = validateDate(qDate) ? qDate : todayKey();
  let limit = parseInt(qLimit || "50", 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  if (limit > 200) limit = 200;

  try {
    const kv = getKV(env);
    const all = await readRecords(kv, date, 0); // 全部，用来算 total
    const records = all.slice(0, limit);
    return jsonOk({ date, total: all.length, records });
  } catch (e) {
    return jsonError(500, e.message || "拉取失败");
  }
}

export async function onRequest() {
  return jsonError(405, "Method Not Allowed");
}
