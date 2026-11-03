interface CopyLinkButtonProps {
  url: string;
  label?: string;
  className?: string;
}

export default function CopyLinkButton({ url, label = "Copy Link", className }: CopyLinkButtonProps) {
  const handleClick = () => {
    navigator.clipboard.writeText(url);
  };

  const defaultClassName = "px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm hover:bg-gray-700 transition";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className || defaultClassName}
    >
      {label}
    </button>
  );
}
