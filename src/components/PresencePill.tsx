'use client';

export interface PresencePillProps {
  presences?: Array<{ address: string; name?: string }>;
  currentAddress?: string;
}

export function PresencePill({ presences = [] }: PresencePillProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-full text-xs">
      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
      <span className="text-gray-300">{presences.length} editing</span>
    </div>
  );
}

export default PresencePill;
