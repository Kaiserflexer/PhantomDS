import { get, put } from "@vercel/blob";
import type { NoteRecord, TaskRecord } from "@/lib/types";

const NOTES_PATH = "phantomds/data/notes.json";
const TASKS_PATH = "phantomds/data/tasks.json";

function requireBlobToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is missing. Add it to .env.local or Vercel environment variables.");
  }
}

async function readCollection<T>(path: string): Promise<T[]> {
  try {
    requireBlobToken();

    const result = await get(path, {
      access: "private"
    });

    if (!result || result.statusCode !== 200) {
      return [];
    }

    const text = await new Response(result.stream, {
      headers: {
        "Cache-Control": "no-store"
      }
    }).text();

    const data = JSON.parse(text) as unknown;
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
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

export function readNotes() {
  return readCollection<NoteRecord>(NOTES_PATH);
}

export function writeNotes(notes: NoteRecord[]) {
  return writeCollection(NOTES_PATH, notes);
}

export function readTasks() {
  return readCollection<TaskRecord>(TASKS_PATH);
}

export function writeTasks(tasks: TaskRecord[]) {
  return writeCollection(TASKS_PATH, tasks);
}
