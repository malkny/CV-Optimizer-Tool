import Anthropic from "@anthropic-ai/sdk";
import { anthropic as _integrationAnthopic } from "@workspace/integrations-anthropic-ai";

// Prefer a user-supplied key (no budget limits) over the Replit-managed integration
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : _integrationAnthopic;

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

function formatInstructions(format: "one-page" | "standard"): string {
  if (format === "one-page") {
    return `CV FORMAT: ONE PAGE — preserve every role, credential, and project from the original CV. Do NOT omit anything. Achieve density purely through tight writing.
   - summary: 2 crisp sentences (40–55 words). Role title + 2 differentiators + value statement.
   - skills: 3–4 categories, up to 8 items each on one line.
   - experience: Keep EVERY role and EVERY bullet. Each bullet = 1 line max: action verb → specific contribution → quantified result. Strip filler words but keep all facts.
   - education: Degree, institution, dates. Include detail bullets if they add value (GPA, honors).
   - projects: All projects. 1–2 tight bullets each.
   - professionalDevelopment: All items, no multi-line details (fold into one line).
   Writing rule: if a bullet would be >15 words, tighten it — do not split or remove it.`;
  }
  return `CV FORMAT: STANDARD — no page limit. Include full professional detail.
   - summary: 2–3 sentences (60–100 words). Role-anchored opener + 2–3 quantified differentiators aligned with the JD + value proposition.
   - skills: 2–5 categories, 4–8 items each. Mirror JD terminology where truthfully applicable.
   - experience: Keep ALL roles. 3–5 achievement bullets per role, one line each: action verb → contribution → quantified result. For roles >10 years ago and clearly unrelated, 1–2 bullets suffice.
   - education: Institution, degree, field, dates. 0–2 notable details (GPA ≥3.5, honors, relevant thesis).
   - projects: 0–4 projects, 2–3 bullets each.
   - professionalDevelopment: 0–8 items, optional provider, year, one-line details.`;
}

const CV_JSON_SCHEMA = `{
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
}`;

