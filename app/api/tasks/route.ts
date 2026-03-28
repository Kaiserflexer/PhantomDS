import { NextResponse } from "next/server";
import { readTasks, writeTasks } from "@/lib/blob-store";
import type { TaskPriority, TaskRecord, TaskStatus } from "@/lib/types";
import { createId, nowIso } from "@/lib/utils";

const allowedStatuses = new Set<TaskStatus>(["todo", "in_progress", "done"]);
const allowedPriorities = new Set<TaskPriority>(["low", "medium", "high"]);

export const dynamic = "force-dynamic";

export async function GET() {
  const tasks = await readTasks();
  const sorted = [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return NextResponse.json(sorted, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
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

    const tasks = await readTasks();
    await writeTasks([task, ...tasks]);

    return NextResponse.json(task, {
      status: 201,
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save task."
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Task id is required." }, { status: 400 });
    }

    const tasks = await readTasks();
    const index = tasks.findIndex((task) => task.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const currentTask = tasks[index];
    const nextTitle = typeof body.title === "string" ? body.title.trim() : currentTask.title;
    const nextDescription = typeof body.description === "string" ? body.description.trim() : currentTask.description;
    const nextStatus = allowedStatuses.has(body.status) ? body.status : currentTask.status;
    const nextPriority = allowedPriorities.has(body.priority) ? body.priority : currentTask.priority;
    const nextDueDate = body.dueDate === null ? null : typeof body.dueDate === "string" ? body.dueDate || null : currentTask.dueDate;

    if (!nextTitle) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    const nextTask: TaskRecord = {
      ...currentTask,
      title: nextTitle,
      description: nextDescription,
      status: nextStatus,
      priority: nextPriority,
      dueDate: nextDueDate,
      updatedAt: nowIso()
    };

    const nextTasks = [...tasks];
    nextTasks[index] = nextTask;
    await writeTasks(nextTasks);

    return NextResponse.json(nextTask, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update task."
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

    const tasks = await readTasks();
    const nextTasks = tasks.filter((task) => task.id !== id);

    if (nextTasks.length === tasks.length) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    await writeTasks(nextTasks);

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
        error: error instanceof Error ? error.message : "Failed to delete task."
      },
      { status: 500 }
    );
  }
}
