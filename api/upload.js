// POST /api/upload
// 入参 body: { variety:String, frequency:Number, verdict:"raw"|"ripe"|"over" }
// 出参: { ok:true, record:{ userNumber, userLabel, variety, frequency, verdict, verdictText, date, timestamp } }
const {
  preflight, jsonError, jsonOk,
  redis, todayKey, pad3, sanitizeVariety,
  VALID_VERDICTS, VERDICT_TEXT,
} = require("./_lib.js");

module.exports = async (req, res) => {
  if (preflight(req, res)) return;
  if (req.method !== "POST") return jsonError(res, 405, "Method Not Allowed");

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { return jsonError(res, 400, "Invalid JSON"); }
  }
  if (!body || typeof body !== "object") return jsonError(res, 400, "Missing body");

  const variety = sanitizeVariety(body.variety);
  const frequency = Math.round(Number(body.frequency));
  const verdict = String(body.verdict || "").toLowerCase();

  if (!variety) return jsonError(res, 400, "品种不能为空");
  if (!Number.isFinite(frequency) || frequency < 30 || frequency > 800) {
    return jsonError(res, 400, "频率超出可上传范围（30–800Hz）");
  }
  if (VALID_VERDICTS.indexOf(verdict) < 0) return jsonError(res, 400, "判定结果不合法");

  const date = todayKey();
  const counterKey = "counter:" + date;
  const listKey = "uploads:" + date;

  try {
    const n = await redis(["INCR", counterKey]);
    if (n === 1) {
      await redis(["EXPIRE", counterKey, 60 * 60 * 24 * 35]);
    }
    const userNumber = Number(n) || 1;
    const userLabel = pad3(userNumber) + "号西瓜研究员";
    const timestamp = Date.now();

    const record = {
      id: "u_" + date + "_" + pad3(userNumber),
      userNumber, userLabel,
      variety, frequency,
      verdict, verdictText: VERDICT_TEXT[verdict],
      date, timestamp,
    };

    await redis(["LPUSH", listKey, JSON.stringify(record)]);
    await redis(["EXPIRE", listKey, 60 * 60 * 24 * 35]);

    return jsonOk(res, { record });
  } catch (e) {
    return jsonError(res, 500, e.message || "上传失败");
  }
};
