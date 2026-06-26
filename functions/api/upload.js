// POST /api/upload
// 入参 body: { variety:String, frequency:Number, verdict:"raw"|"ripe"|"over" }
// 出参 : { ok:true, record:{ userNumber, userLabel, variety, frequency, verdict, verdictText, date, timestamp } }
import {
  preflight, jsonOk, jsonError,
  getKV, todayKey, pad3, sanitizeVariety,
  nextUserNumber, appendRecord,
  VALID_VERDICTS, VERDICT_TEXT,
} from "../_lib.js";

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return jsonError(400, "Invalid JSON");
  }
  if (!body || typeof body !== "object") return jsonError(400, "Missing body");

  const variety = sanitizeVariety(body.variety);
  const frequency = Math.round(Number(body.frequency));
  const verdict = String(body.verdict || "").toLowerCase();

  if (!variety) return jsonError(400, "品种不能为空");
  if (!Number.isFinite(frequency) || frequency < 30 || frequency > 800) {
    return jsonError(400, "频率超出可上传范围（30–800Hz）");
  }
  if (VALID_VERDICTS.indexOf(verdict) < 0) return jsonError(400, "判定结果不合法");

  try {
    const kv = getKV(env);
    const date = todayKey();
    const userNumber = await nextUserNumber(kv, date);
    const userLabel = pad3(userNumber) + "号西瓜研究员";
    const timestamp = Date.now();

    const record = {
      id: "u_" + date + "_" + pad3(userNumber),
      userNumber, userLabel,
      variety, frequency,
      verdict, verdictText: VERDICT_TEXT[verdict],
      date, timestamp,
    };

    await appendRecord(kv, date, record);
    return jsonOk({ record });
  } catch (e) {
    return jsonError(500, e.message || "上传失败");
  }
}

export async function onRequest({ request }) {
  return jsonError(405, "Method Not Allowed");
}
