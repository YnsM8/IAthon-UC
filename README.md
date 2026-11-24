# PILAS

**Tu protección inteligente antes de confiar, pagar o transferir.**

PILAS es un asistente de prevención de estafas digitales que analiza mensajes, ofertas y capturas en busca de señales de posible fraude. El equipo prepara un MVP funcional para una demostración en vivo en el **VI CONCEPMI LIMA 2026**, como parte del reto «De la idea al MVP».

## El problema que resuelve

Luis es un bodeguero de 41 años que recibe pagos mediante billeteras digitales. Cuando un cliente le muestra una captura, Luis necesita decidir si puede entregar el producto. PILAS le permite revisar la imagen, entender las inconsistencias visibles y saber cómo comprobar el abono. El MVP también atiende a personas que reciben mensajes sospechosos, buscan trabajo por redes sociales o realizan compras digitales.

## Alcance del MVP

| Sección | Qué podrá hacer el usuario |
| --- | --- |
| Inicio | Entender qué analiza PILAS y llegar al analizador con «Analizar ahora». |
| Panel | Ver el total de análisis, la distribución por riesgo, los resultados recientes de la sesión y consejos preventivos. |
| Analizador | Pegar un mensaje o cargar una imagen JPG, JPEG o PNG. Podrá previsualizar, cambiar o retirar la imagen antes de enviarla. |
| Resultados | Ver el riesgo bajo, medio o alto con un semáforo y una etiqueta de texto. Leer cada señal, su explicación, una recomendación y las limitaciones del análisis. Podrá iniciar otro análisis o volver al panel. |
| Asistente | Consultar en lenguaje sencillo cómo verificar un mensaje, una transferencia o una oferta y qué hacer si ya compartió datos. |
| Centro de prevención | Consultar ejemplos ficticios, alertas y recomendaciones sobre suplantación bancaria, falsos familiares, comprobantes adulterados, ofertas laborales engañosas, premios falsos y compras por redes sociales. |

La interfaz debe funcionar en celular, tableta y computadora. El riesgo se expresará en palabras y colores con contraste legible. Un porcentaje requeriría un método de puntuación definido y calibrado.

## Reparto del trabajo

| Frente | Responsabilidades |
| --- | --- |
| Backend — responsable del repositorio | Definir y exponer la API, validar texto y archivos, integrar IA para texto y visión, normalizar resultados y manejar fallos del proveedor. Configurar credenciales y registros operativos. |
| Frontend — segunda persona del equipo | Construir las pantallas responsive, los formularios, la previsualización, el semáforo y el panel de sesión. Implementar los estados inicial, de carga, de error y de resultado. Integrar primero con ejemplos ficticios y luego con la API. |
| Ambos | Acordar el contrato antes de integrar, revisar cambios en los campos de respuesta y ensayar los tres escenarios de principio a fin. |

## Arquitectura y contrato inicial propuestos

La primera implementación del analizador está en [backend/](backend/README.md). La guía incluye instalación, configuración de Gemini y ejemplos para probar los endpoints desde frontend.

El punto de partida es **HTML, CSS y JavaScript** para el frontend y **Python con FastAPI** para el backend. El navegador envía la solicitud a la API de PILAS. El backend valida la entrada, llama al proveedor de IA y devuelve un resultado estructurado. Para texto, el modelo revisará urgencia, suplantación, solicitudes de dinero o datos y señales en enlaces visibles. Para imágenes, un modelo multimodal leerá el contenido y revisará inconsistencias visibles, con OCR si se necesita.

| Operación | Solicitud |
| --- | --- |
| `POST /api/analisis/texto` | JSON con el campo `texto`. |
| `POST /api/analisis/imagen` | `multipart/form-data` con el campo `imagen` en formato JPEG o PNG. |

Las dos operaciones devuelven la misma estructura. El siguiente ejemplo ficticio permite al frontend implementar la pantalla de resultados sin esperar al servicio de IA.

