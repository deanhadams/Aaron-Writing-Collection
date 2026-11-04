// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Beat } from "@/lib/db/schema";
import { ScriptBeat } from "./script-beat";

const colors = new Map([
  ["REVOC", "#B4237A"],
  ["DESRUC", "#0F766E"],
]);

const show = (beat: Omit<Beat, "id" | "text">) =>
  render(<ScriptBeat beat={{ id: "a", text: "Hi", ...beat }} characterColors={colors} />);

const colorOf = (name: string) => screen.getByText(name).style.getPropertyValue("--char");

afterEach(cleanup);

describe("ScriptBeat speakers", () => {
  it("colors a single speaker", () => {
    show({ type: "dialogue", character: "REVOC" });
    expect(colorOf("REVOC")).toBe("#B4237A");
  });

  it("colors each shared speaker with their own color", () => {
    show({ type: "dialogue", character: "REVOC & DESRUC" });
    expect(colorOf("REVOC")).toBe("#B4237A");
    expect(colorOf("DESRUC")).toBe("#0F766E");
  });

  it("links each name that has a card", () => {
    render(
      <ScriptBeat
        beat={{ id: "a", type: "dialogue", character: "REVOC & ZED", text: "Hi" }}
        characterColors={colors}
        characterLinks={new Map([["REVOC", "revoc-eriflleh"]])}
      />,
    );
    expect(screen.getByRole("link", { name: "REVOC" }).getAttribute("href")).toBe("/characters/revoc-eriflleh");
    expect(screen.queryByRole("link", { name: "ZED" })).toBeNull();
  });

  it("keeps the separator as written", () => {
    const { container } = show({ type: "dialogue", character: "REVOC, DESRUC / KRAD" });
    expect(container.textContent).toContain("REVOC, DESRUC / KRAD");
  });

  it("falls back to the default for a name with no card", () => {
    show({ type: "dialogue", character: "REVOC & ZED" });
    expect(colorOf("ZED")).toBe("var(--color-primary-strong)");
  });

  it("shows a voice label with no card on its own", () => {
    const { container } = show({ type: "vo", character: "INTERCOM" });
    expect(container.textContent).toContain("INTERCOM");
    expect(container.textContent).not.toContain("V.O.");
  });

  it("marks a character's voice-over once, after the names", () => {
    const { container } = show({ type: "vo", character: "REVOC" });
    expect(container.textContent).toContain("REVOC (V.O.)");
  });

  it("shows a nameless voice-over", () => {
    const { container } = show({ type: "vo" });
    expect(container.textContent).toContain("V.O.");
  });
});
