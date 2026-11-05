/** Edit this list to add a category. Entries with any other category show under Other. */
export const LORE_CATEGORIES = ["World", "Powers", "Organisations", "Places", "Items", "Events", "Other"] as const;

export type LoreCategory = (typeof LORE_CATEGORIES)[number];

export const loreCategory = (value: string | null): LoreCategory =>
  LORE_CATEGORIES.find((category) => category === value) ?? "Other";

export const PLACEHOLDER_BODY = "Add details here…";

/** Titles and categories only: the story itself is for Aaron to write. */
export const STARTER_ENTRIES: { title: string; category: LoreCategory }[] = [
  { title: "Hu-mons", category: "World" },
  { title: "Warrior System Exam", category: "World" },
  { title: "Natural Gifts", category: "Powers" },
  { title: "Ashes", category: "Powers" },
  { title: "Air Force", category: "Powers" },
  { title: "Warrior's Departments", category: "Organisations" },
  { title: "Department Zero", category: "Organisations" },
  { title: "Slayers", category: "Organisations" },
  { title: "The Big Five", category: "Organisations" },
  { title: "The Orphanage", category: "Places" },
  { title: "The Colosseum", category: "Places" },
];
