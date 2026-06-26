// GET /api/analysis?date=YYYY-MM-DD
// 默认 date=今天。聚合维度：品种、判定、频率分布
// 返回:
// {
//   ok, date, total,
//   byVariety: [{ variety, count, avgFreq }, ...],
//   byVerdict: { raw, ripe, over },
//   freqHistogram: [{ bin:"<100", count }, { bin:"100-130", ... }, ...],
//   overall: { avgFreq, minFreq, maxFreq }
// }
const {
  preflight, jsonError, jsonOk,
  redis, todayKey, validateDate,
} = require("./_lib.js");

const BINS = [
  { label: "<100", lo: 0, hi: 100 },
  { label: "100–130", lo: 100, hi: 130 },
  { label: "130–160", lo: 130, hi: 160 },
  { label: "160–190", lo: 160, hi: 190 },
  { label: "190–230", lo: 190, hi: 230 },
  { label: "≥230", lo: 230, hi: Infinity },
];

module.exports = async (req, res) => {
  if (preflight(req, res)) return;
  if (req.method !== "GET") return jsonError(res, 405, "Method Not Allowed");

  const qDate = req.query && req.query.date;
  const date = validateDate(qDate) ? qDate : todayKey();
  const listKey = "uploads:" + date;

  try {
    const total = Number(await redis(["LLEN", listKey])) || 0;
    if (total === 0) {
      return jsonOk(res, {
        date, total: 0,
        byVariety: [], byVerdict: { raw: 0, ripe: 0, over: 0 },
        freqHistogram: BINS.map((b) => ({ bin: b.label, count: 0 })),
        overall: { avgFreq: 0, minFreq: 0, maxFreq: 0 },
      });
    }
    const raw = await redis(["LRANGE", listKey, 0, total - 1]);
    const records = (raw || []).map((s) => {
      try { return JSON.parse(s); } catch (e) { return null; }
    }).filter(Boolean);

    const varietyMap = new Map();
    const verdictCnt = { raw: 0, ripe: 0, over: 0 };
    const histCnt = BINS.map(() => 0);
    let sum = 0, mn = Infinity, mx = -Infinity;

    for (const r of records) {
      const v = String(r.variety || "未填写");
      const f = Number(r.frequency) || 0;
      const verd = r.verdict || "raw";

      if (!varietyMap.has(v)) varietyMap.set(v, { variety: v, count: 0, sum: 0 });
      const e = varietyMap.get(v);
      e.count++; e.sum += f;

      if (verdictCnt[verd] !== undefined) verdictCnt[verd]++;

      for (let i = 0; i < BINS.length; i++) {
        if (f >= BINS[i].lo && f < BINS[i].hi) { histCnt[i]++; break; }
      }

      sum += f; if (f < mn) mn = f; if (f > mx) mx = f;
    }

    const byVariety = Array.from(varietyMap.values())
      .map((e) => ({ variety: e.variety, count: e.count, avgFreq: Math.round(e.sum / e.count) }))
      .sort((a, b) => b.count - a.count);

    const freqHistogram = BINS.map((b, i) => ({ bin: b.label, count: histCnt[i] }));

    return jsonOk(res, {
      date, total,
      byVariety,
      byVerdict: verdictCnt,
      freqHistogram,
      overall: {
        avgFreq: Math.round(sum / records.length),
        minFreq: mn === Infinity ? 0 : mn,
        maxFreq: mx === -Infinity ? 0 : mx,
      },
    });
  } catch (e) {
    return jsonError(res, 500, e.message || "分析失败");
  }
};
