# VibeDraft

Self-hosted AI novel-writing desk. Two panels: the Executor drafts on the left, the Planner thinks on the right. The Story Vault is the only context sent to the models — never the whole manuscript.

SQLite for state and Markdown for manuscripts. One Docker volume.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + shadcn-style Radix primitives
- TipTap 3 with the official Markdown extension (manuscripts stay Markdown)
- SQLite + Drizzle ORM + better-sqlite3 for settings, presets, books, vault, and chats
- SSE streaming through Next route handlers
- Zod validation, atomic writes, per-file locks
- `docx` + `marked` + `sanitize-html` for export

## Quick start

```bash
cp .env.example .env
# edit APP_USERNAME, APP_PASSWORD, SESSION_SECRET
npm install
npm run dev
```

Open http://localhost:3000. The first run sends you to `/setup`.

For a local provider, run the bundled mock so the full loop works without an API key:

```bash
npm run mock-ai
# Base URL: http://localhost:8787/v1
# Models: mock-planner, mock-executor, mock-summarizer
```

The mock streams synthetic text. It is for development only.

To skip the setup screen and put a synthetic book on the shelf, seed the demo after starting the mock:

```bash
npm run seed:demo
```

> Warning: `seed:demo` **deletes** `data/vibedraft.db` and replaces the legacy demo files. Run it only on a disposable or fresh data volume, never on a shelf you want to keep.

That writes legacy seed files pointing at `http://localhost:8787/v1` and resets `data/vibedraft.db`. The next app start imports the seed through the one-time legacy migration. Delete `data/` to return to a clean first run.

## Docker

```bash
cp .env.example .env
# edit credentials and SESSION_SECRET
mkdir -p data
docker compose up -d --build
```

Open `http://<host-ip>:3008`. The container listens on `0.0.0.0:3000` internally and publishes only port `3008` to the LAN. SQLite and `novels/*.md` both live under `/data`, bind-mounted from `./data` on the host, so image rebuilds never replace them.

The container entrypoint repairs ownership of `/data` on startup before dropping to the non-root app user. On Linux, you can also pre-own the host folder:

```bash
sudo chown -R 1001:1001 ./data
```

Put it behind HTTPS (Caddy, Traefik, nginx) if it is reachable beyond localhost. The session cookie is marked `Secure` only when the request itself arrives over HTTPS (including `X-Forwarded-Proto`), so plain HTTP on a LAN still works.

## LAN access

`npm run dev` and `npm run start` bind to `0.0.0.0`, so another device can use `http://<host-ip>:3000`. The browser talks to whatever origin it loaded the page from; all app API calls use relative paths and never a hardcoded `localhost`.

For development over a private LAN address, Next.js dev-origin protection is relaxed for `192.168.*.*`, `10.*.*.*`, and `172.16.*.*`–`172.31.*.*`. Add custom hostnames (for example mDNS or a tunnel) with `ALLOWED_DEV_ORIGINS=writer.local,tunnel.example.com`.

API CORS headers are emitted only for requests whose `Origin` matches the server host. Cross-origin API access is still rejected; mutations also enforce same-origin checks.

## Data layout

```text
data/
├── vibedraft.db                    # settings, presets, books, vault, chats
└── novels/
    └── <slug>/
        ├── chapters/
        │   ├── chapter_1.md
        │   └── .history/chapter_1/ # snapshots written before a replacement
        └── illustrations/          # generated, persisted illustration files
```

SQLite handles global settings, AI presets, book metadata and local settings, the Story Vault (premise, characters, chapter summaries), drafts, and chapter chat histories. Chapter manuscripts stay as Markdown so exports and filesystem backups stay simple. Deleted books move their Markdown folder to `novels/.trash/` and remove their database row.

