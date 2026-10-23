# Design system: Night desk

Direction contract lives in `.impeccable/surfaces/src-app-app.md`. This file records the built world.

## Thesis

A lit manuscript on a dark desk. The page is the only bright object; chrome recedes into ink-blue. Amber marks where the machine is working. The product refuses the warm-cream-and-serif book-app default and the dashboard-of-cards shelf.

## Color

All values are CSS custom properties in `src/app/globals.css`.

| Token | Hex | Role |
| --- | --- | --- |
| `--background` | `#0b0f14` | Desk / app ground |
| `--foreground` | `#e9e2d4` | Bone text |
| `--card` | `#11171f` | Panels |
| `--popover` | `#151d27` | Menus, dialogs |
| `--secondary` | `#18212b` | Quiet controls, selected tabs |
| `--muted-foreground` | `#93a0ad` | Secondary text |
| `--border` | `#26313d` | Hairlines |
| `--input` | `#2c3946` | Field borders |
| `--primary` | `#f2a93b` | Lamp amber: primary action, current state, focus |
| `--primary-foreground` | `#1a1206` | Ink on amber |
| `--paper` | `#f5eedf` | Manuscript page |
| `--ink` | `#1a1712` | Manuscript text |
| `--paper-muted` | `#6f6759` | Paper secondary text |
| `--paper-line` | `#ded3bf` | Paper rules |
| `--destructive` | `#f2705b` | Failure |
| `--success` | `#86bd93` | Saved / in vault |
| `--warning` | `#f2c14e` | Caution |

Amber is never a wash. It appears as a 1px rule, a lit dot, a focus ring, a primary button, or a current-chapter marker. Paper is the only large light surface. The reading page can switch to a night page: `#10161e` ground, bone text, muted `#b7c0c9`, and a hairline `#26313d` border. The shell around it stays ink-blue. The two grounds never blend into a beige middle.

## Type

- **UI:** `"Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif` — workhorse, fixed rem steps, no display face in labels or controls.
- **Prose:** `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif` — manuscript and reading mode only.
- **Mono:** `"Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace` — chapter numbers, status, file paths, shortcuts.

Manuscript measure is 68ch at 19px/1.78. Reading mode uses the same measure on an 820px page. UI type runs 10–14px with a 1.125–1.2 step ratio. Display headings are serif on product surfaces only where they carry the book (library title, book title, chapter title, login statement), not in controls or data.

## Layout

- 4px base rhythm; 6px control radius; 1px hairlines; no rounded-card stacks.
- App shell: 56px top bar, full-height content, page-owned scroll.
- Workspace: resizable 2/3 page / 1/3 rail; 820px maximum page width; 26–48% rail bounds. Mobile switches to Write/Plan tabs.
- Library: asymmetric featured book plus a hairline list. The list is hidden when the shelf holds one book and no search is active.
- Reading: centered paper page, slim chrome, progress rule, outline dialog.
- Setup/settings: two columns; a lit form panel on the right, explanatory rail on the left.
- Login: split composition; dark typographic left, paper form right. The form is a page, not a floating card.

## Components

- **Button:** amber primary, bordered secondary, ghost, destructive, paper (ink). Focus ring is 2px amber with a 2px offset. Active state translates 1px.
- **Input / textarea:** dark well, 1px border, amber focus. Placeholders meet body contrast.
- **Paper sheet:** warm paper, soft warm shadow, inset top highlight, no border radius above 4px. It is the only elevated object in the workspace.
- **Badges:** pill, mono, 10px, tracked. Amber = attention, green = in vault, red = failure.
- **Banners:** inline, bordered, icon + title + body + actions. No colored side-stripe. Used for save conflicts, execution errors, summary state, and streaming.
- **Chat:** no bubbles. Role label (YOU / PLANNER) in mono, timestamp, then prose. Assistant Markdown is rendered; user text is preserved. Streaming shows a caret and a thinking line.
- **Split pane:** 1px handle, amber while dragging; layout persisted by `autoSaveId`.
- **Outline:** hairline sections, mono labels, chapter summaries. No cards.
- **Preset manager:** global list on the left, one editor panel on the right. Role tabs, prompt textarea, five parameter fields with info tooltips, sticky save bar. Base and default presets carry mono badges; the base cannot be deleted.
- **Book settings:** a focused dialog over the workspace. Source banner distinguishes local settings from global fallback; a "Load a preset" row copies prompts and parameters without saving; role tabs repeat the same editor with a per-book model field. Sticky footer names the blast radius: "Affects this book only."
- **Parameter field:** label + info tooltip, numeric value, range slider, low/high anchors. Amber accent only on the active thumb and focus ring.
- **Reading toolbar:** compact segmented theme control, 12?24px size stepper, typeface select, and Standard/Cozy/Wide/Full page-width select. It sits outside the page so it stays legible in both page themes. Used in the Executor status row and in a thin Reading Mode comfort bar.
- **Stream lock:** the page follows only when the writer is at the bottom. A floating "Scroll to bottom" pill with a live amber dot appears while the Executor streams and the viewport is above the bottom.
- **Reasoning accordion:** a closed `<details>` block above the reply, mono label "Reasoning", dimmer 11.5px prose, live amber dot while streaming. It exists only when the provider sends reasoning or `<think>` content.
- **Version switcher:** a compact mono `< 2 / 3 >` control on assistant messages with more than one saved alternative. Hover actions regenerate, delete the active version, or edit a user prompt.
- **Cover:** generated in CSS from a deterministic palette per slug; cloth grain, spine shadow, serif title, mono "A NOVEL". No raster cover assets.

