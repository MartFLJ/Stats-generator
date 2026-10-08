"use strict";

/* =========================================================
   1. MODELO: la ficha y sus reglas (sin DOM)
   ========================================================= */
const VERSION = 3;
const MAX_SCALE = 1000;
const DEF_NAMES = ["Poder","Velocidad","Alcance","Precisión","Resistencia","Potencial","Agilidad","Inteligencia","Suerte","Carisma"];
const RANKS = ["E","D","C","B","A","S","S+"];

// Valor mínimo de cada letra repartido de forma pareja entre 0 y max.
const autoTh = M => RANKS.map((_, k) => Math.round(k * M / 6));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const newFicha = () => ({
  v: VERSION, id: null,
  name: "Nuevo personaje", subtitle: "",
  n: 6, names: [...DEF_NAMES],
  max: 10, stats: [10,8,6,8,4,10,6,8,4,6],
  rankMode: "letters",                 // "letters" | "custom"
  th: autoTh(10),                      // umbrales del panel de letras
  custom: [{ min: 0, label: "—" }],    // filas del panel personalizado
  showValue: false,
  color: "#e0457b", letters: true      // letters = mostrar etiquetas
});

// Convierte y sanea fichas de cualquier versión al formato actual.
function migrate(raw) {
  const f = { ...newFicha(), ...JSON.parse(JSON.stringify(raw)) };
  if (!raw.v) {                        // v1: escala desde 1
    if (!raw.max) { f.max = 5; f.th = autoTh(5); }
    f.th[0] = 0;
  }
  delete f.stand;
  f.max = clamp(Math.round(+f.max) || 10, 3, MAX_SCALE);
  f.n = clamp(Math.round(+f.n) || 6, 3, 10);
  f.names = DEF_NAMES.map((d, i) => String(f.names?.[i] ?? d).slice(0, 14));
  f.stats = DEF_NAMES.map((_, i) => clamp(Math.round(+f.stats?.[i]) || 0, 0, f.max));
  const th = RANKS.map((_, k) => clamp(Math.round(+f.th?.[k]) || 0, 0, f.max));
  th[0] = 0;
  for (let k = 1; k < th.length; k++) th[k] = Math.max(th[k], th[k - 1]);
  f.th = th;
  let c = (Array.isArray(f.custom) ? f.custom : [])
    .map(r => ({ min: clamp(Math.round(+r.min) || 0, 0, MAX_SCALE), label: String(r.label ?? "").slice(0, 6) }))
    .sort((a, b) => a.min - b.min);
  if (!c.length) c = [{ min: 0, label: "—" }];
  c[0].min = 0;
  f.custom = c.slice(0, 50);
  f.rankMode = f.rankMode === "custom" ? "custom" : "letters";
  f.showValue = !!f.showValue;
  f.letters = f.letters !== false;
  f.color = /^#[0-9a-f]{6}$/i.test(f.color) ? f.color : "#e0457b";
  f.name = String(f.name ?? "").slice(0, 28);
  f.subtitle = String(f.subtitle ?? "").slice(0, 40);
  f.v = VERSION;
  return f;
}

function rankOf(f, v) {
  let r = 0;
  f.th.forEach((t, k) => { if (v >= t) r = k; });
  return RANKS[r];
}

// Etiqueta de un valor según el panel activo (letras o personalizado).
function labelOf(f, v) {
  if (f.rankMode === "custom") {
    let l = "";
    f.custom.forEach(r => { if (v >= r.min) l = r.label; });
    return l;
  }
  return rankOf(f, v);
}

/* =========================================================
   2. DIBUJO: ficha -> SVG (función pura, reutilizable)
   ========================================================= */
const G = { W: 640, H: 500, CX: 320, CY: 285, R: 115, RC: 155 };
const EXPORT_PAL = { bg: "#f6f4ef", ink: "#1d1b20", mute: "#77737d", line: "#cfcac0" };
// Paso "redondo" para los anillos: nunca más de 10 hilos, sea cual sea la escala.
function niceStep(M) {
  for (const b of [1, 2, 5, 10, 20, 50, 100, 200, 500]) if (M / b <= 10) return b;
  return 500;
}
const FONT = `font-family="'Trebuchet MS',Arial,sans-serif"`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const points = p => p.map(q => q.map(n => n.toFixed(1)).join(",")).join(" ");

