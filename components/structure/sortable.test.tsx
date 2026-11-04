// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { moveItem } from "@/lib/structure/order";
import { ReorderTools, type RowHandle } from "./sortable";

const handle = { ref: () => {} } as unknown as RowHandle;

function List({ onMove }: { onMove?: (from: number, to: number) => void }) {
  const [items, setItems] = useState(["A", "B", "C"]);
  const move = (from: number, to: number) => {
    onMove?.(from, to);
    setItems(moveItem(items, from, to));
  };

  return (
    <ul>
      {items.map((item, index) => (
        <li key={item}>
          <ReorderTools label={item} handle={handle} index={index} count={items.length} onMove={move} />
        </li>
      ))}
    </ul>
  );
}

const order = () => screen.getAllByRole("listitem").map((row) => row.querySelector("button")?.getAttribute("aria-label"));

afterEach(cleanup);

describe("ReorderTools", () => {
  it("moves a row with the keyboard and keeps focus for the next press", async () => {
    const user = userEvent.setup();
    render(<List />);

    const button = screen.getByRole("button", { name: "Move A down" });
    button.focus();

    await user.keyboard("{Enter}");
    expect(order()[1]).toBe("Drag to reorder A");
    expect(document.activeElement).toBe(button);

    await user.keyboard("{Enter}");
    expect(order()[2]).toBe("Drag to reorder A");
    expect(document.activeElement).toBe(button);
  });

  it("stays put at either end, and says so", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<List onMove={onMove} />);

    const up = screen.getByRole("button", { name: "Move A up" });
    const down = screen.getByRole("button", { name: "Move C down" });
    expect(up.getAttribute("aria-disabled")).toBe("true");
    expect(down.getAttribute("aria-disabled")).toBe("true");

    await user.click(up);
    await user.click(down);
    expect(onMove).not.toHaveBeenCalled();
  });
});
