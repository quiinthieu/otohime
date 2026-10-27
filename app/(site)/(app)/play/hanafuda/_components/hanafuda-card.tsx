"use client";

import type {
  AccentMotifKind,
  HanafudaCard,
  PlantMotifKind,
} from "@/lib/hanafuda/deck";
import type { MonthlyLog } from "@/lib/yearly-log";
import type { KeyboardEvent, PointerEvent, DragEvent } from "react";

export type HanafudaCardArtProps = {
  card: HanafudaCard;
  compact?: boolean;
};

function renderPlantLayer(
  plant: PlantMotifKind,
  variant: 1 | 2 | 3 | 4,
  primary: string,
  secondary: string,
  ink: string,
) {
  switch (plant) {
    case "pine":
      return (
        <g className="hanafuda-plant-layer" data-plant="pine">
          <path
            d="M6 92 C14 74, 24 68, 34 92 Z"
            fill={primary}
            fillOpacity={0.22}
          />
          <circle cx={20} cy={58} r={11} fill={primary} fillOpacity={0.82} />
          <circle cx={40} cy={54} r={12} fill={primary} fillOpacity={0.76} />
          {variant >= 3 ? (
            <path
              d="M10 88 L28 66 L46 88 Z"
              fill={primary}
              fillOpacity={0.35}
            />
          ) : null}
        </g>
      );
    case "plum":
      return (
        <g className="hanafuda-plant-layer" data-plant="plum">
          <circle cx={24} cy={56} r={6.5} fill={primary} fillOpacity={0.85} />
          <circle cx={24} cy={56} r={2} fill="#fbf6ea" />
          <circle cx={42} cy={42} r={5.5} fill={primary} fillOpacity={0.8} />
          <circle cx={42} cy={42} r={1.8} fill="#fbf6ea" />
          {variant >= 3 ? (
            <circle cx={18} cy={36} r={4.5} fill={secondary} fillOpacity={0.65} />
          ) : null}
        </g>
      );
    case "cherry":
      return (
        <g className="hanafuda-plant-layer" data-plant="cherry">
          <circle cx={22} cy={26} r={8.5} fill={primary} fillOpacity={0.78} />
          <circle cx={42} cy={28} r={7.5} fill={primary} fillOpacity={0.72} />
          <circle cx={32} cy={20} r={6.5} fill={secondary} fillOpacity={0.45} />
          {variant === 4 ? (
            <circle cx={16} cy={46} r={4} fill={primary} fillOpacity={0.65} />
          ) : null}
        </g>
      );
    case "wisteria":
      return (
        <g className="hanafuda-plant-layer" data-plant="wisteria">
          <ellipse cx={17} cy={42} rx={4.5} ry={18} fill={primary} fillOpacity={0.76} />
          <ellipse cx={32} cy={38} rx={4.5} ry={16} fill={primary} fillOpacity={0.7} />
          <ellipse cx={47} cy={34} rx={4} ry={14} fill={primary} fillOpacity={0.64} />
        </g>
      );
    case "iris":
      return (
        <g className="hanafuda-plant-layer" data-plant="iris">
          <path d="M4 82 Q32 76 60 82 L60 94 L4 94 Z" fill={primary} fillOpacity={0.2} />
          <ellipse cx={28} cy={34} rx={8} ry={5.5} fill={primary} fillOpacity={0.85} />
          <path d="M18 88 L22 44 L26 88 Z" fill={secondary} fillOpacity={0.78} />
          <path d="M32 88 L35 40 L39 88 Z" fill={secondary} fillOpacity={0.72} />
        </g>
      );
    case "peony":
      return (
        <g className="hanafuda-plant-layer" data-plant="peony">
          <circle cx={32} cy={52} r={12} fill={primary} fillOpacity={0.82} />
          <circle cx={32} cy={52} r={5} fill="#f4b829" fillOpacity={0.85} />
          <ellipse cx={20} cy={66} rx={7} ry={4} fill={secondary} fillOpacity={0.6} />
          <ellipse cx={44} cy={66} rx={7} ry={4} fill={secondary} fillOpacity={0.6} />
        </g>
      );
    case "bush-clover":
      return (
        <g className="hanafuda-plant-layer" data-plant="bush-clover">
          <circle cx={26} cy={48} r={3.2} fill={primary} />
          <circle cx={34} cy={38} r={3} fill={primary} />
          <circle cx={44} cy={28} r={2.8} fill={primary} />
          <circle cx={22} cy={60} r={2.8} fill={secondary} />
          <circle cx={38} cy={52} r={2.8} fill={secondary} />
        </g>
      );
    case "susuki":
      return (
        <g className="hanafuda-plant-layer" data-plant="susuki">
          <path
            d="M4 90 C18 64, 46 64, 60 90 L60 94 L4 94 Z"
            fill={ink}
            fillOpacity={0.82}
          />
        </g>
      );
    case "chrysanthemum":
      return (
        <g className="hanafuda-plant-layer" data-plant="chrysanthemum">
          <circle cx={28} cy={58} r={11} fill={primary} fillOpacity={0.86} />
          <circle cx={28} cy={58} r={4.5} fill={secondary} fillOpacity={0.75} />
          {variant >= 3 ? (
            <circle cx={44} cy={70} r={7.5} fill={primary} fillOpacity={0.7} />
          ) : null}
        </g>
      );
    case "maple":
      return (
        <g className="hanafuda-plant-layer" data-plant="maple">
          <circle cx={26} cy={24} r={8.5} fill={primary} fillOpacity={0.72} />
          <circle cx={44} cy={38} r={8} fill={primary} fillOpacity={0.68} />
          {variant >= 3 ? (
            <circle cx={20} cy={52} r={7} fill="#d97228" fillOpacity={0.65} />
          ) : null}
        </g>
      );
    case "willow":
      return (
        <g className="hanafuda-plant-layer" data-plant="willow">
          <path
            d="M4 84 Q20 78 36 84 T60 84 L60 94 L4 94 Z"
            fill={primary}
            fillOpacity={0.28}
          />
        </g>
      );
    case "paulownia":
      return (
        <g className="hanafuda-plant-layer" data-plant="paulownia">
          <ellipse cx={32} cy={76} rx={18} ry={9} fill={primary} fillOpacity={0.8} />
          <circle cx={32} cy={46} r={5} fill={secondary} fillOpacity={0.78} />
          <circle cx={20} cy={54} r={4} fill={secondary} fillOpacity={0.7} />
          <circle cx={44} cy={54} r={4} fill={secondary} fillOpacity={0.7} />
        </g>
      );
  }
}

