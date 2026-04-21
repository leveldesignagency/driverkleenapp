"use client";

import { useEffect } from "react";
import { useNotifications, Notification } from "@/lib/notifications";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const ICON_MAP: Record<Notification["type"], typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const COLOR_MAP: Record<Notification["type"], string> = {
  success: "border-accent-200 bg-accent-50 text-accent-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-brand-200 bg-brand-50 text-brand-800",
};

const ICON_COLOR_MAP: Record<Notification["type"], string> = {
  success: "text-accent-500",
  error: "text-red-500",
  info: "text-brand-500",
};

const AUTO_DISMISS_MS = 5000;

function ToastItem({ notification }: { notification: Notification }) {
  const dismiss = useNotifications((s) => s.dismiss);
  const Icon = ICON_MAP[notification.type];

  useEffect(() => {
    const timer = setTimeout(() => dismiss(notification.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notification.id, dismiss]);

  return (
    <div
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur-sm animate-in slide-in-from-top-2 fade-in ${COLOR_MAP[notification.type]}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${ICON_COLOR_MAP[notification.type]}`} />
      <div className="flex-1">
        <p className="text-sm font-semibold">{notification.title}</p>
        {notification.message && (
          <p className="mt-0.5 text-xs opacity-80">{notification.message}</p>
        )}
      </div>
      <button
        onClick={() => dismiss(notification.id)}
        className="flex-shrink-0 rounded-lg p-1 opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const notifications = useNotifications((s) => s.notifications);

  if (notifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-0 top-0 z-[100] flex w-full flex-col items-end gap-2 p-4 sm:p-6">
      {notifications.map((n) => (
        <ToastItem key={n.id} notification={n} />
      ))}
    </div>
  );
}
