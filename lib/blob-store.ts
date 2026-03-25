import { get, put } from "@vercel/blob";
import type { PhantomStore } from "@/lib/types";

const STORE_PATH = "phantomds/data/store.json";

const emptyStore: PhantomStore = {
  notes: [],
  tasks: []
};

function requireBlobToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is missing. Add it to .env.local or Vercel environment variables.");
  }
}

export async function readStore(): Promise<PhantomStore> {
  try {
    requireBlobToken();

    const result = await get(STORE_PATH, {
      access: "private"
    });

    if (!result || result.statusCode !== 200) {
      return emptyStore;
    }

    const text = await new Response(result.stream, {
      headers: {
        "Cache-Control": "no-store"
      }
    }).text();
    const data = JSON.parse(text) as Partial<PhantomStore>;

    return {
      notes: Array.isArray(data.notes) ? data.notes : [],
      tasks: Array.isArray(data.tasks) ? data.tasks : []
    };
  } catch {
    return emptyStore;
  }
}

export async function writeStore(data: PhantomStore) {
  requireBlobToken();

  await put(STORE_PATH, JSON.stringify(data, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0
  });
}
