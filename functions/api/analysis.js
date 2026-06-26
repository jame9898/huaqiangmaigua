// GET /api/analysis?date=YYYY-MM-DD
// 默认 date=今天。聚合维度：品种、判定、频率分布
import {
  preflight, jsonOk, jsonError,
  getKV, todayKey, validateDate, readRecords,
} from "../_lib.js";

const BINS = [
  { label: "<100", lo: 0, hi: 100 },
  { label: "100–130", lo: 100, hi: 130 },
  { label: "130–160", lo: 130, hi: 160 },
  { label: "160–190", lo: 160, hi: 190 },
  { label: "190–230", lo: 190, hi: 230 },
  { label: "≥230", lo: 230, hi: Infinity },
];

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const qDate = url.searchParams.get("date");
  const date = validateDate(qDate) ? qDate : todayKey();

  try {
    const kv = getKV(env);
    const records = await readRecords(kv, date, 0);

    if (records.length === 0) {
      return jsonOk({
        date, total: 0,
        byVariety: [],
        byVerdict: { raw: 0, ripe: 0, over: 0 },
        freqHistogram: BINS.map((b) => ({ bin: b.label, count: 0 })),
        overall: { avgFreq: 0, minFreq: 0, maxFreq: 0, withWeight: 0, avgWeight: 0, avgRipeness: 0 },
      });
    }

    const varietyMap = new Map();
    const verdictCnt = { raw: 0, ripe: 0, over: 0 };
    const histCnt = BINS.map(() => 0);
    let sum = 0, mn = Infinity, mx = -Infinity;
    let weightSum = 0, weightCount = 0, ripenessSum = 0, ripenessCount = 0;

    for (const r of records) {
      const v = String(r.variety || "未填写");
      const f = Number(r.frequency) || 0;
      const verd = r.verdict || "raw";
      const w = (typeof r.weight === "number" && r.weight > 0) ? r.weight : null;
      const ri = (typeof r.ripenessIndex === "number" && r.ripenessIndex > 0) ? r.ripenessIndex : null;

      if (!varietyMap.has(v)) varietyMap.set(v, { variety: v, count: 0, sum: 0, weightSum: 0, weightCount: 0 });
      const e = varietyMap.get(v);
      e.count++; e.sum += f;
      if (w !== null) { e.weightSum += w; e.weightCount++; }

      if (verdictCnt[verd] !== undefined) verdictCnt[verd]++;

      for (let i = 0; i < BINS.length; i++) {
        if (f >= BINS[i].lo && f < BINS[i].hi) { histCnt[i]++; break; }
      }

      sum += f;
      if (f < mn) mn = f;
      if (f > mx) mx = f;
      if (w !== null) { weightSum += w; weightCount++; }
      if (ri !== null) { ripenessSum += ri; ripenessCount++; }
    }

    const byVariety = Array.from(varietyMap.values())
      .map((e) => ({
        variety: e.variety,
        count: e.count,
        avgFreq: Math.round(e.sum / e.count),
        avgWeight: e.weightCount > 0 ? Math.round(e.weightSum / e.weightCount * 10) / 10 : null,
        withWeight: e.weightCount,
      }))
      .sort((a, b) => b.count - a.count);

    const freqHistogram = BINS.map((b, i) => ({ bin: b.label, count: histCnt[i] }));

    return jsonOk({
      date, total: records.length,
      byVariety,
      byVerdict: verdictCnt,
      freqHistogram,
      overall: {
        avgFreq: Math.round(sum / records.length),
        minFreq: mn === Infinity ? 0 : mn,
        maxFreq: mx === -Infinity ? 0 : mx,
        withWeight: weightCount,
        avgWeight: weightCount > 0 ? Math.round(weightSum / weightCount * 10) / 10 : 0,
        avgRipeness: ripenessCount > 0 ? Math.round(ripenessSum / ripenessCount) : 0,
      },
    });
  } catch (e) {
    return jsonError(500, e.message || "分析失败");
  }
}

export async function onRequest() {
  return jsonError(405, "Method Not Allowed");
}
