import { useState, type ElementType, type MouseEvent } from "react";
import { translate, langMeta } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n-context";
import { Languages } from "lucide-react";

/**
 * Renders user-generated content translated to the viewer's display language.
 * - Global "Show original" toggle (in header) flips every instance to source text.
 * - Tap any item to reveal its original inline (per-item override).
 * - Do NOT wrap: plates, names, models, SOP codes, skill levels.
 */
export function TranslatedText({
  text,
  className,
  as: As = "span",
  showBadge = false,
}: {
  text: string;
  className?: string;
  as?: ElementType;
  showBadge?: boolean;
}) {
  const { lang, showOriginal } = useI18n();
  const [reveal, setReveal] = useState(false);
  const target = lang ?? "en";
  const { text: translated, source, translated: didTranslate } = translate(text, target);
  const display = showOriginal || reveal ? text : translated;

  return (
    <As
      className={className}
      onClick={
        didTranslate
          ? (e: MouseEvent) => {
              e.stopPropagation();
              setReveal((r) => !r);
            }
          : undefined
      }
      title={didTranslate ? `${langMeta(source).flag} ${langMeta(source).label}` : undefined}
      style={didTranslate ? { cursor: "pointer" } : undefined}
    >
      {display}
      {didTranslate && showBadge && (
        <span className="ml-1 inline-flex items-center gap-0.5 align-middle text-[9px] font-medium text-muted-foreground">
          <Languages className="h-2.5 w-2.5" />
          {showOriginal || reveal ? langMeta(source).flag : langMeta(target).flag}
        </span>
      )}
    </As>
  );
}
