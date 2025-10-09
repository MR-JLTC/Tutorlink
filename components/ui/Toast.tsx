import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  notify: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const notify = (message: string, type: ToastType = 'info') => {
    const id = idRef.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => remove(id), 3500);
  };

  // Expose a global notifier for non-react code (e.g., axios interceptors)
  useEffect(() => {
    (window as any).__notify = (msg: string, type?: ToastType) => notify(msg, type);
    return () => { delete (window as any).__notify; };
  }, []);

  const value = useMemo(() => ({ notify }), []);

  const colorByType: Record<ToastType, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-primary-600',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`text-white shadow-lg rounded-md px-4 py-3 flex items-start gap-3 ${colorByType[t.type]} animate-slide-in`}
            role="alert"
          >
            <span className="text-sm">{t.message}</span>
            <button className="ml-2 opacity-80 hover:opacity-100" onClick={() => remove(t.id)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ))}
      </div>
      <style>
        {`
          @keyframes slide-in { from { transform: translateY(-8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
          .animate-slide-in { animation: slide-in 150ms ease-out; }
        `}
      </style>
    </ToastContext.Provider>
  );
};


