const $ = id => document.getElementById(id);
const names = { inicio: "Inicio", panel: "Panel", analizar: "Analizador", resultado: "Resultado", asistente: "Asistente", guias: "Centro de prevención" };
const risks = { bajo: "Bajo", medio: "Medio", alto: "Alto" };
const prize = "¡Felicidades! Ganaste S/ 5,000. Deposita S/ 50 para liberar tu premio";
const job = "Vacante de auxiliar. Paga S/ 30 por inscripción para continuar con el proceso";
const questions = [
  "¿Cómo verifico un mensaje sospechoso?",
  "¿Qué hago si recibí un comprobante sospechoso?",
  "¿Cómo identifico una oferta laboral fraudulenta?",
  "¿Qué hago si compartí mis datos?",
];
const guides = [
  ["Suplantación bancaria", "«Tu cuenta será bloqueada. Entra al enlace y actualiza tu clave».", ["Amenaza de bloqueo inmediato", "Solicitud de claves o códigos"], "Abre la aplicación bancaria directamente o llama al número oficial que ya conoces."],
  ["Falsos familiares", "«Cambié de número y necesito que me prestes dinero hoy».", ["Número desconocido", "Presión para transferir rápido"], "Llama a la persona por su número habitual o confirma por otro medio antes de transferir."],
  ["Comprobantes adulterados", "Un cliente muestra una captura con importes distintos para la misma operación.", ["Datos o importes contradictorios", "Presión para entregar el producto"], "Abre tu aplicación bancaria y comprueba el abono antes de entregar."],
  ["Falsas ofertas laborales", "«Paga S/ 30 por inscripción para que podamos agendar tu entrevista».", ["Cobro por participar", "Empleador difícil de verificar"], "Busca a la empresa y confirma la vacante por su canal oficial antes de compartir datos."],
  ["Premios y sorteos falsos", "«Ganaste un premio. Deposita S/ 50 para recibirlo».", ["Premio inesperado", "Pago adelantado"], "Evita depositar y verifica el sorteo por un canal oficial que tú mismo busques."],
  ["Compras por redes sociales", "«Envía el adelanto ahora o perderás esta oferta».", ["Precio inusualmente bajo", "Urgencia y pago fuera de la plataforma"], "Revisa la reputación del vendedor y utiliza los canales de pago y protección de la plataforma."],
];
const state = { page: "inicio", kind: "texto", file: null, preview: null, result: null, busy: false, chatting: false, messages: [] };
const storageKey = "pilas-session-v1";
const emptyStats = () => ({ counts: { bajo: 0, medio: 0, alto: 0 }, elapsed: 0, recent: [] });
let stats = emptyStats();
try {
  stats = JSON.parse(sessionStorage.getItem(storageKey)) || stats;
} catch {
  // El panel sigue funcionando en memoria.
}

function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}

function button(text, onClick, className = "sample") {
  const item = node("button", text, className);
  item.type = "button";
  item.addEventListener("click", onClick);
  return item;
}

function showError(id, message = "") {
  $(id).textContent = message;
  $(id).hidden = !message;
}

async function api(path, options) {
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new Error("No se pudo conectar con PILAS. Inténtalo de nuevo.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    throw new Error(body?.error?.mensaje || "El servicio no pudo completar la solicitud. Inténtalo de nuevo.");
  }
  return body;
}

function json(data) {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}

