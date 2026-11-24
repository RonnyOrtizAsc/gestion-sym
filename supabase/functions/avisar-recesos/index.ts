// Avisos de receso al celular de los encargados (lo llama pg_cron cada minuto, solo cuando hay algo que avisar):
//  · Cuando a alguien le quedan 2 minutos: "A Víctor le quedan 2 min de receso".
//  · Al acabarse: "Víctor acabó su receso".
//  · Mientras siga pasado: un aviso cada minuto con cuánto se ha pasado.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });
const primer = (n: string) => (n || "?").split(" ")[0];

Deno.serve(async (req) => {
  const { data: cfg, error } = await sb.rpc("push_config");
  if (error || !cfg) return json({ error: "sin configuración" }, 500);
  if (req.headers.get("x-cron-token") !== cfg.cron_token) return json({ error: "no autorizado" }, 401);
  const prueba = new URL(req.url).searchParams.has("prueba");

  // Solo de día (hora de El Salvador), para no despertar a nadie con un receso olvidado
  const hora = new Date(Date.now() - 6 * 3600e3).getUTCHours();
  if (!prueba && (hora < 6 || hora >= 19)) return json({ enviado: 0, motivo: "fuera de horario" });

  const { data: estado } = await sb.rpc("recesos_abiertos_estado");
  const todos = estado ?? [];
  const previos = todos.filter((e: any) => +e.usado >= e.limite - 2 && +e.usado < e.limite && !e.avisado_previo);
  const pasados = todos.filter((e: any) => +e.usado >= e.limite);
  const nuevos = pasados.filter((e: any) => !e.avisado_fin), siguen = pasados.filter((e: any) => e.avisado_fin);
  const avisos: { title: string; body: string; tag: string }[] = [];

  // 1) Le quedan 2 minutos
  for (const e of previos) { const q = Math.max(1, Math.round(e.limite - e.usado));
    avisos.push({ title: `A ${primer(e.nombre)} le quedan ${q} min`, body: `De sus ${e.limite} min de receso.`, tag: `previo-${e.id}` }); }
  // 2) Se le acabó
  for (const e of nuevos) avisos.push({ title: `${primer(e.nombre)} acabó su receso`, body: `Ya cumplió sus ${e.limite} min. Toca para marcar que regresó.`, tag: `fin-${e.id}` });
  // 3) Sigue pasado: cada minuto
  if (siguen.length) {
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
          JSON.stringify({ ...aviso, url: "./#recesos" }), { TTL: 120, urgency: "high" });
        enviado++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_suscripciones").delete().eq("id", s.id);   // celular que ya no existe
        else console.error("push", e?.statusCode, e?.body);
      }
    }));
  }
  const ahora = new Date().toISOString();
  if (previos.length) await sb.from("recesos").update({ avisado_previo: ahora }).in("id", previos.map((e: any) => e.id));
  if (nuevos.length) await sb.from("recesos").update({ avisado_fin: ahora, avisado_previo: ahora }).in("id", nuevos.map((e: any) => e.id));
  return json({ enviado, avisos: avisos.length });
});
