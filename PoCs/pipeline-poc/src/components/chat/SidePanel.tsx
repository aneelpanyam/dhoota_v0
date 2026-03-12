"use client";

import { X } from "lucide-react";

export interface InfoCard {
  id: string;
  title: string;
  content: unknown;
  card_type: string;
  icon?: string;
  display_order: number;
}

interface SidePanelProps {
  cards: InfoCard[];
  isOpen: boolean;
  onClose: () => void;
}

const CARD_TYPE_LABELS: Record<string, string> = {
  about: "About",
  contact: "Contact",
  services: "Services",
  custom: "Custom",
};

function getSectionLabel(cardType: string): string {
  const normalized = cardType.toLowerCase().replace(/\s+/g, "_");
  return CARD_TYPE_LABELS[normalized] ?? cardType;
}

function renderContent(content: unknown): React.ReactNode {
  if (content === null || content === undefined) return null;
  if (typeof content === "string") return content;
  if (typeof content === "number" || typeof content === "boolean") return String(content);
  if (Array.isArray(content)) {
    return (
      <ul className="list-disc list-inside space-y-1 text-sm">
        {content.map((item, i) => (
          <li key={i}>{renderContent(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof content === "object") {
    const entries = Object.entries(content as Record<string, unknown>);
    return (
      <dl className="space-y-1.5 text-sm">
        {entries.map(([key, val]) => (
          <div key={key}>
            <dt className="font-medium text-muted-foreground capitalize">
              {key.replace(/_/g, " ")}
            </dt>
            <dd className="ml-0 mt-0.5">{renderContent(val)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return null;
}

export function SidePanel({ cards, isOpen, onClose }: SidePanelProps) {
  const grouped = cards.reduce<Record<string, InfoCard[]>>((acc, card) => {
    const key = card.card_type.toLowerCase().replace(/\s+/g, "_") || "custom";
    if (!acc[key]) acc[key] = [];
    acc[key].push(card);
    return acc;
  }, {});

  const sectionOrder = ["about", "contact", "services", "custom"];
  const sortedSections = Object.keys(grouped).sort(
    (a, b) =>
      (sectionOrder.indexOf(a) === -1 ? 99 : sectionOrder.indexOf(a)) -
      (sectionOrder.indexOf(b) === -1 ? 99 : sectionOrder.indexOf(b))
  );

  const panelContent = (
    <>
      <div className="flex items-center justify-between h-14 px-4 border-b shrink-0">
        <h3 className="font-semibold text-foreground">Info</h3>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
          aria-label="Close panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No info cards available.</p>
        ) : (
          sortedSections.map((sectionKey) => {
            const sectionCards = grouped[sectionKey]
              .slice()
              .sort((a, b) => a.display_order - b.display_order);
            return (
              <section key={sectionKey}>
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                  {getSectionLabel(sectionKey)}
                </h4>
                <div className="space-y-3">
                  {sectionCards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-lg border bg-card p-3 shadow-sm"
                    >
                      <h5 className="font-medium text-foreground mb-2">
                        {card.title}
                      </h5>
                      <div className="text-muted-foreground">
                        {renderContent(card.content)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <div className="hidden lg:flex w-72 shrink-0 flex-col border-l bg-muted/30">
        {panelContent}
      </div>

      {/* Mobile: overlay panel */}
      {isOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="lg:hidden fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] bg-background flex flex-col shadow-xl animate-in slide-in-from-right duration-200 border-l">
            {panelContent}
          </div>
        </>
      )}
    </>
  );
}
