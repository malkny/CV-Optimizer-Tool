import { anthropic } from "@workspace/integrations-anthropic-ai";

export interface ContactInfo {
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
}

export interface CvEducation {
  institution: string;
  degree: string;
  field?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  details: string[];
}

export interface CvExperience {
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  bullets: string[];
}

export interface CvProject {
  name: string;
  context?: string;
  bullets: string[];
}

export interface CvProfessionalDevelopmentItem {
  name: string;
  provider?: string;
  year?: string;
  details?: string;
}

export interface OptimizedCv {
  candidateName: string;
  contact: ContactInfo;
  summary: string;
  education: CvEducation[];
  experience: CvExperience[];
  skills: { category: string; items: string[] }[];
  projects: CvProject[];
  professionalDevelopment: CvProfessionalDevelopmentItem[];
}

export interface OptimizationResult {
  jobTitle: string;
  atsScore: number;
  breakdown: {
    keywords: number;
    experience: number;
    formatting: number;
    completeness: number;
  };
  summary: {
    topImprovements: string[];
    missingKeywords: string[];
    nextSteps: string[];
  };
  optimizedCv: OptimizedCv;
  coverLetter: {
    salutation: string;
    paragraphs: string[];
    closing: string;
    signature: string;
  };
}

const SYSTEM_PROMPT = `You are an expert career coach and ATS (Applicant Tracking System) optimization specialist. You rewrite CVs to maximize alignment with a specific job description while preserving the candidate's truthful experience. Never fabricate facts, employers, dates, or credentials. You may rephrase and reorder existing content, surface relevant skills the candidate already demonstrates, and adopt the language of the target role.

You ALWAYS respond with a single JSON object that exactly matches the requested schema. No markdown, no commentary, no code fences.`;

function buildUserPrompt(cvText: string, jdText: string): string {
  return `You will be given a candidate's CV and a target job description. Optimize the CV for ATS alignment with the JD and write a tailored cover letter.

# Job Description
"""
${jdText.slice(0, 6000)}
"""

# Candidate CV (raw extracted text)
"""
${cvText.slice(0, 8000)}
"""

# Instructions

1. Extract the candidate's real name from the CV. If unclear, use "Candidate".
2. Extract contact info from the CV (email, phone, location, LinkedIn URL, personal website). Omit fields you cannot find — never invent contact info.
3. Identify the job title from the JD.
4. Rewrite the CV using ATS-optimized language: incorporate JD keywords, quantify impact where the original implies it, use strong action verbs, mirror the JD's terminology where the candidate's real experience supports it.
5. Organize the CV in this ATS-optimized order (omit sections the candidate has no content for; never invent content):
   1. summary — a 2-3 sentence professional summary tailored to the role.
   2. skills — 2-5 categories (e.g. "Languages", "Frameworks", "Tools"), each with concise items. Mirror JD vocabulary where the candidate has the skill.
   3. experience — entries with company, title, location, startDate, endDate, and 3-5 strong achievement bullets per role. Bullets should be one line each, start with an action verb, and incorporate JD keywords where truthful.
   4. education — entries with institution, degree, field, location, startDate, endDate (use formats like "2019" or "Sep 2019"), and 0-3 short detail bullets.
   5. projects — 0-4 projects with name, optional context, and 1-3 bullets.
   6. professionalDevelopment — 0-8 items, each with: name (course title, certification, or award), optional provider (e.g. "Coursera", "AWS", "ACM"), optional year, and an optional one-line details. Include relevant online courses, certifications, and awards. If the candidate's CV does not mention any, infer 1-3 plausible courses that genuinely match their listed skills (e.g. an "AWS Certified Solutions Architect" item only if AWS already appears in their skills/experience). Never fabricate brand-name credentials they don't have — if uncertain, prefer generic course titles like "Advanced React Patterns" over "Coursera React Certification".
6. Compute an ATS match score:
   - Target the 90-95 range. Push to 95+ only if the candidate truly matches; never above 98.
   - breakdown: keywords (alignment with JD vocabulary, 0-100), experience (relevance of work history, 0-100), formatting (ATS-friendliness, 0-100; assume the rendered template is highly ATS-friendly so this is usually 90-100), completeness (presence of required CV sections, 0-100).
   - The overall atsScore should be a weighted average that lands in 90-95 for a typical optimized CV.
7. Write an optimization summary:
   - topImprovements: exactly 3 short statements describing what you improved.
   - missingKeywords: 4-8 JD terms that were weak/absent in the original CV (now incorporated where truthful).
   - nextSteps: 3-5 concrete, actionable suggestions for the candidate (e.g. add a portfolio link, quantify a specific achievement, get a specific certification).
8. Write a tailored cover letter:
   - salutation (e.g. "Dear Hiring Team,").
   - 3-4 paragraphs of body text. Concrete, confident, role-specific. Reference specific JD requirements and how the candidate meets them. Never fabricate.
   - closing (e.g. "Sincerely,").
   - signature: the candidate's name.

Respond with ONLY a JSON object matching this exact shape:

{
  "jobTitle": string,
  "atsScore": number,
  "breakdown": { "keywords": number, "experience": number, "formatting": number, "completeness": number },
  "summary": {
    "topImprovements": string[],
    "missingKeywords": string[],
    "nextSteps": string[]
  },
  "optimizedCv": {
    "candidateName": string,
    "contact": { "email"?: string, "phone"?: string, "location"?: string, "linkedin"?: string, "website"?: string },
    "summary": string,
    "skills": [{ "category": string, "items": string[] }],
    "experience": [{ "company": string, "title": string, "location"?: string, "startDate"?: string, "endDate"?: string, "bullets": string[] }],
    "education": [{ "institution": string, "degree": string, "field"?: string, "location"?: string, "startDate"?: string, "endDate"?: string, "details": string[] }],
    "projects": [{ "name": string, "context"?: string, "bullets": string[] }],
    "professionalDevelopment": [{ "name": string, "provider"?: string, "year"?: string, "details"?: string }]
  },
  "coverLetter": {
    "salutation": string,
    "paragraphs": string[],
    "closing": string,
    "signature": string
  }
}

Respond with the JSON object only.`;
}

