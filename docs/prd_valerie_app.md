# PRD – AI průvodce tvorbou kurzu (Valérie)

## 🧭 Název produktu
Průvodce tvorbou kurzu (Valérie)

---

## 🎯 Cíl produktu
Pomoci uživatelům (primárně seniorům) vytvořit návrh vzdělávacího kurzu pomocí strukturovaného procesu a podpůrného AI chatbota.

---

## 👤 Cílová skupina
- Senioři
- Lidé bez zkušenosti s tvorbou kurzů
- Uživatelé, kteří chtějí předávat své znalosti

---

## 🤖 Role AI (Valérie)

### Persona
- žena ~60 let
- milá, podporující
- tyká, ale respektuje
- krátké a srozumitelné odpovědi

### Role
- facilitátor (ne autor)
- pomáhá překonat autorský blok
- nabízí příklady a otázky

---

## 🧩 Hlavní user flow

### Layout
- Levý panel: strukturovaný výstup
- Pravý panel: chat

---

## 🔄 Kroky procesu
1. Oblast kurzu
2. Cíl kurzu
3. Znalosti a zkušenosti
4. Kvíz (3 otázky, 3 odpovědi, 1 správná)
5. Název kurzu

---

## 🧠 Behavior Valérie
- krátké odpovědi (2–4 věty)
- jednoduchý jazyk
- jemná motivace
- nepíše obsah za uživatele

---

## 🧱 Datový model (MVP)

```json
{
  "id": "uuid",
  "domain": { "raw": "", "final": "" },
  "goal": { "raw": "", "final": "" },
  "experience": { "raw": "", "final": "" },
  "quiz": [],
  "title": { "raw": "", "final": "" }
}
```

---

## 💾 Ukládání dat
- SQLite
- Prisma ORM
- anonymní user ID v cookie

---

## 📚 Knihovna kurzů
- seznam kurzů
- detail kurzu
- editace (formulář)

---

## 🧪 MVP scope
- bez loginu
- bez exportu
- bez hlasu

---

# 🧰 Technický stack (MVP)

## Frontend
- Nuxt 4
- TypeScript
- Tailwind CSS

## Backend
- Nuxt server routes (API)
- Prisma ORM
- SQLite databáze

## AI
- Google Gemini API (server-side)

## Infrastrukturа
- Docker Compose
- Caddy (reverse proxy + HTTPS)

---

## 🐳 Docker Compose služby
- web (Nuxt app)
- caddy (reverse proxy)
- volume pro SQLite

---

## 🔌 API návrh (MVP)

### POST /api/chat
- vstup: message, course_id, step
- výstup: response, updated_step_data

### POST /api/course
- vytvoření nového kurzu

### GET /api/course
- seznam kurzů

### GET /api/course/:id
- detail kurzu

### PUT /api/course/:id
- update kurzu

---

## 🚀 Další fáze
- voice input/output
- export kurzu
- sdílení kurzů
