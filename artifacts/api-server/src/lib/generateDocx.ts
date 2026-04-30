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
const TEXT_HEX = "111111";
const MUTED_HEX = "555555";

function dateRange(startDate?: string, endDate?: string): string {
  if (startDate && endDate) return `${startDate} – ${endDate}`;
  if (endDate) return endDate;
  if (startDate) return `${startDate} – Present`;
  return "";
}

function titleParagraph(name: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: name, bold: true, size: 44, color: TEXT_HEX })],
  });
}

function sectionHeading(label: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 100 },
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

function entryHeading(label: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 80, after: 40 },
    children: [new TextRun({ text: label, bold: true, size: 22, color: TEXT_HEX })],
  });
}

function leftRightHeading(left: string, right: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 80, after: 40 },
    children: [
      new TextRun({ text: left, bold: true, size: 22, color: TEXT_HEX }),
      new TextRun({ text: `\t${right}`, size: 20, color: MUTED_HEX }),
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

function plainParagraph(
  text: string,
  opts: { bold?: boolean; italics?: boolean; size?: number; color?: string; after?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
): Paragraph {
  return new Paragraph({
    spacing: { after: opts.after ?? 60 },
    alignment: opts.alignment,
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
  const out: Paragraph[] = [titleParagraph(name)];
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
        children: [new TextRun({ text: bits.join("  •  "), size: 20, color: MUTED_HEX })],
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

const docStyles = {
  default: {
    document: {
      run: { font: "Calibri", size: 22, color: TEXT_HEX },
    },
    title: {
      run: { font: "Calibri", size: 44, bold: true, color: TEXT_HEX },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 80 } },
    },
    heading1: {
      run: { font: "Calibri", size: 22, bold: true, color: ACCENT_HEX },
      paragraph: { spacing: { before: 240, after: 100 } },
    },
    heading2: {
      run: { font: "Calibri", size: 22, bold: true, color: TEXT_HEX },
      paragraph: { spacing: { before: 80, after: 40 } },
    },
  },
};

const sectionPage = {
  size: { orientation: PageOrientation.PORTRAIT },
  margin: { top: 720, bottom: 720, left: 900, right: 900 },
};

export async function generateCvDocx(cv: OptimizedCv): Promise<Buffer> {
  const children: Paragraph[] = [];
  children.push(...header(cv.candidateName, cv.contact));

  // 1. Summary
  if (cv.summary) {
    children.push(sectionHeading("Summary"));
    children.push(plainParagraph(cv.summary));
  }

  // 2. Skills
  if (cv.skills.length > 0) {
    children.push(sectionHeading("Skills"));
    for (const s of cv.skills) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${s.category}: `, bold: true, size: 22, color: TEXT_HEX }),
            new TextRun({ text: s.items.join(", "), size: 22, color: TEXT_HEX }),
          ],
        }),
      );
    }
  }

  // 3. Experience
  if (cv.experience.length > 0) {
    children.push(sectionHeading("Experience"));
    for (const x of cv.experience) {
      const left = [x.company, x.location].filter(Boolean).join(", ");
      const right = dateRange(x.startDate, x.endDate);
      children.push(right ? leftRightHeading(left, right) : entryHeading(left));
      if (x.title) {
        children.push(plainParagraph(x.title, { italics: true, after: 40 }));
      }
      for (const b of x.bullets) {
        children.push(bulletParagraph(b));
      }
    }
  }

  // 4. Education
  if (cv.education.length > 0) {
    children.push(sectionHeading("Education"));
    for (const e of cv.education) {
      const left = [e.institution, e.location].filter(Boolean).join(", ");
      const right = dateRange(e.startDate, e.endDate);
      children.push(right ? leftRightHeading(left, right) : entryHeading(left));
      const degreeLine = [e.degree, e.field].filter(Boolean).join(", ");
      if (degreeLine) {
        children.push(plainParagraph(degreeLine, { italics: true, after: 40 }));
      }
      for (const b of e.details) {
        children.push(bulletParagraph(b));
      }
    }
  }

  // 5. Projects
  if (cv.projects.length > 0) {
    children.push(sectionHeading("Projects"));
    for (const p of cv.projects) {
      const headline = p.context ? `${p.name} — ${p.context}` : p.name;
      children.push(entryHeading(headline));
      for (const b of p.bullets) {
        children.push(bulletParagraph(b));
      }
    }
  }

  // 6. Professional Development (courses, certifications, awards)
  if (cv.professionalDevelopment.length > 0) {
    children.push(sectionHeading("Professional Development"));
    for (const item of cv.professionalDevelopment) {
      const meta = [item.provider, item.year].filter(Boolean).join(" · ");
      const headline = meta ? `${item.name} — ${meta}` : item.name;
      children.push(entryHeading(headline));
      if (item.details) {
        children.push(plainParagraph(item.details));
      }
    }
  }

  const doc = new Document({
    creator: cv.candidateName,
    title: `${cv.candidateName} — Résumé`,
    styles: docStyles,
    sections: [{ properties: { page: sectionPage }, children }],
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
  children.push(plainParagraph(today, { color: MUTED_HEX, after: 120 }));

  if (content.jobTitle) {
    children.push(entryHeading(`Re: ${content.jobTitle}`));
  }

  children.push(plainParagraph(content.salutation, { after: 160 }));
  for (const p of content.paragraphs) {
    children.push(plainParagraph(p, { after: 160 }));
  }
  children.push(plainParagraph(content.closing, { after: 80 }));
  children.push(plainParagraph(content.signature, { bold: true }));

  const doc = new Document({
    creator: content.candidateName,
    title: `${content.candidateName} — Cover Letter`,
    styles: docStyles,
    sections: [{ properties: { page: sectionPage }, children }],
  });

  return Packer.toBuffer(doc) as Promise<Buffer>;
}
