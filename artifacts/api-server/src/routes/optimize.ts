import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { detectKind, parseCv } from "../lib/parseFile";
import { fetchJobDescription } from "../lib/fetchJd";
import { optimizeCvAgainstJd } from "../lib/optimize";
import { generateCoverLetterPdf, generateCvPdf, type CoverLetterContent } from "../lib/generatePdf";
import { generateCoverLetterDocx, generateCvDocx } from "../lib/generateDocx";
import { createSession, getSession, type FileType } from "../lib/sessionStore";

const MAX_BYTES = 5 * 1024 * 1024;
const MIN_JD_CHARS = 50;
const MAX_JD_CHARS = 5000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

const router: IRouter = Router();

router.post(
  "/optimize",
  (req, res, next) => {
    upload.single("cv")(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      const code = (err as { code?: string }).code;
      if (code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "File exceeds 5MB limit. Please compress and retry.", code: "FILE_TOO_LARGE" });
        return;
      }
      req.log?.error({ err }, "Multer rejected upload");
      res.status(400).json({ error: "Upload failed. Please try again.", code: "UPLOAD_FAILED" });
    });
  },
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Please upload a .pdf or .docx CV.", code: "NO_FILE" });
      return;
    }
    const kind = detectKind(file.mimetype, file.originalname);
    if (!kind) {
      res.status(400).json({ error: "Unsupported format. Please upload a .pdf or .docx file.", code: "UNSUPPORTED_FORMAT" });
      return;
    }

    const jdTextRaw = typeof req.body?.jdText === "string" ? req.body.jdText.trim() : "";
    const jdUrlRaw = typeof req.body?.jdUrl === "string" ? req.body.jdUrl.trim() : "";

    let jdText = "";
    if (jdTextRaw) {
      if (jdTextRaw.length < MIN_JD_CHARS || jdTextRaw.length > MAX_JD_CHARS) {
        res.status(400).json({
          error: `Job description too short or long. Paste a complete JD (${MIN_JD_CHARS}–${MAX_JD_CHARS} chars).`,
          code: "JD_LENGTH",
        });
        return;
      }
      jdText = jdTextRaw;
    } else if (jdUrlRaw) {
      if (!/^https:\/\//i.test(jdUrlRaw)) {
        res.status(400).json({ error: "URL must use https://. Please paste the JD text manually.", code: "JD_URL_INVALID" });
        return;
      }
      try {
        jdText = await fetchJobDescription(jdUrlRaw);
      } catch (err) {
        req.log?.warn({ err, url: jdUrlRaw }, "Failed to fetch JD URL");
        res.status(400).json({ error: "Unable to fetch URL. Please paste the JD text manually.", code: "JD_URL_FETCH" });
        return;
      }
      if (jdText.length < MIN_JD_CHARS) {
        res.status(400).json({
          error: "Couldn't extract enough text from the URL. Please paste the JD manually.",
          code: "JD_URL_EMPTY",
        });
        return;
      }
      if (jdText.length > MAX_JD_CHARS) {
        jdText = jdText.slice(0, MAX_JD_CHARS);
      }
    } else {
      res.status(400).json({ error: "Provide either a job description text or a URL.", code: "JD_MISSING" });
      return;
    }

    let cvText: string;
    try {
      cvText = await parseCv(file.buffer, kind);
    } catch (err) {
      req.log?.warn({ err }, "Failed to parse CV");
      res.status(400).json({
        error: "Could not read CV. Ensure it's not password-protected or scanned.",
        code: "CV_PARSE_FAILED",
      });
      return;
    }
    if (!cvText || cvText.length < 50) {
      res.status(400).json({
        error: "CV appears empty or unreadable. Try a different file.",
        code: "CV_EMPTY",
      });
      return;
    }

    let result;
    try {
      result = await optimizeCvAgainstJd(cvText, jdText);
    } catch (err) {
      req.log?.error({ err }, "Optimization failed");
      res.status(500).json({
        error: "Optimization failed. Please try again in a moment.",
        code: "OPTIMIZE_FAILED",
      });
      return;
    }

    const coverContent: CoverLetterContent = {
      candidateName: result.optimizedCv.candidateName,
      contact: result.optimizedCv.contact,
      jobTitle: result.jobTitle,
      salutation: result.coverLetter.salutation,
      paragraphs: result.coverLetter.paragraphs,
      closing: result.coverLetter.closing,
      signature: result.coverLetter.signature,
    };

    let cvPdf: Buffer;
    let cvDocx: Buffer;
    let coverPdf: Buffer;
    let coverDocx: Buffer;
    try {
      [cvPdf, cvDocx, coverPdf, coverDocx] = await Promise.all([
        generateCvPdf(result.optimizedCv),
        generateCvDocx(result.optimizedCv),
        generateCoverLetterPdf(coverContent),
        generateCoverLetterDocx(coverContent),
      ]);
    } catch (err) {
      req.log?.error({ err }, "File generation failed");
      res.status(500).json({
        error: "Failed to generate file. Please try again or contact support.",
        code: "GENERATION_FAILED",
      });
      return;
    }

    const session = createSession(
      {
        "cv-pdf": cvPdf,
        "cv-docx": cvDocx,
        "cover-letter-pdf": coverPdf,
        "cover-letter-docx": coverDocx,
      },
      result.optimizedCv.candidateName,
      result.jobTitle,
    );

    res.json({
      sessionId: session.id,
      atsScore: result.atsScore,
      breakdown: result.breakdown,
      summary: result.summary,
      downloads: {
        cvPdf: `/api/optimize/${session.id}/download/cv-pdf`,
        cvDocx: `/api/optimize/${session.id}/download/cv-docx`,
        coverLetterPdf: `/api/optimize/${session.id}/download/cover-letter-pdf`,
        coverLetterDocx: `/api/optimize/${session.id}/download/cover-letter-docx`,
      },
      candidateName: result.optimizedCv.candidateName,
      jobTitle: result.jobTitle,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  },
);

const ALLOWED_TYPES: ReadonlySet<FileType> = new Set([
  "cv-pdf",
  "cv-docx",
  "cover-letter-pdf",
  "cover-letter-docx",
]);

function fileTypeMeta(t: FileType, candidateName: string): { mime: string; ext: string; label: string } {
  switch (t) {
    case "cv-pdf":
      return { mime: "application/pdf", ext: "pdf", label: "CV" };
    case "cv-docx":
      return {
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ext: "docx",
        label: "CV",
      };
    case "cover-letter-pdf":
      return { mime: "application/pdf", ext: "pdf", label: "Cover-Letter" };
    case "cover-letter-docx":
      return {
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ext: "docx",
        label: "Cover-Letter",
      };
  }
}

function safeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_") || "Candidate";
}

router.get(
  "/optimize/:sessionId/download/:fileType",
  (req: Request, res: Response) => {
    const { sessionId, fileType } = req.params as { sessionId: string; fileType: string };
    if (!ALLOWED_TYPES.has(fileType as FileType)) {
      res.status(404).json({ error: "Unknown file type", code: "UNKNOWN_FILE_TYPE" });
      return;
    }
    const session = getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found or expired", code: "SESSION_EXPIRED" });
      return;
    }
    const ft = fileType as FileType;
    const buf = session.files[ft];
    const meta = fileTypeMeta(ft, session.candidateName);
    const filename = `${safeFileName(session.candidateName)}-${meta.label}.${meta.ext}`;
    res.setHeader("Content-Type", meta.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buf.length.toString());
    res.setHeader("Cache-Control", "no-store");
    res.end(buf);
  },
);

export default router;
