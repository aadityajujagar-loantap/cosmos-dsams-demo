"use client";

import { FormEvent, ReactNode, useId, useState } from "react";

import { Button, Field, Input, Label, Select, Textarea } from "@/components/ui/primitives";

export interface FieldConfig<T> {
  name: keyof T;
  label: string;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  renderAfter?: ReactNode;
  type?: "text" | "email" | "number" | "date" | "textarea" | "select";
}

export function RecordForm<T extends object>({
  fields,
  initialValue,
  onCancel,
  onSubmit,
  submitLabel = "Save",
}: {
  fields: FieldConfig<T>[];
  initialValue: Partial<T>;
  onCancel?: () => void;
  onSubmit: (value: Partial<T>) => void;
  submitLabel?: string;
}) {
  const [value, setValue] = useState<Partial<T>>(initialValue);
  const formId = useId();

  function update(name: keyof T, nextValue: string) {
    setValue((current) => ({ ...current, [name]: nextValue }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(value);
  }

  return (
    <form className="space-y-5" id={formId} onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => {
          const rawValue = value[field.name];
          const fieldValue = typeof rawValue === "number" ? String(rawValue) : String(rawValue ?? "");
          return (
            <Field className={field.type === "textarea" ? "md:col-span-2" : undefined} key={String(field.name)}>
              <Label htmlFor={`${formId}-${String(field.name)}`}>{field.label}</Label>
              {field.type === "select" ? (
                <Select
                  id={`${formId}-${String(field.name)}`}
                  onChange={(event) => update(field.name, event.target.value)}
                  required={field.required}
                  value={fieldValue}
                >
                  <option value="">Select {field.label}</option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : field.type === "textarea" ? (
                <Textarea
                  id={`${formId}-${String(field.name)}`}
                  onChange={(event) => update(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  value={fieldValue}
                />
              ) : (
                <Input
                  id={`${formId}-${String(field.name)}`}
                  onChange={(event) => update(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  type={field.type ?? "text"}
                  value={fieldValue}
                />
              )}
              {field.renderAfter}
            </Field>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        {onCancel ? (
          <Button onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
        ) : null}
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
