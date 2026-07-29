'use client';

import React, { useState } from 'react';
import type { CoCreatorPresence, InvoiceSectionFocus } from '@/types/presence';

const sectionColors: Record<InvoiceSectionFocus, string> = {
  details: 'ring-blue-500',
  payments: 'ring-green-500',
  recipients: 'ring-purple-500',
};

const sectionLabels: Record<InvoiceSectionFocus, string> = {
  details: 'Details',
  payments: 'Payments',
  recipients: 'Recipients',
};

interface AvatarProps {
  presence: CoCreatorPresence;
  isCurrentUser: boolean;
}

function Avatar({ presence, isCurrentUser }: AvatarProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const initials = presence.displayName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div key={presence.userId} className="relative group">
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold
          bg-gradient-to-br from-indigo-400 to-purple-600 text-white
          ring-2 ${sectionColors[presence.focusedSection]}
          ${isCurrentUser ? 'ring-offset-2' : ''}
          cursor-help transition-transform hover:scale-110
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {presence.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={presence.avatarUrl}
            alt={presence.displayName}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="
            absolute -top-12 left-1/2 transform -translate-x-1/2 z-50
            bg-gray-900 text-white text-xs font-medium px-3 py-2 rounded
            whitespace-nowrap shadow-lg
          "
        >
          <div>{presence.displayName}</div>
          <div className="text-gray-300 text-xs">
            viewing {sectionLabels[presence.focusedSection]}
          </div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}
    </div>
  );
}

interface PresenceBarProps {
  presenceRoster: CoCreatorPresence[];
  currentUserId: string;
}

export default function PresenceBar({ presenceRoster, currentUserId }: PresenceBarProps) {
  const [showOverflowTooltip, setShowOverflowTooltip] = useState(false);

  if (presenceRoster.length === 0) {
    return null;
  }

  const visibleCount = 5; // Show up to 5 avatars before "+N"
  const displayRoster = presenceRoster.slice(0, visibleCount);
  const overflowCount = Math.max(0, presenceRoster.length - visibleCount);

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-b border-blue-200 rounded-lg">
      <span className="text-xs font-medium text-gray-600">Active now:</span>

      <div className="flex items-center -space-x-3">
        {displayRoster.map((presence) => (
          <Avatar
            key={presence.userId}
            presence={presence}
            isCurrentUser={presence.userId === currentUserId}
          />
        ))}

        {/* Overflow indicator */}
        {overflowCount > 0 && (
          <div className="relative">
            <div
              className="
                w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold
                bg-gray-300 text-gray-700 ring-2 ring-gray-400
                cursor-help transition-transform hover:scale-110
              "
              onMouseEnter={() => setShowOverflowTooltip(true)}
              onMouseLeave={() => setShowOverflowTooltip(false)}
            >
              +{overflowCount}
            </div>

            {/* Overflow tooltip */}
            {showOverflowTooltip && (
              <div
                className="
                  absolute -top-12 left-1/2 transform -translate-x-1/2 z-50
                  bg-gray-900 text-white text-xs font-medium px-3 py-2 rounded
                  whitespace-nowrap shadow-lg max-w-xs
                "
              >
                <div className="font-semibold mb-1">Also present:</div>
                {presenceRoster.slice(visibleCount).map((presence) => (
                  <div key={presence.userId} className="text-gray-300">
                    {presence.displayName} • {sectionLabels[presence.focusedSection]}
                  </div>
                ))}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