## Motion

150–250ms, exponential ease-out. Motion communicates state only: streaming caret, thinking dots, banner rise, progress rule, toast entry. No page-load choreography. `prefers-reduced-motion` collapses all animation and transition durations.

## Copy

The product speaks like a working desk, not a chatbot. Controls name the action: "Execute chapter", "Generate summary", "Continue to chapter 3", "Rewrite this chapter", "Skip summary". Errors name the problem and the recovery. No praise, no "AI magic", no invented proof.

## Accessibility

- Contrast: bone on ink-blue ≈ 15:1; muted ≈ 6.7:1 on panels; amber on ink-blue ≈ 9:1; ink on paper ≈ 15:1; paper-muted ≈ 5:1. Placeholders use the muted token rather than a reduced opacity.
- Every icon-only control has an `aria-label`; selects have labels; dialogs use Radix focus management.
- Keyboard: Ctrl/Cmd+S saves, Ctrl/Cmd+Enter executes, Enter sends in chat, Shift+Enter adds a line, arrows turn pages in reading mode, `/` focuses library search.
- Reduced motion is honored globally.
- No WCAG conformance level is claimed. This is a single-user, self-hosted surface; it has not been audited against a formal target.

## Assets

- `public/favicon.svg` — authored SVG nib mark. No raster assets ship in the application.
- Review captures live in `.impeccable/review/` and are not shipped.

## File map

- `src/app/globals.css` — tokens, paper sheet, manuscript, chat prose, motion, scrollbars, selection.
- `src/components/ui/*` — Radix primitives styled for the world.
- `src/components/workspace/workspace-view.tsx` — split pane, autosave, execute, summary, continue.
- `src/components/chat/chat-thread.tsx` — shared Planner thread.
- `src/components/chat/reasoning-block.tsx` ? collapsible reasoning trace.
- `src/lib/chat/messages.ts` ? pure response-version and prompt-edit operations.
- `src/lib/streams/` ? Zustand stream state and Planner/Executor runners that survive navigation.
- `src/components/editor/markdown-editor.tsx` — TipTap + Markdown extension.
- `src/components/reading/reading-toolbar.tsx` ? page theme, size, and typeface controls.
- `src/lib/reading-preferences.ts` ? sanitized localStorage preferences and page CSS variables.
- `src/components/library/*` — shelf, covers, empty state.
- `src/components/reader/reader-view.tsx` — reading mode.
- `src/components/settings/settings-screen.tsx` — provider connections, model routing, and setup.
- `src/components/presets/preset-manager.tsx` ? global preset library and editor.
- `src/components/workspace/book-settings-dialog.tsx` ? per-book prompt, parameter, and model overrides.
- `src/components/ai/role-settings-editor.tsx` ? shared role prompt and parameter editor.
- `src/components/ai/parameter-fields.tsx` ? sampling fields with tooltips.
- `src/lib/presets/defaults.ts` ? base preset, normalization, copy-on-write snapshots.
- `src/lib/storage/book-config.ts` ? local config read/write and global fallback.
- `src/components/outline/outline-view.tsx` — Story Vault presentation.

## Finish review

Verdict: **ship** for code review.

Evidence: desktop (1440x900) and mobile (390x844) captures in `.impeccable/review/`; exercised login, setup test/save, library, book details, reading mode and outline dialog, preset creation and default selection, new-book preset copy, per-book prompt/model/parameter overrides, premise-first creation, Planner SSE, Executor SSE, automatic summary, Continue, stale-save 409, Markdown/HTML/DOCX export, reasoning parsing, response regeneration and version switching, per-version deletion, prompt editing, and in-app navigation during both streams against the bundled mock provider. Provider-side inspection confirmed the book-specific model, system prompt, and all five sampling parameters reached the request body; the global models stayed unchanged. Stream tests confirmed the viewport locks above the bottom, the control returns the page to live text, the pending user message and reasoning resume after navigation, the inner text width follows the selected page width, and reading preferences survive reload through localStorage.

Fixed during the review: locale hydration mismatch, false unsaved-on-load state from editor normalization, duplicate shelf list for a single book, toasts covering primary actions, missing list markers, cover title clipping, eyebrow labels above headings, a decorative grid overlay, summary-vs-rewrite action hierarchy, low-contrast placeholders, missing sticky save bars in long preset/book settings panels, aggressive streaming auto-scroll, dark-page contrast, fixed inner text measure, missing reasoning visibility, stream state loss on navigation, and chat response versioning.

Not verified: a real provider (mock only), the Docker image (Docker Desktop was not running on this machine), a formal accessibility audit, and multi-hour editing performance.

