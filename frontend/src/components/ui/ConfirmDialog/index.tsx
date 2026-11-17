import { useState, type ReactNode } from "react";
import { getErrorMessage } from "../../../api/api.helper";
import { Alert } from "../Alert";
import { Button } from "../Button";
import { Modal } from "../Modal";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  appearance?: "primary" | "danger";
  // may throw; the error is shown inside the dialog and it stays open
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  appearance = "primary",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setPending(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(getErrorMessage(err));
      setPending(false);
    }
  };

  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      dismissible={!pending}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={appearance} onClick={confirm} loading={pending} autoFocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {error && <Alert variant="error">{error}</Alert>}
        {children}
      </div>
    </Modal>
  );
}
