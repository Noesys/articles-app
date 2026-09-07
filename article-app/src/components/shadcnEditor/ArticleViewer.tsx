import { useEditor, EditorContent } from "@tiptap/react";
import { useEffect } from "react";
import "./Tiptap.css";
import { tiptapExtensions } from "./TiptapExtensions";
import { resolveContentToHtml } from "@/components/editor/lib/contentNormalize";
import CopyButton from "@/admin/utils/CopyButton";

type Props = {
  content: string;
};

/**
 * Read-only renderer used by the Preview tab (ArticleCreation / ArticleDetail)
 * and by the admin article detail screen.
 *
 * Content may arrive as:
 *  - Tiptap HTML (normal case, includes <img src="data:image/...">)
 *  - raw markdown, including base64 images written as ![alt](data:image/png;base64,…)
 *
 * resolveContentToHtml() picks the right path, so the preview always shows
 * formatted output plus the inline images instead of literal syntax.
 */
export default function ArticleViewer({ content }: Props) {
  const editor = useEditor({
    extensions: tiptapExtensions,
    content: resolveContentToHtml(content),
    editable: false,
  });

  // Preview is re-opened with new content while mounted (toggling Editor /
  // Preview keeps this component alive in some screens), so re-sync.
  useEffect(() => {
    if (!editor) return;
    const next = resolveContentToHtml(content);
    if (next !== editor.getHTML()) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="article-viewer">
      <EditorContent editor={editor} />
    </div>
  );
}
