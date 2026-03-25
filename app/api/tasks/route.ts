import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/blob-store";
import type { TaskPriority, TaskRecord, TaskStatus } from "@/lib/types";
import { createId, nowIso } from "@/lib/utils";

const allowedStatuses = new Set<TaskStatus>(["todo", "in_progress", "done"]);
const allowedPriorities = new Set<TaskPriority>(["low", "medium", "high"]);

export async function GET() {
  const store = await readStore();
  const tasks = [...store.tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    const timestamp = nowIso();
    const status = allowedStatuses.has(body.status) ? body.status : "todo";
    const priority = allowedPriorities.has(body.priority) ? body.priority : "medium";

    const task: TaskRecord = {
      id: createId("task"),
      title,
      description: typeof body.description === "string" ? body.description.trim() : "",
      status,
      priority,
      dueDate: typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const store = await readStore();
    const nextStore = {
      ...store,
      tasks: [task, ...store.tasks]
    };

    await writeStore(nextStore);

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save task."
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
      return NextResponse.json({ error: "Task id is required." }, { status: 400 });
    }

    const store = await readStore();
    const nextTasks = store.tasks.filter((task) => task.id !== id);

    if (nextTasks.length === store.tasks.length) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    await writeStore({
      ...store,
      tasks: nextTasks
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete task."
      },
      { status: 500 }
    );
  }
}
