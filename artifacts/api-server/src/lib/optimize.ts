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

const SYSTEM_PROMPT = `You are a senior career coach and ATS optimization specialist. You rewrite CVs to maximize both ATS keyword matching and genuine appeal to the hiring company — considering their industry, culture, values, and what they actually care about. You preserve every truthful fact from the candidate's CV; you never fabricate employers, dates, credentials, or achievements. You may rephrase, reorder, and sharpen existing content, and surface skills the candidate demonstrably has.

You ALWAYS respond with a single JSON object exactly matching the requested schema. No markdown, no commentary, no code fences.`;

function buildUserPrompt(cvText: string, jdText: string, format: "one-page" | "standard"): string {
  const formatInstructions =
    format === "one-page"
      ? `CV FORMAT: ONE PAGE (compact layout, not truncated content)
   IMPORTANT: Do NOT omit any real role, employer, or credential from the candidate's history. Achieve compactness through concise writing, not deletion.
   - summary: Exactly 2 crisp sentences (40–60 words). Role-title phrase + 2 key differentiators + value proposition.
   - skills: 2–3 categories, each ≤6 items, comma-separated on one line.
   - experience: Keep ALL roles. Write 2 tight, high-impact bullets per role (1 line each, verb + metric + result). For roles >10 years ago that are clearly irrelevant, reduce to 1 bullet or omit bullets only — never omit the role itself.
   - education: Institution, degree, dates only. 0 detail bullets.
   - projects: 0–2 most relevant projects, 1 bullet each.
   - professionalDevelopment: 0–3 items, no details field.`
      : `CV FORMAT: STANDARD (no page limit — include full professional detail)
   - summary: 2–3 sentences (60–100 words). Open with a role-anchored statement, highlight 2–3 quantified differentiators aligned with the JD, close with a concise value proposition.
   - skills: 2–5 categories, each with 4–8 items. Mirror JD terminology where the candidate genuinely has the skill.
   - experience: Keep ALL roles. Write 3–5 achievement bullets per role, one line each: action verb → specific contribution → quantified result (use the original CV's numbers; if no number given, describe scope). For roles >10 years ago and clearly unrelated, 1–2 bullets suffice.
   - education: Institution, degree, field, dates, 0–2 notable detail bullets (GPA if ≥3.5, honors, relevant thesis).
   - projects: 0–4 projects, 2–3 bullets each.
   - professionalDevelopment: 0–8 items with optional provider, year, and one-line details.`;

  return `You will optimize a candidate's CV against a job description, tailoring it to the specific company and role.

# Job Description
"""
${jdText.slice(0, 6000)}
"""

# Candidate CV (raw extracted text)
"""
${cvText.slice(0, 8000)}
"""

# Step-by-step Instructions

## STEP 1 — Analyze the company & role
Before writing anything, infer from the JD:
- Company type: startup / scale-up / enterprise / agency / non-profit / government
- Industry: e.g. fintech, healthcare, e-commerce, SaaS, consulting, manufacturing
- Culture signals: e.g. data-driven, innovation-first, collaborative, high-autonomy, process-oriented, mission-driven
- Values: look for repeated phrases ("move fast", "customer obsessed", "rigorous", "inclusive", "ownership")
- What they care about most in this role: leadership, technical depth, client-facing skills, cross-functional collaboration, etc.
Use these insights to calibrate tone and emphasis throughout the CV — e.g. startups → impact/velocity language; enterprise → governance/scalability; mission-driven → alignment with purpose.

## STEP 2 — Extract candidate facts
1. Real name (or "Candidate" if unclear).
2. Contact info: email, phone, location, LinkedIn URL, personal website. Never invent — only include what's in the CV.
3. Job title from the JD.

## STEP 3 — Rewrite the CV
4. Use ATS-optimized language: mirror JD keywords where the candidate's experience truthfully supports it. Use strong action verbs. Quantify impact using numbers already in the CV; never invent metrics.
5. Apply company-culture tone throughout: bullet style, verb choice, and emphasis should feel native to the target company.
6. Organize sections in this order (skip sections with no real content):
   summary → skills → experience → education → projects → professionalDevelopment

   ${formatInstructions}

   professionalDevelopment: each item has name (certification, course, or award), optional provider, optional year, optional one-line details. Include items mentioned in the CV first. If none found, suggest 1–3 plausible items that match skills the candidate already demonstrates. Never fabricate brand-name certifications; use generic titles when uncertain (e.g. "Advanced SQL for Analytics" rather than "Mode Analytics Certification").

## STEP 4 — ATS score
7. Compute:
   - atsScore: overall weighted score, target 90–95 for a well-matched CV; never exceed 98.
   - breakdown.keywords: JD vocabulary alignment (0–100)
   - breakdown.experience: work history relevance (0–100)
   - breakdown.formatting: ATS-friendliness of the template — usually 92–98 since our template is clean
   - breakdown.completeness: all expected sections present (0–100)

## STEP 5 — Optimization summary
8. topImprovements: exactly 3 short statements of what you improved.
   missingKeywords: 4–8 JD terms weak/absent in the original (now woven in where truthful).
   nextSteps: 3–5 concrete, actionable suggestions for the candidate.

## STEP 6 — Cover letter
9. Write a tailored cover letter:
   - salutation (e.g. "Dear Hiring Team,")
   - 3–4 paragraphs: confident, specific, role-and-company-anchored. Name the company's stated values or mission where clearly inferable from the JD. Reference how the candidate's real achievements meet the specific requirements.
   - closing (e.g. "Sincerely,")
   - signature: candidate's name

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
  format: "one-page" | "standard" = "standard",
): Promise<OptimizationResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(cvText, jdText, format) }],
  });

  const block = message.content[0];
  const text = block && block.type === "text" ? block.text : "";
  if (!text) {
    throw new Error("Optimization service returned an empty response");
  }
  const parsed = extractJson(text);
  return normalize(parsed);
}
