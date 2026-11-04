import type { BeatType } from "@/lib/db/schema";

export const BEAT_LABELS: Record<BeatType, string> = {
  dialogue: "Dialogue",
  visual: "Visual",
  sound: "Sound",
  vo: "V.O.",
  action: "Action",
  note: "Note",
};
