"use client";

import type { Widget, WidgetAction, WidgetType } from "@/types/api";
import type { ContextItem } from "@/components/chat/ContextStrip";
import { TextResponseWidget } from "./TextResponseWidget";
import { ActivityCardWidget } from "./ActivityCardWidget";
import { DataListWidget } from "./DataListWidget";
import { DataTableWidget } from "./DataTableWidget";
import { ChartWidget } from "./ChartWidget";
import { StatsCardWidget } from "./StatsCardWidget";
import { MediaGalleryWidget } from "./MediaGalleryWidget";
import { ConfirmationCardWidget } from "./ConfirmationCardWidget";
import { QuestionCardWidget } from "./QuestionCardWidget";
import { DefaultOptionsMenuWidget } from "./DefaultOptionsMenuWidget";
import { ErrorCardWidget } from "./ErrorCardWidget";
import { ContextPickerWidget } from "./ContextPickerWidget";
import { CalendarWidget } from "./CalendarWidget";
import { TimelineWidget } from "./TimelineWidget";

export interface WidgetRendererProps {
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
  onPinToContext?: (item: ContextItem) => void;
}

const widgetMap: Record<WidgetType, React.ComponentType<WidgetRendererProps>> = {
  text_response: TextResponseWidget,
  activity_card: ActivityCardWidget,
  data_list: DataListWidget,
  data_table: DataTableWidget,
  chart: ChartWidget,
  stats_card: StatsCardWidget,
  media_gallery: MediaGalleryWidget,
  confirmation_card: ConfirmationCardWidget,
  question_card: QuestionCardWidget,
  default_options_menu: DefaultOptionsMenuWidget,
  error_card: ErrorCardWidget,
  context_picker: ContextPickerWidget,
  calendar: CalendarWidget,
  timeline: TimelineWidget,
  tag_cloud: TextResponseWidget,
  summary: TextResponseWidget,
  conversation_thread: TextResponseWidget,
  code_list: TextResponseWidget,
  website_preview: TextResponseWidget,
  status_ticket: TextResponseWidget,
};

export function WidgetRenderer(props: WidgetRendererProps) {
  const Component = widgetMap[props.widget.type] ?? TextResponseWidget;
  return <Component {...props} />;
}
