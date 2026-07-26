# Malerfirma Kurt Hansen – sagssystem

Webbaseret sagsstyring til malerfirmaet: sager med interaktive plantegninger,
hvor vægge markeres, tildeles farver, fotograferes fra smartphone og (senere)
kvalitetssikres.

## Teknologi

- **Next.js** (React + TypeScript) som PWA – virker på smartphone/tablet i browseren
- **Supabase** – login, brugerroller, database (Postgres) og billedlagring
- **Konva** – interaktiv plantegning (tegn vægge og rum ovenpå tegningen)
- **pdf.js** – konverterer uploadede PDF-plantegninger til billeder i browseren

## Kom i gang

### 1. Opret et Supabase-projekt

1. Gå til [supabase.com](https://supabase.com) og opret et (gratis) projekt.
2. Åbn **SQL Editor** i Supabase og kør hele indholdet af
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   Det opretter tabeller, adgangsregler (RLS) og storage-buckets.

### 2. Miljøvariabler

Kopiér `.env.example` til `.env.local` og udfyld værdierne fra
Supabase → **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### 3. Opret den første admin-bruger

```bash
npm install
node scripts/create-admin.mjs admin@firma.dk MinKode1234 "Kurt Hansen"
```

### 4. Start systemet

```bash
npm run dev
```

Åbn [http://localhost:3000](http://localhost:3000) og log ind.
Yderligere brugere (malere og kontor) oprettes under **Brugere** i systemet.

## Arbejdsgang

1. **Kontoret** opretter en sag (sagsnummer, kunde, adresse) og uploader en
   plantegning (PDF eller billede).
2. I **Redigér tegning** tegnes rum (tryk hjørnerne af) og vægge (tryk og træk)
   ovenpå plantegningen – nemmest på tablet. Hver væg tildeles en farve, som
   vises direkte på tegningen.
3. Kontoret tildeler malere til sagen. Malere ser kun deres egne sager.
4. **Maleren i felten** åbner sagen på smartphonen, trykker på en væg,
   trykker "Tag billede" – kameraet åbner, og billedet knyttes automatisk
   til præcis den væg. En grøn prik på tegningen viser, at væggen har billeder.
5. Noter kan skrives pr. rum af både kontor og malere.

## Roller

| Rolle | Kan |
|---|---|
| **Kontor/admin** | Alt: oprette sager/brugere, redigere tegninger, farver, se alle sager |
| **Maler** | Se tildelte sager, tage billeder af vægge, skrive noter |

## Kommende faser

- **Fase 2:** Automatisk væg-genkendelse ved upload (forslag som rettes i editoren)
- **Fase 3:** Kvalitetssikring – før/efter-billeder pr. væg, status pr. væg
  (datamodellen er forberedt: vægge har status, billeder har type DOK/KS)
