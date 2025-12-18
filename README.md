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

## API Végpontok

- `GET /api/health`: Ellenőrzi a szerver állapotát. Visszatérési érték: `{ "ok": true, "ts": "<ISO timestamp>" }`