```json
{
  "tipo": "texto",
  "modo": "demo",
  "riesgo": "alto",
  "senales": [
    {
      "titulo": "Pago por adelantado",
      "explicacion": "El mensaje pide depositar S/ 50 para liberar un premio."
    }
  ],
  "recomendacion": "Evita hacer el depósito y verifica el supuesto sorteo por un canal oficial que tú mismo busques.",
  "limitaciones": [
    "La evaluación se basa en el contenido recibido."
  ]
}
```

`tipo` admite `texto` e `imagen`. `riesgo` admite `bajo`, `medio` y `alto`. `modo` distingue `real` y `demo`. En caso de error, la API devolverá un mensaje apto para mostrar al usuario en `{"error":{"codigo":"…","mensaje":"…"}}`. El frontend permitirá corregir entradas inválidas o reintentar si falla el servicio. Si la imagen resulta ilegible, pedirá una captura más clara sin asignarle un nivel de riesgo.

El modo real utilizará un modelo de IA. El modo demo usará casos ficticios identificados como **simulación** en la interfaz y en la respuesta. Si el proveedor falla, la interfaz informará el fallo y podrá ofrecer los casos de demostración de forma explícita.

## Privacidad y alcance de los resultados

- Mantener las credenciales del proveedor en variables de entorno del backend. Validar el formato y el tamaño del archivo antes de enviarlo al modelo.
- Procesar mensajes e imágenes sin persistir los originales por defecto. Limitar los registros operativos a datos como estado y duración de la solicitud. Evitar que formularios y ejemplos soliciten contraseñas, códigos de verificación o números de tarjeta.
- Presentar los resultados como evaluaciones preventivas basadas en el contenido disponible. El riesgo bajo indica pocas señales observadas. El riesgo medio indica que conviene verificar antes de actuar. El riesgo alto indica señales importantes de posible fraude. Una imagen puede mostrar inconsistencias y la comprobación del abono se realiza en el canal bancario oficial.
- Destacar la siguiente recomendación en todo análisis de un comprobante de pago.

  > Una captura de pantalla no demuestra que el dinero haya llegado a tu cuenta. Verifica el abono directamente en tu aplicación bancaria oficial.

## Guion de la demostración

| Escenario | Acción | Resultado esperado |
| --- | --- | --- |
| Comprobante sospechoso | Luis carga una captura ficticia con importes contradictorios. | PILAS explica la inconsistencia visible y destaca cómo comprobar el abono antes de entregar el producto. |
| Premio falso | El usuario pega «¡Felicidades! Ganaste S/ 5,000. Deposita S/ 50 para liberar tu premio». | **Riesgo alto.** La explicación señala el premio inesperado y el pago por adelantado. |
| Oferta laboral falsa | El usuario pega una oferta ficticia que exige pagar por la inscripción. | **Riesgo alto.** La recomendación indica evitar el pago y verificar la identidad del empleador por un canal independiente. |

El ensayo debe cubrir los tres casos, el regreso al panel y la actualización de los conteos de la sesión. También debe comprobar el mensaje vacío, la carga de un archivo inválido, una imagen ilegible, un fallo del proveedor y la etiqueta visible del modo demo.

## Piloto e indicadores

La propuesta B2B2C contempla a **Red Confianza Digital** como financiador y un piloto gratuito para **5.000 usuarios durante seis meses**. Los canales propuestos incluyen agencias de la caja municipal, una red de 2.000 bodegas y una asociación de adultos mayores.

El panel del MVP mostrará resultados de la sesión. Para el piloto, el equipo plantea medir análisis completados, alertas de riesgo alto, tiempo promedio de respuesta, usuarios activos, proporción de alertas revisadas que se justificaron y reportes de posible prevención. Una alerta registra señales detectadas. Confirmar un fraude o documentar un caso evitado exige evidencia adicional.
