"use client";

import { useEffect, useState } from "react";
import { isExpired } from "@stellar-split/sdk";

interface Props {
  deadline: number; // unix seconds
  compact?: boolean; // true → HH:MM:SS, false → DD:HH:MM:SS
}

function calcTimeLeft(deadline: number) {
  return Math.max(0, deadline - Math.floor(Date.now() / 1000));
}

export default function CountdownTimer({ deadline, compact = false }: Props) {
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(deadline));

  useEffect(() => {
    if (isExpired(deadline)) return;
    const id = setInterval(() => {
      const left = calcTimeLeft(deadline);
      setTimeLeft(left);
      if (left === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (isExpired(deadline) || timeLeft === 0) {
    return <span className="text-red-500 font-mono text-xs font-semibold">Expired</span>;
  }

  const days = Math.floor(timeLeft / 86400);
  const hours = Math.floor((timeLeft % 86400) / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  const isUrgent = timeLeft < 86400;
  const colorClass = isUrgent ? "text-red-400" : "text-gray-300";

  const display = compact
    ? `${pad(hours + days * 24)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <span className={`font-mono text-xs font-semibold tabular-nums ${colorClass}`}>
      {display}
    </span>
  );
}
