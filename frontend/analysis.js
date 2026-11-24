import { examples, risks } from "./content.js";

let receiptBytes;

async function getReceiptBytes() {
  if (!receiptBytes) {
    const { default: base64 } = await import("./demo-receipt.js");
    receiptBytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  }
  return receiptBytes;
}

export async function demoReceipt() {
  return new File([await getReceiptBytes()], "comprobante-ficticio.png", { type: "image/png" });
}

export async function imagePreview(file) {
  const expected = {
    "image/jpeg": [0xff, 0xd8, 0xff],
    "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  }[file.type];
  if (!expected || !/\.(jpe?g|png)$/i.test(file.name)) {
    throw new Error("Selecciona un archivo JPG, JPEG o PNG.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("La imagen debe pesar 5 MiB o menos.");
  }
  const signature = new Uint8Array(await file.slice(0, expected.length).arrayBuffer());
  if (!expected.every((byte, index) => signature[index] === byte)) {
    throw new Error("El archivo no parece ser una imagen JPG o PNG válida. Selecciona otra captura.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error("No se pudo abrir la imagen. Adjunta una captura más clara en JPG o PNG.");
    });
    if (image.naturalWidth * image.naturalHeight > 20_000_000) {
      throw new Error("La imagen debe tener hasta 20 megapíxeles.");
    }
    return url;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

const normalize = value => value.toLowerCase().trim().replace(/\s+/g, " ").replace(/\.+$/, "");

async function simulate(type, value) {
  let example;
  if (type === "texto") {
    example = [examples.premio, examples.empleo].find(item => normalize(item.texto) === normalize(value));
  } else {
    const original = await getReceiptBytes();
    const received = new Uint8Array(await value.arrayBuffer());
    if (original.length === received.length && original.every((byte, index) => byte === received[index])) {
      example = examples.pago;
    }
  }
  if (!example) {
    throw new Error("La simulación admite los tres casos ficticios de esta página. Selecciona un ejemplo o cambia al modo API.");
  }
  return {
    tipo: type,
    modo: "demo",
    riesgo: "alto",
    senales: example.signals.map(([titulo, explicacion]) => ({ titulo, explicacion })),
    recomendacion: example.recommendation,
    limitaciones: ["Simulación con un caso ficticio. El resultado de demo es predefinido."],
  };
}

function isResult(payload, type) {
  const isText = value => typeof value === "string" && value.trim().length > 0;
  return payload?.tipo === type
    && ["real", "demo"].includes(payload.modo)
    && Object.hasOwn(risks, payload.riesgo)
    && Array.isArray(payload.senales)
    && payload.senales.every(signal => isText(signal?.titulo) && isText(signal?.explicacion))
    && isText(payload.recomendacion)
    && Array.isArray(payload.limitaciones)
    && payload.limitaciones.every(isText);
}

export async function analyze({ mode, type, value, apiBase, signal }) {
  if (mode === "demo") return simulate(type, value);

  const request = type === "texto"
    ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: value }) }
    : { body: new FormData() };
  if (type === "imagen") request.body.append("imagen", value);

  let response;
  let payload;
  try {
    response = await fetch(`${apiBase}/api/analisis/${type}`, { method: "POST", ...request, signal });
    payload = await response.json().catch(error => {
      if (!(error instanceof SyntaxError)) throw error;
      return null;
    });
  } catch (error) {
    if (signal?.reason?.name === "TimeoutError") {
      throw new Error("El servicio tardó demasiado. Puedes reintentar o probar un caso ficticio.");
    }
    if (signal?.aborted) throw error;
    throw new Error("No pudimos conectar con el servicio. Puedes reintentar o probar un caso ficticio.");
  }

  if (!response.ok) {
    if (payload?.error?.codigo === "imagen_ilegible") {
      throw new Error("La imagen no se pudo leer. Adjunta una captura más clara y vuelve a intentarlo.");
    }
    const message = payload?.error?.mensaje;
    const fallback = response.status >= 500
      ? "El servicio no está disponible. Puedes reintentar o probar un caso ficticio."
      : "El servicio rechazó la solicitud. Revisa el contenido y vuelve a intentarlo.";
    throw new Error(typeof message === "string" && message.trim() ? message : fallback);
  }
  if (!isResult(payload, type)) {
    throw new Error("El servicio devolvió una respuesta incompleta. Vuelve a intentarlo.");
  }
  return payload;
}
