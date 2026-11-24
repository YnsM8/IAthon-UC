from hashlib import sha256
from pathlib import Path

from .gemini import RECEIPT_RECOMMENDATION
from .inputs import ImageInput
from .schemas import AnalysisError, AnalysisResult, ContentType, Signal

DEMO_IMAGE = Path(__file__).resolve().parents[1] / "demo" / "comprobante-ficticio.png"
PRIZE_MESSAGE = "¡Felicidades! Ganaste S/ 5,000. Deposita S/ 50 para liberar tu premio"
JOB_MESSAGE = "Vacante de auxiliar. Paga S/ 30 por inscripción para continuar con el proceso"


def normalize_message(message: str) -> str:
    return " ".join(message.casefold().split()).rstrip(".")


DEMO_RESULTS = {
    normalize_message(PRIZE_MESSAGE): (
        [
            Signal(titulo="Premio inesperado", explicacion="El mensaje anuncia un premio sin aportar información verificable."),
            Signal(titulo="Pago adelantado", explicacion="Pide depositar S/ 50 para liberar el premio."),
        ],
        "Evita el depósito y verifica el supuesto sorteo por un canal oficial que tú mismo busques.",
    ),
    normalize_message(JOB_MESSAGE): (
        [
            Signal(titulo="Cobro por inscripción", explicacion="La oferta exige S/ 30 para continuar con el proceso."),
            Signal(titulo="Empleador sin verificar", explicacion="El mensaje no aporta detalles para confirmar quién ofrece la vacante."),
        ],
        "Evita hacer el pago y verifica la identidad del empleador por un canal independiente.",
    ),
}


class DemoAnalyzer:
    def __init__(self) -> None:
        self.receipt_hash = sha256(DEMO_IMAGE.read_bytes()).digest()

    async def analyze(self, value: str | ImageInput) -> AnalysisResult:
        kind: ContentType
        if isinstance(value, ImageInput):
            if sha256(value.data).digest() != self.receipt_hash:
                raise AnalysisError(422, "caso_demo_no_admitido", "Usa el comprobante ficticio incluido en la demo.")
            kind = "imagen"
            signals = [
                Signal(titulo="Importes distintos", explicacion="El ejemplo muestra S/ 80,00 como monto y S/ 8,00 como total transferido.")
            ]
            recommendation = RECEIPT_RECOMMENDATION
        else:
            result = DEMO_RESULTS.get(normalize_message(value))
            if result is None:
                raise AnalysisError(422, "caso_demo_no_admitido", "Usa el mensaje de premio u oferta laboral de la demo.")
            kind = "texto"
            signals, recommendation = result

        return AnalysisResult(
            tipo=kind,
            modo="demo",
            riesgo="alto",
            senales=signals,
            recomendacion=recommendation,
            limitaciones=["Simulación con un caso ficticio. El resultado de demo es predefinido."],
        )
