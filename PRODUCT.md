# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Next.js (App Router) + TypeScript, chosen for file-based routing across library/editor surfaces, server endpoints for AI drafting and sharing, and a straightforward deploy path. No deploy target was specified.

## Users

Professional writers and authors whose income depends on long-form output. They write daily in long sessions and care about flow, revision depth, and keeping their own voice. Job to be done: move a piece of long-form writing from a structured outline to a finished draft without losing authorial control.

## Product Purpose

VibeDraft is an AI-assisted writing tool built around drafting sections from an outline. The writer owns the structure; the AI fills in section drafts from a brief; the writer edits down rather than up. Success means finished long-form drafts arrive faster while the writer still recognizes the work as theirs.

## Positioning

Draft-from-outline: the outline is the contract, and AI produces section drafts that serve it. The writer's structural decisions are made before generation and are not silently overridden. A tool centered on in-place AI rewriting of the writer's prose cannot truthfully copy this without giving up its own core interaction.

## Operating Context

- Markdown-first: writers work in plain text/Markdown and expect keyboard-first editing.
- Drafts are shared with an editor, so sharing is a factual part of the workflow.
- Work spans multiple projects and documents, so a library with search is expected.
- AI output and writer edits coexist, so version history and comparison are part of normal use.
- Finished work leaves the tool, so export is part of the workflow.

## Capabilities and Constraints

First version must include:

- Hierarchical outline with section-by-section drafting from a brief.
- Export to Markdown, docx, and clean HTML.
- Version history and side-by-side comparison of AI drafts against writer edits.
- Document library with search across drafts.
- Global preset library of per-role system prompts and sampling parameters (temperature, Top-P, Top-K, frequency and presence penalties), with a non-deletable base fallback.
- Copy-on-write book configs: a new book snapshots a preset and the current global default models; its prompts, parameters, and models are then local to that book.
- Per-book model selection and prompt/parameter overrides, applied to every Planner, Executor, and Summarizer request for that book.
- SQLite (via Drizzle and better-sqlite3) owns settings, presets, books, the Story Vault, drafts, and chapter chats. Chapter manuscripts remain Markdown on disk for export and backup.
- Reading comfort in the Executor and Reading Mode: page theme, text size, typeface, and page width. Preferences are browser-local and never written to the vault.
- Reasoning visibility for models that expose it, with the trace collapsed above the reply.
- Planner response versioning: regenerate without overwriting, switch between versions, delete only the active version, and edit a user prompt to branch the conversation.
- Active Planner and Executor streams survive in-app navigation and resume with live text and reasoning.
- Streaming that does not steal the writer's viewport: the page follows only when the writer is at the bottom, with an explicit control to return.
- Sharing drafts with an editor.

Undecided product facts:

- Collaboration depth: whether sharing is a link/comment handoff or real-time co-editing is not confirmed.
- The provider must speak the OpenAI chat-completions format. Model IDs can differ per role and per book; the provider endpoint and key remain global.
- Voice controls (style/voice memory) were not selected for v1; they are not ruled out later.

## Evidence on Hand

None yet. No logo, product copy, testimonials, customer names, benchmarks, or sample drafts exist. Future work must not fabricate any of these.

## Product Principles

1. Structure before prose: the outline is the source of truth, and drafting serves it.
2. Author control is non-negotiable: AI output arrives as a section draft, never as a silent in-place rewrite. The writer also owns the viewport; generation never yanks the page away.
3. Markdown-first and keyboard-first: speed of thought beats chrome.
4. Books own their settings: global presets are starting points, not remote controls. A book keeps its own models, prompts, and parameters once created.
5. Drafts are durable artifacts: versions, comparison, and export are first-class, not add-ons.
6. Claim only what exists: no invented proof, pricing, or capability claims.

## Accessibility & Inclusion

Undecided: no standard was confirmed. Do not claim WCAG conformance until a target is chosen.
