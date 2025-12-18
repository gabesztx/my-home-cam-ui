# My Home Cam UI Starter

Egy modern, full-stack starter projekt Angular v20+ és Express (TypeScript) alapokon.

## Követelmények

### Backend (Node.js)
- **Node.js**: v20 vagy újabb
- **npm**: v10 vagy újabb
- **ffmpeg**: Videó thumbnail és frame extraction

### AI Service (opcionális)
- **Python**: 3.8 vagy újabb
- **pip**: Python package manager
- **ffmpeg**: Videó frame extraction
- **~500 MB RAM**: AI modell futtatásához
- **~200 MB tárhely**: PyTorch és modell súlyok

## Projekt struktúra

- `client/`: Angular frontend alkalmazás (Signals, standalone komponensek, OnPush)
- `server/`: Express backend alkalmazás (TypeScript, szeparált architektúra)
- `ai-service/`: Python AI mikroszerviz (FastAPI, PyTorch, MobileNetV2)
- `package.json`: Gyökér szintű kényelmi scriptek a teljes projekt kezeléséhez

## Telepítés

A projekt gyökerében futtasd az alábbi parancsot a függőségek telepítéséhez:

```bash
npm install
```

Ez a parancs automatikusan telepíti a függőségeket a `client` és `server` mappákban is.

## Üzemeltetési módok

A projekt két fő módban használható:

### A) Fejlesztői (Dev) mód: Remote Backend + Local Angular
Ebben a módban a backend egy Linux szerveren fut, az Angular kliens pedig helyben a fejlesztői gépen (pl. macOS). A kommunikáció CORS használatával történik.

**Backend indítása (Linux szerver - 192.168.1.31):**
1. Függőségek telepítése: `npm install` (a gyökérben)
2. Környezeti változók beállítása a `server/.env.development` fájlban:
   ```
   NODE_ENV=development
   PORT=3000
   MEDIA_ROOT=/home/gabesz/share/camera/aqara_video
   ```
3. Szerver indítása: `npm run dev` (vagy `npm run start`)
   - A szerver a `0.0.0.0:3000` címen fog figyelni.

**Frontend indítása (Local machine):**
1. Az Angular kliens a `http://localhost:4200` címen fut.
2. A `client/src/environments/environment.development.ts` fájlban az `apiBaseUrl` a Linux szerver IP címére mutat: `http://192.168.1.31:3000`.
3. Indítás: `npm run dev` (a gyökérből) vagy `cd client && npm start`.
   - A böngészőben a `http://localhost:4200` címet nyisd meg.

**CORS beállítások:**
A backend alapértelmezés szerint csak a `http://localhost:4200` origin-ről fogad kéréseket. Ha az Angular más porton fut, a `server/src/app.ts` fájlban a `corsOptions` tartalmát frissíteni kell.

### B) Production mód: Express szolgálja ki az Angular buildet
Ebben a módban az Express szerver statikus fájlként szolgálja ki az Angular buildet, így nincs szükség CORS-ra.

1. Build készítése: `npm run build`
2. Indítás: `npm run start`
3. Elérhetőség: `http://<szerver-ip>:3000`

## Környezeti változók (ENV)

A szerver konfigurációja környezeti változókon keresztül történik. A `server/` mappában találhatóak az alábbi fájlok:
- `.env.development`: Fejlesztői környezet
- `.env.production`: Éles környezet

### MEDIA_ROOT beállítása
A `MEDIA_ROOT` egy **abszolút útvonal** kell, hogy legyen, ahol a kamera videók találhatóak.

**Példa beállítás:**
```
MEDIA_ROOT=/home/gabesz/share/camera/aqara_video
```

*Fontos: Ha a megadott útvonal nem létezik, a szerver hibaüzenettel leáll.*

### AI Service beállítások (opcionális)

Az AI címkézés funkció opcionális. A következő környezeti változók szabályozzák:

```
AI_ENABLED=true
AI_SERVICE_URL=http://127.0.0.1:8001
AI_CONFIDENCE=0.55
```

- **AI_ENABLED**: `true` vagy `false` - AI funkció be/kikapcsolása
- **AI_SERVICE_URL**: Az AI mikroszerviz URL-je (alapértelmezett: `http://127.0.0.1:8001`)
- **AI_CONFIDENCE**: Minimum konfidencia küszöb (0.0-1.0, alapértelmezett: 0.55)

**AI kategóriák:**
- **EMBER**: Személy, ember
- **ÁLLAT**: Bármely állat (kutya, macska, madár, stb.)
- **KOCSI**: Jármű (autó, busz, teherautó, stb.)
- **ISMERETLEN**: Alacsony konfidencia vagy nem releváns osztály

## API Végpontok

### Általános
- `GET /api/health`: Ellenőrzi a szerver állapotát. Visszatérési érték: `{ "ok": true, "ts": "<ISO timestamp>" }`
- `GET /api/debug/media-root` (csak dev módban): Visszaadja a feloldott `MEDIA_ROOT` útvonalat.

### Média
- `GET /api/cameras`: Elérhető kamerák listája.
- `GET /api/cameras/:cameraId/dates`: Kamera dátumainak listája (csökkenő sorrendben).
- `GET /api/cameras/:cameraId/dates/:date/videos`: Videók listája egy adott napon (opcionálisan label-ekkel).
- `GET /api/videos/stream?path=<relativePath>`: Videó streamelése (támogatja a Range requesteket).
- `GET /api/videos/thumbnail?path=<relativePath>&w=<width>&mode=<mode>`: Videó előnézeti kép generálása/lekérése.

### AI Címkézés (opcionális)
- `GET /api/videos/labels?path=<relativePath>`: Videó AI címkéjének lekérése cache-ből.
- `POST /api/videos/labels?path=<relativePath>`: Videó AI címkézésének indítása (202 Accepted).

## Rendszerkövetelmények

### Thumbnail generáláshoz
A videó előnézeti képek generálásához a szerveren telepítve kell lennie az **ffmpeg** eszköznek.
- **macOS**: `brew install ffmpeg`
- **Ubuntu**: `sudo apt update && sudo apt install ffmpeg`

### AI Service telepítése (opcionális)

Az AI címkézés funkció használatához telepíteni kell a Python AI mikroszervizet. Részletes telepítési útmutató:

📖 **[SETUP_AI.md](./SETUP_AI.md)** - AI Service telepítési útmutató

**Gyors indítás:**
```bash
# 1. Python virtuális környezet létrehozása
cd ai-service
python3 -m venv .venv
source .venv/bin/activate

# 2. Függőségek telepítése
pip install -r requirements.txt

# 3. AI Service indítása (fejlesztői mód)
cd ../server
npm install  # concurrently csomag telepítése
npm run dev  # Node API + AI Service együtt indul
```

**Produkciós telepítés:**
```bash
# Systemd service használata
sudo cp ai-service.service /etc/systemd/system/
sudo systemctl enable ai-service
sudo systemctl start ai-service
```

**Teljesítmény:**
- Inference idő: ~150-300 ms (Intel G3240 CPU)
- Memória használat: ~400-500 MB
- Modell: MobileNetV2 (CPU-optimalizált)
