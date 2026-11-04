import { describe, expect, it } from "vitest";
import type { ParsedScene } from "./parse-script";
import { extraScenes, planScenes, type ExistingScene } from "./plan-scenes";

const parsed = (position: number, text = "Hello"): ParsedScene => ({
  position,
  kind: "scene",
  title: "Title",
  timecode: "0:00 - 1:00",
  location: "ROOM - DAY",
  beats: [{ id: crypto.randomUUID(), type: "dialogue", character: "DESRUC", text }],
});

// What the database returns: its own beat ids, and keys in jsonb's order.
const stored = (scene: ParsedScene, version = 1): ExistingScene => ({
  ...scene,
  id: `scene-${scene.position}`,
  version,
  importKey: `e1:s${scene.position}`,
  deletedAt: null,
  beats: scene.beats.map(({ type, text, character }) => ({
    character,
    text,
    id: "stored",
    type,
  })),
});

const actions = (existing: ExistingScene[], scenes: ParsedScene[], force = false) =>
  planScenes(existing, scenes, 1, force).map(({ action }) => action);

describe("planScenes", () => {
  it("inserts everything on the first run", () => {
    expect(actions([], [parsed(1), parsed(2)])).toEqual(["insert", "insert"]);
  });

  it("changes nothing on a repeat run", () => {
    const scenes = [parsed(1), parsed(2)];
    expect(actions(scenes.map((scene) => stored(scene)), [parsed(1), parsed(2)])).toEqual(["unchanged", "unchanged"]);
  });

  it("updates an unedited scene when the document changes, and stays at version 1", () => {
    const [plan] = planScenes([stored(parsed(1))], [parsed(1, "Changed")], 1, false);
    expect(plan).toMatchObject({ action: "update", version: 1 });
  });

  it("inserts a new scene added at the end", () => {
    expect(actions([stored(parsed(1))], [parsed(1), parsed(2)])).toEqual(["unchanged", "insert"]);
  });

  it("never overwrites an edited scene without force", () => {
    expect(actions([stored(parsed(1), 2)], [parsed(1, "Changed")])).toEqual(["protected"]);
  });

  it("overwrites an edited scene with force and moves the version on", () => {
    const [plan] = planScenes([stored(parsed(1), 4)], [parsed(1, "Changed")], 1, true);
    expect(plan).toMatchObject({ action: "update", version: 5 });
  });

  it("leaves an edited scene alone when it already matches", () => {
    expect(actions([stored(parsed(1), 3)], [parsed(1)], true)).toEqual(["unchanged"]);
  });

  it("matches by key, not by the position the site gave the scene", () => {
    const moved = { ...stored(parsed(1)), position: 9 };
    expect(actions([moved], [parsed(1)])).toEqual(["unchanged"]);
  });

  it("ignores a site scene sitting at the same position", () => {
    const siteScene = { ...stored(parsed(1, "Written on the site")), importKey: null };
    expect(actions([siteScene], [parsed(1)])).toEqual(["insert"]);
  });

  it("never brings back a scene deleted on the site, even with force", () => {
    const deleted = { ...stored(parsed(1)), deletedAt: new Date() };
    expect(actions([deleted], [parsed(1, "Changed")], true)).toEqual(["deleted"]);
  });
});

describe("extraScenes", () => {
  it("lists imported scenes the document no longer has", () => {
    const existing = [stored(parsed(1)), stored(parsed(2))];
    expect(extraScenes(existing, new Set(["e1:s1"])).map(({ position }) => position)).toEqual([2]);
  });

  it("skips site scenes and deleted scenes", () => {
    const site = { ...stored(parsed(1)), importKey: null };
    const deleted = { ...stored(parsed(2)), deletedAt: new Date() };
    expect(extraScenes([site, deleted], new Set())).toEqual([]);
  });
});
