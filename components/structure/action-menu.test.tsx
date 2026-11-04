// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { moveItem } from "@/lib/structure/order";
import { ActionMenu, MenuDivider, MenuItem } from "./action-menu";

function Menu({ onRename = () => {}, onDelete = () => {} }: { onRename?: () => void; onDelete?: () => void }) {
  return (
    <div data-testid="card">
      <ActionMenu label="Options">
        <MenuItem onSelect={onRename}>Rename</MenuItem>
        <MenuItem onSelect={() => {}}>Mark done</MenuItem>
        <MenuDivider />
        <MenuItem danger onSelect={onDelete}>
          Delete
        </MenuItem>
      </ActionMenu>
      <a href="#elsewhere">Elsewhere</a>
    </div>
  );
}

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Options" }));
  return screen.getByRole("menu");
};

afterEach(cleanup);

describe("ActionMenu", () => {
  it("renders in the body, outside the card, so nothing can clip it", async () => {
    const user = userEvent.setup();
    render(<Menu />);

    const menu = await open(user);

    expect(menu.parentElement).toBe(document.body);
    expect(screen.getByTestId("card").contains(menu)).toBe(false);
  });

  it("is closed until asked for", () => {
    render(<Menu />);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Options" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("focuses the first row and moves with the arrow keys, wrapping at the ends", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await open(user);

    const focused = () => document.activeElement?.textContent;
    expect(focused()).toBe("Rename");

    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe("Mark done");
    await user.keyboard("{End}");
    expect(focused()).toBe("Delete");
    await user.keyboard("{ArrowDown}");
    expect(focused()).toBe("Rename");
    await user.keyboard("{ArrowUp}");
    expect(focused()).toBe("Delete");
    await user.keyboard("{Home}");
    expect(focused()).toBe("Rename");
  });

  it("runs a row with Enter, closes and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<Menu onDelete={onDelete} />);
    await open(user);

    await user.keyboard("{End}{Enter}");

    expect(onDelete).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Options" }));
  });

  it("closes on Escape and returns focus", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await open(user);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Options" }));
  });

  it("closes on an outside click", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await open(user);

    await user.click(screen.getByRole("link", { name: "Elsewhere" }));

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on a second press of the trigger, rather than reopening", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    await open(user);

    await user.click(screen.getByRole("button", { name: "Options" }));

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("keeps a click inside open until a row is chosen", async () => {
    const user = userEvent.setup();
    render(<Menu />);
    const menu = await open(user);

    await user.click(menu.querySelector('[role="separator"]')!);

    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("opens as a sheet on a phone, and its scrim closes it", async () => {
    const user = userEvent.setup();
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal("matchMedia", matchMedia);
    render(<Menu />);

    const menu = await open(user);
    expect(menu.dataset.sheet).toBeDefined();

    await user.click(document.querySelector(".menu-scrim")!);
    expect(screen.queryByRole("menu")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("returns focus to the trigger after its own row moves the card", async () => {
    function Rows() {
      const [items, setItems] = useState(["A", "B"]);
      return (
        <ul>
          {items.map((item, index) => (
            <li key={item}>
              <ActionMenu label={`Options for ${item}`} keepFocusOn={index}>
                <MenuItem onSelect={() => setItems(moveItem(items, index, index === 0 ? 1 : 0))}>Move</MenuItem>
              </ActionMenu>
            </li>
          ))}
        </ul>
      );
    }

    const user = userEvent.setup();
    render(<Rows />);
    const trigger = screen.getByRole("button", { name: "Options for A" });

    await user.click(trigger);
    await user.keyboard("{Enter}");

    expect(document.activeElement).toBe(trigger);
    expect(screen.getAllByRole("listitem")[1].contains(trigger)).toBe(true);
  });
});
