// GET /api/records?date=YYYY-MM-DD&limit=50
// 默认 date=今天，limit 1–200。返回 { ok:true, date, total, records:[...] }（最新在前）
const {
  preflight, jsonError, jsonOk,
  redis, todayKey, validateDate,
} = require("./_lib.js");

module.exports = async (req, res) => {
  if (preflight(req, res)) return;
  if (req.method !== "GET") return jsonError(res, 405, "Method Not Allowed");

  const qDate = req.query && req.query.date;
  const qLimit = req.query && req.query.limit;
  const date = validateDate(qDate) ? qDate : todayKey();
  let limit = parseInt(qLimit, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 50;
  if (limit > 200) limit = 200;

  const listKey = "uploads:" + date;
  try {
    const total = Number(await redis(["LLEN", listKey])) || 0;
    const raw = total === 0 ? [] : await redis(["LRANGE", listKey, 0, limit - 1]);
    const records = (raw || []).map((s) => {
      try { return JSON.parse(s); } catch (e) { return null; }
    }).filter(Boolean);
    return jsonOk(res, { date, total, records });
  } catch (e) {
    return jsonError(res, 500, e.message || "拉取失败");
  }
};
