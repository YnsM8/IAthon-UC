from collections.abc import AsyncIterator
from dataclasses import dataclass
from io import BytesIO

from fastapi import Request
from PIL import Image
from pydantic import ValidationError
from python_multipart.exceptions import MultipartParseError
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from .schemas import MAX_IMAGE_BYTES, MAX_TEXT_LENGTH, AnalysisError, TextInput

MAX_TEXT_BODY_BYTES = 64 * 1024
MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 32 * 1024
MAX_IMAGE_PIXELS = 20_000_000
IMAGE_TYPES = {"JPEG": "image/jpeg", "PNG": "image/png"}


@dataclass(frozen=True)
class ImageInput:
    data: bytes
    mime_type: str


class InMemoryMultipartParser(MultiPartParser):
    # El cuerpo se limita antes de analizarlo, de modo que no se vuelca a disco.
    spool_max_size = MAX_MULTIPART_BYTES


def media_type(request: Request) -> str:
    return request.headers.get("content-type", "").partition(";")[0].strip().lower()


async def bounded_body(request: Request, limit: int) -> bytes:
    buffer = bytearray()
    async for chunk in request.stream():
        if len(buffer) + len(chunk) > limit:
            raise AnalysisError(413, "cuerpo_demasiado_grande", "La solicitud supera el tamaño permitido.")
        buffer.extend(chunk)
    return bytes(buffer)


async def read_text(request: Request) -> str:
    if media_type(request) != "application/json":
        raise AnalysisError(415, "tipo_no_admitido", "Envía el mensaje como JSON.")

    body = await bounded_body(request, MAX_TEXT_BODY_BYTES)
    try:
        return TextInput.model_validate_json(body).texto
    except ValidationError:
        raise AnalysisError(
            422, "texto_invalido", f"Envía un mensaje de 1 a {MAX_TEXT_LENGTH} caracteres en el campo texto."
        ) from None


async def read_image(request: Request) -> ImageInput:
    if media_type(request) != "multipart/form-data":
        raise AnalysisError(415, "tipo_no_admitido", "Envía la imagen como formulario multipart.")

    body = await bounded_body(request, MAX_MULTIPART_BYTES)

    async def multipart_body() -> AsyncIterator[bytes]:
        yield body

    try:
        form = await InMemoryMultipartParser(
            request.headers, multipart_body(), max_files=1, max_fields=0
        ).parse()
    except (MultiPartException, MultipartParseError):
        raise AnalysisError(422, "imagen_invalida", "Adjunta una sola imagen en el campo imagen.") from None

    try:
        upload = form.get("imagen")
        if not isinstance(upload, UploadFile):
            raise AnalysisError(422, "imagen_invalida", "Adjunta una sola imagen en el campo imagen.")
        data = await upload.read(MAX_IMAGE_BYTES + 1)
    finally:
        await form.close()

    if len(data) > MAX_IMAGE_BYTES:
        raise AnalysisError(413, "imagen_demasiado_grande", "La imagen debe pesar 5 MiB o menos.")

    mime = await run_in_threadpool(validate_image, data)
    return ImageInput(data, mime)


def validate_image(data: bytes) -> str:
    try:
        with Image.open(BytesIO(data), formats=list(IMAGE_TYPES)) as image:
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise AnalysisError(413, "imagen_demasiado_grande", "La imagen debe tener hasta 20 megapíxeles.")
            if getattr(image, "is_animated", False):
                raise AnalysisError(422, "imagen_invalida", "Envía una imagen estática en JPG, JPEG o PNG.")
            image.load()
            return IMAGE_TYPES[image.format]
    except Image.DecompressionBombError:
        raise AnalysisError(413, "imagen_demasiado_grande", "La imagen debe tener hasta 20 megapíxeles.") from None
    except (OSError, ValueError, SyntaxError):
        raise AnalysisError(422, "imagen_invalida", "Sube una imagen válida en JPG, JPEG o PNG.") from None
