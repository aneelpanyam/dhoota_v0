"use client";

import { useRef, useCallback } from "react";
import type { Widget, WidgetAction } from "@/types/api";
import ReactMarkdown from "react-markdown";
import { Download } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

interface ChartData {
  chartType: string;
  title: string;
  labels: string[];
  datasets: { label: string; data: number[] }[];
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
  const charts = (d.charts ?? []) as ChartData[];
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
        {charts.map((chart, i) => {
          const chartData = chart.labels.map((label, idx) => {
            const point: Record<string, unknown> = { name: label };
            chart.datasets.forEach((ds) => {
              point[ds.label] = ds.data[idx];
            });
            return point;
          });

          return (
            <div key={i} className="rounded-lg border bg-muted/30 p-4">
              {chart.title && <h4 className="font-semibold text-sm mb-3">{chart.title}</h4>}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {chart.chartType === "bar" ? (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      {chart.datasets.map((ds, di) => (
                        <Bar key={ds.label} dataKey={ds.label} fill={COLORS[di % COLORS.length]} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  ) : chart.chartType === "line" ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      {chart.datasets.map((ds, di) => (
                        <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={COLORS[di % COLORS.length]} strokeWidth={2} />
                      ))}
                    </LineChart>
                  ) : chart.chartType === "pie" || chart.chartType === "donut" ? (
                    <PieChart>
                      <Pie
                        data={chartData.map((d, idx) => ({ ...d, value: chart.datasets[0]?.data[idx] ?? 0 }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={chart.chartType === "donut" ? 60 : 0}
                        outerRadius={80}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  ) : (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey={chart.datasets[0]?.label ?? "value"} fill={COLORS[0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}

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
