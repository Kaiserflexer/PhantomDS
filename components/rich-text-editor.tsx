"use client";

import { useEffect, useRef, useState } from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function run(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  }

  return (
    <div className="editor">
      <div className="toolbar">
        <button className="ghost-button" type="button" onClick={() => run("formatBlock", "<p>")}>Paragraph</button>
        <button className="ghost-button" type="button" onClick={() => run("formatBlock", "<h1>")}>H1</button>
        <button className="ghost-button" type="button" onClick={() => run("formatBlock", "<h2>")}>H2</button>
        <button className="ghost-button" type="button" onClick={() => run("bold")}>Bold</button>
        <button className="ghost-button" type="button" onClick={() => run("italic")}>Italic</button>
        <button className="ghost-button" type="button" onClick={() => run("insertUnorderedList")}>Bullets</button>
        <button className="ghost-button" type="button" onClick={() => run("insertOrderedList")}>Numbered</button>
      </div>
      <div
        ref={editorRef}
        className="editor-surface"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Capture the thought before it disappears..."
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onChange(editorRef.current?.innerHTML ?? "");
        }}
        onInput={() => onChange(editorRef.current?.innerHTML ?? "")}
        style={{ boxShadow: focused ? "inset 0 0 0 1px rgba(187, 124, 255, 0.4)" : undefined }}
      />
    </div>
  );
}
