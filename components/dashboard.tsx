"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { RichTextEditor } from "@/components/rich-text-editor";
import type { NoteRecord, TaskPriority, TaskRecord, TaskStatus } from "@/lib/types";
import { formatDate, summarize } from "@/lib/utils";

type DashboardProps = {
  initialNotes: NoteRecord[];
  initialTasks: TaskRecord[];
};

type WorkspaceTab = "kanban" | "notes";
type ToastState = { tone: "success" | "error"; message: string } | null;
type ColumnDrafts = Record<TaskStatus, string>;

type ColumnConfig = {
  key: TaskStatus;
  title: string;
  accent: string;
};

const columns: ColumnConfig[] = [
  { key: "todo", title: "Backlog", accent: "todo" },
  { key: "in_progress", title: "In Progress", accent: "progress" },
  { key: "done", title: "Done", accent: "done" }
];

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
  const statusRank: Record<TaskStatus, number> = {
    todo: 0,
    in_progress: 1,
    done: 2
  };

  return [...items].sort((left, right) => {
    if (statusRank[left.status] !== statusRank[right.status]) {
      return statusRank[left.status] - statusRank[right.status];
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function priorityLabel(priority: TaskPriority) {
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}

function statusLabel(status: TaskStatus) {
  if (status === "in_progress") return "In progress";
  if (status === "done") return "Done";
  return "Backlog";
}

export function Dashboard({ initialNotes, initialTasks }: DashboardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [notes, setNotes] = useState(initialNotes);
  const [tab, setTab] = useState<WorkspaceTab>("kanban");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTasks[0]?.id ?? null);
  const [columnDrafts, setColumnDrafts] = useState<ColumnDrafts>({ todo: "", in_progress: "", done: "" });
  const [noteTitle, setNoteTitle] = useState("");
  const [notePinned, setNotePinned] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTasks(initialTasks);
    setNotes(initialNotes);
    setSelectedTaskId((current) => current ?? initialTasks[0]?.id ?? null);
  }, [initialNotes, initialTasks]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);
  const sortedNotes = useMemo(() => sortNotes(notes), [notes]);
  const selectedTask = useMemo(
    () => sortedTasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, sortedTasks]
  );

  function showToast(tone: "success" | "error", message: string) {
    setToast({ tone, message });
  }

  function applyTaskUpdate(updatedTask: TaskRecord) {
    setTasks((current) => sortTasks(current.map((task) => (task.id === updatedTask.id ? updatedTask : task))));
    setSelectedTaskId(updatedTask.id);
  }

  async function saveTaskPatch(id: string, patch: Partial<TaskRecord>, fallbackMessage: string) {
    const previousTasks = tasks;
    const previousSelected = selectedTask;

    const optimistic = sortTasks(
      tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              ...patch,
              updatedAt: new Date().toISOString()
            }
          : task
      )
    );

    setTasks(optimistic);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/tasks?id=${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(patch)
        });

        if (!response.ok) {
          setTasks(previousTasks);
          if (previousSelected) setSelectedTaskId(previousSelected.id);
          showToast("error", await readErrorMessage(response, fallbackMessage));
          return;
        }

        const updatedTask = (await response.json()) as TaskRecord;
        applyTaskUpdate(updatedTask);
      } catch {
        setTasks(previousTasks);
        if (previousSelected) setSelectedTaskId(previousSelected.id);
        showToast("error", fallbackMessage);
      }
    });
  }

  async function handleInlineCreate(status: TaskStatus) {
    const title = columnDrafts[status].trim();
    if (!title) return;

    startTransition(async () => {
      try {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title,
            description: "",
            status,
            priority: "medium",
            dueDate: null
          })
        });

        if (!response.ok) {
          showToast("error", await readErrorMessage(response, "Failed to create task."));
          return;
        }

        const task = (await response.json()) as TaskRecord;
        setTasks((current) => sortTasks([task, ...current]));
        setSelectedTaskId(task.id);
        setColumnDrafts((current) => ({ ...current, [status]: "" }));
        showToast("success", "Task created.");
      } catch {
        showToast("error", "Network error while creating task.");
      }
    });
  }


  async function handleUpdateTaskStatus(id: string, status: TaskStatus) {
    await saveTaskPatch(id, { status }, "Failed to update task status.");
  }
  async function handleDeleteTask(id: string) {
    const previousTasks = tasks;
    const fallbackSelection = sortedTasks.find((task) => task.id !== id)?.id ?? null;
    setTasks((current) => current.filter((task) => task.id !== id));
    setSelectedTaskId((current) => (current === id ? fallbackSelection : current));

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

  return (
    <>
      <div className="linear-shell">
        <aside className={`linear-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
          <div className="sidebar-top">
            <button className="logo-chip" type="button" onClick={() => setSidebarCollapsed((value) => !value)}>
              P
            </button>
            {!sidebarCollapsed ? <div className="sidebar-brand">PhantomDS</div> : null}
          </div>

          <nav className="sidebar-nav">
            <button className={`sidebar-link ${tab === "kanban" ? "active" : ""}`} type="button" onClick={() => setTab("kanban")}>
              <span className="sidebar-icon">#</span>
              {!sidebarCollapsed ? <span>Kanban</span> : null}
            </button>
            <button className={`sidebar-link ${tab === "notes" ? "active" : ""}`} type="button" onClick={() => setTab("notes")}>
              <span className="sidebar-icon">N</span>
              {!sidebarCollapsed ? <span>Notes</span> : null}
            </button>
          </nav>

          {!sidebarCollapsed ? (
            <div className="sidebar-footer">
              <div className="sidebar-stat">{sortedTasks.length} tasks</div>
              <div className="sidebar-stat">{sortedNotes.length} notes</div>
            </div>
          ) : null}
        </aside>

        <main className="workspace-main">
          {tab === "kanban" ? (
            <>
              <div className="workspace-toolbar">
                <div>
                  <h1 className="workspace-title">Kanban</h1>
                  <div className="workspace-subtitle">Minimal task flow with inline creation and fast edits.</div>
                </div>
              </div>

              <div className="kanban-board-modern">
                {columns.map((column) => {
                  const items = sortedTasks.filter((task) => task.status === column.key);

                  return (
                    <section
                      key={column.key}
                      className={`modern-column ${column.accent}`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const droppedTaskId = event.dataTransfer.getData("text/task-id") || draggedTaskId;
                        if (!droppedTaskId) return;
                        const droppedTask = sortedTasks.find((task) => task.id === droppedTaskId);
                        if (!droppedTask || droppedTask.status === column.key) return;
                        handleUpdateTaskStatus(droppedTaskId, column.key);
                        setDraggedTaskId(null);
                      }}
                    >
                      <div className="modern-column-header">
                        <div className="modern-column-title-wrap">
                          <span className={`modern-column-dot ${column.accent}`} />
                          <span className="modern-column-title">{column.title}</span>
                        </div>
                        <span className="modern-column-count">{items.length}</span>
                      </div>

                      <div className="inline-create-row">
                        <input
                          value={columnDrafts[column.key]}
                          placeholder="+ Add task"
                          onChange={(event) => setColumnDrafts((current) => ({ ...current, [column.key]: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleInlineCreate(column.key);
                            }
                          }}
                        />
                      </div>

                      <div className="modern-column-stack">
                        {items.map((task) => (
                          <article
                            key={task.id}
                            className={`task-min-card ${selectedTaskId === task.id ? "active" : ""}`}
                            draggable
                            onDragStart={(event) => {
                              setDraggedTaskId(task.id);
                              event.dataTransfer.setData("text/task-id", task.id);
                            }}
                            onDragEnd={() => setDraggedTaskId(null)}
                            onClick={() => setSelectedTaskId(task.id)}
                          >
                            <div className="task-min-title">{task.title}</div>
                            <div className="task-min-meta">
                              <span className={`mini-badge ${task.priority}`}>{priorityLabel(task.priority)}</span>
                              <span className="mini-badge neutral">{formatDate(task.dueDate)}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="notes-workspace">
              <div className="workspace-toolbar">
                <div>
                  <h1 className="workspace-title">Notes</h1>
                  <div className="workspace-subtitle">Separate from the main task screen, like a focused workspace tab.</div>
                </div>
              </div>

              <div className="notes-layout">
                <section className="notes-editor-panel">
                  <div className="panel-headline-row">
                    <div>
                      <div className="panel-title">New note</div>
                      <div className="panel-subcopy">Rich text editor with fast capture flow.</div>
                    </div>
                    <button className={`ghost-pill ${notePinned ? "active" : ""}`} type="button" onClick={() => setNotePinned((value) => !value)}>
                      {notePinned ? "Pinned" : "Pin"}
                    </button>
                  </div>

                  <form className="editor-form" onSubmit={handleCreateNote}>
                    <input
                      className="inline-title-input"
                      value={noteTitle}
                      placeholder="Untitled note"
                      onChange={(event) => setNoteTitle(event.target.value)}
                    />
                    <RichTextEditor value={noteContent} onChange={setNoteContent} />
                    <button className="primary-action" type="submit" disabled={isPending}>Save note</button>
                  </form>
                </section>

                <section className="notes-list-panel">
                  <div className="panel-headline-row">
                    <div>
                      <div className="panel-title">Archive</div>
                      <div className="panel-subcopy">All saved notes in one clean list.</div>
                    </div>
                  </div>

                  <div className="notes-list-stack">
                    {sortedNotes.length === 0 ? (
                      <div className="empty-state-modern">No notes yet.</div>
                    ) : (
                      sortedNotes.map((note) => (
                        <article key={note.id} className="note-list-card">
                          <div>
                            <div className="task-min-title">{note.title}</div>
                            <div className="task-list-copy">{note.summary || "No preview yet."}</div>
                          </div>
                          <div className="task-min-meta">
                            {note.isPinned ? <span className="mini-badge high">Pinned</span> : null}
                            <span className="mini-badge neutral">{formatDate(note.updatedAt)}</span>
                            <button className="ghost-text-button" type="button" onClick={() => handleDeleteNote(note.id)}>Delete</button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>

        {tab === "kanban" && selectedTask ? (
          <aside className="task-detail-panel">
            <div className="panel-headline-row">
              <div>
                <div className="panel-title">Task details</div>
                <div className="panel-subcopy">Inline editing, no modal required.</div>
              </div>
              <button className="ghost-text-button" type="button" onClick={() => setSelectedTaskId(null)}>Close</button>
            </div>

            <div className="detail-form">
              <div className="field compact-field">
                <label htmlFor="detail-title">Title</label>
                <input
                  id="detail-title"
                  value={selectedTask.title}
                  onChange={(event) => saveTaskPatch(selectedTask.id, { title: event.target.value }, "Failed to update task.")}
                />
              </div>

              <div className="field compact-field">
                <label htmlFor="detail-description">Description</label>
                <textarea
                  id="detail-description"
                  rows={6}
                  value={selectedTask.description}
                  onChange={(event) => saveTaskPatch(selectedTask.id, { description: event.target.value }, "Failed to update task.")}
                />
              </div>

              <div className="field compact-field">
                <label htmlFor="detail-priority">Priority</label>
                <select
                  id="detail-priority"
                  value={selectedTask.priority}
                  onChange={(event) => saveTaskPatch(selectedTask.id, { priority: event.target.value as TaskPriority }, "Failed to update task.")}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="field compact-field">
                <label htmlFor="detail-status">Status</label>
                <select
                  id="detail-status"
                  value={selectedTask.status}
                  onChange={(event) => saveTaskPatch(selectedTask.id, { status: event.target.value as TaskStatus }, "Failed to update task.")}
                >
                  <option value="todo">Backlog</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div className="field compact-field">
                <label htmlFor="detail-due-date">Due date</label>
                <input
                  id="detail-due-date"
                  type="date"
                  value={selectedTask.dueDate?.slice(0, 10) ?? ""}
                  onChange={(event) => saveTaskPatch(selectedTask.id, { dueDate: event.target.value || null }, "Failed to update task.")}
                />
              </div>

              <button className="danger-action" type="button" onClick={() => handleDeleteTask(selectedTask.id)}>Delete task</button>
            </div>
          </aside>
        ) : null}
      </div>

      {toast ? <div className={`toast-modern ${toast.tone}`}>{toast.message}</div> : null}
    </>
  );
}

