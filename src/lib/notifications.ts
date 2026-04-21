import { create } from "zustand";

export interface Notification {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message?: string;
}

interface NotificationStore {
  notifications: Notification[];
  push: (n: Omit<Notification, "id">) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useNotifications = create<NotificationStore>((set) => ({
  notifications: [],

  push: (n) =>
    set((s) => ({
      notifications: [
        ...s.notifications,
        { ...n, id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` },
      ],
    })),

  dismiss: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  clear: () => set({ notifications: [] }),
}));
