// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Beat } from "@/lib/db/schema";
import { createEditorStore } from "@/lib/editor/store";
import { BeatList } from "./beat-list";
import { EditorProvider } from "./editor-context";

const CAST = [
  { name: "REVOC", fullName: "Revoc Eriflleh", color: "#B4237A" },
  { name: "DESRUC", fullName: "Desruc Nemo", color: "#0F766E" },
];

function setup(beats: Beat[]) {
  const store = createEditorStore({ title: "T", timecode: null, location: null, beats });
  render(
    <EditorProvider store={store} cast={CAST} showToast={vi.fn()}>
      <BeatList />
    </EditorProvider>,
  );
  return { store, user: userEvent.setup(), beats: () => store.getDoc().beats };
}

const box = (name: RegExp | string) => screen.getByRole("textbox", { name });
const note = (id: string, text: string): Beat => ({ id, type: "note", text });

afterEach(cleanup);

describe("beat keyboard", () => {
  it("adds a beat of the same type on Enter at the end", async () => {
    const { user, beats } = setup([{ id: "a", type: "visual", text: "Ash" }]);
    await user.click(box(/text, beat 1/));
    await user.keyboard("{Enter}");

    expect(beats().map(({ type }) => type)).toEqual(["visual", "visual"]);
    expect(document.activeElement).toBe(box(/text, beat 2/));
  });

  it("splits a beat on Enter in the middle", async () => {
    const { user, beats } = setup([note("a", "one two")]);
    const field = box(/text, beat 1/) as HTMLTextAreaElement;
    await user.click(field);
    field.setSelectionRange(3, 3);
    await user.keyboard("{Enter}");

    expect(beats().map(({ text }) => text)).toEqual(["one", " two"]);
  });

  it("carries the speaker to the next dialogue beat and prompts for one", async () => {
    const { user, beats } = setup([{ id: "a", type: "dialogue", character: "REVOC", text: "Go." }]);
    await user.click(box(/text, beat 1/));
    await user.keyboard("{Enter}");

    expect(beats()[1]).toMatchObject({ type: "dialogue", character: "REVOC", text: "" });
    expect(document.activeElement?.getAttribute("role")).toBe("combobox");
  });

  it("inserts a line break on Shift+Enter", async () => {
    const { user, beats } = setup([note("a", "one")]);
    await user.click(box(/text, beat 1/));
    await user.keyboard("{Shift>}{Enter}{/Shift}two");

    expect(beats()).toHaveLength(1);
    expect(beats()[0].text).toBe("one\ntwo");
  });

  it("deletes an empty beat on Backspace and goes to the one before", async () => {
    const { user, beats } = setup([note("a", "one"), note("b", "")]);
    await user.click(box(/text, beat 2/));
    await user.keyboard("{Backspace}");

    expect(beats().map(({ id }) => id)).toEqual(["a"]);
    expect(document.activeElement).toBe(box(/text, beat 1/));
  });

  it("does not delete a beat with text, or the only beat", async () => {
    const { user, beats } = setup([note("a", "")]);
    await user.click(box(/text, beat 1/));
    await user.keyboard("{Backspace}");
    expect(beats()).toHaveLength(1);
  });

  it("cycles the type on Tab and Shift+Tab, staying in the field", async () => {
    const { user, beats } = setup([note("a", "text")]);
    const field = box(/text, beat 1/);
    await user.click(field);

    await user.tab();
    expect(beats()[0].type).toBe("dialogue");
    await user.tab({ shift: true });
    expect(beats()[0].type).toBe("note");
    expect(document.activeElement).toBe(box(/text, beat 1/));
  });

  it("lets Tab leave the field after Escape, so keyboard users are not trapped", async () => {
    const { user, beats } = setup([note("a", "text"), note("b", "more")]);
    await user.click(box(/text, beat 1/));
    await user.keyboard("{Escape}");
    await user.tab();

    expect(beats()[0].type).toBe("note");
    expect(document.activeElement).not.toBe(box(/text, beat 1/));
  });

  it("moves a beat with Alt+Up and Alt+Down, keeping focus in it", async () => {
    const { user, beats } = setup([note("a", "one"), note("b", "two")]);
    await user.click(box(/text, beat 2/));
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");

    expect(beats().map(({ id }) => id)).toEqual(["b", "a"]);
    expect((document.activeElement as HTMLTextAreaElement).value).toBe("two");
  });

  it("opens a type menu on / and picks with Enter", async () => {
    const { user, beats } = setup([note("a", "")]);
    await user.click(box(/text, beat 1/));
    await user.keyboard("/vi");

    expect(screen.getByRole("listbox", { name: "Beat type" })).toBeTruthy();
    await user.keyboard("{Enter}");
    expect(beats()[0]).toMatchObject({ type: "visual", text: "" });
  });

  it("leaves the text alone when the menu is dismissed", async () => {
    const { user, beats } = setup([note("a", "")]);
    await user.click(box(/text, beat 1/));
    await user.keyboard("/{Escape}");

    expect(screen.queryByRole("listbox", { name: "Beat type" })).toBeNull();
    expect(beats()[0].text).toBe("/");
  });
});

describe("speakers", () => {
  const dialogue = (character?: string): Beat => ({ id: "a", type: "dialogue", character, text: "" });
  const speaker = () => screen.getByRole("combobox", { name: /Speaker|alongside/ });

  it("autocompletes from a full name", async () => {
    const { user, beats } = setup([dialogue()]);
    await user.click(speaker());
    await user.keyboard("erif{Enter}");
    expect(beats()[0].character).toBe("REVOC");
  });

  it("builds a shared speaker", async () => {
    const { user, beats } = setup([dialogue()]);
    await user.click(speaker());
    await user.keyboard("rev&des{Enter}");
    expect(beats()[0].character).toBe("REVOC & DESRUC");
  });

  it("accepts a new name and flags it as having no card", async () => {
    const { user, beats } = setup([dialogue()]);
    await user.click(speaker());
    await user.keyboard("zed{Enter}");

    expect(beats()[0].character).toBe("ZED");
    expect(screen.getByText("no card yet")).toBeTruthy();
  });

  it("adds to the speakers when the field is clicked, rather than replacing", async () => {
    const { user, beats } = setup([dialogue("REVOC")]);
    await user.click(speaker());
    await user.keyboard("des{Enter}");
    expect(beats()[0].character).toBe("REVOC & DESRUC");
  });

  it("removes a speaker with its button", async () => {
    const { user, beats } = setup([dialogue("REVOC & DESRUC")]);
    await user.click(screen.getByRole("button", { name: "Remove speaker REVOC" }));
    expect(beats()[0].character).toBe("DESRUC");
  });

  it("replaces a carried-over speaker when another name is typed", async () => {
    const { user, beats } = setup([{ id: "a", type: "dialogue", character: "REVOC", text: "Go." }]);
    await user.click(box(/text, beat 1/));
    await user.keyboard("{Enter}des{Enter}");
    expect(beats()[1].character).toBe("DESRUC");
  });

  it("keeps a carried-over speaker on Enter", async () => {
    const { user, beats } = setup([{ id: "a", type: "dialogue", character: "REVOC", text: "Go." }]);
    await user.click(box(/text, beat 1/));
    await user.keyboard("{Enter}{Enter}Again.");
    expect(beats()[1]).toMatchObject({ character: "REVOC", text: "Again." });
  });
});
