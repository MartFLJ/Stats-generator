"use strict";

/* =========================================================
   1. MODELO: la ficha y sus reglas (sin DOM)
   ========================================================= */
const VERSION = 2;
const DEF_NAMES = ["Poder","Velocidad","Alcance","Precisión","Resistencia","Potencial","Agilidad","Inteligencia","Suerte","Carisma"];
const RANKS = ["E","D","C","B","A","S","S+"];

// Valor mínimo de cada letra repartido de forma pareja entre 0 y max.
const autoTh = M => RANKS.map((_, k) => Math.round(k * M / 6));

const newFicha = () => ({
  v: VERSION, id: null,
  name: "Nuevo personaje", subtitle: "",
  n: 6, names: [...DEF_NAMES],
  max: 10, stats: [10,8,6,8,4,10,6,8,4,6], th: autoTh(10),
  color: "#e0457b", letters: true
});

// Convierte fichas guardadas con formatos anteriores al formato actual.
function migrate(raw) {
  const f = { ...newFicha(), ...JSON.parse(JSON.stringify(raw)) };
  if (!raw.v) {                       // v1: escala desde 1, sin subtítulo
    if (!raw.max) { f.max = 5; f.th = autoTh(5); }
    f.th[0] = 0;                      // ahora E empieza en 0
  }
  delete f.stand;
  f.v = VERSION;
  return f;
}

function rankOf(f, v) {
  let r = 0;
  f.th.forEach((t, k) => { if (v >= t) r = k; });
  return RANKS[r];
}

/* =========================================================
   2. DIBUJO: ficha -> SVG (función pura, reutilizable)
   ========================================================= */
const G = { W: 640, H: 480, CX: 320, CY: 270, R: 115, RC: 155 };
const EXPORT_PAL = { bg: "#f6f4ef", ink: "#1d1b20", mute: "#77737d", line: "#cfcac0" };
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

  const step = Math.ceil(M / 10);
  for (let k = step; k <= M; k += step) h += `<polygon points="${ring(k)}" fill="none" stroke="${P.line}" stroke-width="1.2"/>`;
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
      h += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" ${FONT} font-size="17" font-weight="900" fill="${f.color}">${rankOf(f, f.stats[i])}</text>`;
    }
    const [x, y] = pt(i, RC + 22), co = Math.cos(ang(i));
    const an = co > 0.3 ? "start" : co < -0.3 ? "end" : "middle";
    h += `<text x="${x}" y="${y}" text-anchor="${an}" dominant-baseline="central" ${FONT} font-size="15" font-weight="700" fill="${P.ink}">${esc(f.names[i])}</text>`;
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
    r.innerHTML = `<input type="text" value="${esc(state.names[i])}" maxlength="14"><input type="range" min="0" max="${state.max}" step="1" value="${state.stats[i]}"><span class="val">${state.stats[i]}</span>`;
    const [t, s, v] = r.children;
    t.oninput = () => { state.names[i] = t.value; draw(); };
    s.oninput = () => { state.stats[i] = +s.value; v.textContent = s.value; draw(); };
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
  buildControls(); buildRanks(); draw(); renderList();
}

/* --- eventos del formulario --- */
for (let k = 3; k <= 10; k++) $("count").add(new Option(k, k));
$("count").onchange = e => { state.n = +e.target.value; buildControls(); draw(); };
$("cname").oninput = e => { state.name = e.target.value; draw(); };
$("subtitle").oninput = e => { state.subtitle = e.target.value; draw(); };
$("color").oninput = e => { state.color = e.target.value; draw(); renderList(); };
$("letters").onchange = e => { state.letters = e.target.checked; draw(); };
$("rand").onclick = () => { state.stats = state.stats.map(() => Math.floor(Math.random() * (state.max + 1))); buildControls(); draw(); };
$("reset").onclick = () => { state.stats = state.stats.map(() => Math.ceil(state.max / 2)); buildControls(); draw(); };
$("auto").onclick = () => { state.th = autoTh(state.max); buildRanks(); draw(); };
$("max").onchange = e => {
  const M = Math.max(3, Math.min(20, Math.round(+e.target.value || 10)));
  state.max = M; e.target.value = M;
  state.stats = state.stats.map(v => Math.min(v, M));
  state.th = autoTh(M);
  buildControls(); buildRanks(); draw();
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
