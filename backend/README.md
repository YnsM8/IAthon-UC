# Backend de PILAS

API en FastAPI para analizar mensajes y capturas. El modo demo permite probar el contrato con tres ejemplos ficticios. El modo real usa la API de Gemini de Google AI Studio para texto e imágenes.

## Ejecutar en Windows

Requiere Python 3.11 o posterior.

Ejecuta estos comandos en PowerShell desde la raíz del repositorio.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Set-Location backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

La documentación interactiva de FastAPI estará en [localhost:8000/docs](http://127.0.0.1:8000/docs). `GET /api/salud` indica el modo seleccionado. En macOS o Linux, usa `.venv/bin/python` desde la raíz y `../.venv/bin/python` desde `backend/`.

## Activar Gemini

1. Copia `backend/.env.example` a `backend/.env`.
2. En el archivo local, asigna `PILAS_MODE=real` y pega tu clave de Google AI Studio en `GEMINI_API_KEY`.
3. Reinicia el servidor y verifica que `GET /api/salud` muestre `"modo":"real"`. Después ejecuta un análisis para comprobar que la clave y el modelo funcionan.

`GEMINI_MODEL` usa `gemini-3.5-flash-lite` por defecto. Puedes cambiarlo por otro modelo de Gemini compatible con imágenes y salidas estructuradas. [Documentación de la API de Gemini](https://aistudio.google.com/api-reference/generate-content).

Git ignora el archivo `backend/.env`. En modo real, PILAS envía a Google el mensaje o la imagen para procesarlos. Usa datos ficticios durante las pruebas.

## Integración con frontend

| Ruta | Entrada |
| --- | --- |
| `POST /api/analisis/texto` | JSON con `texto` de 1 a 5.000 caracteres. |
| `POST /api/analisis/imagen` | Formulario multipart con un único archivo en el campo `imagen`. Admite JPEG y PNG estáticos de hasta 5 MiB y 20 megapíxeles. |

Ambos endpoints devuelven `tipo`, `modo`, `riesgo`, `senales`, `recomendacion` y `limitaciones`. Muestra `modo: "demo"` como simulación y renderiza los campos de respuesta como texto. Si el análisis identifica un comprobante, la recomendación pide verificar el abono en la app bancaria oficial.

Los errores usan el formato `{"error":{"codigo":"...","mensaje":"..."}}`. Una imagen ilegible obtiene `422` y `imagen_ilegible`. Los fallos del proveedor devuelven un error de servicio. El modo real conserva su estado cuando Gemini falla.

`PILAS_CORS_ORIGINS` controla los orígenes permitidos. Por defecto admite `localhost` y `127.0.0.1` en los puertos `5500` y `5173`.

## Probar la demo

Con `PILAS_MODE=demo`, usa la página `/docs` para enviar los siguientes ejemplos. En modo demo la API acepta estos dos mensajes y el archivo incluido.

| Escenario | Entrada |
| --- | --- |
| Premio falso | `¡Felicidades! Ganaste S/ 5,000. Deposita S/ 50 para liberar tu premio` |
| Oferta laboral falsa | `Vacante de auxiliar. Paga S/ 30 por inscripción para continuar con el proceso` |
| Comprobante sospechoso | [comprobante-ficticio.png](demo/comprobante-ficticio.png) |

Los tres casos devuelven `modo: "demo"` y `riesgo: "alto"`.

Para ejecutar las pruebas automatizadas desde `backend/` en Windows, usa `..\.venv\Scripts\python.exe -m unittest discover -s tests`. Las pruebas de Gemini simulan las respuestas del proveedor y se ejecutan sin una clave.
