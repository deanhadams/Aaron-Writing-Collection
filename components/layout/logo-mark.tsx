import { useId } from "react";

export function LogoMark({ className }: { className?: string }) {
  const id = useId();

  return (
    <svg viewBox="0 0 40 40" aria-hidden className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563ff" />
          <stop offset="0.55" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#00d9ff" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id})`}>
        <rect x="10.5" y="2" width="7.5" height="20" rx="3.75" transform="rotate(-9 14 21)" />
        <rect x="22" y="2" width="7.5" height="20" rx="3.75" transform="rotate(9 26 21)" />
        <circle cx="20" cy="26.5" r="12" />
      </g>
      <g fill="#ff4fa3">
        <path d="M9.6 20.5C7.4 18.4 6.6 15.6 7.3 12.6 8.7 14.8 10.6 16.3 13 17Z" />
        <path d="M30.4 20.5C32.6 18.4 33.4 15.6 32.7 12.6 31.3 14.8 29.4 16.3 27 17Z" />
      </g>
      <g fill="white">
        <circle cx="15.6" cy="26" r="1.9" />
        <circle cx="24.4" cy="26" r="1.9" />
        <path d="M18.4 30h3.2L20 31.8Z" />
      </g>
    </svg>
  );
}
