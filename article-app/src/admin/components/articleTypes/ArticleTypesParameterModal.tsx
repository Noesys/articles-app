import { ParameterDraft, ScopeType } from "@/admin/utils/types";
import Button from "../ui/Button";
import { Trash2 } from "lucide-react";
import { Input, Modal, Select } from "antd";
import { WheelEvent } from "react";

interface Props {
  modalOpen: boolean;
  modalDraft: ParameterDraft | null;
  setModalDraft: React.Dispatch<React.SetStateAction<ParameterDraft | null>>;
  saveModal: () => void;
  closeModal: () => void;
}

export default function ArticleTypesParameterModal({
  modalOpen,
  modalDraft,
  setModalDraft,
  saveModal,
  closeModal,
}: Props) {
  const modalNumericInvalid =
    modalDraft?.scopeType === "numeric" &&
    modalDraft.minValue !== "" &&
    modalDraft.maxValue !== "" &&
    Number(modalDraft.maxValue) <= Number(modalDraft.minValue);

  function handleWheel(e: WheelEvent<HTMLInputElement>) {
    e.currentTarget.blur();
  }

  return (
    <>
      <Modal
        open={modalOpen}
        onCancel={closeModal}
        title={modalDraft?.isNew ? "Add Parameter" : "Edit Parameter"}
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              key="cancel"
              variant="secondary"
              onClick={closeModal}
              type="button"
              className="min-w-[90px]"
            >
              Cancel
            </Button>
            <Button
              key="save"
              onClick={saveModal}
              disabled={
                !modalDraft?.name.trim() ||
                !modalDraft?.prompt.trim() ||
                !!modalNumericInvalid
              }
              type="button"
              className="min-w-[90px]"
            >
              Save
            </Button>
          </div>
        }
        destroyOnHidden
      >
        {modalDraft && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Parameter name
              </label>
              <Input
                value={modalDraft.name}
                onChange={(e) =>
                  setModalDraft({ ...modalDraft, name: e.target.value })
                }
                placeholder="e.g. Grammar"
                className="!bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Prompt for the parameter
              </label>
              <Input.TextArea
                value={modalDraft.prompt}
                onChange={(e) =>
                  setModalDraft({ ...modalDraft, prompt: e.target.value })
                }
                placeholder="AI instruction for evaluating this parameter..."
                rows={2}
                className="!bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Range / Option
              </label>
              <Select
                showSearch
                value={modalDraft.scopeType}
                onChange={(v: ScopeType) =>
                  setModalDraft({ ...modalDraft, scopeType: v })
                }
                className="w-full [&_.ant-select-selector]:!bg-white"
                styles={{
                  popup: {
                    root: { background: "#fff" },
                  },
                }}
                options={[
                  { value: "numeric", label: "Numeric" },
                  { value: "option", label: "Option" },
                ]}
                filterOption={(input, opt) =>
                  (opt?.label as string)
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </div>
            {modalDraft.scopeType === "numeric" ? (
              <div className="grid grid-cols-2 gap-2.5">
                <Input
                  onWheel={handleWheel}
                  type="number"
                  value={modalDraft.minValue}
                  onChange={(e) =>
                    setModalDraft({ ...modalDraft, minValue: e.target.value })
                  }
                  placeholder="Min"
                  className="!bg-white"
                />
                <Input
                  onWheel={handleWheel}
                  type="number"
                  value={modalDraft.maxValue}
                  onChange={(e) =>
                    setModalDraft({ ...modalDraft, maxValue: e.target.value })
                  }
                  placeholder="Max"
                  className="!bg-white"
                />
                {modalNumericInvalid && (
                  <p className="text-xs text-red-500 col-span-2">
                    Max must be greater than min.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {modalDraft.options.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option.label}
                      placeholder="Option label"
                      onChange={(e) => {
                        const next = [...modalDraft.options];
                        next[index] = { ...next[index], label: e.target.value };
                        setModalDraft({ ...modalDraft, options: next });
                      }}
                      className="flex-1 !bg-white"
                    />
                    <button
                      type="button"
                      className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                      onClick={() => {
                        const next = modalDraft.options.filter(
                          (_, i) => i !== index,
                        );
                        setModalDraft({ ...modalDraft, options: next });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="border"
                  onClick={() =>
                    setModalDraft({
                      ...modalDraft,
                      options: [...modalDraft.options, { label: "" }],
                    })
                  }
                >
                  Add a new parameter option
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
