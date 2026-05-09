import PDFDocument from "pdfkit";
import type { OptimizedCv } from "./optimize";

export type CvFormat = "one-page" | "standard";

const TEXT = "#111111";
const MUTED = "#555555";
const RULE = "#AAAAAA";

// Name = 14pt, section headline = 12pt, entry title = 11pt, body/contact = 10pt
// Both formats use same type scale; only spacing & margins differ
interface PdfConfig {
  margin: number;
  nameSize: number;
  sectionSize: number;
  bodySize: number;
  entrySize: number;
  contactSize: number;
  lineGap: number;
  sectionBefore: number;
  sectionAfter: number;
  entryGap: number;
  bulletGap: number;
  headerRule: number;
}

const FORMAT_CONFIG: Record<CvFormat, PdfConfig> = {
  "one-page": {
    margin: 36,
    nameSize: 14,
    sectionSize: 12,
    bodySize: 10,
    entrySize: 11,
    contactSize: 9,
    lineGap: 0.8,
    sectionBefore: 4,
    sectionAfter: 2,
    entryGap: 2,
    bulletGap: 1,
    headerRule: 0.5,
  },
  standard: {
    margin: 54,
    nameSize: 14,
    sectionSize: 12,
    bodySize: 10,
    entrySize: 11,
    contactSize: 9,
    lineGap: 1.5,
    sectionBefore: 8,
    sectionAfter: 3,
    entryGap: 4,
    bulletGap: 2,
    headerRule: 0.5,
  },
};

function bufferDoc(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));
    doc.end();
  });
}

function dateRange(startDate?: string, endDate?: string): string {
  if (startDate && endDate) return `${startDate} – ${endDate}`;
  if (endDate) return endDate;
  if (startDate) return `${startDate} – Present`;
  return "";
}

function movePt(doc: PDFKit.PDFDocument, pt: number): void {
  doc.moveDown(pt / doc.currentLineHeight(true));
}

function sectionHeader(doc: PDFKit.PDFDocument, label: string, cfg: PdfConfig): void {
  movePt(doc, cfg.sectionBefore);
  doc.font("Helvetica-Bold").fontSize(cfg.sectionSize).fillColor(TEXT)
    .text(label.toUpperCase(), { characterSpacing: 1.0 });
  const y = doc.y + 1.5;
  doc.moveTo(cfg.margin, y).lineTo(doc.page.width - cfg.margin, y)
    .lineWidth(cfg.headerRule).strokeColor(RULE).stroke();
  movePt(doc, cfg.sectionAfter);
  doc.fillColor(TEXT);
}

function bullet(doc: PDFKit.PDFDocument, text: string, cfg: PdfConfig): void {
  const x = doc.x;
  doc.font("Helvetica").fontSize(cfg.bodySize).fillColor(TEXT)
    .text(`•  ${text}`, { indent: 5, paragraphGap: cfg.bulletGap, lineGap: 0.5 });
  doc.x = x;
}

