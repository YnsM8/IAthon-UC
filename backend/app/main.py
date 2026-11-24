import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from os import getenv
from pathlib import Path
from typing import Annotated

import httpx
from dotenv import dotenv_values
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .demo import DEMO_IMAGE, DemoAnalyzer
from .gemini import DEFAULT_MODEL, GEMINI_URL, GeminiAnalyzer
from .inputs import ImageInput, read_image, read_text
from .schemas import AnalysisError, AnalysisResult, ErrorResponse, Mode, TextInput

LOCAL_ORIGINS = ",".join(
    f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (5500, 5173)
)
ERROR_RESPONSES = {
    413: {"model": ErrorResponse, "description": "Solicitud demasiado grande"},
    415: {"model": ErrorResponse, "description": "Formato de solicitud incompatible"},
    422: {"model": ErrorResponse, "description": "Entrada inválida o caso de demo desconocido"},
    502: {"model": ErrorResponse, "description": "Respuesta incompleta del modelo"},
    503: {"model": ErrorResponse, "description": "Proveedor no disponible"},
    504: {"model": ErrorResponse, "description": "Tiempo de espera del proveedor agotado"},
}


def create_app(*, gemini_transport: httpx.AsyncBaseTransport | None = None) -> FastAPI:
    settings = dotenv_values(Path(__file__).resolve().parents[1] / ".env", interpolate=False)

    def setting(name: str, default: str = "") -> str:
        return getenv(name, settings.get(name) or default).strip()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        mode = setting("PILAS_MODE", "demo")
        if mode == "demo":
            app.state.mode = mode
            app.state.analyzer = DemoAnalyzer()
            yield
            return
        if mode != "real":
            raise RuntimeError("PILAS_MODE admite demo o real.")

        api_key = setting("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("Configura GEMINI_API_KEY para usar PILAS_MODE=real.")
        model = setting("GEMINI_MODEL", DEFAULT_MODEL)
        if not re.fullmatch(r"gemini-[a-zA-Z0-9_.-]+", model):
            raise RuntimeError("GEMINI_MODEL debe ser un identificador de modelo de Gemini.")
        async with httpx.AsyncClient(
            base_url=GEMINI_URL,
            headers={"x-goog-api-key": api_key},
            timeout=httpx.Timeout(20, connect=5),
            transport=gemini_transport,
        ) as client:
            app.state.mode = mode
            app.state.analyzer = GeminiAnalyzer(client, model)
            yield

    origins = setting("PILAS_CORS_ORIGINS", LOCAL_ORIGINS).split(",")
    app = FastAPI(title="PILAS API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in origins if origin.strip()],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(AnalysisError)
    async def analysis_error_handler(_: Request, exc: AnalysisError) -> JSONResponse:
        body = ErrorResponse(error=exc.detail)
        return JSONResponse(status_code=exc.status, content=body.model_dump())

    @app.get("/api/salud")
    async def health(request: Request) -> dict[str, str]:
        mode: Mode = request.app.state.mode
        return {"estado": "ok", "modo": mode}

    @app.get("/api/demo/comprobante", response_class=FileResponse)
    async def demo_receipt() -> FileResponse:
        return FileResponse(DEMO_IMAGE, media_type="image/png")

    @app.post(
        "/api/analisis/texto",
        response_model=AnalysisResult,
        responses=ERROR_RESPONSES,
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {"application/json": {"schema": TextInput.model_json_schema()}},
            }
        },
    )
    async def analyze_text(request: Request, text: Annotated[str, Depends(read_text)]) -> AnalysisResult:
        return await request.app.state.analyzer.analyze(text)

    @app.post(
        "/api/analisis/imagen",
        response_model=AnalysisResult,
        responses=ERROR_RESPONSES,
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    "multipart/form-data": {
                        "schema": {
                            "type": "object",
                            "required": ["imagen"],
                            "properties": {"imagen": {"type": "string", "format": "binary"}},
                        }
                    }
                },
            }
        },
    )
    async def analyze_image(request: Request, image: Annotated[ImageInput, Depends(read_image)]) -> AnalysisResult:
        return await request.app.state.analyzer.analyze(image)

    frontend = Path(__file__).resolve().parents[2] / "frontend"
    if frontend.is_dir():
        app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")

    return app


app = create_app()
