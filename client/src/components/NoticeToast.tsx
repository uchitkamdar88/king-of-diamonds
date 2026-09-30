import { useEffect } from "react";
import { useAppStore } from "../stores/appStore";

export function NoticeToast() {
  const notice = useAppStore((s) => s.notice);
  const setNotice = useAppStore((s) => s.setNotice);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [notice, setNotice]);

  if (!notice) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[60] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-rose-400/40 bg-slate-950/95 px-4 py-3 text-center font-mono text-sm text-rose-100 shadow-[0_0_30px_rgba(255,45,85,0.25)]"
    >
      {notice}
    </div>
  );
}
