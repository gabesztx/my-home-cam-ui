# AI Service Telepítési Útmutató

Ez az útmutató lépésről lépésre bemutatja, hogyan kell beállítani az AI service-t a HomeCam alkalmazáshoz.

## Előfeltételek

- Python 3.8 vagy újabb
- pip (Python package manager)
- ffmpeg és ffprobe (videó frame kinyeréshez)
- Node.js és npm (már telepítve van)

## 1. Python és pip ellenőrzése

```bash
python3 --version
pip3 --version
```

Ha nincs telepítve:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3 python3-pip python3-venv

# macOS (Homebrew)
brew install python3
```

## 2. ffmpeg telepítése

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS (Homebrew)
brew install ffmpeg

# Ellenőrzés
ffmpeg -version
ffprobe -version
```

## 3. AI Service telepítése

### 3.1. Navigálj az ai-service könyvtárba

```bash
cd ~/my-home-cam-ui/ai-service
# vagy a te elérési utad:
cd /home/gabesz/share/develop/my-home-cam-ui/ai-service
```

### 3.2. Python virtuális környezet létrehozása

```bash
python3 -m venv .venv
```

### 3.3. Virtuális környezet aktiválása

```bash
source .venv/bin/activate
```

A terminálban megjelenik a `(.venv)` prefix, ami jelzi, hogy a virtuális környezet aktív.

### 3.4. Függőségek telepítése

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

**Figyelem:** Ez a lépés eltarthat néhány percig, mert letölti a PyTorch-ot és a torchvision-t (~200 MB).

**NumPy kompatibilitás:** A `requirements.txt` tartalmazza a `numpy<2` korlátozást, hogy biztosítsa a PyTorch 2.2.0 kompatibilitást. Ha már telepítetted a függőségeket és NumPy 2.x figyelmeztetést kapsz, futtasd újra:

```bash
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

### 3.5. Modell letöltése (első indítás)

Az első indításkor a PyTorch automatikusan letölti a MobileNetV2 ImageNet súlyokat (~14 MB).

```bash
# Teszteld az AI service-t
python3 -c "from utils.classifier import ImageClassifier; c = ImageClassifier(); print('OK')"
```

Ha minden rendben van, kiírja: "Loading MobileNetV2 model..." majd "Model loaded successfully. Device: cpu" és végül "OK".

## 4. AI Service indítása fejlesztői módban

### 4.1. Manuális indítás (teszteléshez)

```bash
cd ~/my-home-cam-ui/ai-service
source .venv/bin/activate
uvicorn app:app --host 127.0.0.1 --port 8001
```

Ellenőrizd, hogy fut-e:
```bash
curl http://127.0.0.1:8001/health
```

Válasz:
```json
{
  "status": "healthy",
  "service": "HomeCam AI Service",
  "model": "MobileNetV2",
  "confidence_threshold": 0.55
}
```

### 4.2. Automatikus indítás a Node API-val együtt

A `server/package.json` már be van állítva, hogy automatikusan indítsa az AI service-t:

```bash
cd ~/my-home-cam-ui/server
npm install  # Ha még nem tetted meg (concurrently csomag telepítése)
npm run dev
```

Ez egyszerre indítja:
- Node API-t (port 3000)
- AI service-t (port 8001)

## 5. Produkciós telepítés (systemd service)

### 5.1. Systemd service fájl másolása

```bash
sudo cp ~/my-home-cam-ui/ai-service.service /etc/systemd/system/
```

### 5.2. Service fájl szerkesztése (ha szükséges)

Nyisd meg a fájlt és módosítsd az elérési utakat, ha szükséges:

```bash
sudo nano /etc/systemd/system/ai-service.service
```

Módosítsd:
- `User=gabesz` → a te felhasználóneved
- `WorkingDirectory=/home/gabesz/my-home-cam-ui/ai-service` → a te elérési utad
- `ExecStart=/home/gabesz/my-home-cam-ui/ai-service/.venv/bin/uvicorn ...` → a te elérési utad

### 5.3. Service engedélyezése és indítása

```bash
sudo systemctl daemon-reload
sudo systemctl enable ai-service
sudo systemctl start ai-service
```

### 5.4. Service állapotának ellenőrzése

```bash
sudo systemctl status ai-service
```

Ha fut, ezt kell látnod:
```
● ai-service.service - HomeCam AI Service
   Loaded: loaded (/etc/systemd/system/ai-service.service; enabled)
   Active: active (running) since ...
