import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface FoldersUIState {
  /** Collapsed/expanded state of the folder sidebar, persisted across reloads. */
  sidebarCollapsed: boolean;
}

interface FoldersUIActions {
  toggleSidebarCollapsed: () => void;
}

export const useFoldersStore = create<FoldersUIState & FoldersUIActions>()(
  devtools(
    persist(
      (set) => ({
        sidebarCollapsed: false,
        toggleSidebarCollapsed: () =>
          set(
            (s) => ({ sidebarCollapsed: !s.sidebarCollapsed }),
            false,
            "folders/toggleSidebarCollapsed"
          ),
      }),
      { name: "stellarsplit_folders_ui" }
    ),
    {
      name: "FoldersStore",
      enabled: process.env.NODE_ENV === "development",
    }
  )
);
