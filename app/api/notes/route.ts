import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/blob-store";
import type { NoteRecord } from "@/lib/types";
import { createId, nowIso, summarize } from "@/lib/utils";

export async function GET() {
  const store = await readStore();
  const notes = [...store.notes].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return Number(right.isPinned) - Number(left.isPinned);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });

  return NextResponse.json(notes);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    const timestamp = nowIso();
    const note: NoteRecord = {
      id: createId("note"),
      title,
      content: typeof body.content === "string" ? body.content : "",
      summary: typeof body.summary === "string" ? body.summary : summarize(typeof body.content === "string" ? body.content : ""),
      isPinned: Boolean(body.isPinned),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const store = await readStore();
    const nextStore = {
      ...store,
      notes: [note, ...store.notes]
    };

    await writeStore(nextStore);

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save note."
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json({ error: "Note id is required." }, { status: 400 });
    }

    const store = await readStore();
    const nextNotes = store.notes.filter((note) => note.id !== id);

    if (nextNotes.length === store.notes.length) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }

    await writeStore({
      ...store,
      notes: nextNotes
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete note."
      },
      { status: 500 }
    );
  }
}