function buildUserPrompt(cvText: string, jdText: string, format: "one-page" | "standard"): string {
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
3. Job title from the JD (use as "jobTitle" in the JSON).

## STEP 3 — Rewrite the CV
4. Use ATS-optimized language: mirror JD keywords where the candidate's experience truthfully supports it. Use strong action verbs. Quantify impact using numbers already in the CV; never invent metrics.
5. Apply company-culture tone throughout: bullet style, verb choice, and emphasis should feel native to the target company.
6. Organize sections in this order (skip sections with no real content):
   summary → skills → experience → education → projects → professionalDevelopment

   ${formatInstructions(format)}

   professionalDevelopment: ONLY include items explicitly present in the candidate's original CV (certifications, courses, awards, training). Do NOT invent, suggest, or add any new items. If the original CV has none, output an empty array []. Recommendations for certifications or courses belong in nextSteps only, not here.

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
   nextSteps: 3–5 concrete, actionable suggestions for the candidate. This is the right place to recommend certifications, courses, or skills the candidate should pursue.

## STEP 6 — Cover letter
9. Write a tailored cover letter:
   - salutation (e.g. "Dear Hiring Team,")
   - 3–4 paragraphs: confident, specific, role-and-company-anchored. Name the company's stated values or mission where clearly inferable from the JD. Reference how the candidate's real achievements meet the specific requirements.
   - closing (e.g. "Sincerely,")
   - signature: candidate's name

Respond with ONLY a JSON object matching this exact shape:

${CV_JSON_SCHEMA}

Respond with the JSON object only.`;
}

function buildCompanyPrompt(cvText: string, companyText: string, format: "one-page" | "standard"): string {
  return `You will tailor a candidate's CV for a speculative/general application to a company — no specific job posting is available. Analyze the company from their website, infer their industry, culture, and values, then align the CV to appeal to that company for the candidate's natural professional area.

# Company Website Content
"""
${companyText.slice(0, 6000)}
"""

# Candidate CV (raw extracted text)
"""
${cvText.slice(0, 8000)}
"""

# Step-by-step Instructions

## STEP 1 — Analyze the company
From the website text, determine:
- Company name (use it in the cover letter; if unclear use "the company")
- Company type: startup / scale-up / enterprise / agency / non-profit / government / research
- Industry: e.g. fintech, healthcare, e-commerce, SaaS, logistics, media, deep tech
- Culture signals: data-driven, innovation-first, collaborative, customer-obsessed, mission-driven, etc.
- Values: repeated words or phrases that indicate what they care about
- Tone: formal vs. informal, technical vs. accessible, global vs. local
Use all of this to calibrate the CV's tone, verb choices, and emphasis. The CV should feel like it was written by someone who deeply understands and shares the company's ethos.

## STEP 2 — Extract candidate facts
1. Real name (or "Candidate" if unclear).
2. Contact info: email, phone, location, LinkedIn URL, personal website. Never invent.
3. Candidate's primary role/title: infer from the most recent or most prominent role in the CV. Use this as "jobTitle" in the JSON (e.g. "Senior Software Engineer", "Marketing Manager").

## STEP 3 — Rewrite the CV
4. Keep every role, employer, credential, and project truthfully. Never fabricate or remove anything.
5. Reframe bullets to highlight skills and achievements that align with the company's industry and values.
6. Use industry-appropriate ATS keywords inferred from the company's sector (not from a JD — use your knowledge of what ATS systems in this industry scan for).
7. Organize sections in this order (skip sections with no real content):
   summary → skills → experience → education → projects → professionalDevelopment

   ${formatInstructions(format)}

   professionalDevelopment: ONLY include items explicitly present in the candidate's original CV. Do NOT invent or suggest new ones. If the original CV has none, output []. Any certification or course recommendations belong in nextSteps only.

## STEP 4 — ATS score
8. Compute an ATS score as if this were a general application in the company's industry:
   - atsScore: 88–95 for a well-matched candidate; never exceed 98.
   - breakdown.keywords: industry vocabulary alignment (0–100)
   - breakdown.experience: relevance of work history to the company's sector (0–100)
   - breakdown.formatting: ATS-friendliness — usually 92–98
   - breakdown.completeness: all key sections present (0–100)
   Note: for "missingKeywords" list 4–8 industry-standard terms now woven into the CV.

## STEP 5 — Optimization summary
9. topImprovements: exactly 3 statements of what you improved.
   missingKeywords: 4–8 industry-relevant keywords added.
   nextSteps: 3–5 actionable suggestions (e.g. tailor further once a specific role is posted, add a portfolio, pursue a relevant certification).

## STEP 6 — Cover letter (speculative)
10. Write a compelling speculative cover letter expressing genuine interest in the company:
    - salutation: "Dear Hiring Team," or "Dear [Company Name] Team," if company name is clear
    - 3–4 paragraphs:
      • Opening: express specific, informed admiration for the company (reference their actual industry/mission/values from the website).
      • Body: highlight 2–3 real achievements from the CV that are relevant to the company's work and culture.
      • Closing: express enthusiasm for contributing to their mission, invite them to reach out for any suitable opening.
    - closing: e.g. "Sincerely,"
    - signature: candidate's name

Respond with ONLY a JSON object matching this exact shape:

${CV_JSON_SCHEMA}

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

async function callClaude(prompt: string): Promise<OptimizationResult> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
  const block = message.content[0];
  const text = block && block.type === "text" ? block.text : "";
  if (!text) throw new Error("Optimization service returned an empty response");
  return normalize(extractJson(text));
}

export async function optimizeCvAgainstJd(
  cvText: string,
  jdText: string,
  format: "one-page" | "standard" = "standard",
): Promise<OptimizationResult> {
  return callClaude(buildUserPrompt(cvText, jdText, format));
}

export async function optimizeCvForCompany(
  cvText: string,
  companyText: string,
  format: "one-page" | "standard" = "standard",
): Promise<OptimizationResult> {
  return callClaude(buildCompanyPrompt(cvText, companyText, format));
}
