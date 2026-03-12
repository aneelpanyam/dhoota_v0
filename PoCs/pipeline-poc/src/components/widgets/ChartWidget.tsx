"use client";

import type { Widget, WidgetAction } from "@/types/api";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
}

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

export function ChartWidget({ widget }: Props) {
  const d = widget.data;
  const chartType = (d.chartType as string) ?? "bar";
  const title = d.title as string;
  const subtitle = d.subtitle as string | undefined;
  const labels = (d.labels as string[]) ?? [];
  const datasets = (d.datasets as { label: string; data: number[]; color?: string }[]) ?? [];

  const chartData = labels.map((label, i) => {
    const point: Record<string, unknown> = { name: label };
    datasets.forEach((ds) => {
      point[ds.label] = ds.data[i];
    });
    return point;
  });

  return (
    <div className="rounded-xl border bg-card p-4">
      {title && <h4 className="font-semibold text-sm mb-1">{title}</h4>}
      {subtitle && <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>}

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {datasets.map((ds, i) => (
                <Bar key={ds.label} dataKey={ds.label} fill={ds.color ?? COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {datasets.map((ds, i) => (
                <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={ds.color ?? COLORS[i % COLORS.length]} strokeWidth={2} />
              ))}
            </LineChart>
          ) : chartType === "area" ? (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {datasets.map((ds, i) => (
                <Area key={ds.label} type="monotone" dataKey={ds.label} fill={ds.color ?? COLORS[i % COLORS.length]} stroke={ds.color ?? COLORS[i % COLORS.length]} fillOpacity={0.3} />
              ))}
            </AreaChart>
          ) : chartType === "pie" || chartType === "donut" ? (
            <PieChart>
              <Pie
                data={chartData.map((d, i) => ({ ...d, value: datasets[0]?.data[i] ?? 0 }))}
                cx="50%"
                cy="50%"
                innerRadius={chartType === "donut" ? 60 : 0}
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
              <Bar dataKey={datasets[0]?.label ?? "value"} fill={COLORS[0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
