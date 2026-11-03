# Aaron's Writing Collection: Build Plan

A private writing studio for Aaron's anime screenplay series (starting with **Devil Bunny, Season 1**) with a character bible. Three people can log in and all three can edit.

## 1. What we're building

| Area | What it does |
|---|---|
| **Library** | Home page with a card per series/season (Season 1 first), progress and last edited |
| **Script studio** | Season → Episode → Scene → Beats. Beats are typed lines: Dialogue, Visual, Sound, V.O., Action, Note |
| **Character bible** | Character cards with uploaded images (Cloudflare R2), details, and auto-listed appearances |
| **Lore** | Pages for world rules (Hu-mons, Warrior System, gifts, departments) |
| **Reader** | Clean read-only script view, plus export to Word/PDF |
| **Safety** | Login for 3 users only, version history on every scene, one-click full export |

Not included in v1: public pages, comments, real-time co-editing, AI features. All can be added later.

## 2. What the Season 1 master file tells us

Analysed from `Season_1.docx` (about 27,000 words, no embedded images):
- Episodes 1 to 24 with titles. **The heading for Episode 23 is missing** (the file jumps from 22 to 24, "Hell No (Season Finale)"). The importer must not crash on this. Ask Aaron whether 23 exists.
- The "SEASON 1" heading repeats before every episode, so the importer must not create 24 seasons.
- Scene headings look like `Scene 3: The Gift of Ashes`, each with an emoji, followed by a timecode line like `(9:00 - 12:30) CITY STREETS - DAY`.
- Special blocks: Prologue, Opening Theme, Episode Outro, Post-Credit Scene, `(21:00) END EPISODE`.
- About 776 dialogue lines, formatted `NAME: (parenthetical) text`.
- Other line types: `(VISUAL):`, `SOUND:`, `V.O. (...)`, and indented sub-bullets used as action notes.
- Some inconsistencies (trailing spaces, `Sparing`, a stray `a` after a bracket). The importer should import the text as written. Aaron fixes typos later in the editor.

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | One repo, one Railway service, API and UI together |
| Database | **Neon Postgres** | Already chosen; use the *pooled* connection string |
| ORM / migrations | **Drizzle ORM** | Light, typed, simple SQL migrations |
| Images | **Cloudflare R2** (S3-compatible, public `r2.dev` URL) | Browser uploads straight to R2 via presigned URLs; the app stores only the key (e.g. `characters/revoc-eriflleh.png`) and builds the URL from `R2_PUBLIC_URL` |
| Auth | Email + password (bcrypt), signed cookie session, **no signup page**; 3 users seeded from env | Private by default |
| Styling | Tailwind CSS | Fast to theme |
| Docx import | `mammoth` (docx → HTML) + custom parser | Reliable heading and list structure |
| Export | `docx` library for Word; browser print-to-PDF for PDF | No heavy server dependencies |
| Hosting | **Railway** (Nixpacks, env vars in Railway dashboard) | Already chosen |

Secrets (Neon URL, R2 keys, session secret, user passwords) go in `.env.local` and the Railway variables. They never go in prompts or in git.

## 4. Look and feel

Light and bright, blue-led, with a little neon.
- **Background:** soft white-blue `#F5F9FF`, cards white with a thin blue border.
- **Primary:** electric blue `#2563FF`. **Neon accent:** cyan `#00D9FF` for glows, focus rings, active tabs, and small highlights only.
- **Ink:** deep navy `#0B1B3A` for text (not black).
- **Fonts:** headings in **Outfit** (friendly, modern); body in **Inter**; the script editor and reader in **Courier Prime** so it feels like a real screenplay.
- **Character colors:** each character gets a color chip, used on their dialogue names in the editor.
- Subtle neon glow on buttons and active items; light mode only to start.

## 5. Data model

