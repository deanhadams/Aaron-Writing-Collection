# Aaron's Writing Collection

A private web app where Aaron writes anime screenplays (first: **Devil Bunny, Season 1**) and keeps a character bible. Three users, all can edit. No public signup.

The full build plan is in [aarons-writing-collection-plan.md](aarons-writing-collection-plan.md): build steps, importer rules (section 6), risks and open questions. "PLAN" in a prompt means this file.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS
- Drizzle ORM
- Neon Postgres (pooled connection string via `DATABASE_URL`)
- Cloudflare R2 for images (S3 API, presigned uploads)
- Email/password auth with bcrypt and signed cookie sessions
- Hosted on Railway

## Structure

Series > seasons > episodes > scenes.

- Scenes hold an ordered JSON array of typed **beats**: `dialogue`, `visual`, `sound`, `vo`, `action`, `note`.
- Characters have cards with images and an auto-derived list of the scenes they appear in.

## Data model

```
users(id, email, name, password_hash)
series(id, title, description, cover_key)
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

## Design

LIGHT theme, blue-led.

Tokens live in [app/globals.css](app/globals.css). Use the Tailwind names below (`bg-primary`, `text-muted`, `glass`), not raw hex values.

### Colors

| Tailwind name | Value | Use |
|---|---|---|
| `background` | `#F5F9FF` | Page background |
| `primary` | `#2563FF` | Main blue, large text and graphics |
| `primary-strong` | `#1A45C4` | Small blue text (labels, links); `primary` fails AA on glass and mesh |
| `neon` | `#00D9FF` | Cyan. Decoration only: glows, focus, borders, bars. Never text |
| `violet` | `#7C5CFF` | Gradients and highlights only |
| `pink` | `#FF4FA3` | Gradients and highlights only |
| `ink` | `#0B1B3A` | Text |
| `muted` | `#475372` | Secondary text. Use this, not `ink` with opacity |
| `line` | `#D6E4FF` | Hairlines, progress track |
| `status-idea` | `#5B3BD6` | Idea pill text, on 15% violet mixed with white |
| `status-drafting` | `#0B6A85` | Drafting pill text, on 15% cyan mixed with white |
| `status-done` | `#0B6B3C` | Done pill text, on 15% of itself mixed with white |

### Gradients (CSS variables)

| Variable | Stops | Use |
|---|---|---|
| `--gradient-signature` | `#2563FF` → `#7C5CFF` → `#00D9FF` | Decoration only: borders, progress bars, lines |
| `--gradient-cover` | blue → violet → pink → cyan | Season cover art; set `--cover-angle` per season |
| `--gradient-text` | `#1D4ED8` → `#6236E8` → `#0E7490` | Gradient headings (`text-gradient`) |
| `--gradient-text-shift` | Same hues, reordered | The hero title's crossfade |
| `--gradient-button` | `#2563FF` → `#6B46F5` → `#0A78B5` | Anything with white text on it |

The text and button gradients are deepened versions of the signature, because cyan is about 1.6:1 on the background and white on `#7C5CFF` is 4.35:1. Never put text on `--gradient-signature`.

### Components and utilities

- **Surfaces:** `glass` (frosted card with gradient hairline), `glass-link` (adds hover lift and glow), `script-page` (the white script sheet).
- **Type:** `text-gradient`, `eyebrow` (small uppercase tracked label), `numeral-outline` (big outlined number; on dark art set `--numeral`, `--numeral-fill: black` and `--numeral-blend: screen`).
- **Controls:** `btn-primary`, `btn-ghost`, `field`, `chip`.
- **Shadows:** `shadow-soft`, `shadow-glow`, `shadow-page`.
- **Motion:** `rise` (fade-up; set `--i` for stagger), `page-enter`, `skeleton` (shimmer), `--ease-soft`.

Fonts: **Outfit** (headings), **Inter** (body), **Courier Prime** (script text only).

### Motion and performance rules

- Animate `transform` and `opacity` only, under 300ms for interactions. Put glows on a pseudo-element and fade its opacity rather than animating `box-shadow`.
- Prefer CSS animation. It works in Server Components and needs no JavaScript.
- `prefers-reduced-motion` is handled once, at the end of `globals.css`. Elements must look finished with their animation removed.
- Mesh blobs are radial gradients, not blur filters. Phones drop `backdrop-filter` on cards, so keep blur layers few.

## Rules

- Never commit secrets.
- Read config from env.
- Every scene save checks a version number and writes a revision row.
- Keep components small.
- Write simple tests for the importer and the save logic.
- Commit after each step with a clear message.
