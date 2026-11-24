export const receiptAdvice = "Una captura de pantalla no demuestra que el dinero haya llegado a tu cuenta. Verifica el abono directamente en tu aplicación bancaria oficial.";

export const examples = {
  premio: {
    texto: "¡Felicidades! Ganaste S/ 5,000. Deposita S/ 50 para liberar tu premio",
    signals: [
      ["Premio inesperado", "El mensaje anuncia un premio sin aportar información verificable."],
      ["Pago por adelantado", "Pide depositar S/ 50 para liberar el premio."],
    ],
    recommendation: "Evita el depósito y verifica el supuesto sorteo por un canal oficial que tú mismo busques.",
  },
  empleo: {
    texto: "Vacante de auxiliar. Paga S/ 30 por inscripción para continuar con el proceso",
    signals: [
      ["Cobro por inscripción", "La oferta exige S/ 30 para continuar con el proceso."],
      ["Empleador sin verificar", "El mensaje no aporta detalles para confirmar quién ofrece la vacante."],
    ],
    recommendation: "Evita hacer el pago y verifica la identidad del empleador por un canal independiente.",
  },
  pago: {
    signals: [["Importes distintos", "El ejemplo muestra S/ 80,00 como monto y S/ 8,00 como total transferido."]],
    recommendation: receiptAdvice,
  },
};

export const risks = {
  bajo: { label: "Riesgo bajo", color: "#369264", summary: "Se observaron pocas señales. Aplica las verificaciones habituales antes de actuar." },
  medio: { label: "Riesgo medio", color: "#b37b12", summary: "Se observaron señales que conviene verificar antes de actuar." },
  alto: { label: "Riesgo alto", color: "#c24452", summary: "Se observaron señales importantes de posible fraude." },
};

export const guidance = {
  mensaje: "Evita usar enlaces o teléfonos del mensaje. Abre la app o el sitio oficial por tu cuenta y consulta por sus canales de atención. Si el mensaje aparenta venir de un conocido, llámalo a su número habitual.",
  transferencia: receiptAdvice + " Confirma el monto y el movimiento recibido antes de entregar el producto.",
  oferta: "Busca a la empresa por tu cuenta y confirma que la oferta esté publicada en sus canales oficiales. Si te piden pagar inscripción, materiales o un adelanto, evita el pago y consulta directamente con la empresa.",
  datos: "Si compartiste datos bancarios, contacta a tu banco por un canal oficial y pide que protejan tu cuenta. Si compartiste una contraseña, cámbiala desde un dispositivo seguro, cierra las sesiones abiertas y activa la verificación en dos pasos. Guarda la evidencia para reportar el caso.",
};

export const guides = [
  ["Suplantación bancaria", "«Tu cuenta será bloqueada. Valida tu acceso en este enlace»", "La amenaza de bloqueo busca que actúes con prisa.", "Abre tu app bancaria por tu cuenta y confirma si hay avisos."],
  ["Falsos familiares", "«Hola, cambié de número. Necesito que me transfieras hoy»", "El número nuevo y la urgencia dificultan comprobar quién escribe.", "Llama al número habitual de tu familiar o pregunta a alguien de confianza."],
  ["Comprobantes adulterados", "Una captura muestra S/ 80,00 como monto y S/ 8,00 como total transferido.", "Los importes contradictorios indican que debes revisar el abono.", receiptAdvice],
  ["Ofertas laborales engañosas", "«Paga la inscripción para continuar con el proceso»", "El cobro aparece antes de verificar quién ofrece el trabajo.", "Evita pagar y confirma la vacante en el sitio oficial de la empresa."],
  ["Premios falsos", "«Ganaste S/ 5.000. Deposita S/ 50 para liberar el premio»", "El mensaje combina un premio inesperado con un pago adelantado.", "Evita el depósito y consulta al organizador por un canal oficial."],
  ["Compras por redes sociales", "«Transfiere ahora o perderás el precio especial»", "La presión busca que pagues antes de revisar al vendedor.", "Revisa referencias independientes y usa medios con protección al comprador."],
];
