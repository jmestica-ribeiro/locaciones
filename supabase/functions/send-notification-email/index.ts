import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");
const FROM_EMAIL = Deno.env.get("NOTIF_FROM_EMAIL") || "onboarding@resend.dev";
const FROM_NAME = Deno.env.get("NOTIF_FROM_NAME") || "RIBEIRO - LOCACIONES";
const APP_URL = Deno.env.get("NOTIF_APP_URL") || "https://obras.ribeiro.ar";

const GOLD = "#e7b13a";
const DARK = "#1a1a2e";

function formatFecha(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (fecha || "-");
}

function buildHtml({ nombre, proyecto, fecha, etapa, npt_horas, npt_motivo, es_primero, hay_npt }) {
  const isNpt = hay_npt && !es_primero;
  const tag = isNpt ? "Tiempo no productivo" : "Parte diario";
  const heading = isNpt
    ? `Se registró tiempo no productivo en ${proyecto}`
    : `Se cargó un nuevo parte en ${proyecto}`;

  const infoCols = isNpt
    ? [
        { label: "Etapa", value: etapa || "-" },
        { label: "NPT (hs)", value: `${npt_horas}${npt_motivo ? " · " + npt_motivo : ""}` },
      ]
    : [
        { label: "Proyecto", value: proyecto },
        { label: "Fecha", value: formatFecha(fecha) },
      ];

  const cardsHtml = infoCols
    .map(
      (c, i) => `
      <td style="padding:14px 18px;${i > 0 ? "border-left:1px solid #e8e6de;" : ""}">
        <div style="font-size:11px;font-weight:700;letter-spacing:.04em;color:#8a8a8a;text-transform:uppercase;">${c.label}</div>
        <div style="font-size:14px;font-weight:700;color:${DARK};margin-top:3px;">${c.value}</div>
      </td>`
    )
    .join("");

  return `
  <div style="background:#f4f2ea;padding:32px 16px;font-family:Segoe UI, Arial, sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8e6de;">
      <div style="background:${DARK};padding:22px 26px;display:flex;align-items:baseline;gap:10px;">
        <span style="font-size:17px;font-weight:800;color:${GOLD};letter-spacing:.02em;">RIBEIRO</span>
        <span style="font-size:13px;font-weight:600;color:#cfcfd8;">LOCACIONES</span>
        <span style="font-size:11px;color:#8a8a97;margin-left:auto;">${tag}</span>
      </div>
      <div style="padding:28px 26px 8px;">
        <p style="margin:0 0 6px;font-size:13px;color:#6b6b6b;">Hola, <b>${nombre}</b></p>
        <h1 style="margin:0 0 20px;font-size:19px;line-height:1.35;color:${DARK};">${heading}</h1>
        <table style="width:100%;border-collapse:collapse;background:#faf9f4;border:1px solid #e8e6de;border-radius:10px;overflow:hidden;">
          <tr>${cardsHtml}</tr>
        </table>
        <div style="margin:26px 0 8px;">
          <a href="${APP_URL}/proyectos/${encodeURIComponent(proyecto)}"
             style="display:inline-block;background:${GOLD};color:${DARK};font-weight:700;font-size:13.5px;text-decoration:none;padding:12px 22px;border-radius:8px;">
            Ver en Locaciones →
          </a>
        </div>
      </div>
      <div style="padding:16px 26px 22px;border-top:1px solid #eeece4;">
        <p style="margin:0;font-size:11.5px;color:#9a9a9a;line-height:1.5;">
          Este email fue generado automáticamente por RIBEIRO - LOCACIONES.<br/>
          Si creés que fue un error, contactá al área correspondiente.
        </p>
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!RESEND_API_KEY) {
    return new Response("RESEND_API_KEY no configurada", { status: 500 });
  }

  const payload = await req.json();
  const { proyecto, fecha, etapa, npt_horas, npt_motivo, es_primero, hay_npt, destinatarios } = payload;

  if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
    return new Response("Sin destinatarios", { status: 200 });
  }

  const subject = hay_npt && !es_primero
    ? `NPT registrado — ${proyecto}`
    : `Nuevo parte cargado — ${proyecto}`;

  const results = await Promise.all(
    destinatarios.map(async (d) => {
      const html = buildHtml({ nombre: d.nombre, proyecto, fecha, etapa, npt_horas, npt_motivo, es_primero, hay_npt });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [d.email],
          subject,
          html,
        }),
      });
      return { email: d.email, ok: res.ok, status: res.status };
    })
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    return new Response(JSON.stringify({ failed }), { status: 502 });
  }

  return new Response("OK", { status: 200 });
});