export async function generateCvPdf(cv: OptimizedCv, format: CvFormat = "standard"): Promise<Buffer> {
  const cfg = FORMAT_CONFIG[format];

  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: cfg.margin, bottom: cfg.margin, left: cfg.margin, right: cfg.margin },
    bufferPages: true,
    info: { Title: `${cv.candidateName} CV`, Author: cv.candidateName },
  });

  // ── Header ──
  doc.font("Helvetica-Bold").fontSize(cfg.nameSize).fillColor(TEXT)
    .text(cv.candidateName, { align: "center" });

  const contactBits: string[] = [];
  if (cv.contact.location) contactBits.push(cv.contact.location);
  if (cv.contact.email) contactBits.push(cv.contact.email);
  if (cv.contact.phone) contactBits.push(cv.contact.phone);
  if (cv.contact.linkedin) contactBits.push(cv.contact.linkedin);
  if (cv.contact.website) contactBits.push(cv.contact.website);
  if (contactBits.length > 0) {
    doc.moveDown(0.25).font("Helvetica").fontSize(cfg.contactSize).fillColor(MUTED)
      .text(contactBits.join("  |  "), { align: "center" });
  }
  doc.moveDown(0.3);
  const ry = doc.y;
  doc.moveTo(cfg.margin, ry).lineTo(doc.page.width - cfg.margin, ry)
    .lineWidth(0.75).strokeColor(TEXT).stroke();
  doc.moveDown(0.3);

  // 1. Summary
  if (cv.summary) {
    sectionHeader(doc, "Professional Summary", cfg);
    doc.font("Helvetica").fontSize(cfg.bodySize).fillColor(TEXT)
      .text(cv.summary, { align: "justify", lineGap: cfg.lineGap });
  }

  // 2. Skills
  if (cv.skills.length > 0) {
    sectionHeader(doc, "Core Skills", cfg);
    for (const s of cv.skills) {
      doc.font("Helvetica-Bold").fontSize(cfg.bodySize).fillColor(TEXT)
        .text(`${s.category}: `, { continued: true })
        .font("Helvetica").fillColor(TEXT)
        .text(s.items.join(", "), { lineGap: 0.5 });
    }
  }

  // 3. Experience
  if (cv.experience.length > 0) {
    sectionHeader(doc, "Professional Experience", cfg);
    for (const x of cv.experience) {
      const left = [x.company, x.location].filter(Boolean).join(" · ");
      const right = dateRange(x.startDate, x.endDate);
      doc.font("Helvetica-Bold").fontSize(cfg.entrySize).fillColor(TEXT)
        .text(left, { continued: !!right });
      if (right) {
        doc.font("Helvetica").fontSize(cfg.bodySize).fillColor(MUTED)
          .text(right, { align: "right" });
      }
      if (x.title) {
        doc.font("Helvetica-Oblique").fontSize(cfg.bodySize).fillColor(TEXT).text(x.title);
      }
      for (const b of x.bullets) bullet(doc, b, cfg);
      movePt(doc, cfg.entryGap);
    }
  }

  // 4. Education
  if (cv.education.length > 0) {
    sectionHeader(doc, "Education", cfg);
    for (const e of cv.education) {
      const left = [e.institution, e.location].filter(Boolean).join(" · ");
      const right = dateRange(e.startDate, e.endDate);
      doc.font("Helvetica-Bold").fontSize(cfg.entrySize).fillColor(TEXT)
        .text(left, { continued: !!right });
      if (right) {
        doc.font("Helvetica").fontSize(cfg.bodySize).fillColor(MUTED)
          .text(right, { align: "right" });
      }
      const deg = [e.degree, e.field].filter(Boolean).join(", ");
      if (deg) doc.font("Helvetica-Oblique").fontSize(cfg.bodySize).fillColor(TEXT).text(deg);
      for (const b of e.details) bullet(doc, b, cfg);
      movePt(doc, cfg.entryGap);
    }
  }

  // 5. Projects
  if (cv.projects.length > 0) {
    sectionHeader(doc, "Projects", cfg);
    for (const p of cv.projects) {
      const headline = p.context ? `${p.name}  ·  ${p.context}` : p.name;
      doc.font("Helvetica-Bold").fontSize(cfg.bodySize).fillColor(TEXT).text(headline);
      for (const b of p.bullets) bullet(doc, b, cfg);
      movePt(doc, cfg.entryGap);
    }
  }

  // 6. Professional Development
  if (cv.professionalDevelopment.length > 0) {
    sectionHeader(doc, "Professional Development", cfg);
    for (const item of cv.professionalDevelopment) {
      const meta = [item.provider, item.year].filter(Boolean).join(" · ");
      const headline = meta ? `${item.name}  ·  ${meta}` : item.name;
      doc.font("Helvetica-Bold").fontSize(cfg.bodySize).fillColor(TEXT).text(headline);
      if (item.details) {
        doc.font("Helvetica").fontSize(cfg.bodySize).fillColor(TEXT)
          .text(item.details, { indent: 5, lineGap: 0.5 });
      }
      movePt(doc, cfg.entryGap);
    }
  }

  return bufferDoc(doc);
}

export interface CoverLetterContent {
  candidateName: string;
  contact: OptimizedCv["contact"];
  jobTitle: string;
  salutation: string;
  paragraphs: string[];
  closing: string;
  signature: string;
}

export async function generateCoverLetterPdf(content: CoverLetterContent): Promise<Buffer> {
  const cfg = FORMAT_CONFIG["standard"];

  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: cfg.margin, bottom: cfg.margin, left: cfg.margin, right: cfg.margin },
    bufferPages: true,
    info: { Title: `${content.candidateName} Cover Letter`, Author: content.candidateName },
  });

  doc.font("Helvetica-Bold").fontSize(cfg.nameSize).fillColor(TEXT)
    .text(content.candidateName, { align: "center" });

  const cb: string[] = [];
  if (content.contact.location) cb.push(content.contact.location);
  if (content.contact.email) cb.push(content.contact.email);
  if (content.contact.phone) cb.push(content.contact.phone);
  if (content.contact.linkedin) cb.push(content.contact.linkedin);
  if (cb.length > 0) {
    doc.moveDown(0.25).font("Helvetica").fontSize(cfg.contactSize).fillColor(MUTED)
      .text(cb.join("  |  "), { align: "center" });
  }
  doc.moveDown(0.3);
  const ry = doc.y;
  doc.moveTo(cfg.margin, ry).lineTo(doc.page.width - cfg.margin, ry)
    .lineWidth(0.75).strokeColor(TEXT).stroke();
  doc.moveDown(0.8);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.font("Helvetica").fontSize(cfg.bodySize).fillColor(MUTED).text(today);
  doc.moveDown(0.6);

  if (content.jobTitle) {
    doc.font("Helvetica-Bold").fontSize(cfg.entrySize).fillColor(TEXT)
      .text(`Re: ${content.jobTitle}`);
    doc.moveDown(0.5);
  }

  doc.font("Helvetica").fontSize(cfg.bodySize).fillColor(TEXT).text(content.salutation);
  doc.moveDown(0.6);
  for (const p of content.paragraphs) {
    doc.font("Helvetica").fontSize(cfg.bodySize).fillColor(TEXT)
      .text(p, { align: "justify", lineGap: cfg.lineGap });
    doc.moveDown(0.6);
  }
  doc.font("Helvetica").fontSize(cfg.bodySize).fillColor(TEXT).text(content.closing);
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(cfg.bodySize).fillColor(TEXT).text(content.signature);

  return bufferDoc(doc);
}
