import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from "docx";
import type { OptimizedCv } from "./optimize";
import type { CoverLetterContent } from "./generatePdf";

const ACCENT_HEX = "8C1515";

function dateRange(startDate?: string, endDate?: string): string {
  if (startDate && endDate) return `${startDate} – ${endDate}`;
  if (endDate) return endDate;
  if (startDate) return `${startDate} – Present`;
  return "";
}

function sectionHeading(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    border: {
      bottom: { color: "CCCCCC", space: 1, style: BorderStyle.SINGLE, size: 6 },
    },
    children: [
      new TextRun({
        text: label.toUpperCase(),
        bold: true,
        size: 22,
        color: ACCENT_HEX,
        characterSpacing: 30,
      }),
    ],
  });
}

function leftRight(left: { text: string; bold?: boolean; italics?: boolean }[], right: string): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { after: 40 },
    children: [
      ...left.map(
        (l) =>
          new TextRun({
            text: l.text,
            bold: l.bold,
            italics: l.italics,
            size: 22,
          }),
      ),
      new TextRun({ text: `\t${right}`, size: 20, color: "555555" }),
    ],
  });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60 },
    indent: { left: 360, hanging: 220 },
    children: [
      new TextRun({ text: "•  ", size: 22 }),
      new TextRun({ text, size: 22 }),
    ],
  });
}

function plainParagraph(text: string, opts: { bold?: boolean; italics?: boolean; size?: number; color?: string; after?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: opts.after ?? 60 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italics,
        size: opts.size ?? 22,
        color: opts.color,
      }),
    ],
  });
}

function header(name: string, contact: OptimizedCv["contact"]): Paragraph[] {
  const out: Paragraph[] = [];
  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: name, bold: true, size: 44 })],
    }),
  );
  const bits: string[] = [];
  if (contact.location) bits.push(contact.location);
  if (contact.email) bits.push(contact.email);
  if (contact.phone) bits.push(contact.phone);
  if (contact.linkedin) bits.push(contact.linkedin);
  if (contact.website) bits.push(contact.website);
  if (bits.length > 0) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: bits.join("  •  "), size: 20, color: "555555" })],
      }),
    );
  }
  out.push(
    new Paragraph({
      spacing: { after: 120 },
      border: {
        bottom: { color: ACCENT_HEX, space: 1, style: BorderStyle.SINGLE, size: 8 },
      },
      children: [new TextRun({ text: "" })],
    }),
  );
  return out;
}

export async function generateCvDocx(cv: OptimizedCv): Promise<Buffer> {
  const children: Paragraph[] = [];
  children.push(...header(cv.candidateName, cv.contact));

  if (cv.summary) {
    children.push(sectionHeading("Summary"));
    children.push(plainParagraph(cv.summary));
  }

  if (cv.education.length > 0) {
    children.push(sectionHeading("Education"));
    for (const e of cv.education) {
      const left = [e.institution, e.location].filter(Boolean).join(", ");
      const right = dateRange(e.startDate, e.endDate);
      children.push(leftRight([{ text: left, bold: true }], right));
      const degreeLine = [e.degree, e.field].filter(Boolean).join(", ");
      if (degreeLine) {
        children.push(plainParagraph(degreeLine, { italics: true }));
      }
      for (const b of e.details) {
        children.push(bulletParagraph(b));
      }
    }
  }

  if (cv.experience.length > 0) {
    children.push(sectionHeading("Experience"));
    for (const x of cv.experience) {
      const left = [x.company, x.location].filter(Boolean).join(", ");
      const right = dateRange(x.startDate, x.endDate);
      children.push(leftRight([{ text: left, bold: true }], right));
      if (x.title) {
        children.push(plainParagraph(x.title, { italics: true }));
      }
      for (const b of x.bullets) {
        children.push(bulletParagraph(b));
      }
    }
  }

  if (cv.projects.length > 0) {
    children.push(sectionHeading("Projects"));
    for (const p of cv.projects) {
      const headline = p.context ? `${p.name} — ${p.context}` : p.name;
      children.push(plainParagraph(headline, { bold: true }));
      for (const b of p.bullets) {
        children.push(bulletParagraph(b));
      }
    }
  }

  if (cv.skills.length > 0) {
    children.push(sectionHeading("Skills"));
    for (const s of cv.skills) {
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${s.category}: `, bold: true, size: 22 }),
            new TextRun({ text: s.items.join(", "), size: 22 }),
          ],
        }),
      );
    }
  }

  if (cv.awards.length > 0) {
    children.push(sectionHeading("Awards & Honors"));
    for (const a of cv.awards) {
      children.push(bulletParagraph(a));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc) as Promise<Buffer>;
}

export async function generateCoverLetterDocx(content: CoverLetterContent): Promise<Buffer> {
  const children: Paragraph[] = [];
  children.push(...header(content.candidateName, content.contact));

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  children.push(plainParagraph(today, { color: "555555", after: 120 }));

  if (content.jobTitle) {
    children.push(plainParagraph(`Re: ${content.jobTitle}`, { bold: true, after: 160 }));
  }

  children.push(plainParagraph(content.salutation, { after: 160 }));
  for (const p of content.paragraphs) {
    children.push(plainParagraph(p, { after: 160 }));
  }
  children.push(plainParagraph(content.closing, { after: 80 }));
  children.push(plainParagraph(content.signature, { bold: true }));

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc) as Promise<Buffer>;
}