function fichaToSvg(f, P) {
  const N = f.n, M = f.max, { CX, CY, R, RC } = G;
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / N;
  const pt = (i, r) => [CX + Math.cos(ang(i)) * r, CY + Math.sin(ang(i)) * r];
  const ring = k => points([...Array(N)].map((_, i) => pt(i, R * k / M)));
  let h = "";

  h += `<text x="${CX}" y="52" text-anchor="middle" ${FONT} font-size="30" font-weight="900" fill="${P.ink}">${esc(f.name || "Sin nombre").toUpperCase()}</text>`;
  if (f.subtitle) h += `<text x="${CX}" y="80" text-anchor="middle" ${FONT} font-size="16" fill="${P.mute}">${esc(f.subtitle)}</text>`;

  const step = niceStep(M), levels = [];
  for (let k = step; k < M - step * 0.4; k += step) levels.push(k);
  levels.push(M);                      // el borde exterior siempre es el máximo
  levels.forEach(k => { h += `<polygon points="${ring(k)}" fill="none" stroke="${P.line}" stroke-width="1.2"/>`; });
  for (let i = 0; i < N; i++) { const [x, y] = pt(i, R); h += `<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" stroke="${P.line}" stroke-width="1.2"/>`; }
  h += `<circle cx="${CX}" cy="${CY}" r="${RC}" fill="none" stroke="${P.ink}" stroke-width="3"/>`;

  const data = [...Array(N)].map((_, i) => pt(i, R * f.stats[i] / M));
  h += `<polygon points="${points(data)}" fill="${f.color}" fill-opacity=".5" stroke="${f.color}" stroke-width="3" stroke-linejoin="round"/>`;
  data.forEach(([x, y]) => h += `<circle cx="${x}" cy="${y}" r="4.5" fill="${f.color}"/>`);

  for (let i = 0; i < N; i++) {
    const [a, b] = pt(i, RC - 9), [c, d] = pt(i, RC + 9);
    h += `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${P.ink}" stroke-width="3"/>`;
    if (f.letters) {
      const [x, y] = pt(i, RC - 24);
      h += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" ${FONT} font-size="17" font-weight="900" fill="${f.color}">${esc(labelOf(f, f.stats[i]))}</text>`;
    }
    const [x, y] = pt(i, RC + 22), co = Math.cos(ang(i));
    const an = co > 0.3 ? "start" : co < -0.3 ? "end" : "middle";
    const dy = f.showValue ? -8 : 0;
    h += `<text x="${x}" y="${y + dy}" text-anchor="${an}" dominant-baseline="central" ${FONT} font-size="15" font-weight="700" fill="${P.ink}">${esc(f.names[i])}</text>`;
    if (f.showValue) h += `<text x="${x}" y="${y + 9}" text-anchor="${an}" dominant-baseline="central" ${FONT} font-size="13" fill="${P.mute}">${f.stats[i]}</text>`;
  }
  return h;
}

// SVG completo e independiente (para exportar).
const fichaToFile = f =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${G.W * 2}" height="${G.H * 2}" viewBox="0 0 ${G.W} ${G.H}">` +
  `<rect width="${G.W}" height="${G.H}" fill="${EXPORT_PAL.bg}"/>${fichaToSvg(f, EXPORT_PAL)}</svg>`;

/* =========================================================
   3. ALMACENAMIENTO (localStorage)
   ========================================================= */
const KEY = "stat-fichas";
let memory = [];
const store = {
  read() {
    try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v).map(migrate) : memory; }
    catch (e) { return memory; }
  },
  write(list) {
    memory = list;
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* sin espacio o bloqueado */ }
  }
};

/* =========================================================
   4. INTERFAZ
   ========================================================= */
const $ = id => document.getElementById(id);
let state = newFicha();
let fichas = store.read();

