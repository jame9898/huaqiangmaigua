// POST /api/upload
// 入参 body: { variety:String, weight:Number, frequency:Number, verdict:"raw"|"ripe"|"over", actualVerdict:"raw"|"ripe"|"over"|"pending" }
// 出参 : { ok:true, record:{ userNumber, userLabel, variety, weight, frequency, verdict, verdictText, actualVerdict, actualVerdictText, date, timestamp, ripenessIndex } }
import {
  preflight, jsonOk, jsonError,
  getKV, todayKey, pad3, sanitizeVariety,
  nextUserNumber, appendRecord,
  VALID_VERDICTS, VERDICT_TEXT,
} from "../_lib.js";

const VALID_ACTUAL_VERDICTS = ["raw", "ripe", "over", "pending"];
const ACTUAL_VERDICT_TEXT = { raw: "生瓜", ripe: "熟瓜", over: "过熟", pending: "待切开" };

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
  const actualVerdict = String(body.actualVerdict || "").toLowerCase();

  // 重量必填
  const w = Number(body.weight);
  if (!Number.isFinite(w) || w < 0 || w > 10) {
    return jsonError(400, "西瓜重量不能为空且需在 0–10 kg 范围内");
  }
  const weight = Math.round(w * 10) / 10;

  if (!variety) return jsonError(400, "品种不能为空");
  if (!Number.isFinite(frequency) || frequency < 30 || frequency > 800) {
    return jsonError(400, "频率超出可上传范围（30–800Hz）");
  }
  if (VALID_VERDICTS.indexOf(verdict) < 0) return jsonError(400, "检测结果不合法");
  if (VALID_ACTUAL_VERDICTS.indexOf(actualVerdict) < 0) return jsonError(400, "实际结果不合法");

  try {
    const kv = getKV(env);
    const date = todayKey();
    const userNumber = await nextUserNumber(kv, date);
    const userLabel = pad3(userNumber) + "号西瓜研究员";
    const timestamp = Date.now();

    const ripenessIndex = Math.round(frequency * frequency * Math.pow(weight, 2 / 3));

    const record = {
      id: "u_" + date + "_" + pad3(userNumber),
      userNumber, userLabel,
      variety, frequency,
      weight, ripenessIndex,
      verdict, verdictText: VERDICT_TEXT[verdict],
      actualVerdict, actualVerdictText: ACTUAL_VERDICT_TEXT[actualVerdict],
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
