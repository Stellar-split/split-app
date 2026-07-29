'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import DOMPurify from 'dompurify';
import { useEffect, useCallback } from 'react';

interface NotesEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function NotesEditor({
  value,
  onChange,
  placeholder = 'Add notes...',
  disabled = false,
}: NotesEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: false }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3'],
        ALLOWED_ATTR: ['href', 'title'],
      });
      onChange(sanitized);
    },
    editable: !disabled,
  });

  useEffect(() => {
    if (editor && value && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const insertLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="toolbar"
        className="flex flex-wrap gap-1 bg-gray-800 border border-gray-700 rounded-lg p-2"
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            editor.chain().focus().run();
          }
        }}
      >
        <button
          type="button"
          onClick={toggleBold}
          disabled={disabled}
          aria-label="Toggle bold"
          className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
            editor.isActive('bold')
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          B
        </button>

        <button
          type="button"
          onClick={toggleItalic}
          disabled={disabled}
          aria-label="Toggle italic"
          className={`px-3 py-1.5 rounded text-sm italic transition-colors ${
            editor.isActive('italic')
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          I
        </button>

        <button
          type="button"
          onClick={toggleBulletList}
          disabled={disabled}
          aria-label="Toggle bullet list"
          className={`px-3 py-1.5 rounded text-sm transition-colors ${
            editor.isActive('bulletList')
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          • List
        </button>

        <button
          type="button"
          onClick={insertLink}
          disabled={disabled}
          aria-label="Insert link"
          className={`px-3 py-1.5 rounded text-sm transition-colors ${
            editor.isActive('link')
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          🔗 Link
        </button>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 min-h-32">
        <EditorContent
          editor={editor}
          className="prose prose-invert max-w-none text-sm text-gray-100 focus:outline-none [&>*]:focus:outline-none"
        />
      </div>
    </div>
  );
}
