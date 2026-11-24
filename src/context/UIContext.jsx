"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ToastContainer from "@/components/ui/ToastContainer";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PromptDialog from "@/components/ui/PromptDialog";

const UIContext = createContext(null);

const TOAST_TYPES = ["success", "error", "warning", "info"];

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);

  const toastSequence = useRef(0);
  const toastTimers = useRef(new Map());
  const dialogRef = useRef(null);

  const dismissToast = useCallback((id) => {
    const timer = toastTimers.current.get(id);

    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimers.current.delete(id);
    }

    setToasts((current) =>
      current.filter((item) => item.id !== id)
    );
  }, []);

  const showToast = useCallback(
    (message, options = {}) => {
      if (message === null || message === undefined || message === "") {
        return null;
      }

      const settings =
        typeof options === "string"
          ? { type: options }
          : options || {};

      const type = TOAST_TYPES.includes(settings.type)
        ? settings.type
        : "info";

      const id = ++toastSequence.current;

      const toast = {
        id,
        message,
        title: settings.title || "",
        type,
      };

      setToasts((current) => [
        ...current,
        toast,
      ].slice(-5));

      const configuredDuration =
        settings.duration === undefined
          ? 4500
          : Number(settings.duration);

      const duration = Number.isFinite(configuredDuration)
        ? Math.max(0, configuredDuration)
        : 4500;

      if (duration > 0) {
        const timer = window.setTimeout(() => {
          dismissToast(id);
        }, duration);

        toastTimers.current.set(id, timer);
      }

      return id;
    },
    [dismissToast]
  );

  const finishDialog = useCallback((result) => {
    const activeDialog = dialogRef.current;

    if (!activeDialog) return;

    dialogRef.current = null;
    setDialog(null);

    activeDialog.resolve(result);
  }, []);

  const showConfirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      const previousDialog = dialogRef.current;

      if (previousDialog) {
        dialogRef.current = null;

        previousDialog.resolve(
          previousDialog.type === "confirm" ? false : null
        );
      }

      const nextDialog = {
        ...options,
        type: "confirm",
        resolve,
      };

      dialogRef.current = nextDialog;
      setDialog(nextDialog);
    });
  }, []);

  const showPrompt = useCallback((options = {}) => {
    return new Promise((resolve) => {
      const previousDialog = dialogRef.current;

      if (previousDialog) {
        dialogRef.current = null;

        previousDialog.resolve(
          previousDialog.type === "confirm" ? false : null
        );
      }

      const nextDialog = {
        ...options,
        type: "prompt",
        resolve,
      };

      dialogRef.current = nextDialog;
      setDialog(nextDialog);
    });
  }, []);

  useEffect(() => {
    return () => {
      toastTimers.current.forEach((timer) => {
        window.clearTimeout(timer);
      });

      toastTimers.current.clear();

      const pendingDialog = dialogRef.current;

      if (pendingDialog) {
        dialogRef.current = null;

        pendingDialog.resolve(
          pendingDialog.type === "confirm" ? false : null
        );
      }
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      showToast,
      showConfirm,
      showPrompt,
    }),
    [showToast, showConfirm, showPrompt]
  );

  return (
    <UIContext.Provider value={contextValue}>
      {children}

      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
      />

      <ConfirmDialog
        open={dialog?.type === "confirm"}
        title={dialog?.title}
        description={dialog?.description}
        confirmText={dialog?.confirmText || "تایید"}
        cancelText={dialog?.cancelText || "انصراف"}
        danger={dialog?.danger || false}
        onCancel={() => finishDialog(false)}
        onConfirm={() => finishDialog(true)}
      />

      <PromptDialog
        open={dialog?.type === "prompt"}
        title={dialog?.title}
        description={dialog?.description}
        defaultValue={dialog?.defaultValue || ""}
        placeholder={dialog?.placeholder}
        confirmText={dialog?.confirmText || "ثبت"}
        cancelText={dialog?.cancelText || "انصراف"}
        required={dialog?.required || false}
        multiline={dialog?.multiline || false}
        inputType={dialog?.inputType || "text"}
        onCancel={() => finishDialog(null)}
        onConfirm={(value) => finishDialog(value)}
      />
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);

  if (!context) {
    throw new Error("useUI must be used inside UIProvider");
  }

  return context;
}