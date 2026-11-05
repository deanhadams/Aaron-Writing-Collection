# Aaron's Writing Collection

A private web app where Aaron writes anime screenplays and keeps a character bible. See [CLAUDE.md](CLAUDE.md) for the data model and design system.

## Setup

1. Copy `.env.example` to `.env.local` and fill in real values. Never commit real values.
2. `npm install`
3. `npm run db:migrate`
4. `npm run db:seed`
5. `npm run dev`

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app at http://localhost:3000 |
| `npm test` | Runs the tests |
| `npm run test:e2e` | Clicks every season and episode action in Edge |
| `npm run db:migrate` | Applies database migrations |
| `npm run db:seed` | Creates the three user accounts from `SEED_USERS` |
| `npm run import:season -- --dry-run` | Reports on `import/Season_1.docx` without touching the database |
| `npm run lore:seed` | Adds the starter lore entries, titles and categories only. Safe to run again |
| `npm run export:check` | Exports every season to Word and reads it back with the importer, listing any difference. Read-only |
| `npm run portraits:link` | Checks R2 for each character's portrait, and links any that are missing a key |

## Reading and exporting

The reader is at `/read/<season>` for a whole season and `/read/<season>/<episode>` for one episode. Keys: J or → next scene, K or ← previous scene, ] next episode, [ previous episode. Text size and the other settings are kept in the browser. The last scene read is kept per person in the database, so it follows them between devices.

To make a PDF, open the reader and choose Print or save as PDF from the … menu. Print the season reader for a whole season. Edge and Chrome show the episode title and page number in the page margins; other browsers may leave them out.

Word files come from the Download Word buttons, or `/api/export/seasons/<id>` and `/api/export/episodes/<id>`. Every line is checked against the importer's parser as it is written, so an export can be imported again. A beat that a plain line would misread gets a label like `(NOTE):` or `(ACTION):`.

Download everything, in the account menu, streams a zip:

| Path | Contents |
|---|---|
| `content/*.json` | Every table of writing, including soft-deleted rows and scene revisions. No user accounts |
| `word/*.docx` | One file per season |
| `manifest.json` | The time, row counts, and every image's R2 key and public URL. The images themselves are not included |

Each download is recorded in `backups_log`.

## Search

Press Ctrl+K or Cmd+K anywhere, or use the search button in the top bar. Enter opens the highlighted result, and the full results page is at `/search`.

| Type this | To find |
|---|---|
| `Desruc` | Any match. Prefixes count, and a slip like `Revok` still finds Revoc |
| `"air force"` | Those words together, in that order |
| `force -air` | Scenes with force and without air |
| `speaker:Revoc` | Scenes where Revoc speaks, through aliases too |
| `kind:outro` | A scene kind: prologue, scene, outro or post-credit |
| `ep:3-5` | Episodes 3 to 5 |

A scene result opens in whichever view you were last in, the reader or the scene page, at the exact line.

Text search needs the `pg_trgm` extension, which migration 0006 turns on.

## Lore

Entries live at `/lore`. Text is markdown, autosaved like scenes, with a History drawer. Link anything with `[[Character Name]]` or `[[Lore Title]]`: typing `[[` offers names, and a name with no entry shows a Create entry button. Other names in an entry's details feed both those links and Mentioned in.

To change the categories, edit `LORE_CATEGORIES` in `lib/lore/categories.ts`.

Covers and inline images go through the same R2 upload as character images, under `lore/<slug>/`.

## Browser tests

`npm run test:e2e` drives the real site in Edge and clicks every action on the season and episode pages, then reloads to prove each change was saved. It uses the running dev server on port 3000, or starts one.

Each test makes a throwaway season numbered 9000 with the title E2E, and deletes it afterwards, so real writing is never touched. It needs the database in `.env.local`.

To test another address or a production build, start the site and point the suite at it:

```
E2E_BASE_URL=http://localhost:3100 npm run test:e2e
```

## Re-importing a season

`npm run import:season` can be run again after the Word file changes. Every episode and scene from the file carries an import key, like `e12:s3`, which is its place in the file. A re-import matches on that key, so nothing on the site confuses it:

| On the site | What a re-import does |
|---|---|
| Scenes or episodes reordered, or a scene moved to another episode | Updates each in place and keeps the site's order |
| Scene or episode added | Leaves it alone. It has no key |
| Scene or episode edited | Skips it and lists it as protected. `--force` overwrites it |
| Scene or episode deleted | Leaves it deleted, even with `--force`, and lists it. After the 30 days it is gone, and a re-import adds it again |
| Character merged or renamed | Matches the old name through the card's aliases, so no card comes back |

Episode status and summary always stay as the site has them. A new episode in the file whose number is taken goes to the next free number, and the report says so.

A key is a place, not an identity. If a scene is inserted in the middle of the Word file, every later scene in that episode shifts onto the next key. Unedited scenes simply update to the new text, but edited scenes are listed as protected, so read that list before using `--force`.

## Images and R2

Images live in a public Cloudflare R2 bucket. The database stores only the key, and display URLs are `${R2_PUBLIC_URL}/${key}`.

| Image | Key |
|---|---|
| Main portrait | `characters/<slug>.png` (the extension follows the file type) |
| Extra images | `characters/<slug>/<random-id>.<ext>` |

Uploads go straight from the browser to R2. The app checks the session, type (PNG, JPG, WebP or GIF) and size (10 MB at most), then returns a presigned PUT URL that lasts five minutes. The URL signs the exact type and size, so R2 refuses anything else.

Set these in `.env.local` and in Railway:

```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PUBLIC_URL
```

### CORS rules for the bucket

Without these rules, the browser blocks every upload, and the upload zone shows "The upload was blocked". In the Cloudflare dashboard, open **R2 > your bucket > Settings > CORS Policy > Add CORS policy**, and paste this, replacing the Railway address with your own:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://YOUR-APP.up.railway.app"
    ],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Changes can take a few seconds to apply.

### Testing an upload

1. Run `npm run dev` and log in.
2. Open **Characters**, then any character.
3. Under **Gallery**, drop in a PNG, JPG, WebP or GIF under 10 MB, choose a file, or paste an image. A progress bar runs, then the image appears.
4. Click the image to open the lightbox, and add a caption.
5. For a portrait, choose **Edit** and use **Upload a new portrait**.

Things to try when it fails:

| What you see | Cause |
|---|---|
| "The upload was blocked" | The CORS rules are missing, or your address is not in `AllowedOrigins` |
| "Storage refused the upload (403)" | The R2 keys are wrong, or the link expired after five minutes |
| "Image storage is not set up" | One of the `R2_` variables is missing |
| "Only PNG, JPG, WebP and GIF" | The file type is not allowed |

Deleting an image removes it from the app but leaves the file in R2. A new portrait of the same type replaces the old file, and one of a different type leaves the old file behind.
