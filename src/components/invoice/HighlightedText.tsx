"use client";

interface HighlightedTextProps {
  text: string;
  query: string;
}

export default function HighlightedText({ text, query }: HighlightedTextProps) {
  if (!query) return <>{text}</>;

  const parts = text.split(new RegExp(`(${query})`, "gi"));

  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={idx} className="bg-yellow-200 dark:bg-yellow-700 no-underline">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}
