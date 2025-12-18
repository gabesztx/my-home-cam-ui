# My Home Cam UI Starter

Egy modern, full-stack starter projekt Angular v20+ és Express (TypeScript) alapokon.

## Követelmények

- **Node.js**: v20 vagy újabb
- **npm**: v10 vagy újabb

## Projekt struktúra

- `client/`: Angular frontend alkalmazás (Signals, standalone komponensek, OnPush)
- `server/`: Express backend alkalmazás (TypeScript, szeparált architektúra)
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

## API Végpontok

- `GET /api/health`: Ellenőrzi a szerver állapotát. Visszatérési érték: `{ "ok": true, "ts": "<ISO timestamp>" }`
- `GET /api/debug/media-root` (csak dev módban): Visszaadja a feloldott `MEDIA_ROOT` útvonalat.
- `GET /api/cameras`: Elérhető kamerák listája.
- `GET /api/cameras/:cameraId/dates`: Kamera dátumainak listája (csökkenő sorrendben).
- `GET /api/cameras/:cameraId/dates/:date/videos`: Videók listája egy adott napon.
- `GET /api/videos/stream?path=<relativePath>`: Videó streamelése (támogatja a Range requesteket).
- `GET /api/videos/thumbnail?path=<relativePath>&w=<width>&mode=<mode>`: Videó előnézeti kép generálása/lekérése.
- `GET /api/videos/labels?path=<relativePath>`: Videó AI címkéinek lekérése.
- `POST /api/videos/labels?path=<relativePath>`: Videó AI analízisének indítása.

## AI Funkciók (CPU-only Objektumdetektálás)

A projekt támogatja az AI alapú videó kategorizálást (EMBER, ÁLLAT, JÁRMŰ) ONNX runtime használatával.

### AI Beállítása (ENV)
Az alábbi változókkal konfigurálható az AI a `.env` fájlokban:
- `AI_ENABLED=true`: AI funkció bekapcsolása.
- `AI_MODEL_PATH`: Az ONNX modell abszolút útvonala (alapértelmezett: `server/assets/models/yolo.onnx`).
- `AI_CONFIDENCE=0.55`: Megbízhatósági küszöb.
- `AI_FRAME_MODE=middle`: Melyik frame-et elemezze (middle vagy start).
- `AI_FRAME_WIDTH=640`: Elemzéshez használt kép szélessége.

### Szükséges fájlok
Az AI működéséhez szükség van egy YOLO modellre az ONNX formátumban:
- `server/assets/models/yolo.onnx`
- `server/assets/models/coco-classes.json` (A projekt tartalmazza)

Az elemzések eredményei a `server/.cache/labels/` mappában tárolódnak JSON formátumban.

## Rendszerkövetelmények (Thumbnail és AI)

A videó előnézeti képek generálásához a szerveren telepítve kell lennie az **ffmpeg** eszköznek.
- **macOS**: `brew install ffmpeg`
- **Ubuntu**: `sudo apt update && sudo apt install ffmpeg`
