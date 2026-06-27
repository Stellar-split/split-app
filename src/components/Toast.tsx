'use client';
interface Props { message: string; type?: 'success' | 'error' | 'info'; onDismiss?: () => void; }
export default function Toast({ message, type = 'info', onDismiss }: Props) {
  const colors = { success: 'bg-green-700', error: 'bg-red-700', info: 'bg-gray-700' };
  return (
    <div role="alert" aria-live="polite" className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm shadow-lg ${colors[type]}`}>
      <span className="flex-1">{message}</span>
      {onDismiss && <button onClick={onDismiss} aria-label="Dismiss notification">✕</button>}
    </div>
  );
}
