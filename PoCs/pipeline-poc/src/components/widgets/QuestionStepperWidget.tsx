"use client";

import { useState } from "react";
import type { Widget, WidgetAction } from "@/types/api";
import { QuestionCardWidget } from "./QuestionCardWidget";
import { ChevronLeft } from "lucide-react";
import { getOptionDisplayName, getOptionHeaderGuidance } from "@/lib/options/display-names";

interface QuestionData {
  questionText: string;
  questionKey: string;
  inlineWidget?: string | null;
  widgetConfig?: Record<string, unknown>;
  isRequired?: boolean;
  paramSchema?: Record<string, unknown>;
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

export function QuestionStepperWidget({
  widget,
  onQAResponse,
  onCancel,
}: Props) {
  const d = widget.data;
  const optionId = d.optionId as string;
  const questions = (d.questions ?? []) as QuestionData[];
  const sessionParams = (d.sessionParams as Record<string, unknown>) ?? {};
  const entityContext = d.entityContext;
  const currentAvatarUrl = d.currentAvatarUrl as string | undefined;
  const currentBannerUrl = d.currentBannerUrl as string | undefined;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [collectedParams, setCollectedParams] = useState<Record<string, unknown>>({});

  if (questions.length === 0) return null;

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const isFirstQuestion = currentIndex === 0;

  const effectiveSessionParams = { ...sessionParams, ...collectedParams };

  const virtualWidget: Widget = {
    id: widget.id,
    type: "question_card",
    data: {
      questionText: currentQuestion.questionText,
      questionKey: currentQuestion.questionKey,
      inlineWidget: currentQuestion.inlineWidget ?? null,
      widgetConfig: currentQuestion.widgetConfig ?? {},
      isRequired: currentQuestion.isRequired ?? true,
      optionId,
      sessionParams: effectiveSessionParams,
      entityContext,
      currentAvatarUrl: currentQuestion.questionKey === "avatar_keys" ? currentAvatarUrl : undefined,
      currentBannerUrl: currentQuestion.questionKey === "banner_keys" ? currentBannerUrl : undefined,
      paramSchema: currentQuestion.paramSchema ?? undefined,
    },
    bookmarkable: false,
  };

  const handleInterceptedQAResponse = (
    _optionId: string,
    params: Record<string, unknown>,
    content?: string
  ) => {
    const newCollected = { ...collectedParams, [currentQuestion.questionKey]: params[currentQuestion.questionKey] };

    if (isLastQuestion) {
      onQAResponse(optionId, { ...sessionParams, ...newCollected }, content);
    } else {
      setCollectedParams(newCollected);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const optionDisplayName = getOptionDisplayName(
    optionId,
    optionId.replace(/^[^.]+\./, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
  const headerGuidance = getOptionHeaderGuidance(optionId, optionDisplayName);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm pr-10 md:pr-0">
        <h3 className="font-semibold text-foreground">{headerGuidance}</h3>
        {questions.length > 1 ? (
          <span className="text-muted-foreground ml-auto">
            Question {currentIndex + 1} of {questions.length}
          </span>
        ) : null}
      </div>
      {questions.length > 1 && !isFirstQuestion && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground pr-10 md:pr-0">
          <button
            onClick={() => setCurrentIndex((prev) => prev - 1)}
            className="flex items-center gap-2 hover:text-foreground transition shrink-0"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span>Back</span>
          </button>
        </div>
      )}
      <QuestionCardWidget
        widget={virtualWidget}
        onAction={() => {}}
        onOptionSelect={() => {}}
        onConfirm={() => {}}
        onQAResponse={handleInterceptedQAResponse}
        onCancel={onCancel}
      />
    </div>
  );
}