```
users(id, email, name, password_hash)
series(id, title, description, cover_key)            -- "Devil Bunny"
seasons(id, series_id, number, title)
episodes(id, season_id, number, title, status, summary,
         opening_theme, outro_theme)                 -- status: idea | drafting | done
scenes(id, episode_id, position, kind, title, timecode, location,
       beats jsonb, version, updated_by, updated_at)
         -- kind: prologue | scene | outro | post_credit
         -- beats: [{id, type, character?, parenthetical?, text}]
scene_revisions(id, scene_id, beats jsonb, saved_by, saved_at)
characters(id, series_id, name, full_name, role, gift, appearance,
           personality, backstory, color, portrait_key)
character_images(id, character_id, r2_key, caption, position)
scene_characters(scene_id, character_id, line_count)  -- derived on save
lore_entries(id, series_id, title, category, body)
```

Why beats are JSON on the scene: loading and saving a whole scene is one operation, and ordering is trivial. Character appearances come from `scene_characters`, which is rebuilt each time a scene is saved.

Concurrency with three editors: each scene has a `version`. A save with a stale version is rejected and the user is told "Someone else edited this scene. Reload to see their changes." That prevents silent overwrites. Every save also writes a `scene_revisions` row.

## 6. Importer rules (Word → database)

1. Convert docx to HTML with mammoth; walk the paragraphs and list items in order.
2. `SEASON n` sets the current season. Repeats of the same number are ignored.
3. `EPISODE n: TITLE` starts an episode. Strip emoji and trailing spaces. Missing numbers are allowed.
4. `Scene n: Title` starts a scene. A line matching `(m:ss - m:ss) LOCATION` is stored as timecode and location.
5. `Prologue`, `OPENING THEME`, `EPISODE OUTRO`, `POST-CREDIT SCENE` become scenes with the matching `kind`. `END EPISODE` is dropped.
6. Beat typing: `(VISUAL):` → visual, `SOUND:` → sound, `NAME:` (caps) → dialogue (parenthetical split off), `V.O.` → vo, indented bullets → action, anything else → note.
7. Character names found in dialogue are collected and seeded into `characters` (merging cases like `CAPTAIN SARAH CALYDON` into `SARAH`).
8. Produce an **import report** (counts per episode, lines that fell back to "note", warnings) so Aaron can sanity-check before anything is final.
9. The importer is **repeatable**: re-running updates by (season, episode number, scene order), and never deletes edits made on the site without confirmation.

## 7. Build steps (one Claude Code session per step)

Each step ends with something you can open and check, and a git commit.

| # | Step | You can verify |
|---|---|---|
| 0 | Accounts & setup: Neon project, R2 bucket + API token + CORS, Railway project, GitHub repo, `.env` | Connection strings in hand |
| 1 | Project scaffold + theme + Neon connection + migrations | Themed home page runs locally, DB tables exist |
| 2 | Auth: seeded 3 users, login/logout, all pages protected | Logged-out visitors are redirected |
| 3 | Library + season/episode/scene browsing (read-only) with fake seed data | Navigation works |
| 4 | **Docx importer** + import report | Season 1 shows all episodes and scenes |
| 5 | **Script editor**: typed beats, character autocomplete, autosave, versioning, revisions | Edit a scene, refresh, change persists; two tabs trigger the conflict message |
| 6 | Character bible + R2 image upload | Create a card, upload a portrait, see appearances |
| 7 | Episode/season management: reorder, status, summaries, themes | Drag episodes and scenes |
| 8 | Reader view + export (Word/PDF) | Download a clean episode |
| 9 | Lore pages + search | Search finds lines and characters |
| 10 | Deploy to Railway + custom domain (optional) + backups/export | Live URL, all 3 can log in |
| 11 | Polish: empty states, mobile layout, keyboard shortcuts | Passes a click-through |

Order note: deploy (step 10) can move earlier. Deploying after step 2 is a good habit, and then every step goes live.

## 8. Claude Code prompts

Open VS Code in an empty folder named `aarons-writing-collection`, start Claude Code, and paste these one at a time. Wait for each to finish and check it before moving on.

