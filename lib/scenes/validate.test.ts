import { describe, expect, it } from "vitest";
import { parseSavePayload } from "./validate";

const beat = { id: "a", type: "note", text: "Hi" };
const valid = { version: 1, title: "T", timecode: null, location: null, beats: [beat] };

describe("parseSavePayload", () => {
  it("accepts a save", () => {
    expect(parseSavePayload(valid)).toEqual(valid);
  });

  it("turns blank header fields into null", () => {
    expect(parseSavePayload({ ...valid, title: "  ", location: " ROOM " })).toMatchObject({
      title: null,
      location: "ROOM",
    });
  });

  it("drops speakers a beat type cannot have", () => {
    const parsed = parseSavePayload({ ...valid, beats: [{ ...beat, type: "visual", character: "REVOC" }] });
    expect(parsed?.beats[0]).toEqual({ id: "a", type: "visual", text: "Hi" });
  });

  it("keeps a voice label", () => {
    const parsed = parseSavePayload({ ...valid, beats: [{ ...beat, type: "vo", character: "INTERCOM" }] });
    expect(parsed?.beats[0].character).toBe("INTERCOM");
  });

  it.each([
    ["no body", null],
    ["no version", { ...valid, version: undefined }],
    ["a text version", { ...valid, version: "1" }],
    ["version 0", { ...valid, version: 0 }],
    ["beats that are not a list", { ...valid, beats: "x" }],
    ["an unknown type", { ...valid, beats: [{ ...beat, type: "song" }] }],
    ["a beat with no id", { ...valid, beats: [{ ...beat, id: "" }] }],
    ["duplicate beat ids", { ...valid, beats: [beat, beat] }],
    ["oversized text", { ...valid, beats: [{ ...beat, text: "x".repeat(20_001) }] }],
  ])("rejects %s", (_name, body) => {
    expect(parseSavePayload(body)).toBeNull();
  });
});
