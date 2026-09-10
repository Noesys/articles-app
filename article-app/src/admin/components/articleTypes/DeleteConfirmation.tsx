import { Trash2 } from "lucide-react";
import Button from "../ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const isParameter = variant === "parameter";
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
            <Trash2 size={18} className="text-red-600" aria-hidden />
          </div>
          <DialogTitle>Delete "{name}"?</DialogTitle>
          <DialogDescription>
            {isParameter
              ? "This will remove this parameter from the article type. This action cannot be undone."
              : "This removes the article type and its scoring prompt. Existing articles of this type won't be deleted, but new submissions can no longer use it."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteConfirmation;
