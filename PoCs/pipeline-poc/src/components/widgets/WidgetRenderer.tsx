"use client";

import type { Widget, WidgetAction, WidgetType, OptionReference } from "@/types/api";
import type { ContextItem } from "@/components/chat/ContextStrip";
import { TextResponseWidget } from "./TextResponseWidget";
import { ActivityCardWidget } from "./ActivityCardWidget";
import { DataListWidget } from "./DataListWidget";
import { DataTableWidget } from "./DataTableWidget";
import { ChartWidget } from "./ChartWidget";
import { StatsCardWidget } from "./StatsCardWidget";
import { StatsGridWidget } from "./StatsGridWidget";
import { MediaGalleryWidget } from "./MediaGalleryWidget";
import { ConfirmationCardWidget } from "./ConfirmationCardWidget";
import { QuestionCardWidget } from "./QuestionCardWidget";
import { QuestionStepperWidget } from "./QuestionStepperWidget";
import { ReportViewWidget } from "./ReportViewWidget";
import { DefaultOptionsMenuWidget } from "./DefaultOptionsMenuWidget";
import { ErrorCardWidget } from "./ErrorCardWidget";
import { ContextPickerWidget } from "./ContextPickerWidget";
import { CalendarWidget } from "./CalendarWidget";
import { TimelineWidget } from "./TimelineWidget";
import { InfoCardWidget } from "./InfoCardWidget";
import { AnnouncementCardWidget } from "./AnnouncementCardWidget";
import { WelcomeMessageWidget } from "./WelcomeMessageWidget";
import { PublicProfileWidget } from "./PublicProfileWidget";

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
  headerActions?: OptionReference[];
}

const widgetMap: Record<WidgetType, React.ComponentType<WidgetRendererProps>> = {
  text_response: TextResponseWidget,
  activity_card: ActivityCardWidget,
  data_list: DataListWidget,
  data_table: DataTableWidget,
  chart: ChartWidget,
  stats_card: StatsCardWidget,
  stats_grid: StatsGridWidget,
  media_gallery: MediaGalleryWidget,
  confirmation_card: ConfirmationCardWidget,
  question_card: QuestionCardWidget,
  question_stepper: QuestionStepperWidget,
  report_view: ReportViewWidget,
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
  info_card: InfoCardWidget,
  announcement_card: AnnouncementCardWidget,
  welcome_message: WelcomeMessageWidget,
  public_profile: PublicProfileWidget,
};

export function WidgetRenderer(props: WidgetRendererProps) {
  const Component = widgetMap[props.widget.type] ?? TextResponseWidget;
  return <Component {...props} />;
}
