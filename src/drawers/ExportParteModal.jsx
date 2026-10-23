import React from 'react';
import { Icon, fmt, clsx } from '../components.jsx';
import { jsPDF } from 'jspdf';
import { getFotosByParte } from '../supabase.js';

/* ── Canvas firma RIBEIRO ────────────────────────────────────────── */
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
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onSign(null);
  };

  return (
    <div className="sig-wrap-dark">
      <canvas
        ref={canvasRef} width={460} height={100}
        className={clsx("sig-canvas-dark", isSigned && "signed")}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
      />
      {!isSigned && <span className="sig-placeholder-dark">Firmá aquí (representante RIBEIRO)</span>}
      {isSigned && (
        <button className="sig-clear-dark" onClick={clear}>
          <Icon name="x" size={12} /> Borrar
        </button>
      )}
    </div>
  );
}

const fmtFecha = (s) => {
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return s; }
};
const fmtFechaLarga = (s) => {
  try {
    return new Date(s + "T00:00:00").toLocaleDateString("es-AR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch { return s; }
};

/* ── Generador PDF ───────────────────────────────────────────────── */
async function generatePDF(parte, project, inspector, firmaRibeiro, representante) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, margin = 18, contentW = W - margin * 2;
  let y = 0;

  const colors = {
    primary: [30, 25, 15],
    gold: [185, 140, 40],
    gray: [100, 95, 88],
    lightGray: [220, 218, 214],
    red: [200, 60, 50],
    white: [255, 255, 255],
    bg: [248, 246, 240],
  };

  const setFont = (size, weight = "normal", color = colors.primary) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", weight);
    doc.setTextColor(...color);
  };
  const sf = setFont;
  const line = (x1, y1, x2, y2, color = colors.lightGray, width = 0.3) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x1, y1, x2, y2);
  };
  const ln = line;
  const rectFill = (x, yy, w, h, fillColor) => {
    doc.setFillColor(...fillColor);
    doc.rect(x, yy, w, h, "F");
  };

  const parteLabel = parte.idCorto
    ? `P-${String(parte.num).padStart(3, "0")} · #${parte.idCorto}`
    : `P-${String(parte.num).padStart(3, "0")}`;

  // ── Header oscuro ──
  rectFill(0, 0, W, 38, colors.primary);

  // Logo RIBEIRO
  let logoLoaded = false;
  try {
    const img = new Image();
    img.src = "/assets/ribeiro-logo.png";
    await new Promise((res) => { img.onload = res; img.onerror = res; });
    if (img.complete && img.naturalWidth > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      doc.addImage(canvas.toDataURL("image/png"), "PNG", margin, 6, 22, 22);
      logoLoaded = true;
    }
  } catch {}

  const textX = logoLoaded ? margin + 26 : margin;
  setFont(15, "bold", colors.white);
  doc.text("PARTE DIARIO DE OBRA", textX, 13);
  setFont(8, "normal", [180, 170, 150]);
  doc.text(`${project.code}  ·  ${project.location}${project.client ? "  ·  " + project.client : ""}`, textX, 20);
  setFont(8, "bold", [180, 170, 150]);
  doc.text("RIBEIRO  OBRAS & VIALIDAD", textX, 27);

  setFont(9, "bold", colors.white);
  doc.text(parteLabel, W - margin, 13, { align: "right" });
  setFont(20, "bold", [231, 177, 58]);
  doc.text(fmtFecha(parte.fecha), W - margin, 24, { align: "right" });
  setFont(7.5, "normal", [180, 170, 150]);
  doc.text(fmtFechaLarga(parte.fecha), W - margin, 30, { align: "right" });

  y = 46;

  // ── Avances ──
  setFont(8, "bold", colors.gold);
  doc.text("AVANCES REGISTRADOS", margin, y);
  y += 4;
  line(margin, y, W - margin, y, colors.gold, 0.4);
  y += 5;

  parte.items.forEach((av, idx) => {
    if (y > 245) { doc.addPage(); y = 20; }

    rectFill(margin, y - 3, contentW, 15, idx % 2 === 0 ? colors.bg : colors.white);
    setFont(11, "bold", colors.primary);
    doc.text(av.nombre_etapa || (av.motivo_npt ? "Solo NPT" : "—"), margin + 3, y + 4);
    if (av.fase) {
      setFont(8, "normal", colors.gray);
      doc.text(av.fase, margin + 3, y + 9.5);
    }
    setFont(12, "bold", colors.primary);
    if (av.nombre_etapa) doc.text(`+${fmt(Number(av.total_avance))} ${av.UM || ""}`, W - margin - 3, y + 4, { align: "right" });
    if (av.descripcion) {
      setFont(8, "normal", colors.gray);
      doc.text(av.descripcion, W - margin - 3, y + 9.5, { align: "right" });
    }
    y += 17;

    // NPT
    if (av.motivo_npt) {
      rectFill(margin, y - 1, contentW, 9, [255, 240, 238]);
      doc.setDrawColor(...colors.red); doc.setLineWidth(1);
      doc.line(margin, y - 1, margin, y + 8);
      setFont(7, "bold", colors.red);
      doc.text(`NPT: ${av.motivo_npt}${av.tiempo_npt ? "  ·  " + av.tiempo_npt + " hs" : ""}`, margin + 3, y + 4);
      if (av.detalle_npt) {
        setFont(6.5, "normal", colors.gray);
        doc.text(av.detalle_npt, W - margin - 2, y + 4, { align: "right" });
      }
      y += 11;
    }

    // Recursos
    const recursos = av.Recursos || [];
    if (recursos.length) {
      setFont(6.5, "normal", colors.gray);
      const txt = recursos.map((r) => {
        const extra = r.puesto || [r.familia, r.subfamilia].filter(Boolean).join("/") || "";
        return `${r.detalle_recurso}${extra ? " — " + extra : ""}${r.total_hs ? ` (${r.total_hs}hs)` : ""}`;
      }).join("  ·  ");
      const ls = doc.splitTextToSize(txt, contentW - 4);
      doc.text(ls, margin + 2, y);
      y += ls.length * 4 + 2;
    }

    line(margin, y, W - margin, y, colors.lightGray, 0.2);
    y += 3;
  });

  // ── Horas por recurso ──
  const horasPorRecurso = {};
  parte.items.forEach((av) => {
    (av.Recursos || []).forEach((r) => {
      if (!r.total_hs) return;
      const k = r.detalle_recurso;
      if (!horasPorRecurso[k]) horasPorRecurso[k] = { horas: 0, tipo: r.tipo_recurso };
      horasPorRecurso[k].horas += Number(r.total_hs);
    });
  });
  const resumenRec = Object.entries(horasPorRecurso).sort((a, b) => b[1].horas - a[1].horas);

  if (resumenRec.length) {
    y += 5;
    if (y > 245) { doc.addPage(); y = 20; }
    setFont(8, "bold", colors.gold);
    doc.text("HORAS POR RECURSO", margin, y);
    y += 4;
    line(margin, y, W - margin, y, colors.gold, 0.4);
    y += 5;

    const cols = Math.min(3, resumenRec.length);
    const colW = contentW / cols;
    resumenRec.forEach(([nombre, { horas, tipo }], i) => {
      const col = i % cols;
      const xPos = margin + col * colW;
      if (col === 0 && i > 0) y += 13;
      rectFill(xPos, y - 2, colW - 2, 11, tipo === "vehiculo" ? [255, 248, 230] : [230, 240, 255]);
      setFont(7, "normal", colors.primary);
      doc.text(nombre, xPos + 2, y + 4);
      setFont(8, "bold", tipo === "vehiculo" ? colors.gold : [60, 120, 180]);
      doc.text(`${horas} hs`, xPos + colW - 4, y + 4, { align: "right" });
    });
    y += 14;
  }

  // ── Observaciones del parte ──
  const obs = parte.items[0]?.observaciones_parte;
  if (obs) {
    y += 5;
    if (y > 245) { doc.addPage(); y = 20; }
    sf(8, "bold", colors.gold);
    doc.text("OBSERVACIONES", margin, y);
    y += 4; ln(margin, y, W - margin, y, colors.gold, 0.4); y += 5;
    sf(9, "normal", colors.primary);
    const obsLines = doc.splitTextToSize(obs, contentW);
    doc.text(obsLines, margin, y);
    y += obsLines.length * 5 + 4;
  }

  // ── Fotos del parte ──
  if (parte.fotos?.length) {
    y += 5;
    if (y > 220) { doc.addPage(); y = 20; }
    sf(8, "bold", colors.gold);
    doc.text("FOTOS DEL PARTE", margin, y);
    y += 4; ln(margin, y, W - margin, y, colors.gold, 0.4); y += 6;

    const fotoSize = (contentW - 9) / 4; // 4 fotos por fila con gaps
    let fx = margin;

    for (let i = 0; i < parte.fotos.length; i++) {
      const foto = parte.fotos[i];
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = foto.url;
        await new Promise((res) => { img.onload = res; img.onerror = res; });
        if (img.complete && img.naturalWidth > 0) {
          const cv = document.createElement("canvas");
          cv.width = img.naturalWidth; cv.height = img.naturalHeight;
          cv.getContext("2d").drawImage(img, 0, 0);
          if (y + fotoSize > 270) { doc.addPage(); y = 20; fx = margin; }
          doc.addImage(cv.toDataURL("image/jpeg", 0.85), "JPEG", fx, y, fotoSize, fotoSize);
          // Borde sutil
          doc.setDrawColor(...colors.lightGray); doc.setLineWidth(0.3);
          doc.rect(fx, y, fotoSize, fotoSize, "S");
          fx += fotoSize + 3;
        }
      } catch {}
    }
    y += fotoSize + 8;
  }

  // ── Sección de firmas ──
  if (y > 220) { doc.addPage(); y = 20; }
  y = Math.max(y + 12, 222);

  line(margin, y, W - margin, y, colors.lightGray, 0.5);
  y += 8;

  const colFirma = contentW / 2 - 5;

  // Cuadro Inspector (en blanco para firma física)
  rectFill(margin, y, colFirma, 46, colors.bg);
  doc.setDrawColor(...colors.lightGray); doc.setLineWidth(0.4);
  doc.rect(margin, y, colFirma, 46, "S");
  setFont(7, "bold", colors.gold);
  doc.text("FIRMA DEL INSPECTOR", margin + 4, y + 6);
  setFont(7, "normal", colors.gray);
  doc.text(`Nombre: ${inspector || "_________________________________"}`, margin + 4, y + 12);
  // Espacio en blanco para firma física
  line(margin + 4, y + 41, margin + colFirma - 4, y + 41, colors.primary, 0.5);
  setFont(6.5, "normal", colors.gray);
  doc.text("Firma y aclaración", margin + colFirma / 2, y + 45, { align: "center" });

  // Cuadro RIBEIRO
  const xRib = margin + colFirma + 10;
  rectFill(xRib, y, colFirma, 46, [30, 25, 15]);
  doc.setDrawColor(...colors.gold); doc.setLineWidth(0.5);
  doc.rect(xRib, y, colFirma, 46, "S");

  setFont(7, "bold", [231, 177, 58]);
  doc.text("RIBEIRO  OBRAS & VIALIDAD", xRib + colFirma / 2, y + 8, { align: "center" });
  if (representante) {
    setFont(7, "normal", [200, 190, 160]);
    doc.text(representante, xRib + colFirma / 2, y + 14, { align: "center" });
  }


  // Firma digital RIBEIRO si existe
  if (firmaRibeiro) {
    try {
      doc.addImage(firmaRibeiro, "PNG", xRib + 4, y + 14, colFirma - 8, 22);
    } catch {}
  }
  line(xRib + 4, y + 41, xRib + colFirma - 4, y + 41, [100, 90, 60], 0.5);
  setFont(6.5, "normal", [150, 140, 110]);
  doc.text("Firma autorizada", xRib + colFirma / 2, y + 45, { align: "center" });

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    rectFill(0, 285, W, 12, colors.primary);
    setFont(6.5, "normal", [140, 130, 110]);
    doc.text(`${project.code}  ·  Parte ${parteLabel}  ·  ${fmtFecha(parte.fecha)}`, margin, 290);
    doc.text(`Página ${i} de ${pageCount}`, W - margin, 290, { align: "right" });
  }

  doc.save(`Parte_${parteLabel}_${parte.fecha}.pdf`);
}

