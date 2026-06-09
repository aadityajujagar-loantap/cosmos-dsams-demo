"use client";

import { ReactNode, useState } from "react";

import { Button, Modal } from "@/components/ui/primitives";

export function PageHeader({
  action,
  eyebrow,
  title,
  description,
}: {
  action?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ActionPair({
  onDelete,
  onEdit,
  onView,
}: {
  onDelete?: () => void;
  onEdit?: () => void;
  onView?: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <div className="flex justify-end gap-2">
        {onView ? (
          <Button onClick={onView} size="sm" type="button" variant="outline">
            View
          </Button>
        ) : null}
        {onEdit ? (
          <Button onClick={onEdit} size="sm" type="button" variant="secondary">
            Edit
          </Button>
        ) : null}
        {onDelete ? (
          <Button onClick={() => setConfirmDelete(true)} size="sm" type="button" variant="ghost">
            Delete
          </Button>
        ) : null}
      </div>
      <Modal
        description="This removes the record from the local demo store and adds an audit event."
        onClose={() => setConfirmDelete(false)}
        open={confirmDelete}
        title="Delete record?"
        width="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirmDelete(false)} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            onClick={() => {
              onDelete?.();
              setConfirmDelete(false);
            }}
            type="button"
            variant="danger"
          >
            Delete record
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function DetailGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-950">{value}</div>
    </div>
  );
}
