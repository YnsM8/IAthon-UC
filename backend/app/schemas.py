from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

ContentType = Literal["texto", "imagen"]
Mode = Literal["real", "demo"]
Risk = Literal["bajo", "medio", "alto"]
NonBlank = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]

MAX_TEXT_LENGTH = 5_000
MAX_IMAGE_BYTES = 5 * 1024 * 1024


class TextInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    texto: Annotated[NonBlank, Field(max_length=MAX_TEXT_LENGTH)]


class Signal(BaseModel):
    titulo: NonBlank
    explicacion: NonBlank


class ResultDetails(BaseModel):
    riesgo: Risk
    senales: list[Signal]
    recomendacion: NonBlank
    limitaciones: list[NonBlank]


class AnalysisResult(ResultDetails):
    tipo: ContentType
    modo: Mode


class ErrorDetail(BaseModel):
    codigo: str
    mensaje: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class AnalysisError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.detail = ErrorDetail(codigo=code, mensaje=message)
