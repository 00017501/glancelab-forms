import { ListBulletsIcon, ListNumbersIcon, TextBIcon, TextHTwoIcon, TextItalicIcon } from "@phosphor-icons/react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface RichTextProps {
  value: string;
  onChange: (html: string) => void;
  ariaLabel: string;
}

function ToolbarButton(props: { label: string; isActive: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.isActive}
      title={props.label}
      onClick={props.onClick}
      className={cn(
        "grid size-8 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        props.isActive && "bg-accent text-foreground",
      )}
    >
      {props.children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex gap-0.5 border-b border-input px-1 py-1">
      <ToolbarButton
        label="Bold"
        isActive={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <TextBIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        isActive={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <TextItalicIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading"
        isActive={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <TextHTwoIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Bulleted list"
        isActive={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ListBulletsIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        isActive={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListNumbersIcon className="size-4" />
      </ToolbarButton>
    </div>
  );
}

/** A small rich-text field: bold, italic, one heading level and lists. The server strips anything else. */
export function RichText({ value, onChange, ariaLabel }: RichTextProps) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, code: false })],
    content: value,
    editorProps: { attributes: { "aria-label": ariaLabel, role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? "" : current.getHTML()),
  });

  if (!editor) return null;
  return (
    <div className="prose-editor border border-input bg-transparent focus-within:border-ring dark:bg-input/30">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
