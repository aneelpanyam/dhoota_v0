export interface ActivityCardData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  visibility: string;
  activityDate: string;
  location: string | null;
  tags: { id: string; name: string; color: string | null }[];
  media: { id: string; url: string; mimeType: string; originalFilename: string }[];
  noteCount: number;
}

export interface DataListItem {
  id: string;
  [key: string]: unknown;
}

export interface DataListColumn {
  key: string;
  label: string;
  sortable?: boolean;
}

export interface DataListData {
  items: DataListItem[];
  columns: DataListColumn[];
  totalItems: number;
  page: number;
  pageSize: number;
}

export interface DataTableData {
  headers: string[];
  rows: (string | number)[][];
  totalRows: number;
}

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
}

export interface ChartData {
  chartType: "bar" | "line" | "pie" | "area" | "donut";
  title: string;
  subtitle?: string;
  labels: string[];
  datasets: ChartDataset[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface StatsCardData {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "flat";
}

export interface MediaGalleryData {
  items: {
    id: string;
    url: string;
    thumbnailUrl?: string;
    mimeType: string;
    filename: string;
    width?: number;
    height?: number;
  }[];
}

export interface ConfirmationCardData {
  title: string;
  fields: { label: string; value: string; inferred?: boolean }[];
  suggestedTags?: { name: string; confidence: number }[];
  optionId: string;
  params: Record<string, unknown>;
}

export interface QuestionCardData {
  questionText: string;
  questionKey: string;
  inlineWidget: string | null;
  widgetConfig: Record<string, unknown>;
  optionId: string;
  sessionParams: Record<string, unknown>;
  paramSchema?: Record<string, unknown>;
}

export interface DefaultOptionsMenuData {
  title: string;
  options: {
    optionId: string;
    name: string;
    icon: string;
    description?: string;
  }[];
}

export interface ErrorCardData {
  message: string;
  retryable: boolean;
  details?: string;
}

export interface TextResponseData {
  text: string;
}
