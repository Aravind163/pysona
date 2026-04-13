import { createContext, useContext } from 'react';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  toasts: any[];
  removeToast: (id: number) => void;
}

export const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  toasts: [],
  removeToast: () => {},
});

export const useToast = () => useContext(ToastContext);
