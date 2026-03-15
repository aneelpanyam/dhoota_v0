"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { Widget, WidgetAction, FileReference } from "@/types/api";
import { Send, X, Upload, FileIcon, Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { RichMarkdownEditor } from "@/components/ui/RichMarkdownEditor";
import { isValidEmail, validateAccessCodeStrength, validateByParamSchema } from "@/lib/validation";

interface PendingFile {
  file: File;
  s3Key?: string;
  uploading: boolean;
  error?: string;
}

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (
    optionId: string,
    params: Record<string, unknown>,
    content?: string
  ) => void;
  onCancel: () => void;
}

interface DynamicOption {
  value: string;
  label: string;
}

export function QuestionCardWidget({ widget, onQAResponse, onCancel }: Props) {
  const d = widget.data;
  const questionText = d.questionText as string;
  const questionKey = d.questionKey as string;
  const inlineWidget = d.inlineWidget as string | null;
  const widgetConfig = (d.widgetConfig as Record<string, unknown>) ?? {};
  const isRequired = (d.isRequired as boolean) ?? true;
  const optionId = d.optionId as string;
  const sessionParams = (d.sessionParams as Record<string, unknown>) ?? {};
  const currentAvatarUrl = d.currentAvatarUrl as string | undefined;
  const currentBannerUrl = d.currentBannerUrl as string | undefined;
  const paramSchema = d.paramSchema as Record<string, unknown> | undefined;

  const dynamicSource = widgetConfig.source as string | undefined;
  const [dynamicOptions, setDynamicOptions] = useState<DynamicOption[]>([]);
  const [dynamicLoading, setDynamicLoading] = useState(false);

  const tagSelectSource = inlineWidget === "tag_select" ? (dynamicSource ?? "tags") : null;
  const isDynamicSelect = !!dynamicSource && (inlineWidget === "select" || !inlineWidget);
  const effectiveInlineWidget = isDynamicSelect ? "select" : inlineWidget;

  useEffect(() => {
    const source = dynamicSource ?? (inlineWidget === "tag_select" ? "tags" : null);
    if (!source) {
      setDynamicOptions([]);
      return;
    }
    let cancelled = false;
    setDynamicLoading(true);
    const params = new URLSearchParams({ source });
    if (source === "tenant_users" && sessionParams?.tenant_id) {
      params.set("tenantId", String(sessionParams.tenant_id));
    }
    if (source === "welcome_messages") {
      if (sessionParams?.tenant_id) params.set("tenantId", String(sessionParams.tenant_id));
      if (sessionParams?.user_id) params.set("userId", String(sessionParams.user_id));
    }
    fetch(`/api/options/dynamic-source?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.options)) {
          setDynamicOptions(data.options);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDynamicLoading(false); });
    return () => { cancelled = true; };
  }, [dynamicSource, inlineWidget, sessionParams?.tenant_id]);

  const existingFromSession = sessionParams?.[questionKey];
  const [value, setValue] = useState(() => {
    if (existingFromSession != null && typeof existingFromSession === "string") return existingFromSession;
    return "";
  });
  const [dateValue, setDateValue] = useState(() => {
    if (existingFromSession != null && typeof existingFromSession === "string") {
      const d = existingFromSession.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    }
    return new Date().toISOString().split("T")[0];
  });
  const [selectValue, setSelectValue] = useState(() => {
    if (existingFromSession != null && existingFromSession !== "") return String(existingFromSession);
    const options = (((d.widgetConfig as Record<string, unknown>) ?? {}).options as Array<string | { value: string; label: string }>) ?? [];
    const defaultVal = ((d.widgetConfig as Record<string, unknown>) ?? {}).default as string | undefined;
    const required = (d.isRequired as boolean) ?? true;
    if (defaultVal) return defaultVal;
    if (!required) return "";
    const first = options[0];
    return typeof first === "string" ? first : first?.value ?? "";
  });
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  type TableColumn = {
    key: string;
    label: string;
    required?: boolean;
    type?: string;
    format?: string;
    accept?: string;
    multiple?: boolean;
    options?: Array<{ value: string; label: string }> | string[];
  };
  const columns = (widgetConfig.columns as TableColumn[]) ?? [];
  const [passwordValue, setPasswordValue] = useState(() =>
    effectiveInlineWidget === "password_with_confirmation" && existingFromSession != null && typeof existingFromSession === "string" ? existingFromSession : ""
  );
  const [passwordConfirmValue, setPasswordConfirmValue] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<Record<string, unknown>[]>(() =>
    columns.length > 0
      ? [Object.fromEntries(columns.map((c) => [c.key, c.type === "file_upload" ? [] : ""]))]
      : []
  );
  const [listItems, setListItems] = useState<string[]>(() => {
    if (Array.isArray(existingFromSession) && existingFromSession.length > 0) {
      return existingFromSession.filter((v): v is string => typeof v === "string");
    }
    return [""];
  });
  const [tagSelectedValues, setTagSelectedValues] = useState<string[]>(() => {
    const existing = sessionParams?.[questionKey];
    if (Array.isArray(existing)) {
      const fromParams = existing.filter((v): v is string => typeof v === "string");
      if (fromParams.length > 0) return fromParams;
    }
    const defaultTags = (widgetConfig.defaultTags as string[] | undefined);
    return Array.isArray(defaultTags) ? defaultTags : [];
  });
  const [newTagText, setNewTagText] = useState("");
  const [addTagLoading, setAddTagLoading] = useState(false);
  const [addTagError, setAddTagError] = useState<string | null>(null);

  const handleAddTag = useCallback(async () => {
    const name = newTagText.trim();
    if (!name || addTagLoading) return;
    setAddTagError(null);
    setAddTagLoading(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddTagError(data.error ?? "Failed to add tag");
        return;
      }
      const opt = data.option as { value: string; label: string } | undefined;
      if (opt) {
        setDynamicOptions((prev) => {
          if (prev.some((o) => o.value === opt.value)) return prev;
          return [...prev, opt].sort((a, b) => a.label.localeCompare(b.label));
        });
        setTagSelectedValues((prev) =>
          prev.includes(opt.value) ? prev : [...prev, opt.value]
        );
        setNewTagText("");
      }
    } catch {
      setAddTagError("Failed to add tag");
    } finally {
      setAddTagLoading(false);
    }
  }, [newTagText, addTagLoading]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const pending: PendingFile = { file, uploading: true };
      setPendingFiles((prev) => [...prev, pending]);

      try {
        const uploadContext = (widgetConfig.uploadContext as string) || "activity";
        const res = await fetch("/api/media/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            fileSizeBytes: file.size,
            context: uploadContext,
          }),
        });

        if (!res.ok) throw new Error("Failed to get upload URL");

        const { uploadUrl, s3Key } = await res.json();

        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        setPendingFiles((prev) =>
          prev.map((f) =>
            f.file === file ? { ...f, s3Key, uploading: false } : f
          )
        );
      } catch {
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.file === file
              ? { ...f, uploading: false, error: "Upload failed" }
              : f
          )
        );
      }
    }

    e.target.value = "";
  }, [widgetConfig]);

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    setValidationError(null);
    let answer: unknown;
    const widget = effectiveInlineWidget;

    switch (widget) {
      case "date_picker":
        answer = dateValue.slice(0, 10);
        break;
      case "select":
      case "visibility_select":
        answer = selectValue || null;
        break;
      case "file_upload": {
        const fileRefs: FileReference[] = pendingFiles
          .filter((f) => f.s3Key)
          .map((f) => ({
            s3Key: f.s3Key!,
            originalFilename: f.file.name,
            mimeType: f.file.type,
            fileSizeBytes: f.file.size,
          }));
        answer = fileRefs.length > 0 ? fileRefs : null;
        break;
      }
      case "table": {
        const valid = tableRows.filter((row) => {
          const hasAny = columns.some((c) => {
            const v = row[c.key];
            if (c.type === "file_upload") return Array.isArray(v) && v.length > 0;
            return String(v ?? "").trim();
          });
          if (!hasAny) return false;
          return columns.filter((c) => c.required).every((c) => {
            const v = row[c.key];
            if (c.type === "file_upload") return !c.required || (Array.isArray(v) && v.length > 0);
            return String(v ?? "").trim();
          });
        });
        if (paramSchema && valid.length > 0) {
          const result = validateByParamSchema(valid, paramSchema);
          if (!result.valid) {
            setValidationError(result.message ?? "Invalid input");
            return;
          }
        } else {
          for (const row of valid) {
            for (const col of columns) {
              if (col.format === "email") {
                const v = String(row[col.key] ?? "").trim();
                if (v && !isValidEmail(v)) {
                  setValidationError(`Invalid email in row: ${v}`);
                  return;
                }
              }
            }
          }
        }
        answer = valid.length > 0 ? valid : null;
        break;
      }
      case "list": {
        const filled = listItems.filter((s) => s.trim().length > 0);
        const listAnswer = filled.length > 0 ? filled : null;
        if (paramSchema && listAnswer && listAnswer.length > 0) {
          const result = validateByParamSchema(listAnswer, paramSchema);
          if (!result.valid) {
            setValidationError(result.message ?? "Invalid input");
            return;
          }
        }
        answer = listAnswer;
        break;
      }
      case "markdown_editor":
        answer = value.trim() || null;
        break;
      case "tag_select":
        answer = tagSelectedValues.length > 0 ? tagSelectedValues : null;
        break;
      case "password_with_confirmation": {
        const pwd = passwordValue.trim();
        const confirm = passwordConfirmValue.trim();
        if (!pwd && !confirm) {
          answer = null;
          break;
        }
        if (pwd !== confirm) {
          setValidationError("Access code and confirmation do not match");
          return;
        }
        const strengthRules = {
          minLength: widgetConfig.minLength as number | undefined,
          maxLength: widgetConfig.maxLength as number | undefined,
          requireUppercase: widgetConfig.requireUppercase as boolean | undefined,
          requireLowercase: widgetConfig.requireLowercase as boolean | undefined,
          requireDigit: widgetConfig.requireDigit as boolean | undefined,
          requireSpecial: widgetConfig.requireSpecial as boolean | undefined,
          pattern: widgetConfig.pattern as string | undefined,
        };
        const strength = validateAccessCodeStrength(pwd, strengthRules);
        if (!strength.valid) {
          setValidationError(strength.errors[0] ?? "Invalid access code");
          return;
        }
        answer = pwd;
        break;
      }
      case "password":
        answer = value.trim() || null;
        break;
      default: {
        const trimmed = value.trim();
        if (paramSchema && trimmed) {
          const result = validateByParamSchema(trimmed, paramSchema);
          if (!result.valid) {
            setValidationError(result.message ?? "Invalid input");
            return;
          }
        } else if (!paramSchema) {
          const format = (widgetConfig.format as string) ?? (questionKey === "email" ? "email" : null);
          if (format === "email" && trimmed && !isValidEmail(trimmed)) {
            setValidationError("Please enter a valid email address");
            return;
          }
        }
        answer = trimmed || null;
        break;
      }
    }

    if (answer === null && isRequired) return;

    const updatedParams = { ...sessionParams, [questionKey]: answer };
    onQAResponse(optionId, updatedParams, typeof answer === "string" ? answer : undefined);
  };

  const handleSkip = () => {
    const updatedParams = { ...sessionParams, [questionKey]: null };
    onQAResponse(optionId, updatedParams);
  };

  const hasUploadingFiles = pendingFiles.some((f) => f.uploading);
  const hasUploadedFiles = pendingFiles.some((f) => f.s3Key);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{questionText}</p>
        <div className="flex items-center gap-2">
          {!isRequired && (
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              Skip
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive transition"
          >
            <X className="h-3 w-3 shrink-0" />
            <span>Cancel</span>
          </button>
        </div>
      </div>

      {effectiveInlineWidget === "table" && columns.length > 0 ? (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {columns.map((col) => (
                    <th key={col.key} className="px-3 py-2 text-left font-medium">
                      {col.label}
                      {col.required && <span className="text-destructive ml-0.5">*</span>}
                    </th>
                  ))}
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, ri) => (
                  <tr key={ri} className="border-b last:border-0">
                    {columns.map((col) => (
                      <td key={col.key} className="px-3 py-1.5">
                        {col.type === "file_upload" ? (
                          <TableFileUploadCell
                            value={(row[col.key] ?? []) as FileReference[]}
                            onChange={(files) => {
                              setTableRows((prev) => {
                                const next = [...prev];
                                next[ri] = { ...next[ri], [col.key]: files };
                                return next;
                              });
                            }}
                            accept={(col.accept as string) ?? "image/*,video/*"}
                            multiple={!!col.multiple}
                          />
                        ) : col.type === "date" || col.key === "activity_date" ? (
                          <input
                            type="date"
                            value={String(row[col.key] ?? "").slice(0, 10)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTableRows((prev) => {
                                const next = [...prev];
                                next[ri] = {
                                  ...next[ri],
                                  [col.key]: val || "",
                                };
                                return next;
                              });
                            }}
                            className="w-full min-w-[120px] px-2 py-1 rounded border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        ) : col.options && col.options.length > 0 ? (
                          <select
                            value={(row[col.key] ?? "") as string}
                            onChange={(e) => {
                              setTableRows((prev) => {
                                const next = [...prev];
                                next[ri] = { ...next[ri], [col.key]: e.target.value };
                                return next;
                              });
                            }}
                            className="w-full min-w-[100px] px-2 py-1 rounded border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                          >
                            <option value="">{col.label}</option>
                            {(col.options as Array<{ value: string; label: string }>).every(
                              (o) => typeof o === "object" && "value" in o
                            )
                              ? (col.options as Array<{ value: string; label: string }>).map(
                                  (opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  )
                                )
                              : (col.options as string[]).map((opt) => (
                                  <option key={opt} value={opt}>
                                    {String(opt).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                  </option>
                                ))}
                          </select>
                        ) : (
                          <input
                            type={col.format === "email" ? "email" : "text"}
                            inputMode={
                              col.type === "number" || col.format === "number" || col.format === "currency"
                                ? "decimal"
                                : undefined
                            }
                            value={(row[col.key] ?? "") as string}
                            onChange={(e) => {
                              const v = e.target.value;
                              const isNumeric =
                                col.type === "number" || col.format === "number" || col.format === "currency";
                              const filtered = isNumeric
                                ? v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
                                : v;
                              setTableRows((prev) => {
                                const next = [...prev];
                                next[ri] = { ...next[ri], [col.key]: filtered };
                                return next;
                              });
                              setValidationError(null);
                            }}
                            placeholder={col.format === "email" ? "e.g. user@example.com" : col.label}
                            className="w-full px-2 py-1 rounded border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                          />
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => setTableRows((prev) => prev.filter((_, i) => i !== ri))}
                        className="p-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setTableRows((prev) => [
                  ...prev,
                  Object.fromEntries(columns.map((c) => [c.key, c.type === "file_upload" ? [] : ""])),
                ])
              }
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Add row
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Continue
            </button>
          </div>
        </div>
      ) : effectiveInlineWidget === "list" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {listItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    setListItems((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    });
                  }}
                  placeholder={(widgetConfig.placeholder as string) ?? "Item"}
                  className="flex-1 px-3 py-2 rounded-lg border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={() => setListItems((prev) => prev.filter((_, j) => j !== i))}
                  className="p-2 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setListItems((prev) => [...prev, ""])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              {(widgetConfig.addLabel as string) ?? "Add item"}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Continue
            </button>
          </div>
        </div>
      ) : effectiveInlineWidget === "markdown_editor" ? (
        <div className="space-y-2">
          <RichMarkdownEditor
            value={value}
            onChange={setValue}
            placeholder={(widgetConfig.placeholder as string) ?? "Enter content (use toolbar for formatting)..."}
            minRows={Math.max(6, (widgetConfig.minRows as number) ?? 6)}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Continue
            </button>
          </div>
        </div>
      ) : effectiveInlineWidget === "tag_select" ? (
        <div className="space-y-3">
          {dynamicLoading ? (
            <div className="px-3 py-2 rounded-lg border bg-muted/50 text-sm text-muted-foreground">
              Loading tags...
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {dynamicOptions.map((opt) => {
                const checked = tagSelectedValues.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTagSelectedValues((prev) =>
                        checked ? prev.filter((v) => v !== opt.value) : [...prev, opt.value]
                      );
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition text-left ${
                      checked ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/30 border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-sm">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newTagText}
              onChange={(e) => {
                setNewTagText(e.target.value);
                setAddTagError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
              placeholder="Add new tag..."
              className="flex-1 min-w-[120px] px-3 py-1.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!newTagText.trim() || addTagLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {addTagLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Add
            </button>
          </div>
          {addTagError && (
            <p className="text-xs text-destructive">{addTagError}</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Continue
            </button>
          </div>
        </div>
      ) : effectiveInlineWidget === "file_upload" ? (
        <div className="space-y-2">
          {currentAvatarUrl && questionKey === "avatar_keys" && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Current profile picture</p>
              <img
                src={currentAvatarUrl}
                alt="Current avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-muted"
              />
            </div>
          )}
          {currentBannerUrl && questionKey === "banner_keys" && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Current banner image</p>
              <img
                src={currentBannerUrl}
                alt="Current banner"
                className="w-full max-h-32 object-cover rounded-lg border-2 border-muted"
              />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple={!!widgetConfig.multiple}
            accept={(widgetConfig.accept as string) ?? "image/*,video/*"}
            className="hidden"
            onChange={handleFileSelect}
          />

          {pendingFiles.length > 0 && (
            <FilePreviewGrid files={pendingFiles} onRemove={removeFile} />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={hasUploadingFiles}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition disabled:opacity-40"
            >
              <Upload className="h-4 w-4" />
              {pendingFiles.length > 0 ? "Add more files" : "Choose files"}
            </button>

            {hasUploadedFiles && (
              <button
                onClick={handleSubmit}
                disabled={hasUploadingFiles}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      ) : effectiveInlineWidget === "password_with_confirmation" ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Access code</label>
            <div className="relative flex items-center gap-2">
              <input
                type={passwordVisible ? "text" : "password"}
                value={passwordValue}
                onChange={(e) => {
                  setPasswordValue(e.target.value);
                  setValidationError(null);
                }}
                placeholder={(widgetConfig.placeholder as string) ?? "e.g. ACME-7X9K"}
                className="flex-1 px-3 py-2 rounded-lg border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
              />
              <button
                type="button"
                onClick={() => setPasswordVisible((v) => !v)}
                className="p-2 rounded text-muted-foreground hover:text-foreground"
                aria-label={passwordVisible ? "Hide" : "Show"}
              >
                {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Confirm access code</label>
            <div className="relative flex items-center gap-2">
              <input
                type={confirmVisible ? "text" : "password"}
                value={passwordConfirmValue}
                onChange={(e) => {
                  setPasswordConfirmValue(e.target.value);
                  setValidationError(null);
                }}
                placeholder="Re-enter to confirm"
                className="flex-1 px-3 py-2 rounded-lg border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
              />
              <button
                type="button"
                onClick={() => setConfirmVisible((v) => !v)}
                className="p-2 rounded text-muted-foreground hover:text-foreground"
                aria-label={confirmVisible ? "Hide" : "Show"}
              >
                {confirmVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {validationError && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}
          <div className="flex justify-end gap-2">
            {!isRequired && (
              <button
                onClick={() => {
                  setValidationError(null);
                  onQAResponse(optionId, { ...sessionParams, [questionKey]: null });
                }}
                className="px-3 py-1.5 rounded-lg border text-sm text-muted-foreground hover:bg-muted/50"
              >
                Skip (auto-generate)
              </button>
            )}
            <button
              onClick={handleSubmit}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Continue
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          {effectiveInlineWidget === "date_picker" ? (
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          ) : effectiveInlineWidget === "select" || effectiveInlineWidget === "visibility_select" ? (
            dynamicLoading ? (
              <div className="flex-1 px-3 py-2 rounded-lg border bg-muted/50 text-sm text-muted-foreground">
                Loading options...
              </div>
            ) : (
              <select
                value={selectValue}
                onChange={(e) => setSelectValue(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {!isRequired && (
                  <option value="">{(widgetConfig.placeholder as string) ?? "Select..."}</option>
                )}
                {dynamicOptions.length > 0
                  ? dynamicOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))
                  : (() => {
                      const opts = (widgetConfig.options as Array<string | { value: string; label: string }>) ?? [];
                      return opts.map((opt) => {
                        const val = typeof opt === "string" ? opt : opt.value;
                        const label = typeof opt === "string"
                          ? opt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                          : opt.label;
                        return (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        );
                      });
                    })()}
              </select>
            )
          ) : (
            <div className="flex-1 space-y-1 min-w-0">
              <input
                type={questionKey === "email" || widgetConfig.format === "email" ? "email" : "text"}
                inputMode={
                  questionKey === "email" || widgetConfig.format === "email"
                    ? "email"
                    : paramSchema?.type === "number" || widgetConfig.format === "number" || widgetConfig.format === "currency"
                      ? "decimal"
                      : "text"
                }
                value={value}
                onChange={(e) => {
                  const v = e.target.value;
                  const isNumeric =
                    paramSchema?.type === "number" || widgetConfig.format === "number" || widgetConfig.format === "currency";
                  const filtered = isNumeric
                    ? v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
                    : v;
                  setValue(filtered);
                  setValidationError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder={
                  questionKey === "email"
                    ? "e.g. user@example.com"
                    : (widgetConfig.placeholder as string) ?? "Type your answer..."
                }
                className="w-full px-3 py-2 rounded-lg border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {validationError && (
                <p className="text-xs text-destructive">{validationError}</p>
              )}
            </div>
          )}

          <button
            onClick={handleSubmit}
            className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function TableFileUploadCell({
  value,
  onChange,
  accept,
  multiple,
}: {
  value: FileReference[];
  onChange: (files: FileReference[]) => void;
  accept: string;
  multiple: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);

  const handleSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        const p: PendingFile = { file, uploading: true };
        setPending((prev) => [...prev, p]);
        try {
          const res = await fetch("/api/media/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type,
              fileSizeBytes: file.size,
              context: "activity",
            }),
          });
          if (!res.ok) throw new Error("Failed to get upload URL");
          const { uploadUrl, s3Key } = await res.json();
          await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          const ref: FileReference = {
            s3Key: s3Key as string,
            originalFilename: file.name,
            mimeType: file.type,
            fileSizeBytes: file.size,
          };
          onChange([...value, ref]);
          setPending((prev) => prev.filter((x) => x.file !== file));
        } catch {
          setPending((prev) => prev.map((x) => (x.file === file ? { ...x, uploading: false, error: "Failed" } : x)));
        }
      }
      e.target.value = "";
    },
    [value, onChange]
  );

  const removeFile = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1 min-w-[120px]">
      <div className="flex flex-wrap gap-1">
        {value.map((f, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-xs truncate max-w-[100px]"
          >
            {f.originalFilename?.slice(0, 12) ?? "file"}
            <button
              type="button"
              onClick={() => removeFile(i)}
              className="ml-0.5 text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {pending.map((p, i) => (
          <span key={`p-${i}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 text-xs">
            <span className="w-2.5 h-2.5 border border-primary/30 border-t-primary rounded-full animate-spin" />
            {p.file.name.slice(0, 10)}
          </span>
        ))}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleSelect}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <Upload className="h-3 w-3" />
        {value.length > 0 ? "Add more" : "Add files"}
      </button>
    </div>
  );
}

