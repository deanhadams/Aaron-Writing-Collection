# Aaron's Writing Collection

A private web app where Aaron writes anime screenplays and keeps a character bible. See [CLAUDE.md](CLAUDE.md) for the data model and design system.

## Setup

1. Copy `.env.example` to `.env.local` and fill in real values. Never commit real values.
2. `npm install`
3. `npm run db:migrate`
4. `npm run db:seed:users`
5. `npm run dev`

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app at http://localhost:3000 |
| `npm test` | Runs the tests |
| `npm run test:e2e` | Clicks every season and episode action in Edge |
| `npm run db:migrate` | Applies database migrations |
| `npm run db:seed:users` | Creates the accounts in `SEED_USERS` that don't exist yet. Never changes an existing password |
| `npm run db:seed` | Sets the name and password of everyone in `SEED_USERS`, including existing accounts |
| `npm run check:deploy` | Lint, types, tests, the environment check and a production build |
| `npm run import:season -- --dry-run` | Reports on `import/Season_1.docx` without touching the database |
| `npm run lore:seed` | Adds the starter lore entries, titles and categories only. Safe to run again |
| `npm run export:check` | Exports every season to Word and reads it back with the importer, listing any difference. Read-only |
| `npm run portraits:link` | Checks R2 for each character's portrait, and links any that are missing a key |

## Deploying to Railway

Before pushing, run `npm run check:deploy`. It runs lint, types, tests, the environment check and a production build, and stops at the first failure.

[railway.json](railway.json) already holds the build command, the start command, the health check at `/api/health`, restart on failure, and the pre-deploy command that runs migrations.

### First deploy

1. **Create the project.** In Railway, choose New Project, then Deploy from GitHub repo, and pick this repository.

2. **Set the variables.** Open the service, then Variables, and add each of these. The app refuses to start, and says which are wrong, if any are missing or still a placeholder.

   | Variable | Where to get it |
   |---|---|
   | `DATABASE_URL` | Neon dashboard, Connect, your production branch, with **Connection pooling on** (the host contains `-pooler`) |
   | `SESSION_SECRET` | Run `openssl rand -base64 32`. Use a new one here, not your local one |
   | `R2_ACCOUNT_ID` | Cloudflare dashboard, R2 overview, Account ID |
   | `R2_ACCESS_KEY_ID` | Cloudflare, R2, Manage R2 API Tokens, Create API token, with Object Read & Write on your bucket |
   | `R2_SECRET_ACCESS_KEY` | Shown once, when you create that token |
   | `R2_BUCKET` | The bucket's name |
   | `R2_PUBLIC_URL` | R2, your bucket, Settings, Public access. No trailing slash |
   | `SEED_USERS` | Only for step 5, and remove it afterwards. See `.env.example` for the format |

3. **Migrations run by themselves.** The pre-deploy command is `npm run db:migrate`, which runs before each deploy goes live, so the app never starts against an old schema. If it fails, the deploy stops and the old version keeps running. It only applies migrations not yet recorded, so running it twice changes nothing.

4. **Generate the domain.** In the service, open Settings, Networking, then Generate Domain.

5. **Create the accounts, once.** Install the [Railway CLI](https://docs.railway.com/guides/cli), then:

   ```
   railway login
   railway link
   railway run npm run db:seed:users
   ```

   This only creates people who don't exist yet, and never changes an existing password. Then delete `SEED_USERS` from Railway, so the passwords aren't left there.

6. **Add the domain to the R2 CORS rules.** In Cloudflare, open R2, your bucket, Settings, CORS Policy, and paste this with your real domain. Without it, uploads fail with "The upload was blocked".

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://YOUR-APP.up.railway.app"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

7. **Check it works.**
   - Open the domain and log in.
   - Upload a portrait on a character's edit page.
   - Press Ctrl+K and search for a name.
   - Open a season and click Download Word.
   - Open the account menu and click Download everything.
   - Visit `/api/health`, which should show `{"status":"ok"}`.

### Day to day

**Run a one-off command.** `railway run <command>` runs it on your computer with Railway's variables, for example `railway run npm run lore:seed`. To run it inside the deployed service instead, use `railway ssh`.

**See logs.** Open the service, then Deployments, pick one, and choose View logs. Or run `railway logs`.

**Roll back a deploy.** Open Deployments, find the last good one, open its menu and choose Rollback. This restores the code only. A database migration from the newer deploy stays applied, so if the old code can't work with it, restore the database as well (below).

**Restore data.** Neon keeps a history of the database, so you can go back in time without a backup file.

1. In the Neon dashboard, open your project, then Backup & Restore.
2. Pick the production branch, and a moment before the problem.
3. Look before you leap: use Preview to run a query against that moment, or create a branch from it and point a local copy of the app at that branch.
4. Choose Restore. Neon saves the old state as a backup branch, so a restore can be undone.

How far back you can go depends on your Neon plan, so check the restore window in your project's settings. Images live in R2 and are not part of this. The Download everything zip is a second copy of the writing, so take one now and then.

### Keep development away from production

Local work should never run against the real writing. Use a separate Neon branch, which starts as a full copy and can't touch production:

1. In Neon, open Branches, then Create branch, name it `development`, and branch from production.
2. Open Connect for that branch and copy its pooled connection string.

| Where | `DATABASE_URL` |
|---|---|
| Railway | The **production** branch |
| `.env.local` on your computer | The **development** branch |

To be warned when that goes wrong, set these in `.env.local`:

```
PRODUCTION_DB_HOST_HINT=ep-your-production-host
APP_ENV_LABEL=Production database
```

The hint is any part of your production Neon host. In development, a red banner then appears if `DATABASE_URL` points there. It shows only the label, never the address.

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

`npm run test:e2e:prod` does the same against the last production build, starting and stopping it on port 3200, so run `npm run build` first. To test another address, start the site and point the suite at it:

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
