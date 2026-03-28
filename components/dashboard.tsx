"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { RichTextEditor } from "@/components/rich-text-editor";
import type { NoteRecord, TaskPriority, TaskRecord, TaskStatus } from "@/lib/types";
import { formatDate, summarize, taskStatusLabel } from "@/lib/utils";

type DashboardProps = {
  initialNotes: NoteRecord[];
  initialTasks: TaskRecord[];
};

type ToastState = {
  tone: "success" | "error";
  message: string;
} | null;

async function readErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    return payload?.error ?? fallback;
  }

  const text = await response.text().catch(() => "");
  return text || fallback;
}

function sortNotes(items: NoteRecord[]) {
  return [...items].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return Number(right.isPinned) - Number(left.isPinned);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function sortTasks(items: TaskRecord[]) {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function Dashboard({ initialNotes, initialTasks }: DashboardProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [tasks, setTasks] = useState(initialTasks);
  const [isPending, startTransition] = useTransition();
  const [noteTitle, setNoteTitle] = useState("");
  const [notePinned, setNotePinned] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("todo");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    setNotes(initialNotes);
    setTasks(initialTasks);
  }, [initialNotes, initialTasks]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 2600);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const taskColumns = useMemo(
    () => [
      {
        key: "todo" as const,
        title: "Backlog",
        accent: "todo",
        items: sortTasks(tasks.filter((task) => task.status === "todo"))
      },
      {
        key: "in_progress" as const,
        title: "In progress",
        accent: "in-progress",
        items: sortTasks(tasks.filter((task) => task.status === "in_progress"))
      },
      {
        key: "done" as const,
        title: "Done",
        accent: "done",
        items: sortTasks(tasks.filter((task) => task.status === "done"))
      }
    ],
    [tasks]
  );

  function showToast(tone: "success" | "error", message: string) {
    setToast({ tone, message });
  }

  async function handleCreateNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!noteTitle.trim() && !summarize(noteContent)) {
      showToast("error", "Write a note or add a title first.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/notes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: noteTitle,
            content: noteContent,
            summary: summarize(noteContent),
            isPinned: notePinned
          })
        });

        if (!response.ok) {
          showToast("error", await readErrorMessage(response, "Failed to save note."));
          return;
        }

        const note = (await response.json()) as NoteRecord;
        setNotes((current) => sortNotes([note, ...current]));
        setNoteTitle("");
        setNotePinned(false);
        setNoteContent("");
        showToast("success", "Note saved.");
      } catch {
        showToast("error", "Network error while saving note.");
      }
    });
  }

  async function handleDeleteNote(id: string) {
    const previousNotes = notes;
    setNotes((current) => current.filter((note) => note.id !== id));

    startTransition(async () => {
      try {
        const response = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, {
          method: "DELETE"
        });

        if (!response.ok) {
          setNotes(previousNotes);
          showToast("error", await readErrorMessage(response, "Failed to delete note."));
          return;
        }

        showToast("success", "Note deleted.");
      } catch {
        setNotes(previousNotes);
        showToast("error", "Network error while deleting note.");
      }
    });
  }

  async function handleCreateTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!taskTitle.trim()) {
      showToast("error", "Enter a task title first.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title: taskTitle,
            description: taskDescription,
            status: taskStatus,
            priority: taskPriority,
            dueDate: taskDueDate || null
          })
        });

        if (!response.ok) {
          showToast("error", await readErrorMessage(response, "Failed to save task."));
          return;
        }

        const task = (await response.json()) as TaskRecord;
        setTasks((current) => sortTasks([task, ...current]));
        setTaskTitle("");
        setTaskDescription("");
        setTaskStatus("todo");
        setTaskPriority("medium");
        setTaskDueDate("");
        showToast("success", "Task saved.");
      } catch {
        showToast("error", "Network error while saving task.");
      }
    });
  }

  async function handleDeleteTask(id: string) {
    const previousTasks = tasks;
    setTasks((current) => current.filter((task) => task.id !== id));

    startTransition(async () => {
      try {
        const response = await fetch(`/api/tasks?id=${encodeURIComponent(id)}`, {
          method: "DELETE"
        });

        if (!response.ok) {
          setTasks(previousTasks);
          showToast("error", await readErrorMessage(response, "Failed to delete task."));
          return;
        }

        showToast("success", "Task deleted.");
      } catch {
        setTasks(previousTasks);
        showToast("error", "Network error while deleting task.");
      }
    });
  }

  return (
    <>
      <div className="workspace-shell">
        <header className="topbar">
          <div className="brand-block">
            <div className="brand-mark">P</div>
            <div>
              <div className="eyebrow">PhantomDS</div>
              <div className="brand-title">Operations board</div>
            </div>
          </div>

          <div className="topbar-filters">
            <button className="top-pill active" type="button">Overview</button>
            <button className="top-pill" type="button">Kanban</button>
            <button className="top-pill" type="button">Notes</button>
            <button className="top-pill" type="button">Today</button>
          </div>
        </header>

        <section className="hero-panel">
          <div>
            <div className="eyebrow">Team space</div>
            <h1 className="hero-title">Good evening. Your tasks, notes, and decisions are organized in one command layer.</h1>
            <p className="hero-copy">
              A cleaner productivity dashboard inspired by modern kanban and work OS interfaces, but still tuned for the
              PhantomDS dark identity.
            </p>
          </div>

          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-value">{tasks.filter((task) => task.status !== "done").length}</div>
              <div className="metric-label">Open tasks</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{notes.length}</div>
              <div className="metric-label">Saved notes</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{notes.filter((note) => note.isPinned).length}</div>
              <div className="metric-label">Pinned ideas</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{tasks.filter((task) => task.status === "done").length}</div>
              <div className="metric-label">Completed</div>
            </div>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="main-column">
            <div className="section-card">
              <div className="section-heading-row">
                <div>
                  <div className="section-title">Task composer</div>
                  <div className="section-subtitle">Create work items with the same visual rhythm as a kanban board.</div>
                </div>
                <div className="small-status">{isPending ? "Syncing" : "Live"}</div>
              </div>

              <form className="form-grid" onSubmit={handleCreateTask}>
                <div className="field-grid two-up">
                  <div className="field">
                    <label htmlFor="task-title">Task title</label>
                    <input id="task-title" value={taskTitle} placeholder="Prepare launch checklist" onChange={(event) => setTaskTitle(event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="task-due-date">Due date</label>
                    <input id="task-due-date" type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="task-description">Description</label>
                  <textarea id="task-description" rows={3} value={taskDescription} placeholder="What needs to happen next?" onChange={(event) => setTaskDescription(event.target.value)} />
                </div>

                <div className="field-grid two-up">
                  <div className="field">
                    <label htmlFor="task-status">Stage</label>
                    <select id="task-status" value={taskStatus} onChange={(event) => setTaskStatus(event.target.value as TaskStatus)}>
                      <option value="todo">Backlog</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="task-priority">Priority</label>
                    <select id="task-priority" value={taskPriority} onChange={(event) => setTaskPriority(event.target.value as TaskPriority)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <button className="primary-button" type="submit" disabled={isPending}>Add task</button>
              </form>
            </div>

            <div className="section-card">
              <div className="section-heading-row">
                <div>
                  <div className="section-title">Kanban board</div>
                  <div className="section-subtitle">Compact task cards inspired by your references.</div>
                </div>
                <div className="board-toolbar">
                  <span className="top-pill active">All tasks</span>
                  <span className="top-pill">By status</span>
                </div>
              </div>

              <div className="kanban-grid">
                {taskColumns.map((column) => (
                  <section key={column.key} className={`kanban-column ${column.accent}`}>
                    <div className="kanban-header">
                      <div className="kanban-title-wrap">
                        <span className={`kanban-dot ${column.accent}`} />
                        <strong>{column.title}</strong>
                      </div>
                      <span className="count-pill">{column.items.length}</span>
                    </div>

                    <div className="kanban-stack">
                      {column.items.length === 0 ? (
                        <div className="empty-mini">No tasks here yet.</div>
                      ) : (
                        column.items.map((task) => (
                          <article key={task.id} className="task-card-compact">
                            <div className="task-card-top">
                              <div>
                                <div className="task-card-title">{task.title}</div>
                                <div className="task-card-copy">{task.description || "No extra details yet."}</div>
                              </div>
                              <button className="mini-delete" type="button" onClick={() => handleDeleteTask(task.id)}>
                                Delete
                              </button>
                            </div>

                            <div className="task-card-bottom">
                              <span className={`priority-chip ${task.priority}`}>{task.priority}</span>
                              <span className={`status-chip ${task.status}`}>{taskStatusLabel(task.status)}</span>
                              <span className="meta-chip">{formatDate(task.dueDate)}</span>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>

          <aside className="side-column">
            <div className="section-card notes-composer-card">
              <div className="section-heading-row">
                <div>
                  <div className="section-title">Notes lab</div>
                  <div className="section-subtitle">Capture quick ideas, meeting notes, and product thinking.</div>
                </div>
                <button
                  className={`top-pill ${notePinned ? "active" : ""}`}
                  type="button"
                  onClick={() => setNotePinned((value) => !value)}
                >
                  {notePinned ? "Pinned" : "Pin note"}
                </button>
              </div>

              <form className="form-grid" onSubmit={handleCreateNote}>
                <div className="field">
                  <label htmlFor="note-title">Title</label>
                  <input id="note-title" value={noteTitle} placeholder="Optional title" onChange={(event) => setNoteTitle(event.target.value)} />
                </div>

                <RichTextEditor value={noteContent} onChange={setNoteContent} />

                <button className="primary-button" type="submit" disabled={isPending}>Save note</button>
              </form>
            </div>

            <div className="section-card">
              <div className="section-heading-row">
                <div>
                  <div className="section-title">Notes archive</div>
                  <div className="section-subtitle">A denser notes list inspired by workspace sidepanels.</div>
                </div>
              </div>

              <div className="notes-stack">
                {notes.length === 0 ? (
                  <div className="empty-mini">Create your first PhantomDS note.</div>
                ) : (
                  notes.map((note) => (
                    <article className="note-card-compact" key={note.id}>
                      <div className="task-card-top">
                        <div>
                          <div className="task-card-title">{note.title}</div>
                          <div className="task-card-copy">{note.summary || "No preview yet."}</div>
                        </div>
                        <button className="mini-delete" type="button" onClick={() => handleDeleteNote(note.id)}>
                          Delete
                        </button>
                      </div>
                      <div className="task-card-bottom">
                        {note.isPinned ? <span className="priority-chip high">Pinned</span> : null}
                        <span className="meta-chip">Updated {formatDate(note.updatedAt)}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>

      {toast ? (
        <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      ) : null}
    </>
  );
}
