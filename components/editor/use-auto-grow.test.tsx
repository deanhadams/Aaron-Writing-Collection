// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutoGrow } from "./use-auto-grow";

function Box({ value }: { value: string }) {
  const element = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(element, value);
  return <textarea ref={element} value={value} readOnly />;
}

const stubCss = (supported: boolean) => vi.stubGlobal("CSS", { supports: () => supported });

function renderBox(value: string) {
  const view = render(<Box value={value} />);
  return { ...view, box: view.container.querySelector("textarea") as HTMLTextAreaElement };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useAutoGrow", () => {
  it("sets the height to fit where field-sizing is missing, and again on new text", () => {
    stubCss(false);
    const scrollHeight = vi.spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get").mockReturnValue(48);

    const { box, rerender } = renderBox("one");
    expect(box.style.height).toBe("48px");

    scrollHeight.mockReturnValue(96);
    rerender(<Box value={"one\ntwo"} />);
    expect(box.style.height).toBe("96px");
  });

  it("leaves the height to CSS where field-sizing works", () => {
    stubCss(true);
    expect(renderBox("one").box.style.height).toBe("");
  });
});
