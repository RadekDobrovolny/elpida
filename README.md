# Valerie MVP

Prototyp aplikace "Průvodce tvorbou kurzu" dle PRD v `docs/prd_valerie_app.md`.

## Co umí MVP

- anonymní uživatel přes cookie
- knihovna kurzů (`GET/POST /api/course`)
- detail a editace kurzu (`GET/PUT /api/course/:id`)
- chat endpoint (`POST /api/chat`) s personou Valérie
- průchod 5 kroky (oblast, cíl, zkušenosti, kvíz, název)
- UI v čistém TailwindCSS
- průchod kroky přes Progress Bar + klikatelné panely
- SQLite + Prisma
- Docker Compose s Caddy reverse proxy

## Lokální spuštění

1. Volitelně vytvoř `.env` z `.env.example` (pro Gemini klíč).
2. Nainstaluj závislosti:
   - `npm install`
3. Vygeneruj Prisma klienta:
   - `npm run prisma:generate`
4. Spusť dev server:
   - `npm run dev`
5. Otevři `http://localhost:3001`.

`npm run dev` i `npm run start` automaticky provedou `prisma db push`.

## Docker Compose

1. Volitelně nastav `NUXT_GEMINI_API_KEY` v `.env`.
2. Spusť:
   - `docker compose up --build`
3. Otevři `http://localhost`.

## Poznámky

- Pokud není nastavený Gemini API klíč, backend použije fallback odpovědi.
- SQLite databáze je ve výchozím nastavení lokálně v `dev.db`.
