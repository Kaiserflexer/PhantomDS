import { Dashboard } from "@/components/dashboard";
import { readStore } from "@/lib/blob-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const store = await readStore();

  const notes = [...store.notes].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return Number(right.isPinned) - Number(left.isPinned);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });

  const tasks = [...store.tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return <Dashboard initialNotes={notes} initialTasks={tasks} />;
}
