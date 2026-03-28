import { NextResponse } from "next/server";
import { readNotes, writeNotes } from "@/lib/blob-store";
import type { NoteRecord } from "@/lib/types";
import { createId, deriveTitle, nowIso, summarize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const notes = await readNotes();
  const sorted = [...notes].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return Number(right.isPinned) - Number(left.isPinned);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });

  return NextResponse.json(sorted, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const content = typeof body.content === "string" ? body.content : "";
    const title = deriveTitle(typeof body.title === "string" ? body.title : "", content, "Untitled note");

    const timestamp = nowIso();
    const note: NoteRecord = {
      id: createId("note"),
      title,
      content,
      summary: typeof body.summary === "string" ? body.summary : summarize(content),
      isPinned: Boolean(body.isPinned),
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const notes = await readNotes();
    await writeNotes([note, ...notes]);

    return NextResponse.json(note, {
      status: 201,
      headers: {
        "Cache-Control": "no-store"
      }
    });
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

    const notes = await readNotes();
    const nextNotes = notes.filter((note) => note.id !== id);

    if (nextNotes.length === notes.length) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }

    await writeNotes(nextNotes);

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete note."
      },
      { status: 500 }
    );
  }
}
