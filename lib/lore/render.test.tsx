// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoreMarkdown } from "@/components/lore/lore-markdown";
import { buildLinkLookup } from "./links";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const lookup = buildLinkLookup({
  characters: [{ name: "DESRUC", fullName: "Desruc Nemo", aliases: [], slug: "desruc-nemo", color: "#b4237a" }],
  entries: [{ title: "The Colosseum", aliases: ["Arena"], slug: "the-colosseum" }],
});

afterEach(cleanup);

describe("LoreMarkdown", () => {
  it("links a character, coloured with their color", () => {
    render(<LoreMarkdown body="Ask [[Desruc Nemo]]." lookup={lookup} />);

    const chip = screen.getByRole("link", { name: "Desruc Nemo" });
    expect(chip.getAttribute("href")).toBe("/characters/desruc-nemo");
    expect(chip.getAttribute("style")).toContain("--char");
  });

  it("links a lore entry, through an alias too", () => {
    render(<LoreMarkdown body="[[The Colosseum]] or [[Arena|the ring]]" lookup={lookup} />);

    expect(screen.getByRole("link", { name: "The Colosseum" }).getAttribute("href")).toBe("/lore/the-colosseum");
    expect(screen.getByRole("link", { name: "the ring" }).getAttribute("href")).toBe("/lore/the-colosseum");
  });

  it("offers to create an unknown name", () => {
    render(<LoreMarkdown body="[[Nobody Yet]]" lookup={lookup} />);

    expect(screen.getByText("no entry yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create entry for Nobody Yet" })).toBeTruthy();
  });

  it("leaves a link in code as text", () => {
    render(<LoreMarkdown body="`[[DESRUC]]`" lookup={lookup} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("drops script links and raw HTML", () => {
    const { container } = render(<LoreMarkdown body={"[bad](javascript:alert(1))\n\n<script>alert(1)</script>"} lookup={lookup} />);

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
  });

  it("gives headings ids for the contents", () => {
    const { container } = render(<LoreMarkdown body="## The Big Five" lookup={lookup} />);
    expect(container.querySelector("h2")?.id).toBe("the-big-five");
  });

  it("renders tables", () => {
    const { container } = render(<LoreMarkdown body={"| A |\n| - |\n| 1 |"} lookup={lookup} />);
    expect(container.querySelector("table td")?.textContent).toBe("1");
  });
});