### Prompt 0: project brief (paste once, then keep as `CLAUDE.md`)
```
Create a CLAUDE.md for this project with the following context, then wait for my next prompt.

Project: "Aaron's Writing Collection", a private web app where Aaron writes anime screenplays (first: Devil Bunny, Season 1) and keeps a character bible. Three users, all can edit. No public signup.
Stack: Next.js App Router + TypeScript, Tailwind, Drizzle ORM, Neon Postgres (pooled connection string via DATABASE_URL), Cloudflare R2 for images (S3 API, presigned uploads), email/password auth with bcrypt and signed cookie sessions, hosted on Railway.
Structure: series > seasons > episodes > scenes. Scenes hold an ordered JSON array of typed "beats": dialogue, visual, sound, vo, action, note. Characters have cards with images and an auto-derived list of scenes they appear in.
Design: LIGHT theme, blue-led. Background #F5F9FF, primary #2563FF, neon cyan accent #00D9FF used sparingly for glows and focus, ink #0B1B3A. Fonts: Outfit (headings), Inter (body), Courier Prime (script text).
Rules: never commit secrets; read config from env; every scene save checks a version number and writes a revision row; keep components small; write simple tests for the importer and the save logic; commit after each step with a clear message.
```

### Prompt 1: scaffold
```
Scaffold the app: Next.js (App Router, TypeScript, Tailwind), Drizzle ORM connected to Neon via DATABASE_URL (pooled). Add the tables from the data model in CLAUDE.md (users, series, seasons, episodes, scenes, scene_revisions, characters, character_images, scene_characters, lore_entries) with a first migration and npm scripts for generate/migrate. Set up the theme (colors, Outfit/Inter/Courier Prime via next/font) and a simple app shell with a top bar titled "Aaron's Writing Collection". Add a .env.example with every variable needed. Run the migration against my Neon database and show me the tables.
```

### Prompt 2: auth
```
Add authentication. No signup page. Create a seed script that creates up to three users from env vars (SEED_USERS as a JSON array of {email,name,password}), bcrypt-hashing the passwords. The three users are deanh.adams@gmail.com (Dean), aaroncarteradams2305@gmail.com (Aaron) and 5223105@gmail.com (Kim); put placeholder passwords in .env.example and I'll fill in the real ones locally and in Railway. Build /login, logout, and a signed httpOnly cookie session. Protect every page and API route except /login with middleware. Show the logged-in name in the top bar. Add tests for the protection logic.
```

### Prompt 3: library and browsing
```
Build read-only browsing: a home page with a card per season, a season page listing episodes (number, title, status), an episode page listing its scenes, and a scene page that renders beats in a screenplay style (Courier Prime, character names in caps and colored, visual/sound lines in italics). Seed a small fake season so I can see it. Make it look polished and bright-blue with subtle neon accents.
```

### Prompt 4: docx importer
```
Build the Word importer described in section 6 of PLAN. I'll put Season_1.docx in /import. Use mammoth plus a custom parser in /lib/import. Handle: repeated "SEASON 1" headings, emoji and trailing spaces in headings, a missing Episode 23, timecode+location lines, prologue / opening theme / outro / post-credit scenes, and beat typing (visual, sound, dialogue with parenthetical, vo, action, note). Seed characters from dialogue names, merging variants like CAPTAIN SARAH CALYDON into SARAH. The import must be repeatable without duplicating data. Output an import report (counts per episode, lines that became "note", warnings). Write tests with small sample inputs. Then run it on the real file and show me the report.
```

### Prompt 5: script editor
```
Build the scene editor. Each beat is a row with a type chip. Keyboard: Enter adds a new beat, Tab/Shift+Tab or a dropdown switches type (Dialogue, Visual, Sound, V.O., Action, Note). For Dialogue, show a character picker with autocomplete from the characters table, plus an optional parenthetical field. Support reorder (drag), delete, and undo. Autosave every few seconds with a "Saved / Saving… / Conflict" indicator. Saves send the scene version; if stale, reject with 409 and show "Someone else edited this scene, reload to see their changes" without losing the user's text (offer to copy it). Write a scene_revisions row on each save and add a History drawer to restore an earlier revision. Rebuild scene_characters on save. Add tests for the save and conflict logic.
```

