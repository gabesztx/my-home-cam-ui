import io
import os

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image
from ultralytics import YOLO

app = FastAPI()


def get_confidence_threshold() -> float:
    try:
        return float(os.getenv("AI_CONFIDENCE", "0.55"))
    except ValueError:
        return 0.55


MODEL = YOLO("yolov8n.pt")


PERSON = {"person"}
VEHICLE = {"car", "truck", "bus", "motorcycle"}
ANIMAL = {
    "dog",
    "cat",
    "bird",
    "horse",
    "sheep",
    "cow",
    "elephant",
    "bear",
    "zebra",
    "giraffe",
}


def map_class(name: str) -> str:
    if name in PERSON:
        return "EMBER"
    if name in VEHICLE:
        return "KOCSI"
    if name in ANIMAL:
        return "ÁLLAT"
    return "ISMERETLEN"


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/classify")
async def classify(file: UploadFile = File(...)):
    if file.content_type not in {"image/jpeg", "image/jpg"}:
        return JSONResponse(status_code=415, content={"error": "UNSUPPORTED_MEDIA_TYPE"})

    image_bytes = await file.read()
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return JSONResponse(status_code=400, content={"error": "INVALID_IMAGE"})

    threshold = get_confidence_threshold()
    results = MODEL.predict(image, conf=threshold, verbose=False)

    raw = []
    best_mapped = "ISMERETLEN"
    best_conf = 0.0

    if len(results) > 0:
        r = results[0]
        names = r.names
        for box in r.boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            cls_name = str(names.get(cls_id, cls_id))
            raw.append({"class": cls_name, "confidence": conf})

            mapped = map_class(cls_name)
            if mapped != "ISMERETLEN" and conf > best_conf:
                best_conf = conf
                best_mapped = mapped

    return {"topLabel": best_mapped, "confidence": best_conf, "raw": raw}
