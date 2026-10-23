---
version: 1
slug: "src-app-app"
primary_target: "src/app/(app)"
related_targets: []
---

# Surface brief: VibeDraft app

Mode: Operate. Primary target: `src/app/(app)` (library, setup, book detail, reading, workspace).

Audience: professional long-form writers working long evening sessions on a self-hosted machine. They own the outline; the AI drafts sections. The interface must disappear into the task and never imply the model owns the prose.

Job: brainstorm with a Planner, execute a chapter with an Executor, keep the Story Vault current, and move to the next chapter without losing flow. Important states: first-run setup, disconnected models, empty shelf, streaming, partial failure, summarizer failure, unsaved edits, offline.

Constraints: Next.js App Router, Tailwind + shadcn primitives, Markdown-first, SQLite for settings/presets/books/vault/chats, Markdown manuscripts on disk, SSE streaming, single user. Streaming must never steal the writer's scroll position. Reading theme, size, and typeface are browser-local preferences. No fabricated proof, no marketing claims.

## Direction contract

THESIS: A lit manuscript on a dark desk. The writing surface is the only bright object; chrome recedes into ink-blue. Refuses the warm-cream-and-serif book-app default and the dashboard-card shelf.

OWN-WORLD: Ink-blue ground (#0B0F14), panel (#11171F), hairline (#26313D), bone text (#E9E2D4), muted (#8D99A6), lamp amber (#F2A93B) reserved for primary action, current state, and focus. Manuscript is warm paper (#F5EEDF) with near-black ink (#17140F). Squared 6px controls, 1px rules, mono for chapter metadata and status, system grotesque for UI, Iowan/Palatino serif for prose. Amber appears as a thin rule, a lit dot, a focus ring — never a wash.

STORY: The writer sees their book as a physical object on the shelf, opens it onto a lit page, and keeps the plan in a narrow rail beside it. They understand in seconds that the left page is the draft and the right rail is the thinking; amber marks where the machine is working.

FIRST VIEWPORT: Workspace at 1440: a 2/3 paper page on ink-blue, with a slim chapter header above it (book title, chapter number, word count, save state) and a 1/3 Planner rail on the right. The page is the largest object, lit with a soft warm shadow; the rail is dark with a single amber "Execute chapter" action pinned at its foot. A hairline divides plan from prose, not a card.

FORM: Pinned by the user: Night desk, position 3 of 4 offered directions. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
