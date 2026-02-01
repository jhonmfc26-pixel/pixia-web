import { LayoutDefinition } from "@/lib/layouts/types";

type Props = {
  layout: LayoutDefinition;
};

export default function LayoutPreview({ layout }: Props) {
  return (
    <div className="relative w-full aspect-[3/4] bg-neutral-100 rounded-md overflow-hidden">
      {layout.slots.map((slot) => (
        <div
          key={slot.id}
          className="absolute bg-black/20 rounded-sm"
          style={{
            left: `${slot.area.x * 100}%`,
            top: `${slot.area.y * 100}%`,
            width: `${slot.area.width * 100}%`,
            height: `${slot.area.height * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