function route() {
  const [requested, kind] = location.hash.slice(1).split("/");
  const page = Object.hasOwn(names, requested) ? requested : "inicio";
  state.page = page === "resultado" && !state.result ? "analizar" : page;
  state.kind = kind === "imagen" ? "imagen" : "texto";
  for (const section of document.querySelectorAll("[data-page]")) section.hidden = section.dataset.page !== state.page;
  for (const link of document.querySelectorAll("[data-nav]")) {
    if (link.dataset.nav === (state.page === "resultado" ? "analizar" : state.page)) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  $("page-name").textContent = names[state.page];
  if (state.page === "analizar") renderAnalyzer();
  if (state.page === "panel") renderPanel();
  if (state.page === "resultado") renderResult();
}

function renderAnalyzer() {
  const image = state.kind === "imagen";
  $("text-form").hidden = image;
  $("image-form").hidden = !image;
  for (const link of document.querySelectorAll("[data-kind]")) {
    if (link.dataset.kind === state.kind) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  showError("analysis-error");
  const samples = $("sample-actions");
  samples.replaceChildren();
  if (image) {
    samples.append(button("Cargar comprobante ficticio", async () => {
      try {
        const result = await fetch("/api/demo/comprobante");
        if (!result.ok) throw new Error();
        chooseFile(new File([await result.blob()], "comprobante-ficticio.png", { type: "image/png" }));
      } catch {
        showError("analysis-error", "No se pudo cargar el comprobante de demostración.");
      }
    }));
  } else {
    for (const [label, value] of [["Premio falso", prize], ["Oferta laboral falsa", job]]) {
      samples.append(button(label, () => {
        $("message-input").value = value;
        updateCharacters();
        $("message-input").focus();
      }));
    }
  }
}

function updateCharacters() {
  $("characters").textContent = `${$("message-input").value.length.toLocaleString("es-PE")} / 5.000`;
}

function chooseFile(file) {
  if (state.preview) URL.revokeObjectURL(state.preview);
  state.file = null;
  state.preview = null;
  $("preview-img").removeAttribute("src");
  $("file-preview").hidden = true;
  showError("analysis-error");
  if (!file) return;
  if ((!["image/png", "image/jpeg"].includes(file.type) && (file.type || !/\.(png|jpe?g)$/i.test(file.name))) || file.size > 4 * 1024 * 1024) {
    $("file-input").value = "";
    showError("analysis-error", "Selecciona una imagen JPG o PNG de hasta 4 MiB.");
    return;
  }
  state.file = file;
  state.preview = URL.createObjectURL(file);
  $("preview-img").src = state.preview;
  $("file-name").textContent = file.name;
  $("file-preview").hidden = false;
}

async function analyze(kind, options) {
  if (state.busy) return;
  state.busy = true;
  $("analysis-status").hidden = false;
  showError("analysis-error");
  const buttons = document.querySelectorAll(".analysis-form button[type=submit]");
  buttons.forEach(item => { item.disabled = true; });
  const started = performance.now();
  try {
    const result = await api(`/api/analisis/${kind}`, options);
    state.result = result;
    stats.counts[result.riesgo] += 1;
    stats.elapsed += performance.now() - started;
    stats.recent.unshift({ tipo: result.tipo, riesgo: result.riesgo, modo: result.modo, hora: Date.now() });
    stats.recent = stats.recent.slice(0, 5);
    try { sessionStorage.setItem(storageKey, JSON.stringify(stats)); } catch { /* Solo metadatos. */ }
    if (state.page === "analizar") location.hash = "resultado";
    if (state.page === "panel") renderPanel();
  } catch (error) {
    showError("analysis-error", error.message);
  } finally {
    state.busy = false;
    $("analysis-status").hidden = true;
    buttons.forEach(item => { item.disabled = false; });
  }
}

function badge(risk) {
  return node("span", `Riesgo ${risks[risk].toLowerCase()}`, `badge ${risk}`);
}

function renderPanel() {
  const total = Object.values(stats.counts).reduce((sum, count) => sum + count, 0);
  $("total-count").textContent = total;
  $("high-count").textContent = stats.counts.alto;
  $("average-time").textContent = total ? `${(stats.elapsed / total / 1000).toFixed(1)} s` : "—";
  $("risk-distribution").replaceChildren(...Object.entries(risks).map(([risk, label]) => {
    const row = node("div", undefined, "risk-row");
    const progress = node("progress");
    progress.max = total || 1;
    progress.value = stats.counts[risk];
    progress.setAttribute("aria-label", label);
    row.append(node("span", label), progress, node("b", stats.counts[risk]));
    return row;
  }));
  $("recent-analyses").replaceChildren(...(stats.recent.length ? stats.recent.map(item => {
    const row = node("div", undefined, "recent-row");
    const details = node("div");
    const time = new Date(item.hora).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    details.append(node("strong", item.tipo === "texto" ? "Mensaje" : "Imagen"), node("small", `${time} · ${item.modo === "demo" ? "Simulación" : "Gemini"}`));
    row.append(details, badge(item.riesgo));
    return row;
  }) : [node("p", "Tus análisis aparecerán aquí.", "empty")]));
}

function renderResult() {
  const result = state.result;
  const banner = node("article", undefined, "surface result-banner");
  const meter = node("div", undefined, "risk-meter");
  meter.setAttribute("aria-hidden", "true");
  meter.append(...Object.keys(risks).map(risk => node("i", undefined, risk === result.riesgo ? `active ${risk}` : risk)));
  banner.append(badge(result.riesgo), meter, node("p", result.modo === "demo" ? "Simulación con un caso ficticio." : "Evaluación preventiva del contenido recibido."));
  const details = node("div", undefined, "results-grid");
  const signals = node("article", undefined, "surface");
  signals.append(node("h2", "Señales detectadas"));
  const list = node("ul", undefined, "signal-list");
  for (const signal of result.senales) {
    const item = node("li");
    item.append(node("strong", signal.titulo), node("p", signal.explicacion));
    list.append(item);
  }
  signals.append(list.childElementCount ? list : node("p", "Se observaron pocas señales en el contenido."));
  const recommendation = node("article", undefined, "surface recommendation");
  recommendation.append(node("h2", "Qué puedes hacer"), node("p", result.recomendacion));
  details.append(signals, recommendation);
  const limitations = node("ul", undefined, "limitations");
  limitations.append(...result.limitaciones.map(text => node("li", text)));
  const again = node("a", "Realizar otro análisis", "button");
  again.href = `#analizar/${result.tipo}`;
  again.addEventListener("click", () => {
    $("message-input").value = "";
    $("file-input").value = "";
    chooseFile(null);
    updateCharacters();
  });
  $("result-content").replaceChildren(banner, details, limitations, again);
}

async function ask(question) {
  if (state.chatting || !question.trim()) return;
  state.chatting = true;
  $("chat-status").hidden = false;
  $("chat-form").querySelector("button").disabled = true;
  showError("chat-error");
  const bubble = node("p", question, "user-bubble");
  $("chat-log").append(bubble);
  try {
    const result = await api("/api/asistente", json({ pregunta: question, historial: state.messages.slice(-8) }));
    state.messages.push({ rol: "usuario", texto: question }, { rol: "asistente", texto: result.respuesta });
    state.messages = state.messages.slice(-8);
    $("chat-log").append(node("p", result.respuesta, "assistant-bubble"));
    $("chat-input").value = "";
    $("chat-log").scrollTop = $("chat-log").scrollHeight;
  } catch (error) {
    bubble.remove();
    showError("chat-error", error.message);
  } finally {
    state.chatting = false;
    $("chat-status").hidden = true;
    $("chat-form").querySelector("button").disabled = false;
  }
}

for (const question of questions) $("suggestions").append(button(question, () => ask(question)));
for (const [title, example, signals, action] of guides) {
  const card = node("article", undefined, "surface guide-card");
  const detail = node("details");
  const list = node("ul");
  list.append(...signals.map(signal => node("li", signal)));
  detail.append(node("summary", "Ver señales y recomendaciones"), node("p", `Ejemplo ficticio. ${example}`), list, node("p", action));
  card.append(node("h2", title), detail);
  $("guide-grid").append(card);
}

$("message-input").addEventListener("input", updateCharacters);
$("file-input").addEventListener("change", event => chooseFile(event.target.files[0]));
$("remove-file").addEventListener("click", () => { $("file-input").value = ""; chooseFile(null); });
const dropzone = $("dropzone");
dropzone.addEventListener("dragover", event => { event.preventDefault(); dropzone.classList.add("dragging"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
dropzone.addEventListener("drop", event => {
  event.preventDefault();
  dropzone.classList.remove("dragging");
  chooseFile(event.dataTransfer.files[0]);
});
$("text-form").addEventListener("submit", event => {
  event.preventDefault();
  const text = $("message-input").value.trim();
  if (!text) return showError("analysis-error", "Pega un mensaje para analizarlo.");
  analyze("texto", json({ texto: text }));
});
$("image-form").addEventListener("submit", event => {
  event.preventDefault();
  if (!state.file) return showError("analysis-error", "Selecciona una imagen para analizarla.");
  const body = new FormData();
  body.append("imagen", state.file);
  analyze("imagen", { method: "POST", body });
});
$("chat-form").addEventListener("submit", event => { event.preventDefault(); ask($("chat-input").value.trim()); });
document.querySelector(".skip").addEventListener("click", event => { event.preventDefault(); $("contenido").focus(); });
window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); $("contenido").focus({ preventScroll: true }); });
route();
api("/api/salud").then(result => {
  const real = result.modo === "real";
  $("connection").dataset.state = result.modo;
  $("connection").querySelector("b").textContent = real ? "Gemini · Modo real" : "Modo demo";
  $("chat-mode").textContent = real ? "Asistencia con Gemini" : "Simulación con preguntas de ejemplo";
}).catch(() => {
  $("connection").dataset.state = "offline";
  $("connection").querySelector("b").textContent = "Sin conexión";
});
