'use client';

export interface TagInputProps {
  tags?: string[];
  onTagsChange?: (tags: string[]) => void;
}

export function TagInput({ tags = [], onTagsChange }: TagInputProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span key={tag} className="px-2 py-1 bg-indigo-600/20 text-indigo-300 text-xs rounded">
          {tag}
        </span>
      ))}
    </div>
  );
}

export default TagInput;
