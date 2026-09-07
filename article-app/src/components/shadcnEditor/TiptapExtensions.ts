import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { ResizableImage } from "@/components/editor/extensions/ResizableImage";
import TextAlign from "@tiptap/extension-text-align";
import CharacterCount from "@tiptap/extension-character-count";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";

/**
 * Single source of truth for Tiptap extensions.
 * Both TiptapEditor.tsx (editable) and ArticleViewer.tsx (read-only)
 * import this so HTML renders identically in both modes.
 */
export const tiptapExtensions = [
  StarterKit,
  Underline,
  Link.configure({
    openOnClick: false,
  }),
  ResizableImage,
  TextAlign.configure({
    types: ["heading", "paragraph", "image"],
  }),
  CharacterCount,
  Table.configure({
    resizable: true,
  }),
  TableRow,
  TableHeader,
  TableCell,
];
