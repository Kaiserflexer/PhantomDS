"use client";

import { useEffect, useState, useTransition } from "react";
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

  function showToast(tone: "success" | "error", message: string) {
    setToast({ tone, message });
  }

  async function refreshData() {
    const [notesResponse, tasksResponse] = await Promise.all([
      fetch("/api/notes", { cache: "no-store" }),
      fetch("/api/tasks", { cache: "no-store" })
    ]);

    if (notesResponse.ok) {
      setNotes(await notesResponse.json());
    }

    if (tasksResponse.ok) {
      setTasks(await tasksResponse.json());
    }
  }

  async function handleCreateNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!noteTitle.trim()) {
      showToast("error", "Enter a note title first.");
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

        setNoteTitle("");
        setNotePinned(false);
        setNoteContent("");
        showToast("success", "Note saved.");
        await refreshData();
      } catch {
        showToast("error", "Network error while saving note.");
      }
    });
  }

  async function handleDeleteNote(id: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/notes?id=${encodeURIComponent(id)}`, {
          method: "DELETE"
        });

        if (!response.ok) {
          showToast("error", await readErrorMessage(response, "Failed to delete note."));
          return;
        }

        setNotes((current) => current.filter((note) => note.id !== id));
        showToast("success", "Note deleted.");
      } catch {
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

        setTaskTitle("");
        setTaskDescription("");
        setTaskStatus("todo");
        setTaskPriority("medium");
        setTaskDueDate("");
        showToast("success", "Task saved.");
        await refreshData();
      } catch {
        showToast("error", "Network error while saving task.");
      }
    });
  }

  async function handleDeleteTask(id: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/tasks?id=${encodeURIComponent(id)}`, {
          method: "DELETE"
        });

        if (!response.ok) {
          showToast("error", await readErrorMessage(response, "Failed to delete task."));
          return;
        }

        setTasks((current) => current.filter((task) => task.id !== id));
        showToast("success", "Task deleted.");
      } catch {
        showToast("error", "Network error while deleting task.");
      }
    });
  }

  return (
    <>
      <div className="page-shell">
        <section className="hero">
          <div className="hero-grid">
            <div>
              <span className="badge">PhantomDS workspace</span>
              <h1>Black note system with violet gradients and synced storage.</h1>
              <p>
                PhantomDS combines notes, tasks, and a built-in rich text editor in one interface that is ready for
                Vercel deployment and private Blob-based sync.
              </p>
            </div>
            <div className="hero-stats">
              <div className="stat-card">
                <div className="stat-label">Saved notes</div>
                <div className="stat-value">{notes.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active tasks</div>
                <div className="stat-value">{tasks.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pinned ideas</div>
                <div className="stat-value">{notes.filter((note) => note.isPinned).length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Completed</div>
                <div className="stat-value">{tasks.filter((task) => task.status === "done").length}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="stack">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Create note</h2>
                  <div className="panel-subtitle">Built-in editor with private storage sync.</div>
                </div>
                <span className="pill">{isPending ? "Saving..." : "Private Blob"}</span>
              </div>

              <form className="form-grid" onSubmit={handleCreateNote}>
                <div className="field">
                  <label htmlFor="note-title">Title</label>
                  <input id="note-title" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
                </div>

                <div className="section-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setNotePinned((value) => !value)}
                    style={{
                      borderColor: notePinned ? "rgba(187, 124, 255, 0.42)" : undefined,
                      background: notePinned ? "rgba(157, 88, 255, 0.16)" : undefined
                    }}
                  >
                    {notePinned ? "Pinned" : "Pin note"}
                  </button>
                </div>

                <RichTextEditor value={noteContent} onChange={setNoteContent} />

                <button className="button" type="submit" disabled={isPending}>Save note</button>
              </form>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Notes archive</h2>
                  <div className="panel-subtitle">Pinned records stay on top.</div>
                </div>
              </div>

              <div className="stack">
                {notes.length === 0 ? (
                  <div className="empty-state">Create your first PhantomDS note.</div>
                ) : (
                  notes.map((note) => (
                    <article className="card" key={note.id}>
                      <div className="card-title">
                        <div>
                          <strong>{note.title}</strong>
                        </div>
                        <div className="section-actions">
                          {note.isPinned ? <span className="pill">Pinned</span> : null}
                          <button className="ghost-button" type="button" onClick={() => handleDeleteNote(note.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="muted">{note.summary || "No preview yet."}</div>
                      <div className="note-meta">
                        <span>Updated {formatDate(note.updatedAt)}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="stack">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Task control</h2>
                  <div className="panel-subtitle">Track priorities and deadlines.</div>
                </div>
              </div>

              <form className="form-grid" onSubmit={handleCreateTask}>
                <div className="field">
                  <label htmlFor="task-title">Task title</label>
                  <input id="task-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
                </div>

                <div className="field">
                  <label htmlFor="task-description">Description</label>
                  <textarea
                    id="task-description"
                    rows={4}
                    value={taskDescription}
                    onChange={(event) => setTaskDescription(event.target.value)}
                  />
                </div>

                <div className="split-fields">
                  <div className="field">
                    <label htmlFor="task-status">Status</label>
                    <select id="task-status" value={taskStatus} onChange={(event) => setTaskStatus(event.target.value as TaskStatus)}>
                      <option value="todo">To do</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="task-priority">Priority</label>
                    <select
                      id="task-priority"
                      value={taskPriority}
                      onChange={(event) => setTaskPriority(event.target.value as TaskPriority)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="task-due-date">Due date</label>
                  <input id="task-due-date" type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} />
                </div>

                <button className="button" type="submit" disabled={isPending}>Add task</button>
              </form>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Tasks board</h2>
                  <div className="panel-subtitle">A compact overview of current work.</div>
                </div>
              </div>

              <div className="stack">
                {tasks.length === 0 ? (
                  <div className="empty-state">No tasks yet.</div>
                ) : (
                  tasks.map((task) => (
                    <article className="card" key={task.id}>
                      <div className="card-title">
                        <strong>{task.title}</strong>
                        <div className="section-actions">
                          <span className={`pill ${task.status}`}>{taskStatusLabel(task.status)}</span>
                          <button className="ghost-button" type="button" onClick={() => handleDeleteTask(task.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="muted">{task.description || "No extra details provided."}</div>
                      <div className="task-meta">
                        <span>Priority {task.priority}</span>
                        <span>{formatDate(task.dueDate)}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
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
