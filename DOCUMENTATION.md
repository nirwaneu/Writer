# VibeDraft Documentation

This guide covers deployment, configuration, the AI writing workflow, advanced prompt injection, data management, and troubleshooting.

VibeDraft is a self-hosted, single-user application. It is designed to run on a homelab server, a VPS, or a local machine behind Docker.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Requirements](#requirements)
3. [Docker Setup](#docker-setup)
4. [Environment Variables](#environment-variables)
5. [First Run](#first-run)
6. [LAN Access and Port Binding](#lan-access-and-port-binding)
7. [Hermes Agent GitOps Updates](#hermes-agent-gitops-updates)
8. [AI Workflow](#ai-workflow)
9. [Advanced Prompting](#advanced-prompting)
10. [Image Generation](#image-generation)
11. [Reading Mode](#reading-mode)
12. [Data Management](#data-management)
13. [Backup and Restore](#backup-and-restore)
14. [Security Notes](#security-notes)
15. [Troubleshooting](#troubleshooting)
16. [Development](#development)

---

## Architecture

VibeDraft is one Next.js application. There is no separate production backend service.

- The UI and API routes run in the same container.
- Provider calls are made server-side, so API keys never reach the browser.
- SQLite stores settings, presets, books, chapters, characters, and chat history.
- Manuscript text is stored as Markdown under the data volume.
- Generated illustrations and covers are stored as local files under the data volume.

The production container listens on `0.0.0.0:3000` internally. Docker Compose publishes it on host port `3008` by default.

The optional `npm run mock-ai` server on port `8787` is for development only. It is not part of the production Compose stack.

---

## Requirements

- Docker Engine and Docker Compose v2
- A machine with enough disk for manuscripts, SQLite, and generated images
- An OpenAI-compatible provider such as NanoGPT or OpenRouter
- Optional: a reverse proxy such as Caddy, Traefik, or nginx for HTTPS

Recommended providers:

- **NanoGPT** — tested and recommended for token-efficient, uncensored, and reliable generation. [Create an account](https://nano-gpt.com/subscription/weB4cFpW).
- **OpenRouter** — useful for routing across many text and image models.

---

## Docker Setup

Clone the repository and create your environment file:

```bash
git clone <your-repository-url>
cd vibedraft
cp .env.example .env
```

Edit `.env`:

```dotenv
APP_USERNAME=writer
APP_PASSWORD="change-this-password"
SESSION_SECRET=
DATA_DIR=./data
```

Generate a session secret:

```bash
openssl rand -base64 32
```

Start the application:

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
docker compose logs -f vibedraft
```

Open:

```text
http://<server-ip>:3008
```

### Persistent Data

The Compose file bind-mounts the host data directory:

```yaml
volumes:
  - ./data:/data
```

Everything important lives under that mount:

```text
data/
├── vibedraft.db
└── novels/
    └── <slug>/
        ├── chapters/
        │   ├── chapter_1.md
        │   └── .history/
        └── illustrations/
```

Rebuilding the image does not remove `./data`.

### Linux Permissions

The container entrypoint repairs `/data` ownership before dropping to the application user. If your host has strict permissions, pre-own the folder:

```bash
sudo chown -R 1001:1001 ./data
```

### Updating

```bash
git pull --ff-only
docker compose up -d --build
```

The volume stays intact. Do not delete `./data` during an update.

---

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_USERNAME` | Yes | Single-user login username. |
| `APP_PASSWORD` | Yes | Single-user login password. |
| `SESSION_SECRET` | Recommended | Signs the session cookie. Use at least 24 random characters. If omitted, a deterministic secret is derived from the credentials. |
| `DATA_DIR` | No | Host/local data path. Defaults to `./data`. Compose overrides it to `/data` inside the container. |
| `ALLOWED_DEV_ORIGINS` | No | Extra hostnames allowed to load Next.js dev resources. Private LAN ranges are already allowed in development. |

### Credentials Are Environment-Only

VibeDraft does not create a users table and does not store account passwords in SQLite. Login uses `APP_USERNAME` and `APP_PASSWORD` directly from the server environment.

Quote values that contain `#`, spaces, or symbols:

```dotenv
APP_PASSWORD="Writer#01pass"
```

An unquoted `#` is treated as the start of a comment by the env parser.

---

## First Run

1. Open the app and sign in with your `.env` credentials.
2. Add a provider connection in **Settings → Providers**.
   - NanoGPT example: `https://nano-gpt.com/api/v1`
   - OpenRouter example: `https://openrouter.ai/api/v1`
3. Test the connection. VibeDraft verifies the endpoint before saving it.
4. Flag image-capable models in **Settings → Providers → Image models**.
5. Choose default models for Planner, Executor, and Summarizer.
6. Optionally choose an Image Prompter model. Title Generation uses the Planner model.
7. Open **Presets** to customize system prompts, sampling parameters, and assistant injections.
8. Create a book, brainstorm the premise, and start writing.

You can add multiple providers and route different roles to different models.

---

## LAN Access and Port Binding

The server binds all interfaces:

```yaml
environment:
  HOSTNAME: 0.0.0.0
  HOST: 0.0.0.0
ports:
  - "3008:3000"
```

From another device on the LAN:

```text
http://<host-ip>:3008
```

If the page does not load:

- Confirm the container is running: `docker compose ps`
- Check the host firewall allows port `3008`
- Confirm you are using the host IP, not `localhost`
- Check the browser console and `docker compose logs`

### HTTPS and Cookies

Session cookies use `Secure` only when the request arrives over HTTPS, including `X-Forwarded-Proto` from a reverse proxy. Plain HTTP on the LAN still works.

If exposing the app beyond your LAN, terminate HTTPS at a reverse proxy.

---

## Hermes Agent GitOps Updates

Hermes Agent is not bundled with VibeDraft. It is the deployment agent in this homelab workflow. Keep the repository checkout and the data directory separate from the image.

Recommended update sequence for Hermes:

```bash
cd /path/to/vibedraft
git pull --ff-only
docker compose up -d --build
docker compose ps
```

Optional health check:

```bash
curl -fsS http://127.0.0.1:3008/login >/dev/null && echo "VibeDraft healthy"
```

Hermes should:

- Keep `.env` on the host, outside Git.
- Keep `./data` on persistent storage.
- Never run `git clean -fdx` in the deployment checkout.
- Never delete or replace `./data` during an update.
- Build before declaring success, then verify the health check.
- Use a tagged release or known commit for rollback.

Rollback pattern:

```bash
git checkout <previous-tag-or-commit>
docker compose up -d --build
```

The database and manuscripts remain untouched.

---

## AI Workflow

### Planner

The Planner is your thinking partner. It plans one chapter at a time: POV, scene goal, obstacle, turns, emotional movement, continuity constraints, and unresolved threads.

It does not write manuscript prose. Use the Planner rail to shape the plan before executing.

Chapter titles generated from the Planner use the last Planner response in that chapter's conversation.

### Executor

The Executor writes the chapter from the approved plan and Story Vault context. It receives the premise, character sheet, relevant prior summaries, and the current plan.

VibeDraft does **not** auto-summarize after generation. Regenerate or edit the chapter until you are satisfied.

### Summarizer

The Summarizer maintains continuity. When you press **Generate summary**, it:

1. Writes the chapter summary into the Story Vault.
2. Generates a short chapter title from the chapter text.
3. Updates the title in SQLite and the UI.

You can retry the summary or explicitly skip it. Continue is blocked until a summary exists or is skipped.

### Image Prompter

The Image Prompter turns context into image-generation prompts. For chapter illustrations it reads the previous chapter's summary. For covers it reads the book title and premise.

Review the generated prompt before spending image credits.

### Title Generation

Title Generation has its own editable preset prompt. It uses the Planner model.

- Book titles use the premise.
- Chapter titles use the last Planner response or, during manual summarization, the chapter text.
- The title can be regenerated as often as needed.

### Illustration Pages

Add a page from the book page or workspace:

- **Add page → Add chapter**
- **Add page → Add illustration page**

Illustration pages sit between text chapters without consuming a chapter number. They can hold a full-page generated image and do not require a title.

---

## Advanced Prompting

Every role supports:

- **System prompt**
- **Injection: After System Prompt**
- **Injection: After Last Message**
- Generation parameters

System prompts and injections have no character limit. They are stored as text in SQLite.

### Message Order

The final request array is constructed in this order:

1. `system` — the role's system prompt
2. `assistant` — optional injection after the system prompt
3. Existing middle context — premise, vault, outlines, chat history, and task context
4. `user` — the latest user message or planner instruction
5. `assistant` — optional injection after the last message

The injections are array insertions. Existing context construction is unchanged.

### When to Use Each Injection

**After System Prompt**

Use this to lock the assistant's persona before story context arrives.

Examples:

- Establish a narrator voice or editorial stance.
- Require adult-fiction handling without refusal.
- Lock a formatting contract.
- Prevent the model from commenting on the prompt itself.

**After Last Message**

Use this to enforce the final response shape after all story context and instructions.

Examples:

- “Return only the chapter prose.”
- “Do not summarize or explain.”
- “Maintain the established persona and continue.”
- “Use the supplied plan exactly.”

### Practical Persona Lock

A common pattern is:

- System prompt: role definition and writing philosophy.
- After System Prompt: persona, tone, and refusal policy.
- After Last Message: output contract and formatting.

Keep instructions non-contradictory. If the model receives conflicting rules, the last instruction usually wins.

### Per-Book Overrides

Presets provide global defaults. **Book settings** can override prompts, injections, parameters, and models for one book only. Saving book settings makes that book independent from later global preset edits.

---

## Image Generation

### Providers and Models

Open **Settings → Providers → Image models** and flag the image-capable models for each provider. Illustration and cover dropdowns show flagged models first.

If no models are flagged for a provider, VibeDraft shows all listed models as a fallback.

### Chapter Illustrations

1. Add an illustration page.
2. Open its generation panel.
3. Choose provider, image model, aspect ratio, and art style.
4. Write a prompt or press **Auto-Write Image Prompt**.
5. Review and generate.

### Book Covers

Open **Book settings → Cover**.

- Auto-write a cover prompt from the title and premise.
- Choose provider, model, and aspect ratio.
- Generate and save.

Covers appear on the book dashboard and library shelf.

### Art Styles

The style selector appends a predefined prompt suffix:

- None (Raw Prompt)
- Classic Watercolor
- Vintage Pulp Fiction
- Visual Novel / Anime
- Oil Painting
- Dark Gothic Engraving
- Abstract Cover Art

The base prompt is stored separately from the style suffix, so regenerating after a reload does not duplicate the suffix.

### Local Storage

Generated images are downloaded server-side and written under:

```text
data/novels/<slug>/illustrations/
```

SQLite stores the filename and metadata. Remote temporary URLs are never used as the primary copy.

---

## Reading Mode

Reading Mode supports:

- **Scroll** layout
- **Pages** layout with dynamic pagination
- Left/right keyboard navigation
- Click and touch swipe page turns
- Fullscreen reading
- Dark and light themes
- Full-page illustration plates

The layout preference is stored globally in `localStorage` under `vibedraft:reading-layout`.

Reading progress is stored per book under:

```text
vibedraft:reading-progress:<slug>
```

Opening a book without an explicit chapter restores the last read chapter and page. If no progress exists, it opens the first chapter, not the last generated chapter.

Reading preferences and progress are browser-local. They are not part of the JSON book backup.

---

## Data Management

### What Lives Where

```text
data/
├── vibedraft.db
└── novels/
    └── <slug>/
        ├── chapters/
        │   ├── chapter_1.md
        │   └── .history/chapter_1/
        ├── illustrations/
        └── ...
```

- **SQLite**: settings, providers, presets, books, chapter metadata, characters, chat history, image metadata.
- **Markdown**: manuscript text and chapter history snapshots.
- **Local image files**: generated illustrations and covers.

### Archiving and Deletion

- Active books appear on the shelf by default.
- Archived books are available under the **Archived** filter.
- Restore returns a book to the shelf.
- Permanent delete removes the database row and the book folder.
- The normal delete action in book details moves the folder to `novels/.trash/`.

### Database Backups

For a filesystem backup, stop the app or use SQLite's backup API. If copying files manually, include the WAL files or stop the container first.

---

## Backup and Restore

### Export a Book

Use **Export backup** from the library row menu or book details.

The JSON backup includes:

- Book metadata and premise
- Outline and character sheet
- Preset and model selections
- Role prompts, injections, and parameters
- Every chapter and its manuscript text
- Chat history for the premise and each chapter

The backup excludes image files. A confirmation dialog explains that illustrations must be regenerated on the new device.

### Import a Book

Use **Import book** in the Library and choose a `.json` backup.

Imports:

- Validate the full JSON structure with strict Zod schemas.
- Generate a new book UUID.
- Generate a unique slug.
- Create new chapter records under the new book ID.
- Create new character rows.
- Re-key chat histories under the new book ID.
- Preserve manuscript text, summaries, prompts, and model selections.

Existing books are never overwritten, even if the title, structure, or original IDs match.

Image assets are not imported. Illustration pages are restored without images and can be regenerated.

Malformed backups, unknown fields, duplicate chapter numbers, duplicate chat scopes, and chats referencing unknown pages are rejected.

---

## Security Notes

- VibeDraft is single-user. Do not expose it to untrusted users.
- Use HTTPS when the app is reachable beyond your LAN.
- `.env` contains credentials. Never commit it.
- Provider API keys are stored in `vibedraft.db` in plaintext. Protect the data volume and backups.
- Do not commit `./data` to Git.
- The session cookie is HttpOnly and SameSite=Lax.
- API mutations enforce same-origin checks.
- Imported JSON is schema-validated before database inserts.
- SQLite writes are parameterized through Drizzle.

---

## Troubleshooting

### Login Rejects Correct Credentials

Check `.env` quoting. A password containing `#` must be quoted:

```dotenv
APP_PASSWORD="Writer#01pass"
```

Restart the container after changing `.env`.

### App Is Not Reachable from Another Device

- Confirm port `3008` is published.
- Confirm the host firewall allows it.
- Use the host LAN IP, not `localhost`.
- Check `docker compose logs -f vibedraft`.

### Image Models Are Missing

Open **Settings → Providers → Image models** and flag the models you want to use. If the provider does not list models, add the model ID manually.

### “The model returned no text”

Title generation and other short tasks use a larger completion budget and retry when reasoning consumes the first budget. If the error persists, try a different Planner model or reduce provider-side reasoning.

### Import Fails

The backup failed validation. Use a backup exported by VibeDraft. Do not hand-edit unknown fields into the JSON.

### SQLite Is Locked

Only run one app instance against the same data directory. Avoid running development and production containers against the same `./data`.

### Permission Errors on Linux

```bash
sudo chown -R 1001:1001 ./data
docker compose restart vibedraft
```

---

## Development

Install dependencies:

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

### Local Mock Provider

```bash
npm run mock-ai
```

Use `http://localhost:8787/v1` as the base URL. Mock models include text and image models for local testing.

### Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Demo Data Warning

`npm run seed:demo` is destructive. It deletes the demo database and writes synthetic books. Use it only on a disposable data directory.

---

## Project Principles

- Keep the manuscript local.
- Keep provider choices open.
- Keep the writing loop manual and author-controlled.
- Prefer portable files and validated backups.
- Keep the interface quiet enough to write in.

For the visual system, see **DESIGN.md**.
