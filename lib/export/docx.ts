import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { ScriptLine } from "./lines";

const BULLETS = "script-bullets";
const INK = "000000";
const FONT = "Calibri";

const heading = (size: number) => ({ run: { font: FONT, size, bold: true, color: INK }, paragraph: { spacing: { before: 240, after: 120 } } });

function paragraph({ style, runs }: ScriptLine, isFirstEpisode: boolean) {
  const children = runs.map(({ text, bold, italics }) => new TextRun({ text, bold, italics }));

  switch (style) {
    case "season":
      return new Paragraph({ heading: HeadingLevel.HEADING_1, children });
    case "episode":
      return new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: !isFirstEpisode, children });
    case "scene":
      return new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children });
    case "bold":
      return new Paragraph({ keepNext: true, spacing: { after: 80 }, children });
    case "bullet":
      return new Paragraph({ numbering: { reference: BULLETS, level: 0 }, spacing: { after: 60 }, children });
    case "sub":
      return new Paragraph({ numbering: { reference: BULLETS, level: 1 }, spacing: { after: 60 }, children });
  }
}

/** Real Word headings, so the Navigation Pane lists every episode and scene. */
export async function renderDocx(lines: ScriptLine[], title: string): Promise<Buffer> {
  let episodes = 0;
  const children = lines.map((line) => {
    if (line.style === "episode") episodes++;
    return paragraph(line, episodes <= 1);
  });

  const document = new Document({
    creator: "Aaron's Writing Collection",
    title,
    styles: {
      default: {
        document: { run: { font: FONT, size: 22 } },
        heading1: heading(32),
        heading2: heading(26),
      },
    },
    numbering: {
      config: [
        {
          reference: BULLETS,
          levels: [
            { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } },
            { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 240 } } } },
          ],
        },
      ],
    },
    sections: [{ children }],
  });

  return Packer.toBuffer(document);
}
