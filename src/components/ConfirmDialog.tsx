"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Modal } from "./Modal";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
};

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(
  () => Promise.resolve(false),
);

/** In-app replacement for window.confirm(): `const ok = await confirm({...})`. */
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOptions(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={Boolean(options)} onClose={() => settle(false)}>
        {options && (
          <div className="p-6">
            <h2 className="font-display text-lg font-semibold text-ink">
              {options.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-body">
              {options.message}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => settle(false)}
                className="rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-ivory hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => settle(true)}
                className={`rounded-full px-5 py-2.5 text-sm font-medium text-white transition-colors ${
                  options.danger
                    ? "bg-accent hover:bg-accent-hover"
                    : "bg-ink hover:opacity-90"
                }`}
              >
                {options.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}
