// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useModal } from "./use-modal";

// Like a browser: close() reports through a close event that arrives later.
beforeEach(() => {
  vi.useFakeTimers();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    setTimeout(() => this.dispatchEvent(new Event("close")));
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Modal({ onClose }: { onClose: () => void }) {
  const dialog = useModal();
  return <dialog ref={dialog} onClose={onClose} />;
}

function Page() {
  const [isOpen, setOpen] = useState(true);
  return isOpen ? <Modal onClose={() => setOpen(false)} /> : <p>closed</p>;
}

const settle = () => act(() => vi.runAllTimers());

describe("useModal", () => {
  it("stays open under Strict Mode, which runs effects twice in development", () => {
    const { container } = render(
      <StrictMode>
        <Page />
      </StrictMode>,
    );

    settle();

    expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(true);
    expect(container.textContent).not.toContain("closed");
  });

  it("opens without Strict Mode too", () => {
    const { container } = render(<Page />);
    settle();
    expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(true);
  });

  it("closes when the person closes it", () => {
    const { container } = render(
      <StrictMode>
        <Page />
      </StrictMode>,
    );
    settle();

    act(() => container.querySelector("dialog")?.close());
    settle();

    expect(container.textContent).toContain("closed");
  });

  it("closes when the route is hidden, so it cannot block the next page", () => {
    const { container, unmount } = render(<Modal onClose={() => {}} />);
    settle();
    const dialog = container.querySelector("dialog")!;

    unmount();
    settle();

    expect(dialog.hasAttribute("open")).toBe(false);
  });
});
