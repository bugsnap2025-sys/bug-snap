
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-dismiss
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto flex items-start gap-3 min-w-[300px] max-w-md p-4 rounded-xl shadow-lg border transition-all animate-in slide-in-from-bottom-5 duration-300
              ${
                toast.type === 'success' 
                  ? 'bg-white dark:bg-[#1e1e1e] border-green-200 dark:border-green-900/30 text-green-800 dark:text-green-400 shadow-green-50/50 dark:shadow-none' 
                  : toast.type === 'error'
                  ? 'bg-white dark:bg-[#1e1e1e] border-red-200 dark:border-red-900/30 text-red-800 dark:text-red-400 shadow-red-50/50 dark:shadow-none'
                  : 'bg-white dark:bg-[#1e1e1e] border-blue-200 dark:border-blue-900/30 text-slate-800 dark:text-zinc-200 shadow-blue-50/50 dark:shadow-none'
              }
            `}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 size={18} className="text-green-600 dark:text-green-500" />}
              {toast.type === 'error' && <AlertCircle size={18} className="text-red-600 dark:text-red-500" />}
              {toast.type === 'info' && <Info size={18} className="text-blue-600 dark:text-blue-500" />}
            </div>
            <div className="flex-1 text-sm font-medium leading-tight break-words">
              {toast.message}
            </div>
            <button 
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
