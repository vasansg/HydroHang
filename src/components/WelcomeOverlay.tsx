'use client';

import { useEffect, useState } from 'react';

interface Props {
  email: string;
  onDone: () => void;
}

export default function WelcomeOverlay({ email, onDone }: Props) {
  const [exiting, setExiting] = useState(false);
  const name = email.split('@')[0];

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), 2800);
    const t2 = setTimeout(onDone, 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      role="dialog"
      aria-label="Welcome"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(99,102,241,0.5) 0%, rgba(15,13,42,0.98) 65%), #0F0D2A',
        animation: exiting
          ? 'welcomeExit 0.6s ease forwards'
          : 'welcomeEnter 0.4s ease forwards',
      }}
    >
      {/* Background sparkles */}
      {[...Array(14)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            left: `${8 + (i * 6.3) % 84}%`,
            top: `${4 + (i * 9.1) % 88}%`,
            animation: `twinkle ${1.5 + (i % 4) * 0.4}s ease-in-out ${
              (i * 0.25) % 1.5
            }s infinite alternate`,
          }}
        />
      ))}

      {/* Character — outer div floats, inner div bounces in */}
      <div style={{ animation: 'float 3s ease-in-out 1.2s infinite' }}>
        <div style={{ animation: 'bounceIn 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
          <svg
            width="180"
            height="240"
            viewBox="0 0 180 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Ground shadow */}
            <ellipse cx="90" cy="230" rx="44" ry="9" fill="#4F46E5" opacity="0.25" />

            {/* Legs */}
            <rect x="62" y="185" width="21" height="34" rx="9" fill="#312E81" />
            <rect x="97" y="185" width="21" height="34" rx="9" fill="#312E81" />
            {/* Shoes */}
            <ellipse cx="72" cy="219" rx="16" ry="9" fill="#1E1B4B" />
            <ellipse cx="108" cy="219" rx="16" ry="9" fill="#1E1B4B" />

            {/* Body */}
            <rect x="53" y="118" width="74" height="72" rx="17" fill="#4F46E5" />
            {/* Shirt highlight */}
            <rect x="67" y="130" width="46" height="30" rx="10" fill="#6366F1" opacity="0.5" />
            {/* Chest badge */}
            <circle cx="90" cy="145" r="11" fill="#818CF8" opacity="0.4" />

            {/* Left arm — static, hanging slightly forward */}
            <line
              x1="53" y1="132" x2="31" y2="152"
              stroke="#4F46E5" strokeWidth="14" strokeLinecap="round"
            />
            <circle cx="31" cy="152" r="10" fill="#818CF8" />

            {/* Right arm — WAVING (pivots at shoulder 127,132) */}
            <g className="waving-arm">
              <line
                x1="127" y1="132" x2="145" y2="112"
                stroke="#4F46E5" strokeWidth="14" strokeLinecap="round"
              />
              <circle cx="145" cy="112" r="11" fill="#818CF8" />
            </g>

            {/* Head */}
            <circle cx="90" cy="83" r="41" fill="#818CF8" />
            <circle cx="90" cy="83" r="37" fill="#6366F1" />

            {/* Ears */}
            <circle cx="49" cy="85" r="11" fill="#818CF8" />
            <circle cx="131" cy="85" r="11" fill="#818CF8" />

            {/* Eyes */}
            <ellipse cx="74" cy="77" rx="8" ry="9" fill="white" />
            <ellipse cx="106" cy="77" rx="8" ry="9" fill="white" />
            <circle cx="75" cy="78" r="5" fill="#1E1B4B" />
            <circle cx="107" cy="78" r="5" fill="#1E1B4B" />
            {/* Eye shine */}
            <circle cx="77" cy="76" r="2" fill="white" />
            <circle cx="109" cy="76" r="2" fill="white" />

            {/* Happy smile */}
            <path
              d="M 71 93 Q 90 110 109 93"
              stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none"
            />

            {/* Blush */}
            <ellipse cx="61" cy="91" rx="10" ry="6" fill="#F472B6" opacity="0.4" />
            <ellipse cx="119" cy="91" rx="10" ry="6" fill="#F472B6" opacity="0.4" />

            {/* Sparkles near waving hand */}
            <circle
              cx="158" cy="105" r="3" fill="#FBBF24"
              style={{ animation: 'sparkle 0.7s ease-in-out 0.6s infinite alternate' }}
            />
            <circle
              cx="165" cy="92" r="2" fill="#818CF8"
              style={{ animation: 'sparkle 0.7s ease-in-out 0.2s infinite alternate' }}
            />
            <circle
              cx="153" cy="96" r="1.5" fill="#F472B6"
              style={{ animation: 'sparkle 0.9s ease-in-out 0.9s infinite alternate' }}
            />
          </svg>
        </div>
      </div>

      {/* Welcome text */}
      <div
        className="text-center mt-3"
        style={{ animation: 'fadeInUp 0.6s ease 0.8s both' }}
      >
        <h2 className="text-4xl font-black tracking-tight">Welcome back</h2>
        {name && (
          <p className="text-3xl font-black mt-1" style={{ color: '#818CF8' }}>
            {name}!
          </p>
        )}
        <p className="text-white/50 mt-2 text-base">Your laundry is ready to manage</p>
      </div>

      {/* Loading dots */}
      <div
        className="flex gap-2 mt-8"
        style={{ animation: 'fadeIn 0.4s ease 1.5s both' }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary"
            style={{ animation: `dotPulse 0.9s ease-in-out ${i * 0.18}s infinite alternate` }}
          />
        ))}
      </div>
    </div>
  );
}
