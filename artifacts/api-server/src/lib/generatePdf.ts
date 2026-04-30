import PDFDocument from "pdfkit";
import type { OptimizedCv } from "./optimize";

const MARGIN = 56;
const ACCENT = "#8C1515";
const TEXT = "#111111";
const MUTED = "#555555";
const RULE = "#CCCCCC";

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

function sectionHeader(doc: PDFKit.PDFDocument, label: string): void {
  doc.moveDown(0.4);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(ACCENT)
    .text(label.toUpperCase(), { characterSpacing: 1.2 });
  const y = doc.y + 2;
  doc.moveTo(MARGIN, y).lineTo(doc.page.width - MARGIN, y).lineWidth(0.5).strokeColor(RULE).stroke();
  doc.moveDown(0.4);
  doc.fillColor(TEXT);
}

function bullet(doc: PDFKit.PDFDocument, text: string): void {
  const startX = doc.x;
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor(TEXT)
    .text(`•  ${text}`, {
      indent: 8,
      paragraphGap: 2,
      lineGap: 1,
    });
  doc.x = startX;
}

export async function generateCvPdf(cv: OptimizedCv): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: { Title: `${cv.candidateName} CV`, Author: cv.candidateName },
  });

  // Header — name
  doc
    .font("Helvetica-Bold")
    .fontSize(24)
    .fillColor(TEXT)
    .text(cv.candidateName, { align: "center" });

  // Contact line
  const contactBits: string[] = [];
  if (cv.contact.location) contactBits.push(cv.contact.location);
  if (cv.contact.email) contactBits.push(cv.contact.email);
  if (cv.contact.phone) contactBits.push(cv.contact.phone);
  if (cv.contact.linkedin) contactBits.push(cv.contact.linkedin);
  if (cv.contact.website) contactBits.push(cv.contact.website);
  if (contactBits.length > 0) {
    doc
      .moveDown(0.2)
      .font("Helvetica")
      .fontSize(10)
      .fillColor(MUTED)
      .text(contactBits.join("  •  "), { align: "center" });
  }

  doc.moveDown(0.3);
  const ruleY = doc.y;
  doc.moveTo(MARGIN, ruleY).lineTo(doc.page.width - MARGIN, ruleY).lineWidth(0.75).strokeColor(ACCENT).stroke();
  doc.moveDown(0.3);

  // 1. Summary
  if (cv.summary) {
    sectionHeader(doc, "Summary");
    doc
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(TEXT)
      .text(cv.summary, { align: "left", lineGap: 1.5 });
  }

  // 2. Skills
  if (cv.skills.length > 0) {
    sectionHeader(doc, "Skills");
    for (const s of cv.skills) {
      doc
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .fillColor(TEXT)
        .text(`${s.category}: `, { continued: true })
        .font("Helvetica")
        .fillColor(TEXT)
        .text(s.items.join(", "));
    }
  }

  // 3. Experience
  if (cv.experience.length > 0) {
    sectionHeader(doc, "Experience");
    for (const x of cv.experience) {
      const left = [x.company, x.location].filter(Boolean).join(", ");
      const right = dateRange(x.startDate, x.endDate);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT).text(left, { continued: !!right });
      if (right) {
        doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(right, { align: "right" });
      }
      if (x.title) {
        doc.font("Helvetica-Oblique").fontSize(10.5).fillColor(TEXT).text(x.title);
      }
      for (const b of x.bullets) {
        bullet(doc, b);
      }
      doc.moveDown(0.3);
    }
  }

  // 4. Education
  if (cv.education.length > 0) {
    sectionHeader(doc, "Education");
    for (const e of cv.education) {
      const left = [e.institution, e.location].filter(Boolean).join(", ");
      const right = dateRange(e.startDate, e.endDate);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT).text(left, { continued: !!right });
      if (right) {
        doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(right, { align: "right" });
      }
      const degreeLine = [e.degree, e.field].filter(Boolean).join(", ");
      if (degreeLine) {
        doc.font("Helvetica-Oblique").fontSize(10.5).fillColor(TEXT).text(degreeLine);
      }
      for (const b of e.details) {
        bullet(doc, b);
      }
      doc.moveDown(0.3);
    }
  }

  // 5. Projects
  if (cv.projects.length > 0) {
    sectionHeader(doc, "Projects");
    for (const p of cv.projects) {
      const headline = p.context ? `${p.name} — ${p.context}` : p.name;
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(TEXT).text(headline);
      for (const b of p.bullets) {
        bullet(doc, b);
      }
      doc.moveDown(0.2);
    }
  }

  // 6. Professional Development (courses, certifications, awards)
  if (cv.professionalDevelopment.length > 0) {
    sectionHeader(doc, "Professional Development");
    for (const item of cv.professionalDevelopment) {
      const meta = [item.provider, item.year].filter(Boolean).join(" · ");
      const headline = meta ? `${item.name} — ${meta}` : item.name;
      doc.font("Helvetica-Bold").fontSize(10.5).fillColor(TEXT).text(headline);
      if (item.details) {
        doc.font("Helvetica").fontSize(10.5).fillColor(TEXT).text(item.details, { indent: 8, lineGap: 1 });
      }
      doc.moveDown(0.2);
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
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: { Title: `${content.candidateName} Cover Letter`, Author: content.candidateName },
  });

  // Header — same Stanford block
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor(TEXT)
    .text(content.candidateName, { align: "center" });
  const contactBits: string[] = [];
  if (content.contact.location) contactBits.push(content.contact.location);
  if (content.contact.email) contactBits.push(content.contact.email);
  if (content.contact.phone) contactBits.push(content.contact.phone);
  if (content.contact.linkedin) contactBits.push(content.contact.linkedin);
  if (contactBits.length > 0) {
    doc
      .moveDown(0.2)
      .font("Helvetica")
      .fontSize(10)
      .fillColor(MUTED)
      .text(contactBits.join("  •  "), { align: "center" });
  }
  doc.moveDown(0.3);
  const ruleY = doc.y;
  doc.moveTo(MARGIN, ruleY).lineTo(doc.page.width - MARGIN, ruleY).lineWidth(0.75).strokeColor(ACCENT).stroke();
  doc.moveDown(0.8);

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.font("Helvetica").fontSize(10.5).fillColor(MUTED).text(today);
  doc.moveDown(0.6);

  if (content.jobTitle) {
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(TEXT)
      .text(`Re: ${content.jobTitle}`);
    doc.moveDown(0.5);
  }

  doc.font("Helvetica").fontSize(11).fillColor(TEXT).text(content.salutation);
  doc.moveDown(0.6);
  for (const p of content.paragraphs) {
    doc.font("Helvetica").fontSize(11).fillColor(TEXT).text(p, { align: "left", lineGap: 2 });
    doc.moveDown(0.6);
  }
  doc.font("Helvetica").fontSize(11).fillColor(TEXT).text(content.closing);
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT).text(content.signature);

  return bufferDoc(doc);
}
