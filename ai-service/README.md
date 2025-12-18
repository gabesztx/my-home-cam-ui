# HomeCam AI Service

CPU-barát AI mikroszerviz videó frame-ek osztályozásához 4 kategóriába: **EMBER**, **ÁLLAT**, **KOCSI**, **ISMERETLEN**.

## Technológia

- **FastAPI** + **Uvicorn** - Gyors, modern Python web framework
- **PyTorch** + **torchvision** - Deep learning framework
- **MobileNetV2** - CPU-optimalizált neurális háló ImageNet súlyokkal
- **Pillow** - Képfeldolgozás

## Követelmények

- Python 3.8+
- CPU (Intel G3240 vagy jobb)
- ~500 MB szabad RAM
- ~200 MB szabad tárhely (modell súlyok)

## Telepítés

### 1. Python virtuális környezet létrehozása

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate  # Linux/Mac
# vagy
.venv\Scripts\activate  # Windows
```

### 2. Függőségek telepítése

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

**Megjegyzés:** Az első futtatáskor a PyTorch automatikusan letölti a MobileNetV2 ImageNet súlyokat (~14 MB).

### 3. Környezeti változók (opcionális)

```bash
export AI_CONFIDENCE=0.55
```

## Indítás

### Fejlesztői mód

```bash
source .venv/bin/activate
uvicorn app:app --host 127.0.0.1 --port 8001 --reload
```

### Produkciós mód

```bash
source .venv/bin/activate
uvicorn app:app --host 127.0.0.1 --port 8001
```

A szolgáltatás elérhető lesz: `http://127.0.0.1:8001`

## API Endpoint-ok

### GET /health

Health check endpoint.

**Válasz:**
```json
{
  "status": "healthy",
  "service": "HomeCam AI Service",
  "model": "MobileNetV2",
  "confidence_threshold": 0.55
}
```

### POST /classify

Kép osztályozása 4 kategóriába.

**Kérés:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: `file=<image.jpg>`

**Válasz:**
```json
{
  "topLabel": "EMBER",
  "confidence": 0.82,
  "rawTop": "person",
  "rawConfidence": 0.91
}
```

**Kategóriák:**
- `EMBER` - Ember, személy
- `ÁLLAT` - Bármely állat
- `KOCSI` - Autó, busz, teherautó, stb.
- `ISMERETLEN` - Alacsony konfidencia vagy nem releváns osztály

## Tesztelés

### cURL példák

**Health check:**
```bash
curl http://127.0.0.1:8001/health
```

**Kép osztályozása:**
```bash
curl -X POST http://127.0.0.1:8001/classify \
  -F "file=@/path/to/image.jpg"
```

**Példa válasz:**
```json
{
  "topLabel": "ÁLLAT",
  "confidence": 0.8734,
  "rawTop": "tabby cat",
  "rawConfidence": 0.8734
}
```

## Teljesítmény

- **Inference idő:** ~150-300 ms (Intel G3240 CPU-n)
- **Memória használat:** ~400-500 MB
- **Modell méret:** ~14 MB (MobileNetV2 súlyok)

## Hibaelhárítás

### ModuleNotFoundError: No module named 'utils'

Győződj meg róla, hogy az `ai-service` könyvtárban vagy, és a virtuális környezet aktív.

### Lassú inference

- Ellenőrizd, hogy a CPU nem túlterhelt
- Csökkentsd a kép méretét (a modell automatikusan 224x224-re skálázza)
- Győződj meg róla, hogy csak CPU-t használsz (GPU overhead lassíthat)

### Memória hiba

- Növeld a rendszer swap területét
- Csökkentsd az egyidejű kérések számát

## Systemd Service (Produkció)

Hozz létre egy systemd service fájlt: `/etc/systemd/system/ai-service.service`

```ini
[Unit]
Description=HomeCam AI Service
After=network.target

[Service]
User=gabesz
WorkingDirectory=/home/gabesz/my-home-cam-ui/ai-service
ExecStart=/home/gabesz/my-home-cam-ui/ai-service/.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8001
Restart=always
Environment="AI_CONFIDENCE=0.55"

[Install]
WantedBy=multi-user.target
```

**Indítás:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable ai-service
sudo systemctl start ai-service
sudo systemctl status ai-service
```

## Fejlesztés

### Új kategória hozzáadása

Szerkeszd a `utils/labels_map.py` fájlt és add hozzá az új osztályokat a megfelelő kategóriához.

### Konfidencia küszöb módosítása

Állítsd be az `AI_CONFIDENCE` környezeti változót vagy módosítsd az `app.py` fájlban.

## Licenc

MIT