Writes are transactional in SQLite (WAL mode), and Markdown writes remain atomic (temp file + rename). The app is designed for one instance, matching the single-user auth model. Existing `app_config.json`, `outline.json`, `book_config.json`, and `chats/*.json` files are imported once on first start; the legacy files are left on disk and are no longer read after the migration marker is set.

## The loop

1. **Create new** opens the preset picker, then a Planner conversation. The chosen preset and the current global models are copied into the draft row.
2. **Premise done** sends the chat to the Summarizer, writes `premise` and an auto-generated title, then opens Chapter 1.
3. In the workspace, the Planner chat is isolated per chapter in SQLite.
4. **Execute** sends Story Vault context + that chapter's chat to the Executor and streams Markdown into `chapters/chapter_N.md`.
5. The client automatically calls the Summarizer. Its summary is written to the chapter row with status `summarized`.
6. **Continue** advances `currentChapter` and opens the next isolated chat.

The Executor never receives the full manuscript. It receives the premise, characters, selected prior chapter summaries, and the current chapter plan.

## Presets and per-book settings

- **Global presets** live at `/presets`. Each preset stores a system prompt and sampling parameters for the Planner, Executor, Summarizer, and Image Prompter: temperature, Top-P, Top-K, frequency penalty, and presence penalty.
- **The base preset** (`Default / General Fiction`) cannot be deleted. It is the fallback for books that have no local settings.
- **Copy-on-write:** choosing a preset on the new-book screen snapshots the preset's prompts/parameters and the current global default models into the draft row. Publishing turns that row into the book.
- **Book settings** in the workspace edits the active book's prompts, parameters, and models. Saving writes only that book's row; global presets and global models are untouched.
- **Characters:** generate a character sheet from the premise with the Planner, or edit characters manually. Both paths write the Story Vault in SQLite.
- **Pages:** add text chapters or illustration pages from the book page or workspace. Any page can be deleted with confirmation; deleting the current page moves you to a surviving page.
- **Backwards compatibility:** legacy books and drafts imported without local settings resolve to the base/default preset and the global default models at call time. Saving in Book settings writes local settings to the book row.
- **Payloads:** every AI call reads the book's config immediately before sending. The role's system prompt is the first message; the app appends the Story Vault/task block. Custom parameters are sent as `temperature`, `top_p`, `top_k`, `frequency_penalty`, and `presence_penalty`. `top_k` is omitted when set to 0 for provider compatibility. `reasoning_effort` is sent only when the optional field is non-empty.
- **Model choice:** connections are global and can span multiple providers. Each role stores a provider-scoped model value, so the Planner, Executor, Summarizer, and Image Prompter can use models from different providers, per book.

## Illustration pages

- Add a page from the book page or workspace: **Add page → Add chapter** or **Add illustration page**.
- Illustration pages sit in the page sequence without consuming a chapter number. Text chapters keep their logical chapter numbers.
- The illustration editor chooses a provider, image model, prompt, optional negative prompt, and aspect ratio. Requests use the OpenAI-compatible `POST /v1/images/generations` payload.
- **Image models:** open **Settings → Providers → Image models** and flag the image-capable models for each provider. Illustration dropdowns show only flagged models; if none are flagged, all models are shown as a fallback.
- **Auto-Write Image Prompt** uses the new Image Prompter role, the previous chapter's SQLite summary, and the configured Image Prompter model. Review the result, then generate.
- Generated bytes are downloaded server-side and saved under `data/novels/<slug>/illustrations/`. SQLite stores the filename, prompt, provider, model, and aspect ratio, so images survive refresh and container rebuilds without remote expiring URLs.
- **Book covers:** **Book settings → Cover** generates a cover from the title (or an auto-written prompt), stores it in the same persistent illustration folder, and shows it on the book dashboard, library shelf, and featured card.
- Reading mode renders illustration pages as full-page plates.

## Reading comfort

The Executor and Reading Mode share a compact comfort toolbar:

- Light page / dark page toggle for the manuscript surface only.
- Text size from 12 to 24 px.
- Typeface: literary serif, Charter, Garamond, Georgia, or humanist sans.
- Page width: Standard, Cozy, Wide, or Full.

Theme, text size, typeface, and page width live in browser `localStorage` under `vibedraft:reading-preferences`. They never enter the SQLite database.

While the Executor streams, the page follows only when you are already at the bottom. Scroll up and the viewport locks; generation continues below. A **Scroll to bottom** control appears while the stream is active, with a live indicator.

## Reasoning and chat versions

- Model reasoning is parsed from `reasoning_content`, `reasoning`, or `<think>` blocks and shown above the reply in a collapsed **Reasoning** accordion.
- Planner replies support **Regenerate** without replacing the previous response. The version switcher (`< 2 / 3 >`) moves between saved alternatives.
- **Delete** removes only the visible version. The last remaining version removes the reply.
- **Edit** on a user message resends from that prompt.
- Active Planner and Executor streams live in a global client store, so navigating away and back resumes the live text, reasoning, and loading state instead of dropping it.


## Failure behavior

| Failure | Behavior |
| --- | --- |
| Planner stream dies | Partial reply is saved as `failed` and excluded from future context; retry reuses the same user message id. |
| Executor dies mid-stream | Partial chapter is saved to disk; the editor reloads the saved partial and offers retry. |
| Executor returns nothing | Existing chapter text is left untouched. |
| Summarizer fails | Chapter stays saved; chapter status becomes `summary_failed`; UI offers retry or explicit skip. Continue is blocked until one of those happens. |
| Title generation fails | Premise still publishes; book is named `Untitled Novel` and can be renamed. |
| Premise summary fails | Draft is preserved; retry or write the premise manually. |
| Two tabs edit one chapter | Server rejects stale writes with `409`; UI offers reload or explicit overwrite. |
| Provider rate limit / 5xx | Non-streaming calls retry with backoff; streaming calls surface a retryable error. |
| Data dir unwritable | Save errors are shown inline; the editor keeps the text in memory. |
| Book local settings missing/invalid | The API falls back to the global default preset and models; Book settings can write a fresh local config. |
| Provider rejects `top_k` | Set Top-K to 0 in the preset or book settings; the field is omitted from the payload. |
| User scrolls up during execution | The viewport locks; streaming continues; a **Scroll to bottom** control appears until the user returns to the bottom. |

## Auth

Single user. Credentials come from `APP_USERNAME` / `APP_PASSWORD`. A signed HttpOnly JWT session cookie (30 days) is issued after a timing-safe comparison. Login attempts are rate-limited to five per five minutes per IP. `SESSION_SECRET` should be at least 24 random characters; if omitted, a deterministic secret is derived from the credentials. Quote credential values in `.env` when they contain `#`, spaces, or symbols; the env parser treats an unquoted `#` as the start of a comment.

There are no accounts, password resets, or multi-tenant boundaries. Do not expose this app to untrusted users.

## API