### Prompt 6: characters and images
```
Build the character bible: a gallery page and a character page (name, full name, role, gift/power, appearance, personality, backstory, color) with a "Appears in" list of episodes and scenes from scene_characters. Add image upload to Cloudflare R2: the API issues presigned PUT URLs, the browser uploads directly, and we store only the key. The bucket is public through an r2.dev URL, so build image URLs as `${R2_PUBLIC_URL}/${key}`. Convention: the main portrait key is `characters/<slug>.png`, where slug is the lowercase hyphenated full name (for example `characters/revoc-eriflleh.png`). When a character has no image yet, show a placeholder avatar (initial letter on the character's color) and never a broken image. Add an optional script that, for every character, checks whether the conventional portrait URL exists (HEAD request) and sets portrait_key if so. Support extra images with captions, reorder, delete. Validate type and size (images only, max 10 MB). Document the R2 CORS settings I need to configure.
```

### Prompt 7: structure management
```
Add episode and scene management: create/rename/delete episodes and scenes with a confirm dialog, drag to reorder, edit episode status (idea / drafting / done), summary, opening and outro theme fields. Show a season overview with a status progress bar.
```

### Prompt 8: reader and export
```
Add a Reader view for an episode and a whole season (clean, distraction-free, Courier Prime, page-like layout). Add export to Word (.docx) for an episode or a season, formatted like the original document (timecodes, scene headings, dialogue). Add print styles so browser print-to-PDF looks good. Add a "Download everything" backup: a zip with JSON of all content and a docx of each season.
```

### Prompt 9: lore and search
```
Add Lore: pages grouped by category (World, Powers, Organisations, Places), a simple rich-text or markdown editor, and linking. Add global search (Postgres full-text) over scene text, episode titles, characters and lore, with results that jump to the exact scene.
```

### Prompt 10: deploy to Railway
```
Prepare for Railway: add a start/build config, a health check route, and make sure migrations run safely at deploy. List every environment variable I must set in Railway. Add a README section "Deploying" with step-by-step instructions. Make sure no secrets are in the repo and .env files are gitignored.
```

### Prompt 11: polish
```
Polish pass: empty states, loading skeletons, error pages, mobile layout, focus states, keyboard shortcuts cheat sheet, and a consistent neon-blue hover/active style. Fix anything that looks too dark; keep it bright.
```

## 9. Accounts and setup (step 0 checklist)

- **Neon:** create a project, copy the **pooled** connection string. Use a separate branch for dev if you like.
- **Cloudflare R2:** bucket (already public via its `pub-….r2.dev` URL), an API token with read/write on that bucket only, set CORS to allow `PUT` and `GET` from `http://localhost:3000` and the Railway domain. Note: `r2.dev` URLs are meant for light use and anyone with a link can open an image; that's fine for this project, and a custom domain can be added later if needed.
- **Railway:** new project from the GitHub repo; add the env vars; no Railway database needed because Neon is used.
- **GitHub:** private repo for the code.
- **Costs:** Neon, R2 and a small Railway service at this scale are free or a few dollars a month.

## 10. Risks and decisions

| Risk | Plan |
|---|---|
| Three people editing the same scene | Version check + revisions; conflicts are shown, never silently overwritten |
| Losing the work | Revision history, "Download everything" zip, Neon point-in-time restore |
| Messy source formatting | Import report; unknown lines become Notes rather than being dropped |
| Railway wipes local disk | Nothing is stored on disk; images in R2, data in Neon |
| Missing Episode 23 | Importer tolerates gaps; ask Aaron whether it exists |

## 11. Open questions

**Settled:**
- Railway's default URL is fine, no custom domain.
- Accounts: `deanh.adams@gmail.com` (Dean), `aaroncarteradams2305@gmail.com` (Aaron), `5223105@gmail.com` (Kim). All three can edit.
- Images are in the public R2 bucket at `characters/<slug>.png`; placeholders show until the real files exist.

**Still open:**
1. Is there an Episode 23, or is the numbering a typo? Left as is for now; the importer tolerates the gap.
