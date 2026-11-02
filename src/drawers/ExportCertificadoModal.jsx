import React from 'react';
import { Icon, clsx, fmt } from '../components.jsx';
import { jsPDF } from 'jspdf';

/* ── Firma digital ───────────────────────────────────────────────── */
function SignaturePad({ onSign, isSigned }) {
  const canvasRef = React.useRef(null);
  const drawing = React.useRef(false);
  const lastPos = React.useRef(null);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height),
    };
  };
  const startDraw = (e) => { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e, canvasRef.current); };
  const draw = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#e7b13a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
    onSign(canvas.toDataURL("image/png"));
  };
  const stopDraw = () => { drawing.current = false; };
  const clear = () => {
    canvasRef.current.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onSign(null);
  };

  return (
    <div className="sig-wrap-dark">
      <canvas ref={canvasRef} width={460} height={100}
        className={clsx("sig-canvas-dark", isSigned && "signed")}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
      />
      {!isSigned && <span className="sig-placeholder-dark">Firmá aquí (representante RIBEIRO)</span>}
      {isSigned && <button className="sig-clear-dark" onClick={clear}><Icon name="x" size={12} /> Borrar</button>}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */
const fmtF = (s) => {
  try { return new Date(s + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return s; }
};
const fmtLarga = (s) => {
  try { return new Date(s + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return s; }
};

/* ── Generador PDF certificado ───────────────────────────────────── */
async function generateCertificado({ project, avances, desde, hasta, inspector, representante, firmaRibeiro, nroCert }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, margin = 18, contentW = W - margin * 2;
  let y = 0;

  const C = {
    primary: [30, 25, 15], gold: [185, 140, 40], gray: [100, 95, 88],
    lightGray: [220, 218, 214], red: [200, 60, 50], white: [255, 255, 255], bg: [248, 246, 240],
  };

  const sf = (size, w = "normal", color = C.primary) => {
    doc.setFontSize(size); doc.setFont("helvetica", w); doc.setTextColor(...color);
  };
  const ln = (x1, y1, x2, y2, color = C.lightGray, lw = 0.3) => {
    doc.setDrawColor(...color); doc.setLineWidth(lw); doc.line(x1, y1, x2, y2);
  };
  const rf = (x, yy, w, h, fc) => { doc.setFillColor(...fc); doc.rect(x, yy, w, h, "F"); };

  // ── Header ──
  rf(0, 0, W, 42, C.primary);

  // Logo
  try {
    const img = new Image(); img.src = "/assets/ribeiro-logo.png";
    await new Promise((r) => { img.onload = r; img.onerror = r; });
    if (img.complete && img.naturalWidth > 0) {
      const cv = document.createElement("canvas");
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      cv.getContext("2d").drawImage(img, 0, 0);
      doc.addImage(cv.toDataURL("image/png"), "PNG", margin, 8, 22, 22);
    }
  } catch {}

  const tx = margin + 26;
  sf(15, "bold", C.white);
  doc.text("CERTIFICADO DE AVANCE PARCIAL", tx, 14);
  sf(8, "normal", [180, 170, 150]);
  doc.text(`${project.code}  ·  ${project.location}${project.client ? "  ·  " + project.client : ""}`, tx, 21);
  sf(8, "bold", [180, 170, 150]);
  doc.text("RIBEIRO  LOCACIONES", tx, 28);

  // Período + N°
  sf(8, "bold", C.white);
  doc.text(`N° ${String(nroCert).padStart(3, "0")}`, W - margin, 14, { align: "right" });
  sf(10, "bold", [231, 177, 58]);
  doc.text(`${fmtF(desde)}  al  ${fmtF(hasta)}`, W - margin, 23, { align: "right" });
  sf(7.5, "normal", [180, 170, 150]);
  doc.text("Período de certificación", W - margin, 30, { align: "right" });

  y = 50;

  // ── Resumen del período ──
  const totalAvances = avances.length;
  const totalPartes = new Set(avances.map((a) => a.ID_Parte || a.fecha_avance)).size;

  rf(margin, y, contentW, 14, [40, 35, 22]);
  sf(8, "normal", [180, 170, 150]);
  doc.text(`${totalAvances} avances registrados en ${totalPartes} parte${totalPartes !== 1 ? "s" : ""}  ·  del ${fmtLarga(desde)} al ${fmtLarga(hasta)}`, margin + 4, y + 9);
  y += 20;

  // ── Avances acumulados por etapa ──
  sf(9, "bold", C.gold);
  doc.text("AVANCES ACUMULADOS POR ETAPA", margin, y);
  y += 4;
  ln(margin, y, W - margin, y, C.gold, 0.5);
  y += 6;

  // Agrupar por etapa
  const porEtapa = {};
  avances.forEach((a) => {
    if (!a.nombre_etapa) return; // filas "solo NPT"
    const key = `${a.fase || ""}||${a.nombre_etapa || ""}`;
    if (!porEtapa[key]) porEtapa[key] = { fase: a.fase, etapa: a.nombre_etapa, um: a.UM, total: 0, partes: new Set() };
    porEtapa[key].total += Number(a.total_avance) || 0;
    porEtapa[key].partes.add(a.fecha_avance);
  });

  const etapaRows = Object.values(porEtapa);

  // Paleta de colores para chips de fase
  const FASE_PALETTE = [
    [185, 140, 40],   // gold
    [91, 159, 212],   // blue
    [116, 192, 116],  // green
    [169, 139, 214],  // purple
    [95, 182, 168],   // teal
    [226, 73, 59],    // red
    [202, 168, 106],  // sand
  ];
  const fasesUnicas = [...new Set(etapaRows.map((r) => r.fase).filter(Boolean))];
  const faseColor = (f) => FASE_PALETTE[fasesUnicas.indexOf(f) % FASE_PALETTE.length] || C.gray;

  // Helper chip: dibuja un rectángulo redondeado con texto
  const drawChip = (text, x, yy, color) => {
    if (!text) return;
    const pad = 3;
    doc.setFontSize(7); doc.setFont("helvetica", "bold");
    const tw = doc.getTextWidth(text);
    const cw = tw + pad * 2 + 2;
    const ch = 6;
    doc.setFillColor(...color);
    doc.roundedRect(x, yy - 1, cw, ch, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(text.toUpperCase(), x + pad + 1, yy + 3.5);
    return cw;
  };

  // Encabezado tabla: FASE primero, luego ETAPA
  rf(margin, y, contentW, 8, C.primary);
  sf(7, "bold", C.white);
  doc.text("FASE", margin + 3, y + 5);
  doc.text("ETAPA", margin + 52, y + 5);
  doc.text("PARTES", W - margin - 45, y + 5, { align: "right" });
  doc.text("ACUMULADO", W - margin - 3, y + 5, { align: "right" });
  y += 10;

  etapaRows.forEach((row, i) => {
    if (y > 250) { doc.addPage(); y = 20; }
    rf(margin, y - 2, contentW, 13, i % 2 === 0 ? C.bg : C.white);

    // Chip fase (primera columna)
    drawChip(row.fase || "—", margin + 3, y + 2, faseColor(row.fase));

    // Etapa
    sf(11, "bold", C.primary);
    doc.text(row.etapa || "—", margin + 52, y + 6);

    // Partes
    sf(9, "normal", C.gray);
    doc.text(`${row.partes.size}`, W - margin - 45, y + 6, { align: "right" });

    // Acumulado
    sf(13, "bold", C.primary);
    doc.text(`${fmt(row.total)} ${row.um || ""}`, W - margin - 3, y + 6, { align: "right" });

    ln(margin, y + 11, W - margin, y + 11, C.lightGray, 0.2);
    y += 14;
  });

  // Total general si hay una sola unidad
  const ums = [...new Set(etapaRows.map((r) => r.um).filter(Boolean))];
  if (ums.length === 1) {
    const total = etapaRows.reduce((s, r) => s + r.total, 0);
    rf(margin, y, contentW, 10, [40, 35, 22]);
    sf(8, "bold", [180, 170, 150]);
    doc.text("TOTAL", margin + 3, y + 7);
    sf(14, "bold", [231, 177, 58]);
    doc.text(`${fmt(total)} ${ums[0]}`, W - margin - 3, y + 7, { align: "right" });
    y += 14;
  }

  // ── Resumen de recursos ──
  const allRec = avances.flatMap((a) => a.Recursos || []);
  if (allRec.length > 0) {
    y += 6;
    if (y > 240) { doc.addPage(); y = 20; }
    sf(9, "bold", C.gold);
    doc.text("RESUMEN DE RECURSOS", margin, y);
    y += 4; ln(margin, y, W - margin, y, C.gold, 0.5); y += 6;

    // Totales por tipo
    const vehSet = new Set(allRec.filter((r) => r.tipo_recurso === "vehiculo").map((r) => r.ID_RecursoFuente || r.detalle_recurso));
    const perSet = new Set(allRec.filter((r) => r.tipo_recurso === "personal").map((r) => r.ID_RecursoFuente || r.detalle_recurso));
    const hsVeh = allRec.filter((r) => r.tipo_recurso === "vehiculo").reduce((s, r) => s + (Number(r.total_hs) || 0), 0);
    const hsPer = allRec.filter((r) => r.tipo_recurso === "personal").reduce((s, r) => s + (Number(r.total_hs) || 0), 0);
    const hsTotal = hsVeh + hsPer;

    const colW2 = contentW / 3;

    // Vehículos
    rf(margin, y, colW2 - 2, 18, [255, 248, 230]);
    sf(7, "bold", [185, 140, 40]);
    doc.text("VEHÍCULOS", margin + 4, y + 5);
    sf(14, "bold", C.primary);
    doc.text(`${vehSet.size}`, margin + 4, y + 13);
    sf(8, "normal", C.gray);
    doc.text(`${hsVeh} hs`, margin + colW2 - 6, y + 13, { align: "right" });

    // Personal
    const x2 = margin + colW2 + 2;
    rf(x2, y, colW2 - 2, 18, [230, 240, 255]);
    sf(7, "bold", [60, 120, 180]);
    doc.text("PERSONAL", x2 + 4, y + 5);
    sf(14, "bold", C.primary);
    doc.text(`${perSet.size}`, x2 + 4, y + 13);
    sf(8, "normal", C.gray);
    doc.text(`${hsPer} hs`, x2 + colW2 - 6, y + 13, { align: "right" });

    // Total horas
    const x3 = margin + colW2 * 2 + 4;
    rf(x3, y, contentW - colW2 * 2 - 4, 18, [40, 35, 22]);
    sf(7, "bold", [180, 170, 150]);
    doc.text("TOTAL HORAS", x3 + 4, y + 5);
    sf(14, "bold", [231, 177, 58]);
    doc.text(`${hsTotal} hs`, x3 + 4, y + 13);

    y += 22;
  }

  // ── NPT del período ──
  const conNPT = avances.filter((a) => a.motivo_npt);
  if (conNPT.length > 0) {
    y += 6;
    if (y > 240) { doc.addPage(); y = 20; }
    sf(9, "bold", C.gold);
    doc.text("TIEMPO NO PRODUCTIVO (NPT)", margin, y);
    y += 4; ln(margin, y, W - margin, y, C.gold, 0.4); y += 6;

    const nptGrouped = {};
    conNPT.forEach((a) => {
      const k = a.motivo_npt;
      if (!nptGrouped[k]) nptGrouped[k] = 0;
      nptGrouped[k] += Number(a.tiempo_npt) || 1;
    });

    Object.entries(nptGrouped).forEach(([motivo, hs], i) => {
      rf(margin, y - 2, contentW, 9, i % 2 === 0 ? [255, 240, 238] : C.white);
      doc.setDrawColor(...C.red); doc.setLineWidth(0.8);
      doc.line(margin, y - 2, margin, y + 7);
      sf(8, "bold", C.red);
      doc.text(motivo, margin + 3, y + 4);
      sf(9, "bold", C.red);
      doc.text(`${hs} hs`, W - margin - 3, y + 4, { align: "right" });
      y += 11;
    });
  }

  // ── Firmas ──
  if (y > 215) { doc.addPage(); y = 20; }
  y = Math.max(y + 12, 218);
  ln(margin, y, W - margin, y, C.lightGray, 0.5);
  y += 8;

  const colF = contentW / 2 - 5;

  // Inspector
  rf(margin, y, colF, 46, C.bg);
  doc.setDrawColor(...C.lightGray); doc.setLineWidth(0.4);
  doc.rect(margin, y, colF, 46, "S");
  sf(7, "bold", C.gold);
  doc.text("FIRMA DEL INSPECTOR", margin + 4, y + 6);
  sf(7, "normal", C.gray);
  doc.text(`Nombre: ${inspector || "_________________________________"}`, margin + 4, y + 12);
  ln(margin + 4, y + 41, margin + colF - 4, y + 41, C.primary, 0.5);
  sf(6.5, "normal", C.gray);
  doc.text("Firma y aclaración", margin + colF / 2, y + 45, { align: "center" });

  // RIBEIRO
  const xR = margin + colF + 10;
  rf(xR, y, colF, 46, [30, 25, 15]);
  doc.setDrawColor(...C.gold); doc.setLineWidth(0.5);
  doc.rect(xR, y, colF, 46, "S");
  sf(7, "bold", [231, 177, 58]);
  doc.text("RIBEIRO  LOCACIONES", xR + colF / 2, y + 7, { align: "center" });
  if (representante) { sf(7, "normal", [200, 190, 160]); doc.text(representante, xR + colF / 2, y + 13, { align: "center" }); }
  if (firmaRibeiro) {
    try { doc.addImage(firmaRibeiro, "PNG", xR + 4, y + 15, colF - 8, 20); } catch {}
  }
  ln(xR + 4, y + 41, xR + colF - 4, y + 41, [100, 90, 60], 0.5);
  sf(6.5, "normal", [150, 140, 110]);
  doc.text("Firma autorizada", xR + colF / 2, y + 45, { align: "center" });

  // ── Footer ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    rf(0, 285, W, 12, C.primary);
    sf(6.5, "normal", [140, 130, 110]);
    doc.text(`${project.code}  ·  Certificado N° ${String(nroCert).padStart(3,"0")}  ·  ${fmtF(desde)} — ${fmtF(hasta)}`, margin, 290);
    doc.text(`Página ${i} de ${pages}`, W - margin, 290, { align: "right" });
  }

  doc.save(`Certificado_${project.code}_${desde}_${hasta}.pdf`);
}

/* ── Modal ───────────────────────────────────────────────────────── */
export function ExportCertificadoModal({ avancesTotales, project, onClose }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [desde, setDesde] = React.useState("");
  const [hasta, setHasta] = React.useState(hoy);
  const [inspector, setInspector] = React.useState("");
  const [representante, setRepresentante] = React.useState("");
  const [firmaRibeiro, setFirmaRibeiro] = React.useState(null);
  const [nroCert, setNroCert] = React.useState("1");
  const [generating, setGenerating] = React.useState(false);

  // Filtrar avances por rango
  const avancesFiltrados = React.useMemo(() => {
    if (!desde && !hasta) return avancesTotales;
    return avancesTotales.filter((a) => {
      const f = a.fecha_avance || "";
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    });
  }, [avancesTotales, desde, hasta]);

  // Resumen por etapa para preview
  const resumenEtapas = React.useMemo(() => {
    const map = {};
    avancesFiltrados.forEach((a) => {
      if (!a.nombre_etapa) return; // filas "solo NPT"
      const k = a.nombre_etapa;
      if (!map[k]) map[k] = { total: 0, um: a.UM };
      map[k].total += Number(a.total_avance) || 0;
    });
    return Object.entries(map).map(([nombre, { total, um }]) => ({ nombre, total, um }));
  }, [avancesFiltrados]);

  const handleExport = async () => {
    if (!desde) return;
    setGenerating(true);
    try {
      await generateCertificado({
        project, avances: avancesFiltrados, desde, hasta,
        inspector, representante, firmaRibeiro, nroCert: Number(nroCert) || 1,
      });
    } catch (e) { console.error(e); }
    setGenerating(false);
  };

  return (
    <div className="scrim" style={{ justifyContent: "center", alignItems: "center" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="export-modal" style={{ width: "min(580px, 96vw)" }}>
        <div className="export-modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="ch-icon" style={{ background: "rgba(91,159,212,0.15)", color: "#5b9fd4", width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center" }}>
              <Icon name="layers" size={18} />
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--on-cream)" }}>
                Exportar certificado parcial
              </div>
              <div style={{ fontSize: 12, color: "var(--on-cream-2)", marginTop: 2 }}>
                {project.code} · Avances acumulados por período
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div className="export-modal-body">
          {/* Período */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--on-cream-2)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Período</div>
            <div className="field-row" style={{ gridTemplateColumns: "1fr 1fr 120px" }}>
              <div className="field">
                <label>Desde <span className="req">*</span></label>
                <input type="date" className={clsx("input", !desde && "bad")} value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div className="field">
                <label>Hasta</label>
                <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
              <div className="field">
                <label>N° certificado</label>
                <input className="input" value={nroCert} onChange={(e) => setNroCert(e.target.value)} placeholder="1" />
              </div>
            </div>
          </div>

          {/* Preview avances */}
          {avancesFiltrados.length === 0 && desde ? (
            <div style={{ textAlign: "center", padding: "16px 0", color: "var(--on-cream-2)", fontSize: 13 }}>
              Sin avances en el período seleccionado.
            </div>
          ) : avancesFiltrados.length > 0 && (
            <div className="export-preview">
              <div className="export-preview-title">
                {avancesFiltrados.length} avance{avancesFiltrados.length !== 1 ? "s" : ""} · {resumenEtapas.length} etapa{resumenEtapas.length !== 1 ? "s" : ""}
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {resumenEtapas.map((e) => (
                <div key={e.nombre} className="export-preview-row">
                  <span className="export-etapa">{e.nombre}</span>
                  <span className="export-val">{fmt(e.total)} {e.um}</span>
                </div>
              ))}
              </div>
            </div>
          )}

          {/* Datos para PDF */}
          <div className="field">
            <label>Nombre del inspector</label>
            <input className="input" placeholder="Ej: Ing. García" value={inspector} onChange={(e) => setInspector(e.target.value)} />
          </div>
          <div className="field">
            <label>Representante RIBEIRO</label>
            <input className="input" placeholder="Ej: Ing. Ribeiro" value={representante} onChange={(e) => setRepresentante(e.target.value)} />
          </div>

          {/* Firma RIBEIRO */}
          <div className="field">
            <label>Firma RIBEIRO</label>
            <div className="export-firma-box ribeiro" style={{ borderRadius: "var(--r-sm)" }}>
              <div className="efb-title" style={{ color: "#e7b13a", marginBottom: 8 }}>RIBEIRO · Firma digital</div>
              <SignaturePad onSign={setFirmaRibeiro} isSigned={!!firmaRibeiro} />
            </div>
          </div>
        </div>

        <div className="export-modal-foot">
          <button className="btn btn-cream" onClick={onClose}>Cancelar</button>
          <button className="btn" style={{ background: "#5b9fd4", color: "#fff" }}
            onClick={handleExport} disabled={generating || !desde}>
            {generating
              ? <><Icon name="refresh" size={15} style={{ animation: "spin 0.7s linear infinite" }} /> Generando…</>
              : <><Icon name="upload" size={15} /> Exportar certificado</>}
          </button>
        </div>
      </div>
    </div>
  );
}
