import type { ReactNode } from "react";

type IconProps = { className?: string };

function Icon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export const SunIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const MoonStarsIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5Z" />
    <path d="M17 3v4M15 5h4M21 9v2M20 10h2" />
  </Icon>
);

export const SunriseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 2v6M9 5l3-3 3 3M2 18h2M20 18h2M4.9 11.9l1.4 1.4M17.7 13.3l1.4-1.4M2 22h20M16 18a4 4 0 0 0-8 0" />
  </Icon>
);

export const SunsetIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 8V2M9 5l3 3 3-3M2 18h2M20 18h2M4.9 11.9l1.4 1.4M17.7 13.3l1.4-1.4M2 22h20M16 18a4 4 0 0 0-8 0" />
  </Icon>
);

export const MapPinIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 10c0 5-5.5 9.8-7.4 11.3a1 1 0 0 1-1.2 0C9.5 19.8 4 15 4 10a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

export const LayersIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3l9 5-9 5-9-5ZM3 13l9 5 9-5" />
  </Icon>
);

export const ChatIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M21 12a8 8 0 0 1-11.8 7L4 20.5l1.5-5A8 8 0 1 1 21 12Z" />
  </Icon>
);

export const ClockIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const ArrowIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

const PrologueIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3l2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7Z" />
  </Icon>
);

const OutroIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 18V6l11-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </Icon>
);

const PostCreditIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M8 5v14M16 5v14M3 10h5M3 14h5M16 10h5M16 14h5" />
  </Icon>
);

export const KIND_ICONS = {
  prologue: PrologueIcon,
  outro: OutroIcon,
  post_credit: PostCreditIcon,
};
