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

| Token | Value | Use |
|---|---|---|
| Background | `#F5F9FF` | Page background |
| Primary | `#2563FF` | Main blue |
| Neon accent | `#00D9FF` | Sparingly, for glows and focus |
| Ink | `#0B1B3A` | Text |

Fonts: **Outfit** (headings), **Inter** (body), **Courier Prime** (script text).

## Rules

- Never commit secrets.
- Read config from env.
- Every scene save checks a version number and writes a revision row.
- Keep components small.
- Write simple tests for the importer and the save logic.
- Commit after each step with a clear message.
