import mammoth from "mammoth";

export type CvKind = "pdf" | "docx";

export function detectKind(mimetype: string, originalname: string): CvKind | null {
  const lowerName = originalname.toLowerCase();
  if (
    mimetype === "application/pdf" ||
    lowerName.endsWith(".pdf")
  ) {
    return "pdf";
  }
  if (
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return "docx";
  }
  return null;
}

export async function parseCv(buffer: Buffer, kind: CvKind): Promise<string> {
  if (kind === "pdf") {
    const mod = await import("pdf-parse");
    const pdfParse = (mod as unknown as { default: (b: Buffer) => Promise<{ text: string }> }).default;
    const result = await pdfParse(buffer);
    return result.text.trim();
  }
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}
