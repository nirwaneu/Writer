# VibeDraft

**A private, self-hosted AI desk for writing long-form fiction.**

VibeDraft is built for novelists who want the speed of modern AI without giving up control of their voice, their data, or their process. It pairs a focused writing workspace with a Planner, Executor, Summarizer, and Image Prompter that work from your Story Vault instead of dumping your entire manuscript into a prompt.

Private by default. Provider-agnostic. Yours to host.

---

## ✨ Killer Features

### 1. Unrestricted AI Persona Control with Dual Assistant Injection

VibeDraft gives you direct control over how the model behaves. Every role supports **unlimited system prompts** plus two optional assistant injections:

- **Injection: After System Prompt** — lock a persona, tone, point of view, or response contract before any story context is added.
- **Injection: After Last Message** — add a final instruction, formatting rule, or persona reminder after the latest user message.

This is especially useful for complex, uncensored, or highly stylized writing where generic assistant refusals and personality drift get in the way. You stay in charge of the instruction stack.

### 2. Immersive E-Book Reading Mode

Switch between **Scroll** and **Pages** layouts, turn pages with clicks, keyboard, or swipe, and enter fullscreen for a distraction-free reading session. Dark mode is supported in both layouts.

Illustration pages render as true full-page plates: no chapter title, no editor chrome, no unnecessary padding.

### 3. Integrated Image Generation with Art Styles

Generate chapter illustrations and book covers without leaving the app. Choose a provider, image model, prompt, negative prompt, aspect ratio, and art style:

- Classic Watercolor
- Vintage Pulp Fiction
- Visual Novel / Anime
- Oil Painting
- Dark Gothic Engraving
- Abstract Cover Art
- None (Raw Prompt)

Images are downloaded and stored locally on your data volume, so they survive refreshes, restarts, and container rebuilds.

### 4. 100% Local Privacy & Portability

Your library lives in SQLite and Markdown inside your own Docker volume. There is no hosted VibeDraft account and no cloud library.

Each book can be exported as a validated JSON backup and restored on another machine. Imports create new IDs and remap relations safely, so restoring a backup never overwrites an existing book.

---

## Recommended Providers

VibeDraft was meticulously built and tested against **NanoGPT** and **OpenRouter**, and supports any OpenAI-compatible endpoint.

For the best token-efficient, uncensored, and highly reliable AI generation, **NanoGPT is highly recommended**. Support the development of VibeDraft by creating your NanoGPT account here:

**[Create a NanoGPT account →](https://nano-gpt.com/subscription/weB4cFpW)**

Prefer OpenRouter? That works too. Add both providers and route different roles to different models.

---

## 🚀 Quick Start with Docker

```bash
git clone <your-repository-url>
cd vibedraft

cp .env.example .env
# Edit APP_USERNAME, APP_PASSWORD, and SESSION_SECRET

docker compose up -d --build
```

Open:

```text
http://<your-server-ip>:3008
```

The container listens on `0.0.0.0:3000` internally and publishes port `3008`. Your data lives in `./data` on the host.

On Linux, make the data directory writable by the container user:

```bash
sudo chown -R 1001:1001 ./data
```

For setup details, LAN access, Hermes Agent updates, backup/restore, and prompt injection recipes, read **[DOCUMENTATION.md](DOCUMENTATION.md)**.

---

## What Makes VibeDraft Different?

- **The Story Vault is the context layer.** The Executor receives the premise, character sheet, relevant chapter summaries, and the current plan — never the whole manuscript.
- **Manual summary, not surprise automation.** Regenerate and edit freely. Summarize and title a chapter only when you are happy with it.
- **Multi-provider by design.** Mix NanoGPT, OpenRouter, or a local OpenAI-compatible server across Planner, Executor, Summarizer, Image Prompter, and title generation.
- **Portable by default.** SQLite + Markdown + local images, with per-book JSON backup and restore.
- **Made for the homelab.** Docker-first, LAN-accessible, single-user authentication, no external database required.

---

## Tech Stack

- Next.js 16 App Router + React 19 + TypeScript
- Tailwind CSS 4 + Radix/shadcn-style primitives
- TipTap 3 with Markdown
- SQLite + Drizzle ORM + better-sqlite3
- SSE streaming through Next.js route handlers
- Zod validation, atomic writes, per-file locks
- Docker multi-stage build with a persistent data volume

---

## Community & Contributions

Bug reports, prompt recipes, provider notes, and focused pull requests are welcome. If you build something interesting with VibeDraft, share it.

Before opening a large PR, please describe the problem and the intended behavior so the change can stay aligned with the project's architecture.

VibeDraft is a single-user, self-hosted application. Do not expose it directly to untrusted users without HTTPS and appropriate network controls.

---

## Documentation

- **[DOCUMENTATION.md](DOCUMENTATION.md)** — installation, environment variables, Docker, Hermes Agent updates, AI workflow, prompt injection, data management, and troubleshooting.
- **DESIGN.md** — visual system and interface direction.

---

**Write the book. Keep the book.**