function renderAccentLayer(
  accent: AccentMotifKind,
  primary: string,
  secondary: string,
  ink: string,
  inscription?: string,
) {
  switch (accent) {
    case "crane-sun":
      return (
        <g className="hanafuda-accent-layer" data-accent="crane-sun">
          <circle cx={44} cy={22} r={10.5} fill="#c83226" />
          <ellipse cx={31} cy={66} rx={10} ry={6.5} fill="#fbf6ea" stroke={ink} strokeWidth={1.3} />
          <circle cx={25} cy={42} r={2.2} fill="#c83226" />
        </g>
      );
    case "curtain":
      return (
        <g className="hanafuda-accent-layer" data-accent="curtain">
          <rect x={8} y={55} width={48} height={31} rx={1.5} fill="#f4ede1" stroke={ink} strokeWidth={1.4} />
          <rect x={12} y={55} width={8} height={31} fill={secondary} fillOpacity={0.8} />
          <rect x={28} y={55} width={8} height={31} fill="#394878" fillOpacity={0.75} />
          <rect x={44} y={55} width={8} height={31} fill={secondary} fillOpacity={0.8} />
        </g>
      );
    case "full-moon":
      return (
        <g className="hanafuda-accent-layer" data-accent="full-moon">
          <rect x={4} y={4} width={56} height={54} rx={2} fill="#b8332a" fillOpacity={0.82} />
          <circle cx={24} cy={26} r={12} fill="#fffdf7" stroke={ink} strokeWidth={1.2} />
        </g>
      );
    case "rain-man":
      return (
        <g className="hanafuda-accent-layer" data-accent="rain-man">
          <ellipse cx={42} cy={42} rx={10} ry={5} fill="#b8332a" stroke={ink} strokeWidth={1.2} />
          <path d="M34 50 L48 50 L46 78 L36 78 Z" fill="#2c4c7e" stroke={ink} strokeWidth={1.2} />
          <circle cx={16} cy={80} r={3.2} fill="#3b5c3e" stroke={ink} strokeWidth={1} />
        </g>
      );
    case "phoenix":
      return (
        <g className="hanafuda-accent-layer" data-accent="phoenix">
          <ellipse cx={35} cy={34} rx={14} ry={8} fill="#c49228" stroke={ink} strokeWidth={1.3} />
          <circle cx={24} cy={26} r={4} fill="#b8332a" />
        </g>
      );
    case "sake-cup":
      return (
        <g className="hanafuda-accent-layer" data-accent="sake-cup">
          <ellipse cx={38} cy={26} rx={12} ry={6.5} fill="#c83226" stroke={ink} strokeWidth={1.4} />
          <ellipse cx={38} cy={25} rx={8.5} ry={3.8} fill="#f8ecd2" />
          {inscription ? (
            <text
              x={38}
              y={27.5}
              textAnchor="middle"
              fontSize="6.5"
              fontWeight="700"
              fill={ink}
            >
              {inscription}
            </text>
          ) : null}
        </g>
      );
    case "akatan":
    case "aotan":
    case "plain-ribbon": {
      const ribbonFill =
        accent === "aotan" ? "#294b82" : accent === "akatan" ? "#c42f28" : "#d44d38";
      return (
        <g className="hanafuda-accent-layer" data-accent={accent}>
          <path
            d="M18 16 L32 12 L36 68 L22 72 Z"
            fill={ribbonFill}
            stroke={ink}
            strokeWidth={1.4}
          />
          <path d="M20 19 L30 16 L33 64 L23 67 Z" fill="#fbf6ea" fillOpacity={0.85} />
          {inscription ? (
            <text
              x={26.5}
              y={30}
              textAnchor="middle"
              fontSize="5.2"
              fontWeight="700"
              fill={ink}
              writingMode="tb"
            >
              {inscription}
            </text>
          ) : null}
        </g>
      );
    }
    case "boar":
      return (
        <g className="hanafuda-accent-layer" data-accent="boar">
          <ellipse cx={32} cy={68} rx={15} ry={9} fill="#5c3d28" stroke={ink} strokeWidth={1.4} />
          <circle cx={42} cy={65} r={1.5} fill="#fbf6ea" />
        </g>
      );
    case "deer":
      return (
        <g className="hanafuda-accent-layer" data-accent="deer">
          <ellipse cx={34} cy={58} rx={11} ry={6.5} fill="#9e5224" stroke={ink} strokeWidth={1.3} />
          <circle cx={28} cy={57} r={1.2} fill="#fbf6ea" />
          <circle cx={34} cy={56} r={1.2} fill="#fbf6ea" />
        </g>
      );
    case "butterflies":
      return (
        <g className="hanafuda-accent-layer" data-accent="butterflies">
          <circle cx={22} cy={24} r={5} fill="#f4b829" stroke={ink} strokeWidth={1.1} />
          <circle cx={44} cy={32} r={5} fill="#ef6a4c" stroke={ink} strokeWidth={1.1} />
        </g>
      );
    case "bridge":
      return (
        <g className="hanafuda-accent-layer" data-accent="bridge">
          <path
            d="M8 62 L40 48 L56 56 L24 70 Z"
            fill="#c9954c"
            stroke={ink}
            strokeWidth={1.3}
          />
        </g>
      );
    case "lightning":
      return (
        <g className="hanafuda-accent-layer" data-accent="lightning">
          <path
            d="M38 14 L24 38 L36 40 L20 70"
            fill="none"
            stroke="#c83226"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    default:
      return (
        <g className="hanafuda-accent-layer" data-accent={accent}>
          <circle cx={38} cy={36} r={4.5} fill={secondary} fillOpacity={0.38} />
        </g>
      );
  }
}

export function HanafudaCardArt({ card }: HanafudaCardArtProps) {
  const { motif } = card;
  const { palette } = motif;
  const isHikari = card.category === "hikari";
  const isTane = card.category === "tane";

  return (
    <svg
      className="hanafuda-card-svg"
      viewBox="0 0 64 96"
      role="img"
      aria-label={`${card.name} (${card.japaneseName}, Month ${card.month} ${card.flower})`}
      data-svg-card-id={card.id}
    >
      {/* Shared outer sumi-ink rim and washi paper ground */}
      <rect
        className="hanafuda-card-rim"
        x={1.2}
        y={1.2}
        width={61.6}
        height={93.6}
        rx={4}
        fill={palette.wash}
        stroke={palette.ink}
        strokeWidth={2.4}
      />
      <rect
        className="hanafuda-card-inner-frame"
        x={3.8}
        y={3.8}
        width={56.4}
        height={88.4}
        rx={2.2}
        fill="none"
        stroke={palette.ink}
        strokeOpacity={0.28}
        strokeWidth={0.9}
      />

      {/* Subtle washi fiber grain lines */}
      <path
        d="M6 18 H58 M6 48 H58 M6 78 H58"
        stroke={palette.ink}
        strokeOpacity={0.07}
        strokeWidth={0.6}
      />

      {/* Base plant botanical fills */}
      {renderPlantLayer(
        motif.basePlant,
        motif.variant,
        palette.primary,
        palette.secondary,
        palette.ink,
      )}

      {/* Accent motif fills */}
      {renderAccentLayer(
        motif.accent,
        palette.primary,
        palette.secondary,
        palette.ink,
        motif.inscription,
      )}

      {/* Canonical brush-stroke vector paths from lib/hanafuda/deck.ts */}
      <g className="hanafuda-motif-paths">
        {motif.paths.map((d, idx) => (
          <path
            key={`${card.id}-p-${idx}`}
            className="hanafuda-motif-path"
            d={d}
            fill="none"
            stroke={palette.ink}
            strokeWidth={1.85}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>

      {/* Top-left month + kanji cartouche */}
      <g className="hanafuda-month-cartouche">
        <rect
          x={5.5}
          y={5.5}
          width={21}
          height={11}
          rx={1.8}
          fill="#fbf6ea"
          fillOpacity={0.9}
          stroke={palette.ink}
          strokeWidth={0.9}
        />
        <text
          x={16}
          y={13}
          textAnchor="middle"
          fontSize="6.4"
          fontWeight="700"
          fill={palette.ink}
        >
          {card.monthKey}·{card.kanji}
        </text>
      </g>

      {/* Top-right category hanko seal */}
      <g className="hanafuda-category-stamp" data-category={card.category}>
        <circle
          cx={51.5}
          cy={11}
          r={5.8}
          fill={isHikari ? "#c42f28" : isTane ? "#b84a27" : "#fbf6ea"}
          stroke={isHikari || isTane ? "#9e201a" : palette.ink}
          strokeWidth={1.1}
        />
        <text
          x={51.5}
          y={13.3}
          textAnchor="middle"
          fontSize="6.5"
          fontWeight="700"
          fill={isHikari || isTane ? "#fbf6ea" : "#b52b1d"}
        >
          {motif.stampLabel}
        </text>
      </g>
    </svg>
  );
}

export function HanafudaCardFaceDown({ label = "Face-down Hanafuda card" }: { label?: string }) {
  return (
    <svg
      className="hanafuda-card-svg hanafuda-card-facedown-svg"
      viewBox="0 0 64 96"
      role="img"
      aria-label={label}
    >
      <rect
        x={1.2}
        y={1.2}
        width={61.6}
        height={93.6}
        rx={4}
        fill="#241c18"
        stroke="#140f0d"
        strokeWidth={2.4}
      />
      <rect
        x={5}
        y={5}
        width={54}
        height={86}
        rx={2.5}
        fill="#8c2922"
        stroke="#e8dcc8"
        strokeOpacity={0.35}
        strokeWidth={1}
      />
      <circle
        cx={32}
        cy={48}
        r={14}
        fill="none"
        stroke="#f4ede1"
        strokeOpacity={0.45}
        strokeWidth={1.3}
      />
      <text
        x={32}
        y={51}
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="#f4ede1"
        fillOpacity={0.85}
      >
        花札
      </text>
    </svg>
  );
}

export type HanafudaCardBackProps = {
  card: HanafudaCard;
  monthlyLog: MonthlyLog;
  year?: number;
};

export function HanafudaCardBack({ card, monthlyLog, year = 2026 }: HanafudaCardBackProps) {
  const shippedCount = monthlyLog.shippedProjects.length;
  const noteCount = monthlyLog.notes.length;
  const highlightCount = monthlyLog.highlights.length;

  return (
    <div
      className="hanafuda-card-back-content"
      data-testid={`card-back-${card.monthKey}`}
      data-back-month={card.monthKey}
      data-back-flower={monthlyLog.flower}
    >
      <div className="hanafuda-back-header">
        <span className="hanafuda-back-month">
          {card.monthKey} · {monthlyLog.flower} ({card.kanji})
        </span>
        <span className="hanafuda-back-commits" data-testid={`card-back-commits-${card.monthKey}`}>
          {monthlyLog.commits} {monthlyLog.commits === 1 ? "commit" : "commits"} · {year}
        </span>
      </div>

      {shippedCount > 0 ? (
        <div className="hanafuda-back-section">
          <p className="hanafuda-back-heading">Shipped ({shippedCount})</p>
          <ul className="hanafuda-back-list" data-testid={`card-back-projects-${card.monthKey}`}>
            {monthlyLog.shippedProjects.map((proj) => (
              <li key={`${card.monthKey}-${proj.title}`}>
                {proj.href ? (
                  <a href={proj.href} className="hanafuda-back-link">
                    {proj.title}
                  </a>
                ) : (
                  <span>{proj.title}</span>
                )}{" "}
                <span className="hanafuda-back-date">({proj.shipped})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {noteCount > 0 ? (
        <div className="hanafuda-back-section">
          <p className="hanafuda-back-heading">Notes ({noteCount})</p>
          <ul className="hanafuda-back-list" data-testid={`card-back-notes-${card.monthKey}`}>
            {monthlyLog.notes.map((n) => (
              <li key={`${card.monthKey}-${n.date}-${n.title}`}>
                <span>{n.title}</span>{" "}
                <span className="hanafuda-back-date">({n.date})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {shippedCount === 0 && noteCount === 0 && highlightCount > 0 ? (
        <div className="hanafuda-back-section">
          <p className="hanafuda-back-heading">Highlights</p>
          <ul className="hanafuda-back-list">
            {monthlyLog.highlights.slice(0, 2).map((h) => (
              <li key={h.sha}>
                <span>{h.subject}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {shippedCount === 0 && noteCount === 0 && highlightCount === 0 ? (
        <p className="hanafuda-back-empty">
          Quiet workshop month — no shipped projects or notes recorded for {monthlyLog.flower}.
        </p>
      ) : null}
    </div>
  );
}

export type HanafudaCardTileProps = {
  card: HanafudaCard;
  monthlyLog: MonthlyLog;
  year?: number;
  flipped?: boolean;
  selected?: boolean;
  matchable?: boolean;
  choiceCandidate?: boolean;
  disabled?: boolean;
  draggable?: boolean;
  zone: "hand" | "field" | "captured" | "deck";
  onActivate?: (card: HanafudaCard) => void;
  onFlip?: (card: HanafudaCard) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, card: HanafudaCard) => void;
  onDragStart?: (event: DragEvent<HTMLButtonElement>, card: HanafudaCard) => void;
  onDragOver?: (event: DragEvent<HTMLButtonElement>, card: HanafudaCard) => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>, card: HanafudaCard) => void;
  onPointerDown?: (event: PointerEvent<HTMLButtonElement>, card: HanafudaCard) => void;
  onPointerUp?: (event: PointerEvent<HTMLButtonElement>, card: HanafudaCard) => void;
};

export function HanafudaCardTile({
  card,
  monthlyLog,
  year = 2026,
  flipped = false,
  selected = false,
  matchable = false,
  choiceCandidate = false,
  disabled = false,
  draggable = false,
  zone,
  onActivate,
  onFlip,
  onKeyDown,
  onDragStart,
  onDragOver,
  onDrop,
  onPointerDown,
  onPointerUp,
}: HanafudaCardTileProps) {
  return (
    <div
      className="hanafuda-card-tile"
      data-card-id={card.id}
      data-card-month={card.monthKey}
      data-card-flower={card.flower}
      data-card-category={card.category}
      data-zone={zone}
      data-flipped={flipped ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
      data-matchable={matchable ? "true" : "false"}
      data-choice-candidate={choiceCandidate ? "true" : "false"}
    >
      <div className="hanafuda-card-flipper" data-flipped={flipped ? "true" : "false"}>
        {!flipped ? (
          <button
            type="button"
            className="hanafuda-card-face hanafuda-card-front"
            disabled={disabled}
            draggable={draggable}
            aria-pressed={selected || choiceCandidate}
            aria-label={`${card.name} — Month ${card.month} ${card.flower} (${card.category}, ${card.points} pts)`}
            data-hand-card-id={zone === "hand" ? card.id : undefined}
            data-field-card-id={zone === "field" ? card.id : undefined}
            data-deck-card-id={zone === "deck" ? card.id : undefined}
            onClick={() => onActivate?.(card)}
            onKeyDown={(e) => onKeyDown?.(e, card)}
            onDragStart={(e) => onDragStart?.(e, card)}
            onDragOver={(e) => onDragOver?.(e, card)}
            onDrop={(e) => onDrop?.(e, card)}
            onPointerDown={(e) => onPointerDown?.(e, card)}
            onPointerUp={(e) => onPointerUp?.(e, card)}
          >
            <HanafudaCardArt card={card} />
            <span className="hanafuda-card-caption">
              <span className="hanafuda-card-title">{card.name}</span>
              <span className="hanafuda-card-sub">
                {card.monthKey} {card.flower} · {card.points}pt
              </span>
            </span>
          </button>
        ) : (
          <div
            className="hanafuda-card-face hanafuda-card-back"
            role="region"
            aria-label={`${card.name} monthly shipped log (${card.monthKey} ${card.flower})`}
          >
            <HanafudaCardBack card={card} monthlyLog={monthlyLog} year={year} />
          </div>
        )}
      </div>

      {onFlip ? (
        <button
          type="button"
          className="hanafuda-flip-btn"
          aria-pressed={flipped}
          aria-label={`Flip ${card.name} (${card.monthKey} ${card.flower}) card back`}
          data-flip-card={card.id}
          data-flip-month={card.monthKey}
          onClick={(e) => {
            e.stopPropagation();
            onFlip(card);
          }}
        >
          {flipped ? "Show face" : `Flip ${card.monthKey} log`}
        </button>
      ) : null}
    </div>
  );
}
