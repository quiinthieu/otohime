import { NOTEBOOK_LEAVES, type DeskKind } from "@/lib/desk";

// The desk's objects, seen from above, drawn in the site's ink and swatches
// (desk.css). Each is decoration inside its link: the link's text is the label.
// Every object carries a strip of washi tape, the drag handle on touch.

// The notebook hands each leaf's element to leafRef, which turns it (ink-desk.tsx).
type LeafRef = (i: number, el: HTMLElement | null) => void;

export function DeskArt({ kind, id, label, leafRef }: { kind: DeskKind; id: string; label: string; leafRef?: LeafRef }) {
  switch (kind) {
    case "notebook":
      return <Notebook label={label} leafRef={leafRef} />;
    case "polaroid":
      return <Polaroid label={label} tone={id === "sketches" ? "pink" : "blue"} />;
    case "cassette":
      return <Cassette label={label} />;
    case "console":
      return <Console label={label} />;
  }
}

// The first page lies under the leaves: the cover, then plain pages. Each leaf hinges on the spine (desk.css)
// with a face for each side; the back of a turned leaf lies open on the left.
function Notebook({ label, leafRef }: { label: string; leafRef?: LeafRef }) {
  return (
    <span className="desk-book">
      <svg viewBox="0 0 240 170" className="desk-art" aria-hidden="true">
        <rect x={6} y={8} width={228} height={156} rx={6} className="desk-shadow" />
        <rect x={2} y={2} width={228} height={156} rx={6} className="desk-paper" />
        <text x={126} y={56} textAnchor="middle" className="desk-hand">
          {label}
        </text>
        <path d="M44 84h164M44 102h164M44 120h164M44 138h110" className="desk-rule desk-faint" />
      </svg>
      {Array.from({ length: NOTEBOOK_LEAVES }, (_, i) => (
        <span
          key={i}
          ref={(el) => leafRef?.(i, el)}
          className="desk-leaf"
          data-leaf={i}
          style={{ zIndex: NOTEBOOK_LEAVES - i }}
          aria-hidden="true"
        >
          {/* the cover's inside is plain; the first page, seen when the cover peeks open, carries the title */}
          <span className="desk-leaf-face">{i === 0 ? <Cover label={label} /> : <Page title={i === 1 ? label : undefined} />}</span>
          <span className="desk-leaf-face desk-leaf-back">
            <Page ruled={i > 0} />
          </span>
        </span>
      ))}
    </span>
  );
}

function Cover({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 240 170" className="desk-art">
      <rect x={2} y={2} width={228} height={156} rx={6} className="desk-cover" />
      <rect x={2} y={2} width={22} height={156} rx={4} className="desk-spine" />
      <path d="M190 2v156" className="desk-band" />
      <rect x={70} y={44} width={120} height={48} rx={3} className="desk-paper" />
      <text x={130} y={74} textAnchor="middle" className="desk-hand">
        {label}
      </text>
      <path d="M78 104h104M78 116h80" className="desk-rule" />
    </svg>
  );
}

function Page({ title, ruled = true }: { title?: string; ruled?: boolean }) {
  return (
    <svg viewBox="0 0 240 170" className="desk-art">
      <rect x={2} y={2} width={228} height={156} rx={6} className="desk-paper" />
      {title && (
        <text x={126} y={44} textAnchor="middle" className="desk-hand">
          {title}
        </text>
      )}
      {ruled && (
        <path
          d={title ? "M30 76h180M30 94h180M30 112h180M30 130h120" : "M30 40h180M30 58h180M30 76h180M30 94h180M30 112h180M30 130h120"}
          className="desk-rule desk-faint"
        />
      )}
    </svg>
  );
}

function Polaroid({ label, tone }: { label: string; tone: "blue" | "pink" }) {
  return (
    <svg viewBox="0 0 160 190" className="desk-art" aria-hidden="true">
      <rect x={6} y={8} width={152} height={180} rx={2} className="desk-shadow" />
      <rect x={2} y={2} width={152} height={180} rx={2} className="desk-paper" />
      <rect x={14} y={14} width={128} height={124} className={`desk-photo desk-${tone}`} />
      {tone === "blue" ? (
        // a little workbench: a box and a gear
        <g className="desk-line">
          <rect x={36} y={76} width={44} height={36} />
          <circle cx={104} cy={86} r={16} />
          <circle cx={104} cy={86} r={5} />
          <path d="M24 118h108" />
        </g>
      ) : (
        // a sketched face
        <g className="desk-line">
          <circle cx={78} cy={74} r={30} />
          <path d="M66 70h2M88 70h2M68 88q10 8 20 0" />
          <path d="M48 128q30 -24 60 0" />
        </g>
      )}
      <text x={78} y={166} textAnchor="middle" className="desk-hand">
        {label}
      </text>
    </svg>
  );
}

function Cassette({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 200 130" className="desk-art" aria-hidden="true">
      <rect x={6} y={8} width={192} height={120} rx={8} className="desk-shadow" />
      <rect x={2} y={2} width={192} height={120} rx={8} className="desk-shell" />
      <rect x={16} y={14} width={164} height={56} rx={3} className="desk-paper" />
      <rect x={16} y={14} width={164} height={12} className="desk-mint" />
      <text x={98} y={52} textAnchor="middle" className="desk-hand">
        {label}
      </text>
      <rect x={50} y={78} width={96} height={26} rx={13} className="desk-window" />
      <circle cx={68} cy={91} r={8} className="desk-reel" />
      <circle cx={128} cy={91} r={8} className="desk-reel" />
      <path d="M44 122l10 -12h88l10 12" className="desk-line" />
    </svg>
  );
}

function Console({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 120 190" className="desk-art" aria-hidden="true">
      <rect x={6} y={8} width={112} height={180} rx={10} className="desk-shadow" />
      <rect x={2} y={2} width={112} height={180} rx={10} className="desk-blue desk-body" />
      <rect x={12} y={14} width={92} height={74} rx={4} className="desk-bezel" />
      <rect x={24} y={22} width={68} height={56} rx={2} className="desk-lcd" />
      <text x={58} y={56} textAnchor="middle" className="desk-lcd-text">
        {label.toUpperCase()}
      </text>
      <path d="M22 122h24M34 110v24" className="desk-dpad" />
      <circle cx={80} cy={128} r={7} className="desk-button" />
      <circle cx={96} cy={116} r={7} className="desk-button" />
      <path d="M40 160l10 -4M58 160l10 -4" className="desk-line" />
    </svg>
  );
}

// A pinned project on the cork: a push-pin, then a slip of paper hanging from it.
export function PinCard({ title, note }: { title: string; note: string }) {
  return (
    <>
      <span className="desk-pin-head" aria-hidden="true" />
      <span className="desk-pin-card">
        <span className="desk-pin-title">{title}</span>
        <span className="desk-pin-note">{note}</span>
      </span>
    </>
  );
}
