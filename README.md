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

## Fejlesztés

A frontend és a backend párhuzamos futtatásához fejlesztői módban:

```bash
npm run dev
```

- Frontend: [http://localhost:4200](http://localhost:4200)
- Backend: [http://localhost:3000](http://localhost:3000)
- API Proxy: Minden `/api/*` hívás a frontendről a backendre irányítódik.

## Build és Production

A teljes projekt (kliens + szerver) buildelése:

```bash
npm run build
```

Indítás production módban:

```bash
npm run start
```

Production módban az Express szerver szolgálja ki az Angular buildet a `/` útvonalon, és az API-t a `/api` útvonalon. SPA fallback támogatott (minden nem API útvonal az `index.html`-re irányít).

## Környezeti változók (ENV)

A szerver konfigurációja környezeti változókon keresztül történik. A `server/` mappában találhatóak az alábbi fájlok:
- `.env.development`: Fejlesztői környezet (macOS/Windows)
- `.env.production`: Éles környezet (Ubuntu)
- `.env.example`: Példa fájl, ami git-be kerül

### MEDIA_ROOT beállítása
A `MEDIA_ROOT` egy **abszolút útvonal** kell, hogy legyen, ahol a kamera videók találhatóak.

**macOS példa (.env.development):**
```
NODE_ENV=development
PORT=3000
MEDIA_ROOT=/Users/felhasznalonev/Downloads/camera
```

**Ubuntu példa (.env.production):**
```
NODE_ENV=production
PORT=3000
MEDIA_ROOT=/home/gabesz/share/camera
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

## Rendszerkövetelmények (Thumbnail generáláshoz)

A videó előnézeti képek generálásához a szerveren telepítve kell lennie az **ffmpeg** eszköznek.
- **macOS**: `brew install ffmpeg`
- **Ubuntu**: `sudo apt update && sudo apt install ffmpeg`
