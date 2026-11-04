import type { ComponentType } from "react";
import { parseLocation, type TimeTone } from "@/lib/script/parse-location";
import {
  MapPinIcon,
  MoonStarsIcon,
  SunIcon,
  SunriseIcon,
  SunsetIcon,
} from "./scene-icons";

const TIME_ICONS: Record<TimeTone, ComponentType<{ className?: string }>> = {
  day: SunIcon,
  morning: SunriseIcon,
  evening: SunsetIcon,
  night: MoonStarsIcon,
};

function Tooltip({ text }: { text: string }) {
  return (
    <span aria-hidden className="chip-tooltip">
      {text}
    </span>
  );
}

export function LocationChips({
  location,
  className = "",
}: {
  location: string | null;
  className?: string;
}) {
  const { place, timeOfDay, original } = parseLocation(location);
  if (!original || (!place && !timeOfDay)) return null;

  const TimeIcon = timeOfDay && TIME_ICONS[timeOfDay.tone];

  return (
    <p className={`flex flex-wrap gap-2 ${className}`}>
      {place && (
        <span className="place-chip">
          <MapPinIcon className="size-4 shrink-0" />
          <span className="truncate">{place}</span>
          <Tooltip text={original} />
        </span>
      )}
      {timeOfDay && TimeIcon && (
        <span className="time-chip" data-tone={timeOfDay.tone}>
          <TimeIcon className="size-4 shrink-0" />
          {timeOfDay.label}
          {timeOfDay.tone === "night" && (
            <span aria-hidden className="chip-stars">
              <span />
              <span />
              <span />
            </span>
          )}
          <Tooltip text={original} />
        </span>
      )}
    </p>
  );
}