const say = m => { $("status").textContent = m; };
function livePal() {
  const s = getComputedStyle(document.documentElement), g = v => s.getPropertyValue(v).trim();
  return { ink: g("--ink"), mute: g("--mute"), line: g("--line") };
}
const draw = () => { $("chart").innerHTML = fichaToSvg(state, livePal()); };

function buildControls() {
  const box = $("controls"); box.innerHTML = "";
  for (let i = 0; i < state.n; i++) {
    const r = document.createElement("div"); r.className = "row";
    r.innerHTML = `<input type="text" value="${esc(state.names[i])}" maxlength="14"><input type="range" min="0" max="${state.max}" step="1" value="${state.stats[i]}"><input type="number" min="0" max="${state.max}" value="${state.stats[i]}">`;
    const [t, s, v] = r.children;
    t.oninput = () => { state.names[i] = t.value; draw(); };
    s.oninput = () => { state.stats[i] = +s.value; v.value = s.value; draw(); };
    v.oninput = () => { const x = clamp(Math.round(+v.value) || 0, 0, state.max); state.stats[i] = x; s.value = x; draw(); };
    v.onchange = () => { v.value = state.stats[i]; };
    box.appendChild(r);
  }
}

function buildRanks() {
  const box = $("ranks"); box.innerHTML = "";
  RANKS.forEach((r, k) => {
    const d = document.createElement("div"); d.className = "rk";
    d.innerHTML = `<span>${r}</span><input type="number" min="0" max="${state.max}" value="${state.th[k]}" ${k === 0 ? "disabled" : ""}>`;
    const inp = d.querySelector("input");
    inp.onchange = () => {
      const v = Math.max(0, Math.min(state.max, Math.round(+inp.value || 0)));
      state.th[k] = v;
      for (let j = k + 1; j < RANKS.length; j++) if (state.th[j] < v) state.th[j] = v;
      for (let j = k - 1; j > 0; j--) if (state.th[j] > v) state.th[j] = v;
      buildRanks(); draw();
    };
    box.appendChild(d);
  });
}

function renderList() {
  const l = $("list");
  if (!fichas.length) { l.innerHTML = '<span class="muted">Aún no tienes fichas guardadas.</span>'; return; }
  l.innerHTML = "";
  fichas.forEach(f => {
    const b = document.createElement("button");
    b.className = "chip" + (f.id === state.id ? " on" : "");
    b.innerHTML = `<span class="dot" style="background:${esc(f.id === state.id ? state.color : f.color)}"></span>${esc(f.name || "Sin nombre")}`;
    b.onclick = () => { state = migrate(f); syncAll(); say("Ficha abierta."); };
    l.appendChild(b);
  });
}

function syncAll() {
  $("cname").value = state.name; $("subtitle").value = state.subtitle;
  $("count").value = state.n; $("max").value = state.max;
  $("color").value = state.color; $("letters").checked = state.letters;
  $("showval").checked = state.showValue;
  buildControls(); buildRanks(); buildCustom(); setMode(); draw(); renderList();
}

/* --- eventos del formulario --- */
for (let k = 3; k <= 10; k++) $("count").add(new Option(k, k));
$("count").onchange = e => { state.n = +e.target.value; buildControls(); draw(); };
$("cname").oninput = e => { state.name = e.target.value; draw(); };
$("subtitle").oninput = e => { state.subtitle = e.target.value; draw(); };
$("color").oninput = e => { state.color = e.target.value; draw(); renderList(); };
$("letters").onchange = e => { state.letters = e.target.checked; draw(); };
$("showval").onchange = e => { state.showValue = e.target.checked; draw(); };
$("rand").onclick = () => { state.stats = state.stats.map(() => Math.floor(Math.random() * (state.max + 1))); buildControls(); draw(); };
$("reset").onclick = () => { state.stats = state.stats.map(() => Math.ceil(state.max / 2)); buildControls(); draw(); };
$("auto").onclick = () => { state.th = autoTh(state.max); buildRanks(); draw(); };
$("max").onchange = e => {
  const M = clamp(Math.round(+e.target.value) || 10, 3, MAX_SCALE);
  state.max = M; e.target.value = M;
  state.stats = state.stats.map(v => Math.min(v, M));
  state.th = autoTh(M);
  buildControls(); buildRanks(); draw();
};

