import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { Subscription } from "@/types/subscription";

interface SubscriptionState {
  subscriptions: Record<string, Subscription>;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

interface SubscriptionActions {
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  upsertSubscription: (sub: Subscription) => void;
  upsertSubscriptions: (subs: Subscription[]) => void;
  removeSubscription: (id: string) => void;
  reset: () => void;
}

const initialState: SubscriptionState = {
  subscriptions: {},
  loading: false,
  error: null,
  lastFetched: null,
};

export const useSubscriptionStore = create<SubscriptionState & SubscriptionActions>()(
  devtools(
    immer((set) => ({
      ...initialState,
      setLoading: (loading) =>
        set((s) => { s.loading = loading; }, false, "subscription/setLoading"),
      setError: (error) =>
        set((s) => { s.error = error; }, false, "subscription/setError"),
      upsertSubscription: (sub) =>
        set(
          (s) => {
            s.subscriptions[sub.id] = sub;
            s.lastFetched = Date.now();
          },
          false,
          "subscription/upsert"
        ),
      upsertSubscriptions: (subs) =>
        set(
          (s) => {
            for (const sub of subs) {
              s.subscriptions[sub.id] = sub;
            }
            s.lastFetched = Date.now();
          },
          false,
          "subscription/upsertMany"
        ),
      removeSubscription: (id) =>
        set((s) => { delete s.subscriptions[id]; }, false, "subscription/remove"),
      reset: () =>
        set(() => ({ ...initialState }), false, "subscription/reset"),
    })),
    {
      name: "SubscriptionStore",
      enabled: process.env.NODE_ENV === "development",
    }
  )
);
