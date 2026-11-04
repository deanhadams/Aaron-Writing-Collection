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
- `beat.character` is text, not a foreign key, and may match no `characters` row: voice labels like `INTERCOM` (`vo` beats with no card) and shared lines like `REVOC & DESRUC` (`splitSpeakers` credits each person). The editor must accept these, and `scene_characters` skips names with no row.

## Data model

```
users(id, email, name, password_hash)
series(id, title, description, cover_key)
seasons(id, series_id, number, title, summary, version)
         -- version also guards the list of episodes
episodes(id, season_id, number, title, status, summary,
         opening_theme, outro_theme, version, scenes_version,
         import_key, deleted_at, deleted_by)
         -- status: idea | drafting | done
         -- version: its own fields. scenes_version: its list of scenes
         -- number is unique among live episodes only
scenes(id, episode_id, position, kind, title, timecode, location,
       beats jsonb, version, updated_by, updated_at,
       import_key, import_season_id, deleted_at, deleted_by)
         -- kind: prologue | scene | outro | post_credit
         -- beats: [{id, type, character?, parenthetical?, text}]
         -- import_key: its place in the Word file, like e12:s3. Empty if made on the site
scene_revisions(id, scene_id, beats jsonb, title, timecode, location, sealed,
                saved_by, saved_at)
         -- autosaves share a row per person per 5 minutes; sealed rows never merge
scene_presence(scene_id, user_id, last_seen)        -- editor heartbeat
characters(id, series_id, name, full_name, role, gift, appearance,
           personality, backstory, powers, notes, color, portrait_key,
           slug, aliases text[], version, updated_by, updated_at)
character_relationships(id, character_id, related_id, note, position)
character_images(id, character_id, r2_key, caption, position)
scene_characters(scene_id, character_id, line_count)
         -- derived on save. Deleted scenes have no rows until restored
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
| `danger` | `#B3261E` | Destructive actions: delete buttons and menu items |
| `status-idea` | `#5B3BD6` | Idea pill text, on 15% violet mixed with white |
| `status-drafting` | `#0B6A85` | Drafting pill text, on 15% cyan mixed with white |
| `status-done` | `#0B6B3C` | Done pill text, on 15% of itself mixed with white |

### Scene kind colors

Set by `data-kind` on an element, as `--kind` (exact color, decoration only) and `--kind-text` (AA on white, for labels and numbers).

| Kind | `--kind` | `--kind-text` |
|---|---|---|
| `prologue` | `#7C5CFF` | `#5B3BD6` |
| `scene` | `#2563FF` | `#1A45C4` |
| `outro` | `#00D9FF` | `#0B6A85` |
| `post_credit` | `#FF4FA3` | `#B01C72` |

### Episode covers

`coverStyle(number)` in [components/library/episode-cover.tsx](components/library/episode-cover.tsx) cycles through six gradients. It sets `--cover-a/b/c`, `--cover-angle`, `--accent` (decoration) and `--kind-text` (AA text). `--cover-a` must stay dark enough for white text. Status colors: idea `violet`, drafting `neon`, done `#22C55E` for dots and bars, with the `status-*` colors for their text.

### Season covers

Always dark, whatever the page around them. The palette is the `--season-*` variables in `:root`: tune it there. `--season-edge-magenta` and `--season-edge-teal` are fixed corner layers over the gradient, so they stay lower right at every `--cover-angle`. No bright pink, bright cyan or pastel areas inside the cover; `--season-rim` and the numeral glow are the only cyan, both low strength. All text on the cover is white, and its chip overrides the light pill.

### Gradients (CSS variables)

| Variable | Stops | Use |
|---|---|---|
| `--gradient-signature` | `#2563FF` → `#7C5CFF` → `#00D9FF` | Decoration only: borders, progress bars, lines |
| `--gradient-cover-stops` | navy → indigo → dark blue → dark violet | Season cover art. Stops only: a `var()` inside a `:root` gradient is fixed at `:root`, so build the gradient where `--cover-angle` is set |
| `--gradient-text` | `#1D4ED8` → `#6236E8` → `#0E7490` | Gradient headings (`text-gradient`) |
| `--gradient-text-shift` | Same hues, reordered | The hero title's crossfade |
| `--gradient-button` | `#2563FF` → `#6B46F5` → `#0A78B5` | Anything with white text on it |

