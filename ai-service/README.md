# AI service (EMBER / ÁLLAT / KOCSI)

Kicsi FastAPI microservice egyetlen JPEG képkocka osztályozására (CPU-only).

## Követelmények

- Python 3.10+
- Linuxon futtatva (javasolt)

## Telepítés

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Futtatás

Alapértelmezett: `127.0.0.1:8001`

```bash
cd ai-service
source .venv/bin/activate

# opcionális: confidence küszöb
export AI_CONFIDENCE=0.55

uvicorn app:app --host 127.0.0.1 --port 8001
```

## Endpointok

- `GET /health` → `{ "ok": true }`
- `POST /classify` (multipart/form-data)
  - field: `file` (image/jpeg)
  - response:
    ```json
    {
      "topLabel": "EMBER|ÁLLAT|KOCSI|ISMERETLEN",
      "confidence": 0.0,
      "raw": [
        { "class": "person", "confidence": 0.78 }
      ]
    }
    ```
