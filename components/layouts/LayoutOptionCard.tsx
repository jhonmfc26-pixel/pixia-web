import { LayoutDefinition } from "@/lib/layouts/types";
import LayoutPreview from "./LayoutPreview";

type Props = {
  layout: LayoutDefinition;
  score: number;
  isCurrent: boolean;
  onClick: () => void;
};

export default function LayoutOptionCard({
  layout,
  score,
  isCurrent,
  onClick,
}: Props) {
  return (
    <button
      onClick={onClick}
      className={`
        relative rounded-xl border p-3 text-left transition
        ${isCurrent ? "border-black" : "border-black/10 hover:border-black/30"}
      `}
    >
      {/* BADGES */}
      <div className="absolute top-2 right-2 flex gap-1">
        {score > 0.75 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500 text-white">
            ⭐ Recomendado
          </span>
        )}
        {isCurrent && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-black text-white">
            Actual
          </span>
        )}
      </div>

      <LayoutPreview layout={layout} />

      <div className="mt-3">
        <p className="text-sm font-medium">{layout.name}</p>
        <p className="text-xs text-black/50 capitalize">
          {layout.intent}
        </p>
      </div>
    </button>
  );
}