/* ── Modal ───────────────────────────────────────────────────────── */
export function ExportParteModal({ parte, project, onClose }) {
  const [inspector, setInspector] = React.useState("");
  const [firmaRibeiro, setFirmaRibeiro] = React.useState(null);
  const [representante, setRepresentante] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [fotos, setFotos] = React.useState([]);

  React.useEffect(() => {
    if (parte.id && !parte.id.startsWith("fecha:")) {
      getFotosByParte(parte.id).then(setFotos).catch(() => setFotos([]));
    }
  }, [parte.id]);

  const totalHs = React.useMemo(() => {
    let sum = 0;
    parte.items.forEach((av) => (av.Recursos || []).forEach((r) => { sum += Number(r.total_hs) || 0; }));
    return sum;
  }, [parte]);

  const handleExport = async () => {
    setGenerating(true);
    try { await generatePDF({ ...parte, fotos }, project, inspector, firmaRibeiro, representante); }
    catch (e) { console.error(e); }
    setGenerating(false);
  };

  return (
    <div className="scrim" style={{ justifyContent: "center", alignItems: "center" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="export-modal">
        <div className="export-modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="ch-icon" style={{ background: "rgba(231,177,58,0.15)", color: "var(--gold-deep)", width: 36, height: 36, borderRadius: 10 }}>
              <Icon name="report" size={18} />
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--on-cream)" }}>
                Exportar parte PDF
              </div>
              <div style={{ fontSize: 12, color: "var(--on-cream-2)", marginTop: 2 }}>
                P-{String(parte.num).padStart(3, "0")} · {new Date(parte.fecha + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        <div className="export-modal-body">
          <div className="export-summary">
            <div className="export-sum-item">
              <Icon name="report" size={14} />
              <span>{parte.items.length} avance{parte.items.length !== 1 ? "s" : ""}</span>
            </div>
            {totalHs > 0 && (
              <div className="export-sum-item">
                <Icon name="clock" size={14} />
                <span>{totalHs} hs de recursos</span>
              </div>
            )}
            {parte.items.some((a) => a.motivo_npt) && (
              <div className="export-sum-item" style={{ color: "#b52a1a" }}>
                <Icon name="alert" size={14} />
                <span>Con NPT</span>
              </div>
            )}
          </div>

          <div className="field">
            <label>Nombre del inspector</label>
            <input
              className="input"
              placeholder="Ej: Ing. García"
              value={inspector}
              onChange={(e) => setInspector(e.target.value)}
            />
            <div className="hint">Se incluirá en el cuadro de firma del inspector. La firma se deja en blanco para completar a mano.</div>
          </div>

          {fotos.length > 0 && (
            <div className="field">
              <label>Fotos adjuntas ({fotos.length})</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {fotos.map((f) => (
                  <img key={f.id} src={f.url} alt={f.nombre}
                    style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: "1.5px solid var(--line-cream)" }} />
                ))}
              </div>
            </div>
          )}

          <div className="export-preview">
            <div className="export-preview-title">Avances a incluir</div>
            {parte.items.map((av) => (
              <div key={av.id} className="export-preview-row">
                <div>
                  {av.fase && <span className="export-fase">{av.fase}</span>}
                  <span className="export-etapa">{av.nombre_etapa || (av.motivo_npt ? "Solo NPT" : "—")}</span>
                </div>
                {av.nombre_etapa && <span className="export-val">+{fmt(Number(av.total_avance))} {av.UM}</span>}
              </div>
            ))}
          </div>

          {/* RIBEIRO — nombre + firma digital */}
          <div className="field">
            <label>Representante RIBEIRO</label>
            <input
              className="input"
              placeholder="Ej: Ing. Ribeiro"
              value={representante}
              onChange={(e) => setRepresentante(e.target.value)}
            />
          </div>
          <div className="export-firma-box ribeiro" style={{ borderRadius: "var(--r-sm)" }}>
            <div className="efb-title" style={{ color: "#e7b13a", marginBottom: 8 }}>RIBEIRO · Firma digital</div>
            <SignaturePad onSign={setFirmaRibeiro} isSigned={!!firmaRibeiro} />
          </div>
        </div>

        <div className="export-modal-foot">
          <button className="btn btn-cream" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={handleExport} disabled={generating}>
            {generating
              ? <><Icon name="refresh" size={15} style={{ animation: "spin 0.7s linear infinite" }} /> Generando…</>
              : <><Icon name="upload" size={15} /> Descargar PDF</>}
          </button>
        </div>
      </div>
    </div>
  );
}
