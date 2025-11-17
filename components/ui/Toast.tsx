import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  action?: {
    label: string;
    onClick?: () => void;
  } | null;
}

interface ToastContextType {
  notify: (message: string, type?: ToastType, action?: { label: string; onClick?: () => void } | null) => void;
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
    setToasts((prev) => [...prev, { id, message, type, action: null }]);
    setTimeout(() => remove(id), 3500);
  };

  // Expose a global notifier for non-react code (e.g., axios interceptors)
  useEffect(() => {
    (window as any).__notify = (msg: string, type?: ToastType, action?: { label: string; onClick?: () => void } | null) => {
      const id = idRef.current++;
      setToasts((prev) => [...prev, { id, message: msg, type: type || 'info', action: action || null }]);
      setTimeout(() => remove(id), 3500);
    };
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
            <div className="flex-1">
              <span className="text-sm">{t.message}</span>
              {t.action && (
                <div className="mt-2">
                  <button
                    onClick={() => {
                      try {
                        t.action?.onClick && t.action.onClick();
                      } catch (e) {
                        console.error('Toast action failed', e);
                      }
                      remove(t.id);
                    }}
                    className="ml-0 inline-block px-3 py-1 text-sm font-medium bg-white text-gray-800 rounded"
                  >
                    {t.action.label}
                  </button>
                </div>
              )}
            </div>
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