function FilePreviewGrid({
  files,
  onRemove,
}: {
  files: PendingFile[];
  onRemove: (index: number) => void;
}) {
  const previews = useMemo(
    () =>
      files.map((pf) =>
        pf.file.type.startsWith("image/") ? URL.createObjectURL(pf.file) : null
      ),
    [files]
  );

  useEffect(() => {
    return () => previews.forEach((url) => url && URL.revokeObjectURL(url));
  }, [previews]);

  return (
    <div className="grid grid-cols-3 gap-2">
      {files.map((pf, i) => {
        const previewUrl = previews[i];
        return previewUrl ? (
          <div key={i} className="relative group rounded-lg overflow-hidden bg-muted aspect-square">
            <img src={previewUrl} alt={pf.file.name} className="w-full h-full object-cover" />
            {pf.uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
            {pf.error && (
              <div className="absolute inset-0 bg-destructive/60 flex items-center justify-center">
                <span className="text-white text-xs font-medium">Failed</span>
              </div>
            )}
            {!pf.uploading && (
              <button
                onClick={() => onRemove(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : (
          <div key={i} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-muted text-xs col-span-1">
            <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            {pf.uploading && (
              <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
            )}
            <span className="truncate">{pf.file.name}</span>
            {pf.error && <span className="text-destructive text-[10px]">Failed</span>}
            {!pf.uploading && (
              <button onClick={() => onRemove(i)} className="ml-auto text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
