// Avisos de receso al celular de los encargados (lo llama pg_cron cada minuto, solo cuando hay algo que avisar):
//  · En cuanto a alguien se le acaban sus minutos de receso: "Víctor acabó su receso".
//  · Si sigue en receso después de eso, un recordatorio cada 5 minutos con cuánto se ha pasado.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
const primer = (n: string) => (n || "?").split(" ")[0];

Deno.serve(async (req) => {
  const { data: cfg, error } = await sb.rpc("push_config");
  if (error || !cfg) return json({ error: "sin configuración" }, 500);
  if (req.headers.get("x-cron-token") !== cfg.cron_token) return json({ error: "no autorizado" }, 401);
  const cuerpo = await req.json().catch(() => ({}));
  const prueba = new URL(req.url).searchParams.has("prueba");

  // Solo de día (hora de El Salvador), para no despertar a nadie con un receso olvidado
  const hora = new Date(Date.now() - 6 * 3600e3).getUTCHours();
  if (!prueba && (hora < 6 || hora >= 19)) return json({ enviado: 0, motivo: "fuera de horario" });

  const { data: estado } = await sb.rpc("recesos_abiertos_estado");
  const pasados = (estado ?? []).filter((e: any) => +e.usado >= e.limite);
  const nuevos = pasados.filter((e: any) => !e.avisado_fin);
  const avisos: { title: string; body: string; tag: string }[] = [];

  // 1) Se le acaba el receso a alguien: un aviso por persona, al momento
  for (const e of nuevos) avisos.push({ title: `${primer(e.nombre)} acabó su receso`, body: `Ya cumplió sus ${e.limite} min. Toca para marcar que regresó.`, tag: `fin-${e.id}` });

  // 2) Recordatorio cada 5 min de los que siguen pasados (sin repetir a los que se acaban de avisar)
  const siguen = pasados.filter((e: any) => e.avisado_fin);
  if (cuerpo.recordatorio && siguen.length) {
    const txt = siguen.map((e: any) => `${primer(e.nombre)} +${Math.max(1, Math.round(e.usado - e.limite))} min`);
    avisos.push({ title: siguen.length === 1 ? `${primer(siguen[0].nombre)} sigue en receso` : `${siguen.length} siguen en receso`,
      body: `${txt.slice(0, 6).join(" · ")}${txt.length > 6 ? " · …" : ""} de más. ¿Ya regresaron?`, tag: "receso" });
  }
  if (prueba && !avisos.length) avisos.push({ title: "Avisos de receso activados", body: "Así te va a llegar el aviso.", tag: "prueba" });
  if (!avisos.length) return json({ enviado: 0, motivo: "nada que avisar" });

  webpush.setVapidDetails("mailto:avisos@gestion-sym.app", cfg.vapid_public, cfg.vapid_private);
  const { data: subs } = await sb.from("push_suscripciones").select("id, endpoint, p256dh, auth");
  let enviado = 0;
  for (const aviso of avisos) {
    await Promise.all((subs ?? []).map(async (s: any) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...aviso, url: "./#recesos" }), { TTL: 240, urgency: "high" });
        enviado++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_suscripciones").delete().eq("id", s.id);   // celular que ya no existe
        else console.error("push", e?.statusCode, e?.body);
      }
    }));
  }
  if (nuevos.length) await sb.from("recesos").update({ avisado_fin: new Date().toISOString() }).in("id", nuevos.map((e: any) => e.id));
  return json({ enviado, avisos: avisos.length });
});
