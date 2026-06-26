// GET /api/debug
// 诊断接口：返回 Cloudflare Pages Functions 运行时实际拿到的 env keys
// 用来排查"KV 未绑定"问题
import { preflight, jsonOk, jsonError } from "../_lib.js";

export async function onRequestOptions() {
  return preflight();
}

export async function onRequestGet({ env }) {
  const keys = env ? Object.keys(env) : [];
  const hasKV = !!(env && env.KV);
  let kvProbe = "skipped";
  if (hasKV) {
    try {
      // 试着写一次又读一次，验证 KV 真的能用
      await env.KV.put("debug:ping", String(Date.now()), { expirationTtl: 60 });
      const v = await env.KV.get("debug:ping");
      kvProbe = v ? ("ok: " + v) : "read-empty";
    } catch (e) {
      kvProbe = "error: " + (e && e.message ? e.message : String(e));
    }
  }
  return jsonOk({
    runtime: "cloudflare-pages-functions",
    envKeys: keys,
    hasKV,
    kvProbe,
    now: Date.now(),
  });
}

export async function onRequest() {
  return jsonError(405, "Method Not Allowed");
}
