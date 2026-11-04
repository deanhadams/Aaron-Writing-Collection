import { NextResponse } from "next/server";
import { DOCX_TYPE } from "./load";

export const attachment = (fileName: string) => `attachment; filename="${fileName}"`;

export function docxResponse({ fileName, buffer }: { fileName: string; buffer: Buffer }) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": DOCX_TYPE, "Content-Disposition": attachment(fileName), "Cache-Control": "no-store" },
  });
}
