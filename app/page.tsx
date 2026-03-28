import { Dashboard } from "@/components/dashboard";
import { readNotes, readTasks } from "@/lib/blob-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [rawNotes, rawTasks] = await Promise.all([readNotes(), readTasks()]);

  const notes = [...rawNotes].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return Number(right.isPinned) - Number(left.isPinned);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });

  const tasks = [...rawTasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return <Dashboard initialNotes={notes} initialTasks={tasks} />;
}
