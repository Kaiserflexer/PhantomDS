import { get, put } from "@vercel/blob";
import type { NoteRecord, TaskRecord } from "@/lib/types";

const NOTES_PATH = "phantomds/data/notes.json";
const TASKS_PATH = "phantomds/data/tasks.json";
const LEGACY_STORE_PATH = "phantomds/data/store.json";

function requireBlobToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is missing. Add it to .env.local or Vercel environment variables.");
  }
}

function isNoteRecord(value: unknown): value is NoteRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.content === "string" &&
    typeof item.summary === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string" &&
    typeof item.isPinned === "boolean"
  );
}

function isTaskRecord(value: unknown): value is TaskRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.description === "string" &&
    typeof item.status === "string" &&
    typeof item.priority === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string" &&
    (typeof item.dueDate === "string" || item.dueDate === null)
  );
}

type BlobJsonReadResult = {
  found: boolean;
  data: unknown;
};

async function readBlobJson(path: string): Promise<BlobJsonReadResult> {
  requireBlobToken();

  const result = await get(path, {
    access: "private"
  });

  if (!result || result.statusCode !== 200) {
    return { found: false, data: null };
  }

  const text = await new Response(result.stream, {
    headers: {
      "Cache-Control": "no-store"
    }
  }).text();

  return {
    found: true,
    data: JSON.parse(text) as unknown
  };
}

async function readCollection<T>(path: string, guard: (value: unknown) => value is T): Promise<{ found: boolean; items: T[] }> {
  try {
    const result = await readBlobJson(path);

    if (!result.found) {
      return { found: false, items: [] };
    }

    return {
      found: true,
      items: Array.isArray(result.data) ? result.data.filter(guard) : []
    };
  } catch {
    return { found: false, items: [] };
  }
}

async function writeCollection<T>(path: string, data: T[]) {
  requireBlobToken();

  await put(path, JSON.stringify(data, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0
  });
}

async function readLegacyStore(): Promise<{ notes: NoteRecord[]; tasks: TaskRecord[] }> {
  try {
    const result = await readBlobJson(LEGACY_STORE_PATH);

    if (!result.found || !result.data || typeof result.data !== "object") {
      return { notes: [], tasks: [] };
    }

    const store = result.data as Record<string, unknown>;

    return {
      notes: Array.isArray(store.notes) ? store.notes.filter(isNoteRecord) : [],
      tasks: Array.isArray(store.tasks) ? store.tasks.filter(isTaskRecord) : []
    };
  } catch {
    return { notes: [], tasks: [] };
  }
}

export async function readNotes() {
  const result = await readCollection<NoteRecord>(NOTES_PATH, isNoteRecord);

  if (result.found) {
    return result.items;
  }

  const legacy = await readLegacyStore();
  return legacy.notes;
}

export async function writeNotes(notes: NoteRecord[]) {
  return writeCollection(NOTES_PATH, notes.filter(isNoteRecord));
}

export async function readTasks() {
  const result = await readCollection<TaskRecord>(TASKS_PATH, isTaskRecord);

  if (result.found) {
    return result.items;
  }

  const legacy = await readLegacyStore();
  return legacy.tasks;
}

export async function writeTasks(tasks: TaskRecord[]) {
  return writeCollection(TASKS_PATH, tasks.filter(isTaskRecord));
}
