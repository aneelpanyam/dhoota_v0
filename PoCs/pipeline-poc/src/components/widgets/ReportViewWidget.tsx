"use client";

import { useRef, useCallback } from "react";
import type { Widget, WidgetAction } from "@/types/api";
import ReactMarkdown from "react-markdown";
import { Download } from "lucide-react";

interface DataItemSection {
  title: string;
  items: Record<string, unknown>[];
  columns: { key: string; label: string }[];
}

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
}

export function ReportViewWidget({ widget }: Props) {
  const d = widget.data;
  const dataItems = (d.dataItems ?? []) as DataItemSection[];
  const insights = (d.insights as string) ?? "";
  const filterId = d.filterId as string | undefined;
  const reportRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = useCallback(async () => {
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF } = await import("jspdf");

      const element = reportRef.current;
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      if (imgHeight > pdfHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, pdfHeight);
        const remaining = imgHeight - pdfHeight;
        if (remaining > 0) {
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, -pdfHeight, imgWidth, imgHeight);
        }
      } else {
        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      }

      pdf.save(`report-${filterId ?? "export"}-${Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    }
  }, [filterId]);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div ref={reportRef} className="p-4 space-y-6">
        {dataItems.map((section, i) => (
          <div key={i} className="rounded-lg border bg-muted/30 p-4">
            {section.title && <h4 className="font-semibold text-sm mb-3">{section.title}</h4>}
            {section.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {section.columns.map((col) => (
                        <th key={col.key} className="text-left py-2 px-2 font-medium">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((row, ri) => (
                      <tr key={ri} className="border-b last:border-0">
                        {section.columns.map((col) => (
                          <td key={col.key} className="py-2 px-2">
                            {String(row[col.key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No data</p>
            )}
          </div>
        ))}

        {insights && (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{insights}</ReactMarkdown>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t bg-muted/20 flex justify-end">
        <button
          onClick={handleDownloadPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <Download className="h-4 w-4" />
          Download all as PDF
        </button>
      </div>
    </div>
  );
}
