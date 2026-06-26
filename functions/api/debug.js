// GET /api/debug
// 诊断接口：返回 Cloudflare Pages Functions 运行时实际拿到的 env keys
// 用来排查"KV 未绑定"问题
import { preflight, jsonOk, jsonError, getKV } from "../_lib.js";

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestGet({ env }) {
  const keys = env ? Object.keys(env) : [];
  const hasKVDirect = !!(env && env.KV);
  let resolvedKVKey = null;
  let kv = null;
  try {
    kv = getKV(env);
    for (const k of keys) {
      if (env[k] === kv) { resolvedKVKey = k; break; }
    }
  } catch (_) {}
  let kvProbe = "skipped";
  if (kv) {
    try {
      await kv.put("debug:ping", String(Date.now()), { expirationTtl: 60 });
      const v = await kv.get("debug:ping");
      kvProbe = v ? ("ok: " + v) : "read-empty";
    } catch (e) {
      kvProbe = "error: " + (e && e.message ? e.message : String(e));
    }
  }
  return jsonOk({
    runtime: "cloudflare-pages-functions",
    envKeys: keys,
    hasKVDirect,
    resolvedKVKey,
    kvProbe,
    now: Date.now(),
  });
}

export async function onRequest() {
  return jsonError(405, "Method Not Allowed");
}
