import { analyze, demoReceipt, imagePreview } from "./analysis.js";
import { examples, guidance, guides, receiptAdvice, risks } from "./content.js";

const byId = id => document.getElementById(id);
const form = byId("analysis-form");
const message = byId("message");
const imageInput = byId("image");
const settings = byId("settings");
const apiBase = document.querySelector('meta[name="pilas-api"]').content.trim().replace(/\/+$/, "");
const pages = [...document.querySelectorAll(".page")];
const session = [];
let mode = "demo";
let result;
let image;
let previewUrl;
let imageVersion = 0;
let preparingImage = false;
let pending;
let activePage;

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function route() {
  const requested = location.hash.slice(1);
  if (requested === "contenido" && activePage) return;
  const page = pages.find(section => section.id === requested);
  const next = page && (requested !== "resultado" || result) ? page.id : "inicio";
  if (activePage === next) return;
  if (activePage === "analizar" && pending) {
    pending.abort();
    pending = undefined;
    setBusy(false);
  }
  for (const section of pages) section.hidden = section.id !== next;
  for (const link of document.querySelectorAll("nav a")) {
    if (link.hash === "#" + (next === "resultado" ? "analizar" : next)) {
      link.setAttribute("aria-current", "page");
    } else link.removeAttribute("aria-current");
  }
  if (next === "panel") renderPanel();
  if (activePage) {
    byId(next).querySelector("h1").focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  activePage = next;
}

function showError(message = "") {
  const error = byId("form-error");
  error.textContent = message;
  error.hidden = !message;
}

function selectedType() {
  return form.elements.tipo.value;
}

function showType(type) {
  form.elements.tipo.value = type;
  byId("text-fields").hidden = type !== "texto";
  byId("image-fields").hidden = type !== "imagen";
  showError();
  updateSubmit();
}

function clearImage() {
  imageVersion += 1;
  preparingImage = false;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  image = undefined;
  imageInput.value = "";
  byId("preview-image").removeAttribute("src");
  byId("preview").hidden = true;
  updateSubmit();
}

async function loadImage(getFile) {
  clearImage();
  showError();
  const version = imageVersion;
  preparingImage = true;
  updateSubmit();
  try {
    const file = await getFile();
    const url = await imagePreview(file);
    if (version !== imageVersion) {
      URL.revokeObjectURL(url);
      return;
    }
    image = file;
    previewUrl = url;
    byId("preview-image").src = url;
    byId("preview").hidden = false;
  } catch (error) {
    if (version === imageVersion && selectedType() === "imagen") showError(error.message);
  } finally {
    if (version === imageVersion) {
      preparingImage = false;
      updateSubmit();
    }
  }
}

function updateSubmit() {
  byId("submit").disabled = Boolean(pending || (preparingImage && selectedType() === "imagen"));
}

function setBusy(busy) {
  byId("input-fields").disabled = busy;
  byId("mode").disabled = busy;
  for (const button of byId("examples").querySelectorAll("button")) button.disabled = busy;
  byId("form-status").textContent = busy ? "Analizando contenido…" : "";
  byId("submit").textContent = busy ? "Analizando…" : "Analizar contenido ↗";
  updateSubmit();
}

function setMode(next) {
  mode = next;
  byId("mode").innerHTML = mode === "demo"
    ? 'Simulación <span aria-hidden="true">⌄</span>'
    : 'Modo API <span aria-hidden="true">⌄</span>';
  showError();
}

function makeRiskBadge(risk) {
  return element("span", risks[risk].label, "badge risk-" + risk);
}

function makeCard(title, body, className = "card") {
  const card = element("section", undefined, className);
  card.append(element("h2", title), body);
  return card;
}

function renderResult(data) {
  result = data;
  const stack = element("div", undefined, "result-stack");
  const overview = element("div", undefined, "card");
  const traffic = element("span", undefined, "traffic");
  traffic.setAttribute("aria-hidden", "true");
  for (const [risk, definition] of Object.entries(risks)) {
    const light = element("span");
    light.style.setProperty("--indicator", definition.color);
    light.classList.toggle("active", risk === data.riesgo);
    traffic.append(light);
  }
  overview.append(traffic, makeRiskBadge(data.riesgo));
  if (data.modo === "demo") overview.append(" ", element("span", "Simulación", "badge"));
  const summary = element("p", risks[data.riesgo].summary);
  summary.style.marginTop = ".8rem";
  overview.append(summary);
  stack.append(overview);

  const list = element("ul");
  for (const signal of data.senales) {
    const item = element("li");
    item.append(element("strong", signal.titulo), element("div", signal.explicacion));
    list.append(item);
  }
  stack.append(makeCard("Señales observadas", data.senales.length ? list : element("p", "No se identificaron señales específicas en el contenido recibido.")));
  stack.append(makeCard("Qué hacer ahora", element("p", data.recomendacion), "card tip"));
  if (data.tipo === "imagen" && data.recomendacion !== receiptAdvice) {
    stack.append(makeCard("Si la imagen es un comprobante", element("p", receiptAdvice), "card tip"));
  }
  const limits = element("ul");
  for (const limit of data.limitaciones) limits.append(element("li", limit));
  limits.append(element("li", "La evaluación se basa en el contenido recibido y no confirma por sí sola que haya ocurrido un fraude."));
  stack.append(makeCard("Limitaciones", limits));
  byId("result-content").replaceChildren(stack);
}

function renderPanel() {
  const stats = byId("stats");
  stats.replaceChildren();
  const counts = [
    ["Total de análisis", session.length],
    ...Object.entries(risks).map(([key, { label }]) => [label, session.filter(item => item.data.riesgo === key).length, key]),
  ];
  for (const [label, count, risk] of counts) {
    const card = element("div", undefined, "card stat");
    card.append(risk ? makeRiskBadge(risk) : element("span", label), element("strong", count));
    stats.append(card);
  }
  byId("empty-history").hidden = session.length > 0;
  const recent = byId("recent");
  recent.replaceChildren();
  for (const { data, time } of session.slice(0, 6)) {
    const text = data.tipo === "imagen" ? "Imagen" : "Mensaje";
    const date = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" }).format(time);
    const item = element("li");
    const button = element("button");
    button.type = "button";
    button.append(element("span", text + " · " + date + (data.modo === "demo" ? " · Simulación" : "")), makeRiskBadge(data.riesgo));
    button.addEventListener("click", () => {
      renderResult(data);
      location.hash = "resultado";
    });
    item.append(button);
    recent.append(item);
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (pending || preparingImage && selectedType() === "imagen") return;
  showError();
  const type = selectedType();
  const value = type === "texto" ? message.value.trim() : image;
  if (!value || type === "texto" && value.length > 5000) {
    showError(type === "texto" ? "Pega un mensaje de 1 a 5.000 caracteres." : "Adjunta una imagen JPG, JPEG o PNG.");
    (type === "texto" ? message : imageInput).focus();
    return;
  }

  const request = new AbortController();
  pending = request;
  setBusy(true);
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
    const data = await analyze({ mode, type, value, apiBase, signal });
    if (request.signal.aborted) return;
    session.unshift({ data, time: new Date() });
    renderResult(data);
    message.value = "";
    clearImage();
    location.hash = "resultado";
  } catch (error) {
    if (!request.signal.aborted) showError(error.message);
  } finally {
    if (pending === request) {
      pending = undefined;
      setBusy(false);
    }
  }
});