The text and button gradients are deepened versions of the signature, because cyan is about 1.6:1 on the background and white on `#7C5CFF` is 4.35:1. Never put text on `--gradient-signature`.

### Components and utilities

- **Surfaces:** `glass` (frosted card with gradient hairline), `glass-link` (adds hover lift and glow), `script-page` (the white script sheet).
- **Type:** `text-gradient`, `eyebrow` (small uppercase tracked label), `numeral-outline` (big outlined number; on dark art set `--numeral`, `--numeral-fill: black` and `--numeral-blend: screen`).
- **Controls:** `btn-primary`, `btn-ghost`, `field`.
- **Location:** always use `LocationChips`, which runs `parseLocation`. `place-chip` takes its color from the nearest `data-kind`; `time-chip` takes `data-tone` (`day`, `morning`, `evening`, `night`).
- **Shadows:** `shadow-soft`, `shadow-glow`, `shadow-page`.
- **Motion:** `rise` (fade-up; set `--i` for stagger), `page-enter`, `skeleton` (shimmer), `--ease-soft`.

Fonts: **Outfit** (headings), **Inter** (body), **Courier Prime** (script text only).

### Characters

`--char` is a character's exact color, for decoration; `--char-text` (`readableColor`) is the same hue passing AA on white. `characterStyle(color)` sets both. Always show portraits through `Portrait`, which lays the image over the initial as a background, so a missing file never shows a broken image. `beat.character` matches a card by `name` or `aliases`, so use `castLookups`, and any new rebuild of `scene_characters` must include aliases.

### Scene editor

Beat rows take their color from `data-beat` (`--beat` for decoration, `--beat-text` for AA text). `lib/editor/store.ts` and `save-queue.ts` are plain objects outside React: rows subscribe to their own beat, and saves outlive a hidden route. Scene writes go through `saveScene`, `restoreRevision` or `updateSceneDetails` in `lib/scenes/save-scene.ts`.

### Season and episode management

Pages use a board (`lib/structure/board.ts`, `useBoard`): a plain object outside React that keeps what the server confirmed apart from what is in flight, and runs requests one at a time. `useFeedback` adds toasts, the conflict message and the refresh when a hidden route comes back.

- Soft delete sets `deleted_at` for 30 days. Read through `liveScene` and `liveEpisode` in `lib/db/live.ts`. A scene in a deleted episode keeps an empty `deleted_at`, so a restore brings back exactly what was live.
- Delete, restore, reorder and move leave a scene's `version` and `updated_at` alone: they would give open editors a false conflict, and the importer would see an edit. They bump the list's version instead.
- `ActionMenu` portals to the body, so no card can clip it, and becomes a bottom sheet on phones. It follows its trigger on scroll rather than closing, because a scroll can arrive just after it opens. Pass `keepFocusOn` when a row moves its own card.
- `displayTitle` shows titles written in capitals as title case. It is display only: never save its result.
- Rebuilds of `scene_characters` go through `rebuildSceneLinks` with live scenes only.
- `lib/images.ts` reads a server setting, so it returns nothing in the browser. Pass finished urls to client components.
- The importer matches on `import_key`, never on position, and never writes a position, number or episode to a row that exists.

### Motion and performance rules

- Animate `transform` and `opacity` only, under 300ms for interactions. Put glows on a pseudo-element and fade its opacity rather than animating `box-shadow`.
- Prefer CSS animation. It works in Server Components and needs no JavaScript.
- `prefers-reduced-motion` is handled once, at the end of `globals.css`. Elements must look finished with their animation removed.
- Decorative and hover-only elements still count towards page width on phones, even at `opacity: 0`, and `overflow-x: clip` on `body` hides this from `scrollWidth`. Hide them under `@media (hover: none)`.
- Mesh blobs are radial gradients, not blur filters. Phones drop `backdrop-filter` on cards, so keep blur layers few.

## Rules

- Never commit secrets.
- Read config from env.
- Every scene save checks a version number and writes a revision row.
- Keep components small.
- Write simple tests for the importer and the save logic.
- Commit after each step with a clear message.
