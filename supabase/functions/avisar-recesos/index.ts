// Avisa al celular de los encargados mientras alguien sigue en receso (lo llama pg_cron cada 5 minutos).
// Así no se olvida marcar el regreso y el tiempo no sigue contando de más.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const { data: cfg, error } = await sb.rpc("push_config");
  if (error || !cfg) return json({ error: "sin configuración" }, 500);
  if (req.headers.get("x-cron-token") !== cfg.cron_token) return json({ error: "no autorizado" }, 401);
  const prueba = new URL(req.url).searchParams.has("prueba");

  // Solo de día (hora de El Salvador), para no despertar a nadie con un receso olvidado
  const hora = new Date(Date.now() - 6 * 3600e3).getUTCHours();
  if (!prueba && (hora < 6 || hora >= 19)) return json({ enviado: 0, motivo: "fuera de horario" });

  // Recesos abiertos con al menos 4 minutos (el primer aviso llega a los ~5)
  const { data: abiertos } = await sb.from("recesos").select("inicio, trabajadores(nombre)")
    .is("fin", null).eq("tipo", "receso").lte("inicio", new Date(Date.now() - 4 * 60e3).toISOString()).order("inicio");
  const lista = abiertos ?? [];
  if (!lista.length && !prueba) return json({ enviado: 0, motivo: "nadie en receso" });

  const min = (i: string) => Math.round((Date.now() - new Date(i).getTime()) / 60e3);
  const nombres = lista.map((r: any) => `${(r.trabajadores?.nombre || "?").split(" ")[0]} ${min(r.inicio)} min`);
  const aviso = lista.length
    ? { title: lista.length === 1 ? "1 persona sigue en receso" : `${lista.length} personas siguen en receso`,
        body: `${nombres.slice(0, 6).join(" · ")}${nombres.length > 6 ? " · …" : ""}\n¿Ya regresaron? Toca para marcarlo.` }
    : { title: "Avisos de receso activados", body: "Así te va a llegar el aviso mientras alguien esté en receso." };

  webpush.setVapidDetails("mailto:avisos@gestion-sym.app", cfg.vapid_public, cfg.vapid_private);
  const { data: subs } = await sb.from("push_suscripciones").select("id, endpoint, p256dh, auth");
  let enviado = 0;
  await Promise.all((subs ?? []).map(async (s: any) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...aviso, url: "./#recesos", tag: "receso" }), { TTL: 240, urgency: "high" });
      enviado++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_suscripciones").delete().eq("id", s.id);   // celular que ya no existe
      else console.error("push", e?.statusCode, e?.body);
    }
  }));
  return json({ enviado, personas: lista.length });
});
