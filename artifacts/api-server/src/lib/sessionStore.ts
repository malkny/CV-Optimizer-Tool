import { randomUUID } from "node:crypto";

export type FileType = "cv-pdf" | "cv-docx" | "cover-letter-pdf" | "cover-letter-docx";

export interface SessionFiles {
  "cv-pdf": Buffer;
  "cv-docx": Buffer;
  "cover-letter-pdf": Buffer;
  "cover-letter-docx": Buffer;
}

export interface StoredSession {
  id: string;
  createdAt: number;
  expiresAt: number;
  files: SessionFiles;
  candidateName: string;
  jobTitle: string;
}

const TTL_MS = 15 * 60 * 1000;

const store = new Map<string, StoredSession>();

function purgeExpired(): void {
  const now = Date.now();
  for (const [id, session] of store) {
    if (session.expiresAt <= now) {
      store.delete(id);
    }
  }
}

setInterval(purgeExpired, 60 * 1000).unref();

export function createSession(
  files: SessionFiles,
  candidateName: string,
  jobTitle: string,
): StoredSession {
  purgeExpired();
  const now = Date.now();
  const session: StoredSession = {
    id: randomUUID(),
    createdAt: now,
    expiresAt: now + TTL_MS,
    files,
    candidateName,
    jobTitle,
  };
  store.set(session.id, session);
  return session;
}

export function getSession(id: string): StoredSession | undefined {
  purgeExpired();
  return store.get(id);
}