```

### 5.5. Logok megtekintése

```bash
sudo journalctl -u ai-service -f
```

### 5.6. Service újraindítása

```bash
sudo systemctl restart ai-service
```

### 5.7. Service leállítása

```bash
sudo systemctl stop ai-service
```

## 6. Hibaelhárítás

### Hiba: "ECONNREFUSED 127.0.0.1:8001"

**Ok:** Az AI service nem fut.

**Megoldás:**
1. Ellenőrizd, hogy a virtuális környezet létezik-e:
   ```bash
   ls -la ~/my-home-cam-ui/ai-service/.venv
   ```

2. Ha nem létezik, hozd létre (lásd 3.2-3.4 lépések).

3. Indítsd el manuálisan:
   ```bash
   cd ~/my-home-cam-ui/ai-service
   source .venv/bin/activate
   uvicorn app:app --host 127.0.0.1 --port 8001
   ```

4. Ha hibát kapsz, ellenőrizd a függőségeket:
   ```bash
   pip list | grep -E "fastapi|uvicorn|torch"
   ```

### Hiba: "ModuleNotFoundError: No module named 'utils'"

**Ok:** Nem az `ai-service` könyvtárban vagy.

**Megoldás:**
```bash
cd ~/my-home-cam-ui/ai-service
source .venv/bin/activate
uvicorn app:app --host 127.0.0.1 --port 8001
```

### Hiba: "ffmpeg not found"

**Ok:** Az ffmpeg nincs telepítve vagy nem elérhető a PATH-ban.

**Megoldás:**
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Ellenőrzés
which ffmpeg
ffmpeg -version
```

### Lassú inference (>1 másodperc)

**Ok:** A CPU túlterhelt vagy a modell nem CPU-optimalizált.

**Megoldás:**
1. Ellenőrizd a CPU terhelést: `top` vagy `htop`
2. Csökkentsd az egyidejű kérések számát
3. Növeld a konfidencia küszöböt (kevesebb "ISMERETLEN" eredmény)

### Memória hiba

**Ok:** Nincs elég RAM.

**Megoldás:**
1. Növeld a swap területet
2. Csökkentsd az egyidejű kérések számát
3. Indítsd újra az AI service-t

## 7. Tesztelés

### 7.1. Health check

```bash
curl http://127.0.0.1:8001/health
```

### 7.2. Kép osztályozása (példa)

Készíts egy teszt képet vagy használj egy meglévőt:

```bash
# Példa: frame kinyerése egy videóból
ffmpeg -i /path/to/video.mp4 -ss 00:00:05 -vframes 1 test_frame.jpg

# Osztályozás
curl -X POST http://127.0.0.1:8001/classify \
  -F "file=@test_frame.jpg"
```

Válasz:
```json
{
  "topLabel": "EMBER",
  "confidence": 0.8234,
  "rawTop": "person",
  "rawConfidence": 0.8234
}
```

## 8. Konfiguráció

### AI_CONFIDENCE küszöb módosítása

**Fejlesztői mód:**
```bash
export AI_CONFIDENCE=0.60
cd ~/my-home-cam-ui/ai-service
source .venv/bin/activate
uvicorn app:app --host 127.0.0.1 --port 8001
```

**Produkciós mód (systemd):**
```bash
sudo nano /etc/systemd/system/ai-service.service
```

Módosítsd:
```ini
Environment="AI_CONFIDENCE=0.60"
```

Majd:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ai-service
```

**Node API oldalon:**
Szerkeszd a `server/.env.development` fájlt:
```
AI_CONFIDENCE=0.60
```

## 9. Teljesítmény optimalizálás

### CPU-barát beállítások

Az AI service már CPU-optimalizált (MobileNetV2), de további optimalizáláshoz:

1. **Csökkentsd a kép méretét** (már 640px-re van állítva)
2. **Növeld a konfidencia küszöböt** (kevesebb inference)
3. **Használj cache-t** (már implementálva van)
4. **Limitáld az egyidejű kéréseket** (single-flight védelem már implementálva)

### Várható teljesítmény

- **Intel G3240 CPU:** ~150-300 ms / inference
- **Memória használat:** ~400-500 MB
- **Modell méret:** ~14 MB

## 10. Karbantartás

### Cache törlése

```bash
rm -rf /home/gabesz/share/camera/aqara_video/.ai-labels/*
```

### Temp fájlok törlése

```bash
rm -rf /home/gabesz/share/camera/aqara_video/.ai-temp/*
```

### Logok törlése (systemd)

```bash
sudo journalctl --vacuum-time=7d
```

## Összefoglalás

1. ✅ Python 3.8+ telepítése
2. ✅ ffmpeg telepítése
3. ✅ Virtuális környezet létrehozása (`python3 -m venv .venv`)
4. ✅ Függőségek telepítése (`pip install -r requirements.txt`)
5. ✅ AI service indítása (`npm run dev` vagy systemd)
6. ✅ Tesztelés (`curl http://127.0.0.1:8001/health`)

**Fejlesztői mód:**
```bash
cd ~/my-home-cam-ui/server
npm run dev
```

**Produkciós mód:**
```bash
sudo systemctl start ai-service
cd ~/my-home-cam-ui/server
npm run build && npm start
```

Kész! Az AI service most már fut és készen áll a videók osztályozására. 🎉