form.addEventListener("change", event => {
  if (event.target.name === "tipo") showType(selectedType());
});
message.addEventListener("input", () => showError());
imageInput.addEventListener("change", () => {
  const [file] = imageInput.files;
  if (file) void loadImage(() => file);
});
byId("change-image").addEventListener("click", () => imageInput.click());
byId("remove-image").addEventListener("click", () => {
  clearImage();
  showError();
  imageInput.focus();
});
for (const link of document.querySelectorAll("[data-type]")) {
  link.addEventListener("click", () => showType(link.dataset.type));
}
for (const button of document.querySelectorAll("[data-example]")) {
  button.addEventListener("click", () => {
    const key = button.dataset.example;
    setMode("demo");
    showType(key === "pago" ? "imagen" : "texto");
    if (key === "pago") {
      void loadImage(demoReceipt);
      imageInput.focus();
    } else {
      message.value = examples[key].texto;
      message.focus();
    }
  });
}
byId("new-analysis").addEventListener("click", () => {
  message.value = "";
  clearImage();
  showType("texto");
  location.hash = "analizar";
});
byId("mode").addEventListener("click", () => {
  settings.returnValue = "";
  settings.querySelector("form").elements.modo.value = mode;
  settings.showModal();
});
settings.addEventListener("close", () => {
  if (settings.returnValue === "save") setMode(settings.querySelector("form").elements.modo.value);
});

const question = byId("question");
function answer(value) {
  const target = byId("assistant-answer");
  target.hidden = false;
  target.textContent = value;
}
for (const button of document.querySelectorAll("[data-question]")) {
  button.addEventListener("click", () => answer(guidance[button.dataset.question]));
}
byId("assistant-form").addEventListener("submit", event => {
  event.preventDefault();
  const value = question.value.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (!value) {
    answer("Escribe una consulta o elige uno de los temas sugeridos.");
    return;
  }
  const topics = [
    ["datos", /(?:comparti|envie|entregue|di mis|ingrese|publique|revele).*(?:datos|clave|codigo|tarjeta|contrasena)|me robaron/],
    ["transferencia", /transfer|comprobante|captura|yape|plin|abono|deposit/],
    ["oferta", /oferta|vacante|empleo|trabajo|compra|vendedor/],
    ["mensaje", /mensaje|sms|whatsapp|correo|enlace|premio|familiar|banco/],
  ];
  const match = topics.find(([, pattern]) => pattern.test(value));
  answer(match ? guidance[match[0]] : "Puedo orientarte sobre mensajes, transferencias, ofertas o datos que ya compartiste. Elige un tema de arriba o agrega un poco más de contexto sin incluir datos personales.");
  question.value = "";
});

for (const [title, example, alert, recommendation] of guides) {
  const card = element("article", undefined, "card");
  card.append(
    element("p", "EJEMPLO FICTICIO", "kicker"),
    element("h3", title),
    element("p", example),
    element("p", alert),
    element("p", recommendation),
  );
  byId("guides").append(card);
}
window.addEventListener("hashchange", route);
route();
