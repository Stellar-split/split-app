import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface UIState {
  toasts: Toast[];
  commandPaletteOpen: boolean;
  sidebarOpen: boolean;
  activeModal: string | null;
}

interface UIActions {
  addToast: (toast: Toast) => void;
  removeToast: (id: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

const initialState: UIState = {
  toasts: [],
  commandPaletteOpen: false,
  sidebarOpen: false,
  activeModal: null,
};

export const useUIStore = create<UIState & UIActions>()(
  devtools(
    immer((set) => ({
      ...initialState,
      addToast: (toast) =>
        set((s) => { s.toasts.push(toast); }, false, "ui/addToast"),
      removeToast: (id) =>
        set(
          (s) => { s.toasts = s.toasts.filter((t) => t.id !== id); },
          false,
          "ui/removeToast"
        ),
      setCommandPaletteOpen: (open) =>
        set((s) => { s.commandPaletteOpen = open; }, false, "ui/setCommandPaletteOpen"),
      setSidebarOpen: (open) =>
        set((s) => { s.sidebarOpen = open; }, false, "ui/setSidebarOpen"),
      openModal: (modalId) =>
        set((s) => { s.activeModal = modalId; }, false, "ui/openModal"),
      closeModal: () =>
        set((s) => { s.activeModal = null; }, false, "ui/closeModal"),
    })),
    {
      name: "UIStore",
      enabled: process.env.NODE_ENV === "development",
    }
  )
);