/* --- rangos: panel personalizado --- */
function setMode() {
  const c = state.rankMode === "custom";
  $("panel-letters").hidden = c; $("panel-custom").hidden = !c;
  $("tab-letters").classList.toggle("on", !c); $("tab-custom").classList.toggle("on", c);
}
$("tab-letters").onclick = () => { state.rankMode = "letters"; setMode(); draw(); };
$("tab-custom").onclick = () => { state.rankMode = "custom"; setMode(); draw(); };

function buildCustom() {
  const box = $("crows"); box.innerHTML = "";
  state.custom.forEach((r, k) => {
    const d = document.createElement("div"); d.className = "crow";
    d.innerHTML = `<span>Desde</span><input type="number" min="0" max="${state.max}" value="${r.min}" ${k === 0 ? "disabled" : ""}><span>Etiqueta</span><input type="text" maxlength="6" value="${esc(r.label)}">${k === 0 ? "<span></span>" : '<button class="danger" title="Quitar fila">✕</button>'}`;
    const [, mi, , la, x] = d.children;
    mi.onchange = () => { r.min = clamp(Math.round(+mi.value) || 1, 1, state.max); state.custom.sort((a, b) => a.min - b.min); buildCustom(); draw(); };
    la.oninput = () => { r.label = la.value; draw(); };
    if (k > 0) x.onclick = () => { state.custom.splice(k, 1); buildCustom(); draw(); };
    box.appendChild(d);
  });
}
$("cadd").onclick = () => {
  if (state.custom.length >= 50) return;
  const last = state.custom[state.custom.length - 1];
  state.custom.push({ min: Math.min(state.max, last.min + Math.max(1, Math.round(state.max / 10))), label: "" });
  buildCustom(); draw();
};
// Plantilla D&D: modificador = floor((valor - 10) / 2), de -5 (valor 0) a +10 (valor 30).
$("cdnd").onclick = () => {
  if (!confirm("Esto reemplaza nombres, valores, escala y rangos de la ficha actual. ¿Continuar?")) return;
  state.n = 6; state.max = 30;
  ["Fuerza","Destreza","Constitución","Inteligencia","Sabiduría","Carisma"].forEach((n, i) => { state.names[i] = n; });
  [15, 14, 13, 12, 10, 8].forEach((v, i) => { state.stats[i] = v; });
  state.custom = [...Array(16)].map((_, i) => { const m = i - 5; return { min: i * 2, label: (m >= 0 ? "+" : "") + m }; });
  state.th = autoTh(30);
  state.rankMode = "custom"; state.showValue = true; state.letters = true;
  syncAll(); say("Plantilla D&D aplicada.");
};

/* --- fichas --- */
$("new").onclick = () => { state = newFicha(); syncAll(); say("Ficha nueva."); };
$("save").onclick = () => {
  state.id = state.id || "f" + Date.now().toString(36);
  const data = { ...JSON.parse(JSON.stringify(state)), updated: Date.now() };
  fichas = [data, ...fichas.filter(x => x.id !== state.id)];
  store.write(fichas); renderList(); say("Ficha guardada.");
};
$("del").onclick = () => {
  if (!state.id) { say("Esta ficha aún no está guardada."); return; }
  if (!confirm("¿Borrar esta ficha?")) return;
  fichas = fichas.filter(x => x.id !== state.id);
  store.write(fichas); state = newFicha(); syncAll(); say("Ficha borrada.");
};

/* --- descarga --- */
function saveFile(filename, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$("dl").onclick = async () => {
  const name = (state.name || "ficha").toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, "-").replace(/^-|-$/g, "") || "ficha";
  const svg = fichaToFile(state);
  try {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
    const cv = document.createElement("canvas"); cv.width = G.W * 2; cv.height = G.H * 2;
    cv.getContext("2d").drawImage(img, 0, 0);
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    if (!blob) throw new Error("png");
    saveFile(name + ".png", blob); say("Imagen descargada.");
  } catch (e) {
    saveFile(name + ".svg", new Blob([svg], { type: "image/svg+xml" }));
    say("No se pudo generar PNG; se descargó SVG.");
  }
};

syncAll();
