import json
from base64 import b64decode
from io import BytesIO
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

import httpx
from fastapi import FastAPI
from PIL import Image

from app.demo import DEMO_IMAGE, JOB_MESSAGE, PRIZE_MESSAGE
from app.gemini import RECEIPT_RECOMMENDATION
from app.inputs import MAX_MULTIPART_BYTES
from app.main import create_app

TEXT_URL = "/api/analisis/texto"
IMAGE_URL = "/api/analisis/imagen"
RESPONSE_FIELDS = {"tipo", "modo", "riesgo", "senales", "recomendacion", "limitaciones"}


async def upload_demo_image(client: httpx.AsyncClient) -> httpx.Response:
    return await client.post(IMAGE_URL, files={"imagen": (DEMO_IMAGE.name, DEMO_IMAGE.read_bytes(), "image/png")})


class ApiTests(IsolatedAsyncioTestCase):
    async def start_app(self, app: FastAPI) -> None:
        await self.enterAsyncContext(app.router.lifespan_context(app))
        self.client = await self.enterAsyncContext(
            httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver")
        )


class DemoApiTests(ApiTests):
    async def asyncSetUp(self) -> None:
        self.enterContext(patch.dict("os.environ", {"PILAS_MODE": "demo"}))
        await self.start_app(create_app())

    async def test_three_demo_scenarios_share_the_response_contract(self) -> None:
        examples = [
            (await self.client.post(TEXT_URL, json={"texto": PRIZE_MESSAGE}), "texto"),
            (await self.client.post(TEXT_URL, json={"texto": JOB_MESSAGE}), "texto"),
            (await upload_demo_image(self.client), "imagen"),
        ]
        for response, kind in examples:
            with self.subTest(kind=kind, result=response.status_code):
                self.assertEqual(response.status_code, 200)
                result = response.json()
                self.assertEqual(set(result), RESPONSE_FIELDS)
                self.assertEqual((result["tipo"], result["modo"], result["riesgo"]), (kind, "demo", "alto"))
                self.assertTrue(result["senales"])
        self.assertEqual(examples[-1][0].json()["recomendacion"], RECEIPT_RECOMMENDATION)
        health = await self.client.get("/api/salud")
        self.assertEqual(health.json(), {"estado": "ok", "modo": "demo"})

    async def test_demo_rejects_other_messages_without_inventing_a_result(self) -> None:
        response = await self.client.post(TEXT_URL, json={"texto": "Otro mensaje"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["codigo"], "caso_demo_no_admitido")

    async def test_validation_does_not_echo_submitted_content(self) -> None:
        marker = "valor privado"
        response = await self.client.post(TEXT_URL, json={"texto": " ", "duplicado": marker})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["codigo"], "texto_invalido")
        self.assertNotIn(marker, response.text)
        response = await self.client.post(TEXT_URL, json={"texto": "a" * 5_001})
        self.assertEqual(response.status_code, 422)

    async def test_rejects_invalid_and_oversized_uploads(self) -> None:
        response = await self.client.post(
            IMAGE_URL, files={"imagen": ("invalida.png", b"no es una imagen", "image/png")}
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["codigo"], "imagen_invalida")
        response = await self.client.post(
            IMAGE_URL, files={"imagen": ("grande.png", b"x" * MAX_MULTIPART_BYTES, "image/png")}
        )
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["error"]["codigo"], "cuerpo_demasiado_grande")


class GeminiApiTests(ApiTests):
    async def asyncSetUp(self) -> None:
        self.enterContext(patch.dict("os.environ", {
            "PILAS_MODE": "real",
            "GEMINI_API_KEY": "fixture-sin-acceso",
            "GEMINI_MODEL": "gemini-modelo-de-prueba",
        }))
        self.requests: list[httpx.Request] = []
        self.status = 200
        self.finish_reason = "STOP"
        self.answer = {
            "legible": True,
            "es_comprobante": False,
            "riesgo": "medio",
            "senales": [{"titulo": "Solicitud urgente", "explicacion": "El mensaje presiona para actuar."}],
            "recomendacion": "Verifica la solicitud por un canal independiente.",
            "limitaciones": ["La evaluación se basa en el material recibido."],
        }
        app = create_app(gemini_transport=httpx.MockTransport(self.respond))
        await self.start_app(app)

    def respond(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.status != 200:
            return httpx.Response(self.status, json={"error": "detalle privado del proveedor"})
        return httpx.Response(200, json={
            "candidates": [{
                "finishReason": self.finish_reason,
                "content": {"parts": [{"thought": True, "text": "pensamiento"}, {"text": json.dumps(self.answer)}]},
            }]
        })

    async def test_text_uses_api_key_header_and_returns_a_real_result(self) -> None:
        response = await self.client.post(TEXT_URL, json={"texto": PRIZE_MESSAGE})
        self.assertEqual(response.status_code, 200)
        self.assertEqual((response.json()["modo"], response.json()["riesgo"]), ("real", "medio"))
        request = self.requests[0]
        self.assertEqual(request.url.path, "/v1beta/models/gemini-modelo-de-prueba:generateContent")
        self.assertEqual(request.headers["x-goog-api-key"], "fixture-sin-acceso")
        self.assertNotIn("fixture-sin-acceso", str(request.url))
        payload = json.loads(request.content)
        self.assertEqual(payload["contents"][0]["parts"][1]["text"], PRIZE_MESSAGE)
        self.assertEqual(payload["generationConfig"]["responseMimeType"], "application/json")

    async def test_receipt_uses_decoded_mime_and_always_returns_the_bank_recommendation(self) -> None:
        self.answer["es_comprobante"] = True
        response = await upload_demo_image(self.client)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["recomendacion"], RECEIPT_RECOMMENDATION)
        image_part = json.loads(self.requests[0].content)["contents"][0]["parts"][1]["inlineData"]
        self.assertEqual(image_part["mimeType"], "image/png")
        self.assertEqual(b64decode(image_part["data"]), DEMO_IMAGE.read_bytes())

    async def test_unreadable_jpeg_has_no_risk_result(self) -> None:
        self.answer.update(legible=False, riesgo=None, senales=[], recomendacion="")
        image = BytesIO()
        Image.new("RGB", (40, 40), color="white").save(image, format="JPEG")
        response = await self.client.post(IMAGE_URL, files={"imagen": ("foto.jpeg", image.getvalue(), "image/jpeg")})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json(), {"error": {
            "codigo": "imagen_ilegible", "mensaje": "Sube una captura más clara para poder revisarla.",
        }})

    async def test_provider_failure_does_not_return_a_demo_result_or_leak_details(self) -> None:
        self.status = 429
        response = await self.client.post(TEXT_URL, json={"texto": PRIZE_MESSAGE})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(set(response.json()), {"error"})
        self.assertNotIn("detalle privado", response.text)

    async def test_incomplete_provider_output_is_not_accepted(self) -> None:
        self.finish_reason = "MAX_TOKENS"
        response = await self.client.post(TEXT_URL, json={"texto": PRIZE_MESSAGE})
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["error"]["codigo"], "gemini_respuesta_invalida")
