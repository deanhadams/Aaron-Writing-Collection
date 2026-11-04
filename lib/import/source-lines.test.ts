import { describe, expect, it } from "vitest";
import { htmlToLines } from "./source-lines";

describe("htmlToLines", () => {
  it("flattens inline formatting", () => {
    expect(htmlToLines("<p><strong>DESRUC:</strong> <em>Move</em> now.</p>")).toEqual([
      { text: "DESRUC: Move now.", depth: 0 },
    ]);
  });

  it("removes leftover asterisks and keeps everything else", () => {
    expect(htmlToLines("<p>**DESRUC:** teh *bell*  </p>")[0].text).toBe("DESRUC: teh bell");
  });

  it("marks sub-bullets by depth, in document order", () => {
    const html = "<ul><li>DESRUC: One<ul><li>(He turns)</li></ul></li><li>Two</li></ul><p>Three</p>";
    expect(htmlToLines(html)).toEqual([
      { text: "DESRUC: One", depth: 0 },
      { text: "(He turns)", depth: 1 },
      { text: "Two", depth: 0 },
      { text: "Three", depth: 0 },
    ]);
  });

  it("decodes entities and skips empty paragraphs", () => {
    expect(htmlToLines("<p></p><p>Tom &amp; Jerry &#39;s</p><p>   </p>")).toEqual([
      { text: "Tom & Jerry 's", depth: 0 },
    ]);
  });

  it("splits a soft line break into two lines", () => {
    expect(htmlToLines("<p>One<br />Two</p>").map(({ text }) => text)).toEqual(["One", "Two"]);
  });
});
