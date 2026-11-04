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
| `npm run db:migrate` | Applies database migrations |
| `npm run db:seed` | Creates the three user accounts from `SEED_USERS` |
| `npm run import:season -- --dry-run` | Reports on `import/Season_1.docx` without touching the database |
| `npm run portraits:link` | Checks R2 for each character's portrait, and links any that are missing a key |

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
