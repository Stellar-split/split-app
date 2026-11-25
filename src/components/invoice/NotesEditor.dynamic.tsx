import dynamic from 'next/dynamic';
import type { NotesEditorProps } from './NotesEditor';

const NotesEditorDynamic = dynamic(() => import('./NotesEditor'), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-label="Loading editor"
      className="flex items-center justify-center min-h-[120px] rounded-lg bg-gray-800 border border-gray-700"
    >
      <svg
        className="animate-spin h-5 w-5 text-indigo-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      <span className="sr-only">Loading editor...</span>
    </div>
  ),
});

export default NotesEditorDynamic;
export type { NotesEditorProps };
