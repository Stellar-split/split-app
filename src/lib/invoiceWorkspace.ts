export type WorkspaceRole = "owner" | "editor" | "viewer";

export interface WorkspaceParticipant {
  id: string;
  name: string;
  role: WorkspaceRole;
}

export interface WorkspaceNote {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface WorkspaceTask {
  id: string;
  title: string;
  assigneeId?: string;
  done: boolean;
}

export interface WorkspaceState {
  participants: WorkspaceParticipant[];
  notes: WorkspaceNote[];
  tasks: WorkspaceTask[];
}

export const canEdit = (role: WorkspaceRole) => role === "owner" || role === "editor";

export function addNote(state: WorkspaceState, note: WorkspaceNote): WorkspaceState {
  const author = state.participants.find((p) => p.id === note.authorId);
  if (!author || !canEdit(author.role) || !note.text.trim()) return state;
  return { ...state, notes: [...state.notes, { ...note, text: note.text.trim() }] };
}

export function addTask(state: WorkspaceState, task: WorkspaceTask): WorkspaceState {
  if (!task.title.trim()) return state;
  return { ...state, tasks: [...state.tasks, { ...task, title: task.title.trim() }] };
}

export function toggleTask(state: WorkspaceState, taskId: string): WorkspaceState {
  return { ...state, tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) };
}

export function setRole(state: WorkspaceState, participantId: string, role: WorkspaceRole): WorkspaceState {
  const target = state.participants.find((p) => p.id === participantId);
  if (!target || target.role === "owner") return state;
  return { ...state, participants: state.participants.map((p) => (p.id === participantId ? { ...p, role } : p)) };
}

export function progress(state: WorkspaceState): number {
  if (state.tasks.length === 0) return 0;
  return Math.round((state.tasks.filter((t) => t.done).length / state.tasks.length) * 100);
}
