"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { cn } from "@/lib/utils";

export function MarkdownEditor({
  value,
  onChange,
  streaming = false,
  streamingText = "",
  readOnly = false,
  placeholder = "Start writing, or let the Executor draft from the plan.",
  className,
  onStreamApplied,
}: {
  value: string;
  onChange: (markdown: string) => void;
  streaming?: boolean;
  streamingText?: string;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  onStreamApplied?: () => void;
}) {
  const applyingRef = useRef(false);
  const pendingRef = useRef<string | null>(null);
  const frameRef = useRef<number | null>(null);
  const onStreamAppliedRef = useRef(onStreamApplied);

  useEffect(() => {
    onStreamAppliedRef.current = onStreamApplied;
  }, [onStreamApplied]);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly && !streaming,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Markdown.configure({
        indentation: { style: "space", size: 2 },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-empty",
      }),
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "manuscript tiptap",
        spellcheck: "true",
        "aria-label": "Chapter manuscript",
      },
    },
    onUpdate: ({ editor: current }) => {
      if (applyingRef.current) return;
      if (!current.isFocused) return;
      onChange(current.getMarkdown());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly && !streaming);
    editor.view.dom.classList.toggle("streaming", streaming);
  }, [editor, readOnly, streaming]);

  useEffect(() => {
    if (!editor) return;
    if (streaming) return;
    const current = editor.getMarkdown();
    if (current === value) return;
    applyingRef.current = true;
    editor.commands.setContent(value || "", { contentType: "markdown" });
    applyingRef.current = false;
  }, [editor, value, streaming]);

  useEffect(() => {
    if (!editor || !streaming) return;
    pendingRef.current = streamingText;
    if (frameRef.current !== null) return;
    frameRef.current = window.setTimeout(() => {
      frameRef.current = null;
      const next = pendingRef.current ?? "";
      applyingRef.current = true;
      editor.commands.setContent(next, { contentType: "markdown" });
      applyingRef.current = false;
      onStreamAppliedRef.current?.();
    }, 50);
    return () => {
      if (frameRef.current !== null) {
        clearTimeout(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [editor, streaming, streamingText]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) clearTimeout(frameRef.current);
    };
  }, []);

  return (
    <div className={cn("relative", className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
