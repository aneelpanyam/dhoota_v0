"use client";

import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface RichMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  className?: string;
}

export function RichMarkdownEditor({
  value,
  onChange,
  placeholder = "Enter content (use toolbar for formatting)...",
  minRows = 6,
  className = "",
}: RichMarkdownEditorProps) {
  return (
    <div className={className} data-color-mode="light">
      <MDEditor
        value={value}
        onChange={(val) => onChange(val ?? "")}
        preview="live"
        hideToolbar={false}
        enableScroll={true}
        visibleDragbar={false}
        height={Math.max(180, minRows * 24)}
        textareaProps={{
          placeholder,
        }}
      />
    </div>
  );
}
