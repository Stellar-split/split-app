interface CursorOverlayProps {
  cursors: any[];
  fieldName: string;
}

export default function CursorOverlay({ cursors, fieldName }: CursorOverlayProps) {
  return (
    <div className="cursor-overlay">
      {cursors.map((cursor: any) => (
        <div
          key={cursor.userId || cursor.id}
          className="absolute pointer-events-none"
          style={{ color: cursor.color || "gray" }}
        >
          cursor: {cursor.position}
        </div>
      ))}
    </div>
  );
}
