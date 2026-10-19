import { CATEGORIES, type CategoryId } from "../_lib/categories.ts";
import { tint } from "./tint.ts";

// The ten categories. Hovering or focusing one dims every other category in
// the table; pressing one pins it until it is pressed again.
export function Legend({
  pinned,
  onPreview,
  onPin,
}: {
  pinned: CategoryId | null;
  onPreview: (id: CategoryId | null) => void;
  onPin: (id: CategoryId) => void;
}) {
  return (
    <ul className="legend" aria-label="Categories">
      {CATEGORIES.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            className="legend-item tint"
            data-legend={c.id}
            aria-pressed={pinned === c.id}
            style={tint(c)}
            onPointerEnter={() => onPreview(c.id)}
            onPointerLeave={() => onPreview(null)}
            onFocus={() => onPreview(c.id)}
            onBlur={() => onPreview(null)}
            onClick={() => onPin(c.id)}
          >
            <span className="swatch" aria-hidden="true" />
            {c.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
