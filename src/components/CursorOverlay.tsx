'use client';

export interface CursorOverlayProps {
  presences?: Array<{ address: string; x: number; y: number; name?: string }>;
}

export function CursorOverlay({ presences }: CursorOverlayProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {presences?.map((p) => (
        <div key={p.address} style={{ left: p.x, top: p.y }} className="absolute text-xs bg-gray-800 text-gray-200 px-2 py-1 rounded">
          {p.name || p.address}
        </div>
      ))}
    </div>
  );
}

export default CursorOverlay;
