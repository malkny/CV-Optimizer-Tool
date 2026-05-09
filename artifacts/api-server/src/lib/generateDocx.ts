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
import type { CoverLetterContent, CvFormat } from "./generatePdf";

const TEXT_HEX = "111111";
const MUTED_HEX = "555555";
const RULE_HEX = "AAAAAA";

interface DocxConfig {
  nameSize: number;
  sectionSize: number;
  bodySize: number;
  entrySize: number;
  contactSize: number;
  spacingBefore: number;
  spacingAfter: number;
  entryBefore: number;
  bulletAfter: number;
  margin: { top: number; bottom: number; left: number; right: number };
}

type Cfg = DocxConfig;

const FORMAT_CONFIG: Record<CvFormat, DocxConfig> = {
  "one-page": {
    nameSize: 36,
    sectionSize: 19,
    bodySize: 18,
    entrySize: 19,
    contactSize: 17,
    spacingBefore: 140,
    spacingAfter: 60,
    entryBefore: 60,
    bulletAfter: 40,
    margin: { top: 540, bottom: 540, left: 720, right: 720 },
  },
  standard: {
    nameSize: 44,
    sectionSize: 22,
    bodySize: 22,
    entrySize: 22,
    contactSize: 20,
    spacingBefore: 240,
    spacingAfter: 100,
    entryBefore: 80,
    bulletAfter: 60,
    margin: { top: 720, bottom: 720, left: 900, right: 900 },
  },
};

function dateRange(startDate?: string, endDate?: string): string {
  if (startDate && endDate) return `${startDate} – ${endDate}`;
  if (endDate) return endDate;
  if (startDate) return `${startDate} – Present`;
  return "";
}

function titleParagraph(name: string, cfg: Cfg): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: name, bold: true, size: cfg.nameSize, color: TEXT_HEX })],
  });
}

function sectionHeading(label: string, cfg: Cfg): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: cfg.spacingBefore, after: cfg.spacingAfter },
    border: {
      bottom: { color: RULE_HEX, space: 1, style: BorderStyle.SINGLE, size: 6 },
    },
    children: [
      new TextRun({
        text: label.toUpperCase(),
        bold: true,
        size: cfg.sectionSize,
        color: TEXT_HEX,
        characterSpacing: 30,
      }),
    ],
  });
}

function entryHeading(label: string, cfg: Cfg): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: cfg.entryBefore, after: 40 },
    children: [new TextRun({ text: label, bold: true, size: cfg.entrySize, color: TEXT_HEX })],
  });
}

function leftRightHeading(left: string, right: string, cfg: Cfg): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: cfg.entryBefore, after: 40 },
    children: [
      new TextRun({ text: left, bold: true, size: cfg.entrySize, color: TEXT_HEX }),
      new TextRun({ text: `\t${right}`, size: cfg.bodySize, color: MUTED_HEX }),
    ],
  });
}

function bulletParagraph(text: string, cfg: Cfg): Paragraph {
  return new Paragraph({
    spacing: { after: cfg.bulletAfter },
    indent: { left: 360, hanging: 220 },
    children: [
      new TextRun({ text: "•  ", size: cfg.bodySize }),
      new TextRun({ text, size: cfg.bodySize }),
    ],
  });
}

function plainParagraph(
  text: string,
  cfg: Cfg,
  opts: {
    bold?: boolean;
    italics?: boolean;
    color?: string;
    after?: number;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  } = {},
): Paragraph {
  return new Paragraph({
    spacing: { after: opts.after ?? cfg.bulletAfter },
    alignment: opts.alignment,
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italics,
        size: cfg.bodySize,
        color: opts.color ?? TEXT_HEX,
      }),
    ],
  });
}

function headerBlock(name: string, contact: OptimizedCv["contact"], cfg: Cfg): Paragraph[] {
  const out: Paragraph[] = [titleParagraph(name, cfg)];
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
        children: [new TextRun({ text: bits.join("  •  "), size: cfg.contactSize, color: MUTED_HEX })],
      }),
    );
  }
  out.push(
    new Paragraph({
      spacing: { after: 120 },
      border: {
        bottom: { color: TEXT_HEX, space: 1, style: BorderStyle.SINGLE, size: 8 },
      },
      children: [new TextRun({ text: "" })],
    }),
  );
  return out;
}

const buildStyles = (cfg: Cfg) => ({
  default: {
    document: {
      run: { font: "Calibri", size: cfg.bodySize, color: TEXT_HEX },
    },
    title: {
      run: { font: "Calibri", size: cfg.nameSize, bold: true, color: TEXT_HEX },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 80 } },
    },
    heading1: {
      run: { font: "Calibri", size: cfg.sectionSize, bold: true, color: TEXT_HEX },
      paragraph: { spacing: { before: cfg.spacingBefore, after: cfg.spacingAfter } },
    },
    heading2: {
      run: { font: "Calibri", size: cfg.entrySize, bold: true, color: TEXT_HEX },
      paragraph: { spacing: { before: cfg.entryBefore, after: 40 } },
    },
  },
});

