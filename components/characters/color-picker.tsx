"use client";

import { CHARACTER_COLORS, isHexColor } from "@/lib/characters/colors";

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <fieldset>
      <legend className="eyebrow text-muted">Color</legend>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {CHARACTER_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="color-swatch"
            style={{ background: color }}
            aria-label={`Color ${color}`}
            aria-pressed={value.toLowerCase() === color.toLowerCase()}
            onClick={() => onChange(color)}
          />
        ))}
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only">Custom color picker</span>
          <input
            type="color"
            value={isHexColor(value) ? value : "#2563ff"}
            className="color-custom"
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Custom hex color</span>
          <input
            value={value}
            placeholder="#2563FF"
            maxLength={7}
            className="field w-28 text-sm"
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      </div>
    </fieldset>
  );
}