| Route | Purpose |
| --- | --- |
| `POST /api/auth/login` | Credential check, session cookie |
| `GET/POST /api/providers` | List or add provider connections |
| `PUT/DELETE /api/providers/:id` | Edit or remove a provider connection |
| `PATCH /api/providers/:id` | Flag image-capable models for a provider |
| `POST /api/providers/test` | Test a provider endpoint and list its models |
| `PUT /api/config/models` | Save the default Planner, Executor, Summarizer, and Image Prompter models |
| `POST /api/drafts` | Start a brainstorm draft |
| `POST /api/drafts/:id/finalize` | Publish a manually written premise and auto-title if blank |
| `POST /api/ai/image-prompt` | Write an illustration or cover prompt with the Image Prompter |
| `POST /api/ai/planner` | SSE Planner chat (draft premise or chapter) |
| `POST /api/ai/premise` | Summarize premise, auto-title, publish draft |
| `POST /api/ai/execute` | SSE Executor chapter draft |
| `POST /api/ai/summarize` | Summarize a chapter into the vault |
| `GET/POST /api/presets` | List or create global presets |
| `PUT/DELETE /api/presets/:id` | Edit or delete a preset |
| `POST /api/presets/:id/default` | Set the default preset for new books |
| `GET /api/models` | List models grouped by provider |
| `POST /api/novels/:slug/pages` | Add a chapter or illustration page |
| `DELETE /api/novels/:slug/chapters/:n` | Delete a chapter or illustration page |
| `PUT /api/novels/:slug/characters` | Save a manually edited character sheet |
| `POST /api/novels/:slug/characters/generate` | Extract characters with the Planner |
| `POST /api/generate-image` | Generate and persist an illustration |
| `POST /api/generate-cover` | Generate and persist a book cover |
| `GET /api/novels/:slug/illustrations/:file` | Serve a stored illustration or cover |
| `GET/PUT /api/novels/:slug/config` | Read or save the active book?s local config |
| `PUT /api/novels/:slug/chapters/:n` | Save Markdown with optimistic concurrency |
| `POST /api/novels/:slug/chapters/:n/advance` | Create/open the next chapter |
| `GET /api/novels/:slug/export?format=md\|docx\|html` | Export the book or one chapter |

SSE events: `meta`, `delta`, `done`, `error`, plus heartbeat comments. Upstream OpenAI-format streams are normalized server-side; the browser never sees the provider key.

## Security notes

- `vibedraft.db` stores the provider key in plaintext inside your volume. That is the price of a lightweight, self-hosted install. Protect the volume and its backups. Back up the database with the app stopped, or with SQLite's backup API; WAL files must be included.
- HTML export is sanitized before writing.
- All storage paths are validated against the data root; slugs and chapter numbers are strict.
- API mutations check same-origin. The session cookie is HttpOnly + SameSite=Lax.
- Prompts and manuscript content are sent only to the provider you configure.

## Commands

```bash
npm run dev        # development
npm run build      # production build
npm run start      # run the production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Vitest
npm run mock-ai    # local OpenAI-compatible mock on :8787
npm run seed:demo  # synthetic demo book + mock config
npm run check:ui   # Playwright smoke test of setup, create, execute, summary, continue
npm run check:presets # Playwright smoke test of presets and per-book settings
npm run shots      # design captures into .impeccable/review
```

## Verification

```bash
npm run lint && npm run typecheck && npm run test
```

The UI smoke tests need three processes: `npm run dev`, `npm run mock-ai`, and a seeded demo (`npm run seed:demo`). `check:ui` exercises setup, premise-first creation, execute, summary, and continue. `check:presets` exercises preset creation, copy-on-write, the new-book picker, and per-book model/prompt overrides. It is idempotent but creates a preset each run; reseed for a clean demo.

## Design

The visual system is documented in [DESIGN.md](DESIGN.md). It is an Operate surface: a lit manuscript page on an ink-blue desk, amber for machine action, serif for prose only. The surface brief and direction contract live in `.impeccable/surfaces/`.

## Scope

Shipped: VibeDraft branding; premise-first creation; isolated chapter chats; dynamic vault injection; global preset library with per-role prompts and sampling parameters; copy-on-write book configs; per-book model/prompt overrides; SSE planning/drafting with reasoning parsing, non-stealing stream scroll, and persistent stream state across navigation; message regeneration, version switching, per-version deletion, and prompt editing; reading comfort toolbar with browser-local theme, 12?24px size, typeface, and page width; background summaries with retry/skip; autosave with conflict handling; reading mode; outline view; Markdown/DOCX/HTML export; trash-safe deletion; SQLite persistence; Docker deployment.

Deferred: real-time collaboration, editor sharing links, voice/style memory, and a full version-comparison UI. Chapter history snapshots are already written to disk, so comparison can be added without a migration.