export async function generateCvDocx(cv: OptimizedCv, format: CvFormat = "standard"): Promise<Buffer> {
  const cfg = FORMAT_CONFIG[format];
  const children: Paragraph[] = [];
  children.push(...headerBlock(cv.candidateName, cv.contact, cfg));

  // 1. Summary
  if (cv.summary) {
    children.push(sectionHeading("Summary", cfg));
    children.push(plainParagraph(cv.summary, cfg));
  }

  // 2. Skills
  if (cv.skills.length > 0) {
    children.push(sectionHeading("Skills", cfg));
    for (const s of cv.skills) {
      children.push(
        new Paragraph({
          spacing: { after: cfg.bulletAfter },
          children: [
            new TextRun({ text: `${s.category}: `, bold: true, size: cfg.bodySize, color: TEXT_HEX }),
            new TextRun({ text: s.items.join(", "), size: cfg.bodySize, color: TEXT_HEX }),
          ],
        }),
      );
    }
  }

  // 3. Experience
  if (cv.experience.length > 0) {
    children.push(sectionHeading("Experience", cfg));
    for (const x of cv.experience) {
      const left = [x.company, x.location].filter(Boolean).join(", ");
      const right = dateRange(x.startDate, x.endDate);
      children.push(right ? leftRightHeading(left, right, cfg) : entryHeading(left, cfg));
      if (x.title) {
        children.push(plainParagraph(x.title, cfg, { italics: true, after: 40 }));
      }
      for (const b of x.bullets) {
        children.push(bulletParagraph(b, cfg));
      }
    }
  }

  // 4. Education
  if (cv.education.length > 0) {
    children.push(sectionHeading("Education", cfg));
    for (const e of cv.education) {
      const left = [e.institution, e.location].filter(Boolean).join(", ");
      const right = dateRange(e.startDate, e.endDate);
      children.push(right ? leftRightHeading(left, right, cfg) : entryHeading(left, cfg));
      const degreeLine = [e.degree, e.field].filter(Boolean).join(", ");
      if (degreeLine) {
        children.push(plainParagraph(degreeLine, cfg, { italics: true, after: 40 }));
      }
      for (const b of e.details) {
        children.push(bulletParagraph(b, cfg));
      }
    }
  }

  // 5. Projects
  if (cv.projects.length > 0) {
    children.push(sectionHeading("Projects", cfg));
    for (const p of cv.projects) {
      const headline = p.context ? `${p.name} — ${p.context}` : p.name;
      children.push(entryHeading(headline, cfg));
      for (const b of p.bullets) {
        children.push(bulletParagraph(b, cfg));
      }
    }
  }

  // 6. Professional Development
  if (cv.professionalDevelopment.length > 0) {
    children.push(sectionHeading("Professional Development", cfg));
    for (const item of cv.professionalDevelopment) {
      const meta = [item.provider, item.year].filter(Boolean).join(" · ");
      const headline = meta ? `${item.name} — ${meta}` : item.name;
      children.push(entryHeading(headline, cfg));
      if (item.details) {
        children.push(plainParagraph(item.details, cfg));
      }
    }
  }

  const doc = new Document({
    creator: cv.candidateName,
    title: `${cv.candidateName} — Résumé`,
    styles: buildStyles(cfg),
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: cfg.margin,
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc) as Promise<Buffer>;
}

export async function generateCoverLetterDocx(content: CoverLetterContent): Promise<Buffer> {
  const cfg = FORMAT_CONFIG["standard"];
  const children: Paragraph[] = [];
  children.push(...headerBlock(content.candidateName, content.contact, cfg));

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  children.push(plainParagraph(today, cfg, { color: MUTED_HEX, after: 120 }));

  if (content.jobTitle) {
    children.push(entryHeading(`Re: ${content.jobTitle}`, cfg));
  }

  children.push(plainParagraph(content.salutation, cfg, { after: 160 }));
  for (const p of content.paragraphs) {
    children.push(plainParagraph(p, cfg, { after: 160 }));
  }
  children.push(plainParagraph(content.closing, cfg, { after: 80 }));
  children.push(plainParagraph(content.signature, cfg, { bold: true }));

  const doc = new Document({
    creator: content.candidateName,
    title: `${content.candidateName} — Cover Letter`,
    styles: buildStyles(cfg),
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: cfg.margin,
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc) as Promise<Buffer>;
}
