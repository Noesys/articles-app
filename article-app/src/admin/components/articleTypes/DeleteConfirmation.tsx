import { Trash2 } from "lucide-react";
import Button from "../ui/Button";

type DeleteVariant = "articleType" | "parameter";

interface DeleteConfirmationProps {
  open: boolean;
  name: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  variant?: DeleteVariant;
}

const DeleteConfirmation = ({
  open,
  name,
  submitting,
  onClose,
  onConfirm,
  variant = "articleType",
}: DeleteConfirmationProps) => {
  if (!open) return null;
  const isParameter = variant === "parameter";
  return (
    <div>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-slate-900/40"
          onClick={() => !submitting && onClose()}
        />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <h2 className="mt-3 font-semibold text-slate-900">
            Delete "{name}"?
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            {isParameter
              ? "This will remove this parameter from the article type. This action cannot be undone."
              : "This removes the article type and its scoring prompt. Existing articles of this type won't be deleted, but new submissions can no longer use it."}
          </p>

          <div className="mt-5 flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => onClose()}
              disabled={submitting}
              type="button"
              className="min-w-[90px]"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={onConfirm}
              loading={submitting}
              type="button"
              className="min-w-[90px]"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmation;