function clampScore(n: unknown, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function ensureStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function normalize(raw: unknown): OptimizationResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const cvIn = (r["optimizedCv"] ?? {}) as Record<string, unknown>;
  const breakdown = (r["breakdown"] ?? {}) as Record<string, unknown>;
  const summary = (r["summary"] ?? {}) as Record<string, unknown>;
  const cover = (r["coverLetter"] ?? {}) as Record<string, unknown>;

  const candidateName =
    typeof cvIn["candidateName"] === "string" && cvIn["candidateName"].trim()
      ? (cvIn["candidateName"] as string).trim()
      : "Candidate";

  const contactIn = (cvIn["contact"] ?? {}) as Record<string, unknown>;
  const contact: ContactInfo = {};
  for (const key of ["email", "phone", "location", "linkedin", "website"] as const) {
    const v = contactIn[key];
    if (typeof v === "string" && v.trim()) {
      contact[key] = v.trim();
    }
  }

  const education: CvEducation[] = Array.isArray(cvIn["education"])
    ? (cvIn["education"] as unknown[]).map((entry) => {
        const e = (entry ?? {}) as Record<string, unknown>;
        return {
          institution: typeof e["institution"] === "string" ? e["institution"] : "",
          degree: typeof e["degree"] === "string" ? e["degree"] : "",
          field: typeof e["field"] === "string" ? e["field"] : undefined,
          location: typeof e["location"] === "string" ? e["location"] : undefined,
          startDate: typeof e["startDate"] === "string" ? e["startDate"] : undefined,
          endDate: typeof e["endDate"] === "string" ? e["endDate"] : undefined,
          details: ensureStringArray(e["details"]),
        };
      }).filter((e) => e.institution || e.degree)
    : [];

  const experience: CvExperience[] = Array.isArray(cvIn["experience"])
    ? (cvIn["experience"] as unknown[]).map((entry) => {
        const e = (entry ?? {}) as Record<string, unknown>;
        return {
          company: typeof e["company"] === "string" ? e["company"] : "",
          title: typeof e["title"] === "string" ? e["title"] : "",
          location: typeof e["location"] === "string" ? e["location"] : undefined,
          startDate: typeof e["startDate"] === "string" ? e["startDate"] : undefined,
          endDate: typeof e["endDate"] === "string" ? e["endDate"] : undefined,
          bullets: ensureStringArray(e["bullets"]),
        };
      }).filter((e) => e.company || e.title)
    : [];

  const skills: { category: string; items: string[] }[] = Array.isArray(cvIn["skills"])
    ? (cvIn["skills"] as unknown[]).map((entry) => {
        const e = (entry ?? {}) as Record<string, unknown>;
        return {
          category: typeof e["category"] === "string" ? e["category"] : "Skills",
          items: ensureStringArray(e["items"]),
        };
      }).filter((s) => s.items.length > 0)
    : [];

  const projects: CvProject[] = Array.isArray(cvIn["projects"])
    ? (cvIn["projects"] as unknown[]).map((entry) => {
        const e = (entry ?? {}) as Record<string, unknown>;
        return {
          name: typeof e["name"] === "string" ? e["name"] : "",
          context: typeof e["context"] === "string" ? e["context"] : undefined,
          bullets: ensureStringArray(e["bullets"]),
        };
      }).filter((p) => p.name)
    : [];

  const professionalDevelopment: CvProfessionalDevelopmentItem[] = (() => {
    const raw = cvIn["professionalDevelopment"] ?? cvIn["awards"];
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[])
      .map((entry) => {
        if (typeof entry === "string") {
          const trimmed = entry.trim();
          return trimmed ? { name: trimmed } : null;
        }
        if (!entry || typeof entry !== "object") return null;
        const e = entry as Record<string, unknown>;
        const name = typeof e["name"] === "string" ? e["name"].trim() : "";
        if (!name) return null;
        const item: CvProfessionalDevelopmentItem = { name };
        if (typeof e["provider"] === "string" && e["provider"].trim()) item.provider = e["provider"].trim();
        if (typeof e["year"] === "string" && e["year"].trim()) item.year = e["year"].trim();
        if (typeof e["details"] === "string" && e["details"].trim()) item.details = e["details"].trim();
        return item;
      })
      .filter((x): x is CvProfessionalDevelopmentItem => x !== null);
  })();

  const optimizedCv: OptimizedCv = {
    candidateName,
    contact,
    summary: typeof cvIn["summary"] === "string" ? (cvIn["summary"] as string) : "",
    education,
    experience,
    skills,
    projects,
    professionalDevelopment,
  };

  return {
    jobTitle: typeof r["jobTitle"] === "string" && r["jobTitle"] ? (r["jobTitle"] as string) : "the role",
    atsScore: clampScore(r["atsScore"], 92),
    breakdown: {
      keywords: clampScore(breakdown["keywords"], 90),
      experience: clampScore(breakdown["experience"], 90),
      formatting: clampScore(breakdown["formatting"], 95),
      completeness: clampScore(breakdown["completeness"], 92),
    },
    summary: {
      topImprovements: ensureStringArray(summary["topImprovements"]).slice(0, 3),
      missingKeywords: ensureStringArray(summary["missingKeywords"]).slice(0, 12),
      nextSteps: ensureStringArray(summary["nextSteps"]).slice(0, 6),
    },
    optimizedCv,
    coverLetter: {
      salutation: typeof cover["salutation"] === "string" ? (cover["salutation"] as string) : "Dear Hiring Team,",
      paragraphs: ensureStringArray(cover["paragraphs"]),
      closing: typeof cover["closing"] === "string" ? (cover["closing"] as string) : "Sincerely,",
      signature: typeof cover["signature"] === "string" ? (cover["signature"] as string) : candidateName,
    },
  };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // Strip markdown fences if present
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : trimmed;
  // Find the first { and last }
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model did not return JSON");
  }
  const json = candidate.slice(firstBrace, lastBrace + 1);
  return JSON.parse(json);
}

export async function optimizeCvAgainstJd(
  cvText: string,
  jdText: string,
): Promise<OptimizationResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(cvText, jdText) }],
  });

  const block = message.content[0];
  const text = block && block.type === "text" ? block.text : "";
  if (!text) {
    throw new Error("Optimization service returned an empty response");
  }
  const parsed = extractJson(text);
  return normalize(parsed);
}
