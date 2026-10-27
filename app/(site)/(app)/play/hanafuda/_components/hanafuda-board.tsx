"use client";

import {
  advanceToNextRound,
   canCardMatchField,
  createMatch,
  decideKoiKoi,
  getMatchingFieldCards,
  getPlayableHandMatches,
  HANAFUDA_DECK,
  HANAMI_ZAKE_SEED,
  playHandCard,
  runCpuTurn,
  selectFieldMatch,
  TSUKIMI_ZAKE_SEED,
  type CardId,
  type HanafudaCard,
  type HanafudaState,
  type KoiKoiDecision,
} from "@/lib/hanafuda/engine";
import { ALL_YAKU_IDS, YAKU_DEFINITIONS } from "@/lib/hanafuda/yaku";
import {
  getServerSound,
  getSound,
  play,
  setSound,
  subscribeSound,
} from "@/lib/sound-client";
import {
  MONTH_KEYS,
  MONTHLY_FLOWERS,
  type MonthKey,
  type YearlyLog,
} from "@/lib/yearly-log";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  ViewTransition,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  HanafudaCardBack,
  HanafudaCardFaceDown,
  HanafudaCardTile,
} from "./hanafuda-card";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia(REDUCED_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_QUERY).matches;
}

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const TABLE_TRANSITION_CLASSES = {
  "hanafuda-deal": "hanafuda-vt-deal",
  "hanafuda-capture": "hanafuda-vt-capture",
  "hanafuda-flip": "hanafuda-vt-flip",
  default: "none",
} as const;

export type HanafudaBoardProps = {
  yearlyLog: YearlyLog;
  initialSeed?: number;
};

function parseSeedParam(params: URLSearchParams): number | null {
  const raw = params.get("seed");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n) >>> 0;
}

function parseFlipParam(params: URLSearchParams): MonthKey | null {
  const raw = params.get("flip") ?? params.get("month");
  if (!raw) return null;
  const padded = raw.trim().padStart(2, "0") as MonthKey;
  return (MONTH_KEYS as readonly string[]).includes(padded) ? padded : null;
}

function advanceIfCpuTurn(state: HanafudaState): HanafudaState {
  if (
    state.activePlayer === "cpu" &&
    state.phase !== "round-over" &&
    state.phase !== "match-over"
  ) {
    const beforeCpuAnnouncement = state.announcement;
    const afterCpu = runCpuTurn(state);
    if (
      afterCpu.phase === "play-hand" &&
      afterCpu.activePlayer === "human" &&
      afterCpu.lastTurn?.player === "cpu"
    ) {
      const cpuPlayed = afterCpu.lastTurn.handCard.name;
      const cpuCapCount =
        afterCpu.lastTurn.handCaptured.length + afterCpu.lastTurn.drawCaptured.length;
      const prefix = beforeCpuAnnouncement.startsWith("Koi-koi!")
        ? "Koi-koi! You continue the round. "
        : "";
      return {
        ...afterCpu,
        announcement: `${prefix}CPU played ${cpuPlayed} (${cpuCapCount} captured). Your turn.`,
      };
    }
    return afterCpu;
  }
  return state;
}

export function HanafudaBoard({
  yearlyLog,
  initialSeed = HANAMI_ZAKE_SEED,
}: HanafudaBoardProps) {
  const [state, setState] = useState<HanafudaState>(() =>
    createMatch({ seed: initialSeed }),
  );
  const [seedInput, setSeedInput] = useState<string>(() => String(initialSeed));
  const [selectedHandCardId, setSelectedHandCardId] = useState<CardId | null>(null);
  const [boardBacksFlipped, setBoardBacksFlipped] = useState<boolean>(false);
  const [flippedCardIds, setFlippedCardIds] = useState<Record<string, boolean>>({});
  const [flippedMonths, setFlippedMonths] = useState<Record<MonthKey, boolean>>(
    () =>
      Object.fromEntries(MONTH_KEYS.map((k) => [k, false])) as Record<
        MonthKey,
        boolean
      >,
  );
  const [selectedLogMonth, setSelectedLogMonth] = useState<MonthKey>("10");
  const [liveOverride, setLiveOverride] = useState<string | null>(null);
  const [transitionCount, setTransitionCount] = useState<number>(0);
  const [hydrated, setHydrated] = useState<boolean>(false);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const soundOn = useSyncExternalStore(
    subscribeSound,
    getSound,
    getServerSound,
  );

  const draggedCardRef = useRef<{
    cardId: CardId;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    setHydrated(true);
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const urlSeed = parseSeedParam(params);
      const urlFlip = parseFlipParam(params);
      if (urlSeed !== null) {
        setSeedInput(String(urlSeed));
        setState(createMatch({ seed: urlSeed }));
        setSelectedHandCardId(null);
        setLiveOverride(null);
      }
      if (urlFlip !== null) {
        setSelectedLogMonth(urlFlip);
        setFlippedMonths((prev) => ({ ...prev, [urlFlip]: true }));
      }
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  function runWithViewTransition(
    _kind: "hanafuda-deal" | "hanafuda-capture" | "hanafuda-flip",
    update: () => void,
  ) {
    update();
    if (
      !reducedMotion &&
      typeof document !== "undefined" &&
      typeof document.startViewTransition === "function"
    ) {
      setTransitionCount((c) => c + 1);
      try {
        document.startViewTransition(() => {});
      } catch {
        // Ignore if another transition is active
      }
    }
  }

  function startNewMatch(nextSeed: number) {
    const normalized = (Math.trunc(nextSeed) >>> 0) || HANAMI_ZAKE_SEED;
    play("shuffle");
    setSeedInput(String(normalized));
    runWithViewTransition("hanafuda-deal", () => {
      const fresh = createMatch({ seed: normalized });
      setState(fresh);
      setSelectedHandCardId(null);
      setLiveOverride(
        `Dealt new match (seed ${normalized}) — ${fresh.announcement}`,
      );
    });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("seed", String(normalized));
      window.history.replaceState(window.history.state, "", url);
    }
  }

  function executePlayHandCard(
    handCardId: CardId | string,
    targetFieldCardId?: CardId | string | null,
  ) {
    if (state.phase !== "play-hand" || state.activePlayer !== "human") return;
    const inHand = state.hands.human.find((c) => c.id === handCardId);
    if (!inHand) return;

    const matching = getMatchingFieldCards(state, inHand);
    let effectiveTarget = targetFieldCardId ?? null;
    if (effectiveTarget && !matching.some((m) => m.id === effectiveTarget)) {
      // Dropped onto a non-matching field card: if there's 0 matches, discard; otherwise ignore invalid target
      if (matching.length > 0) {
        setLiveOverride(
          `${inHand.name} (Month ${inHand.month} ${inHand.flower}) does not match that card. Match a Month ${inHand.month} ${inHand.flower} card.`,
        );
        return;
      }
      effectiveTarget = null;
    }

    const afterHuman = playHandCard(state, inHand.id, effectiveTarget);
    const nextState = advanceIfCpuTurn(afterHuman);

    if (nextState.phase === "koi-koi-decision") {
      play("stamp");
    } else {
      play("shuffle");
    }

    runWithViewTransition("hanafuda-capture", () => {
      setState(nextState);
      setSelectedHandCardId(null);
      setLiveOverride(null);
    });

    if (
      nextState.phase === "choose-hand-match" ||
      nextState.phase === "choose-draw-match"
    ) {
      const firstCandidateId =
        nextState.pendingMatchChoice?.matchingFieldCards[0]?.id;
      if (firstCandidateId) {
        queueMicrotask(() => {
          const btn = boardRef.current?.querySelector<HTMLButtonElement>(
            `[data-field-card-id="${firstCandidateId}"]`,
          );
          btn?.focus();
        });
      }
    }
  }

  function executeSelectFieldMatch(targetFieldCardId: CardId | string) {
    if (
      state.phase !== "choose-hand-match" &&
      state.phase !== "choose-draw-match"
    ) {
      return;
    }
    const afterChoice = selectFieldMatch(state, targetFieldCardId);
    const nextState = advanceIfCpuTurn(afterChoice);
    if (nextState.phase === "koi-koi-decision") {
      play("stamp");
    } else {
      play("shuffle");
    }
    runWithViewTransition("hanafuda-capture", () => {
      setState(nextState);
      setSelectedHandCardId(null);
      setLiveOverride(null);
    });
  }

  function handleDecision(decision: KoiKoiDecision) {
    if (state.phase !== "koi-koi-decision") return;
    play(decision === "shobu" ? "stamp" : "shuffle");
    const afterDecision = decideKoiKoi(state, decision);
    const nextState = advanceIfCpuTurn(afterDecision);
    runWithViewTransition("hanafuda-capture", () => {
      setState(nextState);
      setSelectedHandCardId(null);
      setLiveOverride(null);
    });
  }

  function handleNextRound() {
    if (state.phase !== "round-over") return;
    play("shuffle");
    const afterAdvance = advanceToNextRound(state);
    const nextState = advanceIfCpuTurn(afterAdvance);
    runWithViewTransition("hanafuda-deal", () => {
      setState(nextState);
      setSelectedHandCardId(null);
      setLiveOverride(null);
    });
  }

  function handleHandCardActivate(card: HanafudaCard) {
    if (state.phase !== "play-hand" || state.activePlayer !== "human") return;
    const matches = getMatchingFieldCards(state, card);

    if (selectedHandCardId === card.id) {
      // Second tap/click on the selected hand card plays it immediately
      executePlayHandCard(card.id, matches.length === 1 ? matches[0].id : null);
      return;
    }

    play("rustle");
    setSelectedHandCardId(card.id);
    if (matches.length === 0) {
      setLiveOverride(
        `Selected ${card.name} (Month ${card.month} ${card.flower}). No matching ${card.flower} card on the field — tap again or press Enter to place on the field.`,
      );
    } else {
      const matchNames = matches.map((m) => m.name).join(" or ");
      setLiveOverride(
        `Selected ${card.name} (Month ${card.month} ${card.flower}). Tap matching ${matchNames} on the field or press Enter to capture.`,
      );
    }
  }

  function handleFieldCardActivate(fieldCard: HanafudaCard) {
    if (
      state.phase === "choose-hand-match" ||
      state.phase === "choose-draw-match"
    ) {
      const valid = state.pendingMatchChoice?.matchingFieldCards.some(
        (m) => m.id === fieldCard.id,
      );
      if (valid) {
        executeSelectFieldMatch(fieldCard.id);
      }
      return;
    }

    if (state.phase !== "play-hand" || state.activePlayer !== "human") return;

    if (selectedHandCardId) {
      if (canCardMatchField(selectedHandCardId, fieldCard.id)) {
        executePlayHandCard(selectedHandCardId, fieldCard.id);
        return;
      }
      const selectedCard = state.hands.human.find(
        (c) => c.id === selectedHandCardId,
      );
      if (
        selectedCard &&
        getMatchingFieldCards(state, selectedCard).length === 0
      ) {
        executePlayHandCard(selectedHandCardId, null);
        return;
      }
    }

    // If no hand card was selected (or a different suit was clicked), check if human holds a matching hand card
    const matchingHandCards = state.hands.human.filter(
      (c) => c.month === fieldCard.month,
    );
    if (matchingHandCards.length === 1) {
      executePlayHandCard(matchingHandCards[0].id, fieldCard.id);
    } else if (matchingHandCards.length > 1) {
      play("rustle");
      setSelectedHandCardId(matchingHandCards[0].id);
      setLiveOverride(
        `Selected ${matchingHandCards[0].name} for Month ${fieldCard.month} ${fieldCard.flower}. Tap ${fieldCard.name} again to capture.`,
      );
    }
  }

  function handleHandKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    card: HanafudaCard,
  ) {
    const handCards = state.hands.human;
    const idx = handCards.findIndex((c) => c.id === card.id);
    if (idx === -1) return;

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIdx = (idx + delta + handCards.length) % handCards.length;
      const nextId = handCards[nextIdx]?.id;
      if (nextId) {
        boardRef.current
          ?.querySelector<HTMLButtonElement>(`[data-hand-card-id="${nextId}"]`)
          ?.focus();
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedHandCardId(card.id);
      const matches = getMatchingFieldCards(state, card);
      const targetFieldId = matches[0]?.id ?? state.field[0]?.id;
      if (targetFieldId) {
        boardRef.current
          ?.querySelector<HTMLButtonElement>(
            `[data-field-card-id="${targetFieldId}"]`,
          )
          ?.focus();
      }
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      handleHandCardActivate(card);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const matches = getMatchingFieldCards(state, card);
      executePlayHandCard(card.id, matches.length === 1 ? matches[0].id : null);
    }
  }

  function handleFieldKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    fieldCard: HanafudaCard,
  ) {
    const fieldCards = state.field;
    const idx = fieldCards.findIndex((c) => c.id === fieldCard.id);

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      if (fieldCards.length === 0) return;
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIdx = (idx + delta + fieldCards.length) % fieldCards.length;
      const nextId = fieldCards[nextIdx]?.id;
      if (nextId) {
        boardRef.current
          ?.querySelector<HTMLButtonElement>(`[data-field-card-id="${nextId}"]`)
          ?.focus();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const targetHandId = selectedHandCardId ?? state.hands.human[0]?.id;
      if (targetHandId) {
        boardRef.current
          ?.querySelector<HTMLButtonElement>(`[data-hand-card-id="${targetHandId}"]`)
          ?.focus();
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleFieldCardActivate(fieldCard);
    }
  }

  // Drag-and-drop handlers (HTML5 + Pointer fallback)
  function handleHandDragStart(
    event: DragEvent<HTMLButtonElement>,
    card: HanafudaCard,
  ) {
    draggedCardRef.current = {
      cardId: card.id,
      startX: event.clientX,
      startY: event.clientY,
      moved: true,
    };
    setSelectedHandCardId(card.id);
    try {
      event.dataTransfer.setData("text/plain", card.id);
      event.dataTransfer.effectAllowed = "move";
    } catch {
      // Ignore dataTransfer restrictions in synthetic environments
    }
  }

  function handleFieldDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    try {
      event.dataTransfer.dropEffect = "move";
    } catch {
      // Ignore
    }
  }

  function handleFieldCardDrop(
    event: DragEvent<HTMLButtonElement>,
    fieldCard: HanafudaCard,
  ) {
    event.preventDefault();
    event.stopPropagation();
    let sourceId = draggedCardRef.current?.cardId ?? selectedHandCardId;
    try {
      const transferred = event.dataTransfer.getData("text/plain");
      if (transferred) sourceId = transferred as CardId;
    } catch {
      // Ignore
    }
    draggedCardRef.current = null;
    if (sourceId) {
      executePlayHandCard(sourceId, fieldCard.id);
    }
  }

  function handleFieldZoneDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    let sourceId = draggedCardRef.current?.cardId ?? selectedHandCardId;
    try {
      const transferred = event.dataTransfer.getData("text/plain");
      if (transferred) sourceId = transferred as CardId;
    } catch {
      // Ignore
    }
    draggedCardRef.current = null;
    if (sourceId) {
      executePlayHandCard(sourceId, null);
    }
  }

  function handleHandPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    card: HanafudaCard,
  ) {
    draggedCardRef.current = {
      cardId: card.id,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  }

  useEffect(() => {
    const onPointerMove = (event: globalThis.PointerEvent) => {
      const current = draggedCardRef.current;
      if (!current) return;
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (Math.hypot(dx, dy) >= 8) {
        current.moved = true;
      }
    };

    const onPointerUp = (event: globalThis.PointerEvent) => {
      const current = draggedCardRef.current;
      if (!current) return;
      draggedCardRef.current = null;
      if (!current.moved) return;
      const targetEl = document.elementFromPoint(event.clientX, event.clientY);
      if (!targetEl) return;
      const fieldBtn = targetEl.closest<HTMLElement>("[data-field-card-id]");
      if (fieldBtn) {
        const fieldCardId = fieldBtn.getAttribute("data-field-card-id");
        if (fieldCardId) {
          executePlayHandCard(current.cardId, fieldCardId);
          return;
        }
      }
      const dropZone = targetEl.closest<HTMLElement>("[data-field-dropzone]");
      if (dropZone) {
        executePlayHandCard(current.cardId, null);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  });

  function toggleCardFlip(card: HanafudaCard) {
    play("rustle");
    const nextFlipped = !isCardFlipped(card);
    const mLog = yearlyLog.months[card.monthKey];
    runWithViewTransition("hanafuda-flip", () => {
      setFlippedCardIds((prev) => ({ ...prev, [card.id]: nextFlipped }));
      if (nextFlipped) {
        const projSummary =
          mLog.shippedProjects.length > 0
            ? mLog.shippedProjects.map((p) => p.title).join(", ")
            : "no shipped projects";
        setLiveOverride(
          `Flipped ${card.name} (Month ${card.monthKey} ${mLog.flower}): ${mLog.commits} commits, ${projSummary}.`,
        );
      } else {
        setLiveOverride(`Returned ${card.name} to card face.`);
      }
    });
  }

  function toggleMonthFlip(monthKey: MonthKey) {
    play("rustle");
    const next = !flippedMonths[monthKey];
    const mLog = yearlyLog.months[monthKey];
    runWithViewTransition("hanafuda-flip", () => {
      setFlippedMonths((prev) => ({ ...prev, [monthKey]: next }));
      setSelectedLogMonth(monthKey);
      if (next) {
        const projSummary =
          mLog.shippedProjects.length > 0
            ? mLog.shippedProjects.map((p) => p.title).join(", ")
            : "no shipped projects";
        setLiveOverride(
          `Flipped Month ${monthKey} (${mLog.flower}) card back: ${mLog.commits} commits, ${projSummary}.`,
        );
      } else {
        setLiveOverride(
          `Returned Month ${monthKey} (${mLog.flower}) cards to front face.`,
        );
      }
    });
  }

  function toggleAllBoardBacks() {
    play("shuffle");
    const next = !boardBacksFlipped;
    runWithViewTransition("hanafuda-flip", () => {
      setBoardBacksFlipped(next);
      setLiveOverride(
        next
          ? "Flipped all cards to reveal their monthly shipped log backs."
          : "Returned all cards to their Hanafuda flower faces.",
      );
    });
  }

  function isCardFlipped(card: HanafudaCard): boolean {
    if (card.id in flippedCardIds) return flippedCardIds[card.id];
    if (flippedMonths[card.monthKey]) return true;
    return boardBacksFlipped;
  }

  const playableMatches = getPlayableHandMatches(state, "human");
  const selectedMatchingFieldIds = new Set<CardId>(
    selectedHandCardId ? (playableMatches[selectedHandCardId] ?? []) : [],
  );
  const choiceCandidateIds = new Set<CardId>(
    state.pendingMatchChoice?.matchingFieldCards.map((c) => c.id) ?? [],
  );

  const liveAnnouncement = liveOverride ?? state.announcement;
  const activeYakuBanner =
    state.pendingDecision?.newYaku ??
    (state.lastTurn?.newYaku && state.lastTurn.newYaku.length > 0
      ? state.lastTurn.newYaku
      : state.roundHistory.at(-1)?.yaku ?? []);

  return (
    <div
      ref={boardRef}
      className="hanafuda-root"
      data-testid="hanafuda-board"
      data-own-sound=""
      data-phase={state.phase}
      data-active-player={state.activePlayer}
      data-seed={state.seed}
      data-round={state.round}
      data-hydrated={hydrated ? "true" : "false"}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-view-transitions={transitionCount}
    >
      {/* Real aria-live status region announcing deals, matches, yaku, Koi-koi? prompts, and monthly log flips */}
      <div className="hanafuda-status-bar">
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="hanafuda-live-text"
          data-testid="hanafuda-live-status"
        >
          {liveAnnouncement}
        </p>

        <div className="hanafuda-toolbar" role="group" aria-label="Game controls">
          <button
            type="button"
            className="btn btn-sm"
            data-testid="seed-hanami"
            aria-pressed={state.seed === HANAMI_ZAKE_SEED}
            onClick={() => startNewMatch(HANAMI_ZAKE_SEED)}
          >
            Seed 53 (Hanami-zake)
          </button>
          <button
            type="button"
            className="btn btn-sm"
            data-testid="seed-tsukimi"
            aria-pressed={state.seed === TSUKIMI_ZAKE_SEED}
            onClick={() => startNewMatch(TSUKIMI_ZAKE_SEED)}
          >
            Seed 151 (Tsukimi-zake)
          </button>
          <label className="hanafuda-seed-label">
            <span className="sr-only">Match seed</span>
            <input
              type="number"
              min={1}
              className="field hanafuda-seed-input"
              aria-label="Match seed"
              data-testid="seed-input"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-sm"
            data-testid="new-match-btn"
            onClick={() =>
              startNewMatch(Number(seedInput) || HANAMI_ZAKE_SEED)
            }
          >
            Deal seed
          </button>
          <button
            type="button"
            className="btn btn-sm"
            data-testid="toggle-card-backs"
            aria-pressed={boardBacksFlipped}
            onClick={toggleAllBoardBacks}
          >
            {boardBacksFlipped ? "Show flower faces" : "Flip monthly backs"}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            data-testid="hanafuda-sound-toggle"
            aria-pressed={soundOn}
            onClick={() => {
              const next = !soundOn;
              setSound(next);
              if (next) play("shuffle");
            }}
          >
            {soundOn ? "Sound: on" : "Sound: off"}
          </button>
        </div>
      </div>

      {/* Match scoreboard & round header */}
      <div className="hanafuda-scoreboard" data-testid="hanafuda-scoreboard">
        <div className="hanafuda-score-pill" data-testid="round-indicator">
          <span className="caption">Round</span>
          <strong>
            {state.round} / {state.totalRounds} ·{" "}
            {MONTHLY_FLOWERS[String(state.roundMonth).padStart(2, "0") as MonthKey]}
          </strong>
        </div>
        <div className="hanafuda-score-pill" data-testid="human-score">
          <span className="caption">You (Dealer: {state.dealer === "human" ? "Yes" : "No"})</span>
          <strong>{state.scores.human} pts</strong>
          {state.koiKoiCalled.human ? (
            <span className="badge" data-testid="human-koikoi-badge">
              Koi-koi ×{state.koiKoiCalls.human}
            </span>
          ) : null}
        </div>
        <div className="hanafuda-score-pill" data-testid="cpu-score">
          <span className="caption">CPU Opponent</span>
          <strong>{state.scores.cpu} pts</strong>
          {state.koiKoiCalled.cpu ? (
            <span className="badge" data-testid="cpu-koikoi-badge">
              Koi-koi ×{state.koiKoiCalls.cpu}
            </span>
          ) : null}
        </div>
        <div className="hanafuda-score-pill" data-testid="stock-count">
          <span className="caption">Stock pile</span>
          <strong>{state.stock.length} cards</strong>
        </div>
      </div>

      {/* Red Hanko Stamp + Brush-stroke 'Koi-koi?' vs 'Shobu' Decision Prompt */}
      {state.phase === "koi-koi-decision" && state.pendingDecision ? (
        <section
          className="hanafuda-koikoi-modal"
          data-testid="koi-koi-prompt"
          aria-labelledby="koi-koi-prompt-heading"
        >
          <div className="hanafuda-koikoi-art">
            {/* Red Hanko Stamp */}
            <div
              className="hanafuda-hanko-stamp"
              data-testid="hanko-stamp"
              data-yaku-id={state.pendingDecision.newYaku[0]?.id}
            >
              <svg
                viewBox="0 0 88 88"
                className="hanafuda-hanko-svg"
                role="img"
                aria-label={`Red hanko stamp: ${state.pendingDecision.newYaku.map((y) => `${y.japaneseName} (${y.name})`).join(", ")}`}
              >
                <circle
                  cx={44}
                  cy={44}
                  r={39}
                  fill="rgba(196, 47, 40, 0.12)"
                  stroke="#b52b1d"
                  strokeWidth={4}
                />
                <circle
                  cx={44}
                  cy={44}
                  r={34}
                  fill="none"
                  stroke="#b52b1d"
                  strokeWidth={1.4}
                  strokeDasharray="6 3"
                />
                <text
                  x={44}
                  y={42}
                  textAnchor="middle"
                  fontSize="18"
                  fontWeight="800"
                  fill="#b52b1d"
                >
                  {state.pendingDecision.newYaku[0]?.japaneseName ?? "役"}
                </text>
                <text
                  x={44}
                  y={61}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill="#b52b1d"
                >
                  {state.pendingDecision.newYaku[0]?.name} ·{" "}
                  {state.pendingDecision.scoreBreakdown.finalPoints}pt
                </text>
              </svg>
            </div>

            {/* Brush-stroke 'Koi-koi?' calligraphy banner */}
            <div className="hanafuda-koikoi-copy">
              <div className="hanafuda-brush-banner">
                <svg
                  viewBox="0 0 220 38"
                  className="hanafuda-brush-svg"
                  aria-hidden="true"
                >
                  <path
                    className="hanafuda-brush-stroke"
                    d="M8 24 C46 10, 112 30, 212 16"
                    fill="none"
                    stroke="#1e1914"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                </svg>
                <h2
                  id="koi-koi-prompt-heading"
                  className="hanafuda-brush-heading"
                  data-testid="koi-koi-brush-heading"
                >
                  Koi-koi? <span className="hanafuda-brush-jp">来い来い？</span>
                </h2>
              </div>

              <p className="hanafuda-koikoi-detail">
                Formed{" "}
                <strong>
                  {state.pendingDecision.newYaku
                    .map((y) => `${y.name} (${y.japaneseName}, ${y.points} pts)`)
                    .join(", ")}
                </strong>
                . Current round value:{" "}
                <strong>
                  {state.pendingDecision.scoreBreakdown.finalPoints} pts
                </strong>
                {state.pendingDecision.scoreBreakdown.multiplier > 1
                  ? ` (×${state.pendingDecision.scoreBreakdown.multiplier} multiplier)`
                  : ""}
                . Call <em>Koi-koi</em> to press on for more yaku, or call{" "}
                <em>Shobu</em> to bank the points and win the round now.
              </p>

              <div className="hanafuda-koikoi-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  data-testid="decide-koi-koi"
                  onClick={() => handleDecision("koi-koi")}
                >
                  Koi-koi (Continue round)
                </button>
                <button
                  type="button"
                  className="btn"
                  data-testid="decide-shobu"
                  onClick={() => handleDecision("shobu")}
                >
                  Shobu (Bank {state.pendingDecision.scoreBreakdown.finalPoints} pts)
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Round-over / Match-over banner with hanko stamp when a yaku won */}
      {state.phase === "round-over" || state.phase === "match-over" ? (
        <section
          className="hanafuda-round-banner"
          data-testid="round-result-banner"
          aria-label="Round result"
        >
          <div className="hanafuda-round-banner-body">
            {activeYakuBanner.length > 0 ? (
              <div
                className="hanafuda-hanko-stamp hanafuda-hanko-stamp-sm"
                data-testid="hanko-stamp"
                data-yaku-id={activeYakuBanner[0]?.id}
              >
                <span className="hanafuda-hanko-kanji">
                  {activeYakuBanner[0]?.japaneseName}
                </span>
                <span className="hanafuda-hanko-name">
                  {activeYakuBanner[0]?.name}
                </span>
              </div>
            ) : null}
            <div>
              <h2 className="font-semibold">{state.announcement}</h2>
              <p className="text-muted text-xs">
                Score: You {state.scores.human} pts · CPU {state.scores.cpu} pts
              </p>
            </div>
          </div>
          <div className="hanafuda-koikoi-actions">
            {state.phase === "round-over" ? (
              <button
                type="button"
                className="btn btn-primary"
                data-testid="next-round-btn"
                onClick={handleNextRound}
              >
                Deal Round {state.round + 1}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                data-testid="play-again-btn"
                onClick={() => startNewMatch(state.seed)}
              >
                Play match again
              </button>
            )}
          </div>
        </section>
      ) : null}

      {/* Main Washi Tatami Game Table */}
      <div className="hanafuda-table" data-testid="hanafuda-table">
        {/* CPU Opponent Zone */}
        <section
          className="hanafuda-zone hanafuda-cpu-zone"
          aria-label="CPU opponent hand and captured cards"
          data-testid="cpu-zone"
        >
          <div className="hanafuda-zone-header">
            <h2 className="caption">
              CPU Opponent · {state.hands.cpu.length} in hand ·{" "}
              {state.captured.cpu.length} captured
            </h2>
            {state.achievedYaku.cpu.length > 0 ? (
              <div className="hanafuda-yaku-pills" data-testid="cpu-yaku-list">
                {state.achievedYaku.cpu.map((y) => (
                  <span key={y.id} className="hanafuda-yaku-seal">
                    {y.japaneseName} {y.name} ({y.points}pt)
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="hanafuda-cpu-row">
            <ul
              className="hanafuda-cpu-hand"
              aria-label="CPU face-down hand"
              data-testid="cpu-hand"
            >
              {state.hands.cpu.map((c, i) => (
                <li key={c.id} className="hanafuda-cpu-card-slot">
                  <HanafudaCardFaceDown label={`CPU hand card ${i + 1}`} />
                </li>
              ))}
            </ul>

            <div
              className="hanafuda-captured-tray"
              data-testid="cpu-captured"
              aria-label="CPU captured cards"
            >
              {state.captured.cpu.length === 0 ? (
                <span className="text-muted text-xs">No CPU captures yet</span>
              ) : (
                <ul className="hanafuda-captured-list">
                  {state.captured.cpu.map((card) => (
                    <li key={card.id}>
                      <ViewTransition
                        name={`hanafuda-table-${card.id}`}
                        share={TABLE_TRANSITION_CLASSES}
                        enter={TABLE_TRANSITION_CLASSES}
                        exit={TABLE_TRANSITION_CLASSES}
                        default="none"
                      >
                        <HanafudaCardTile
                          card={card}
                          monthlyLog={yearlyLog.months[card.monthKey]}
                          year={yearlyLog.generatedYear}
                          flipped={isCardFlipped(card)}
                          zone="captured"
                          disabled
                        />
                      </ViewTransition>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Field (Ba) & Stock (Yama) Zone */}
        <section
          className="hanafuda-zone hanafuda-field-zone"
          aria-label="Field cards and stock pile"
          data-testid="field-zone"
          data-field-dropzone="true"
          onDragOver={handleFieldDragOver}
          onDrop={handleFieldZoneDrop}
        >
          <div className="hanafuda-zone-header">
            <h2 className="caption">
              Field (Ba) · {state.field.length} cards · Stock:{" "}
              {state.stock.length}
            </h2>
            <div className="hanafuda-field-controls">
              {selectedHandCardId &&
              state.phase === "play-hand" &&
              state.activePlayer === "human" ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  data-testid="discard-to-field"
                  onClick={() => executePlayHandCard(selectedHandCardId, null)}
                >
                  Place selected card on field
                </button>
              ) : (
                <span className="text-muted text-xs">
                  Drag, tap, or use arrow keys + Enter/Space to match by monthly flower suit.
                </span>
              )}
            </div>
          </div>

          <div className="hanafuda-field-layout">
            {/* Stock pile */}
            <div className="hanafuda-stock-pile" data-testid="stock-pile">
              <div className="hanafuda-stock-stack">
                <HanafudaCardFaceDown
                  label={`Stock pile (${state.stock.length} cards remaining)`}
                />
                <span className="hanafuda-stock-badge">
                  山札 · {state.stock.length}
                </span>
              </div>
              {state.pendingMatchChoice ? (
                <div
                  className="hanafuda-pending-card"
                  data-testid="pending-match-card"
                >
                  <span className="caption">Matching card:</span>
                  <HanafudaCardTile
                    card={state.pendingMatchChoice.card}
                    monthlyLog={
                      yearlyLog.months[state.pendingMatchChoice.card.monthKey]
                    }
                    year={yearlyLog.generatedYear}
                    flipped={isCardFlipped(state.pendingMatchChoice.card)}
                    zone="field"
                    selected
                  />
                </div>
              ) : null}
            </div>

            {/* Field cards */}
            <ul
              className="hanafuda-card-grid hanafuda-field-grid"
              data-testid="field-cards"
              aria-label="Field cards"
            >
              {state.field.map((card) => {
                const isMatchable = selectedMatchingFieldIds.has(card.id);
                const isChoiceCandidate = choiceCandidateIds.has(card.id);
                return (
                  <li key={card.id} className="hanafuda-card-slot">
                    <ViewTransition
                      name={`hanafuda-table-${card.id}`}
                      share={TABLE_TRANSITION_CLASSES}
                      enter={TABLE_TRANSITION_CLASSES}
                      exit={TABLE_TRANSITION_CLASSES}
                      default="none"
                    >
                      <HanafudaCardTile
                        card={card}
                        monthlyLog={yearlyLog.months[card.monthKey]}
                        year={yearlyLog.generatedYear}
                        flipped={isCardFlipped(card)}
                        matchable={isMatchable}
                        choiceCandidate={isChoiceCandidate}
                        zone="field"
                        onActivate={handleFieldCardActivate}
                        onFlip={toggleCardFlip}
                        onKeyDown={handleFieldKeyDown}
                        onDragOver={handleFieldDragOver}
                        onDrop={handleFieldCardDrop}
                      />
                    </ViewTransition>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Human Player Hand & Captured Zone */}
        <section
          className="hanafuda-zone hanafuda-human-zone"
          aria-label="Your hand and captured cards"
          data-testid="human-zone"
        >
          <div className="hanafuda-zone-header">
            <h2 className="caption">
              Your Hand ({state.hands.human.length}) · Matching cards glow in vermilion
            </h2>
            {state.achievedYaku.human.length > 0 ? (
              <div
                className="hanafuda-yaku-pills"
                data-testid="human-yaku-list"
              >
                {state.achievedYaku.human.map((y) => (
                  <span
                    key={y.id}
                    className="hanafuda-yaku-seal"
                    data-testid={`achieved-yaku-${y.id}`}
                  >
                    {y.japaneseName} {y.name} ({y.points}pt)
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <ul
            className="hanafuda-card-grid hanafuda-hand-grid"
            data-testid="human-hand"
            aria-label="Your hand cards"
          >
            {state.hands.human.map((card) => {
              const hasFieldMatch =
                (playableMatches[card.id]?.length ?? 0) > 0;
              const isSelected = selectedHandCardId === card.id;
              return (
                <li key={card.id} className="hanafuda-card-slot">
                  <ViewTransition
                    name={`hanafuda-table-${card.id}`}
                    share={TABLE_TRANSITION_CLASSES}
                    enter={TABLE_TRANSITION_CLASSES}
                    exit={TABLE_TRANSITION_CLASSES}
                    default="none"
                  >
                    <HanafudaCardTile
                      card={card}
                      monthlyLog={yearlyLog.months[card.monthKey]}
                      year={yearlyLog.generatedYear}
                      flipped={isCardFlipped(card)}
                      selected={isSelected}
                      matchable={hasFieldMatch}
                      draggable={
                        state.phase === "play-hand" &&
                        state.activePlayer === "human"
                      }
                      disabled={
                        state.phase !== "play-hand" ||
                        state.activePlayer !== "human"
                      }
                      zone="hand"
                      onActivate={handleHandCardActivate}
                      onFlip={toggleCardFlip}
                      onKeyDown={handleHandKeyDown}
                      onDragStart={handleHandDragStart}
                      onPointerDown={handleHandPointerDown}
                    />
                  </ViewTransition>
                </li>
              );
            })}
          </ul>

          <div
            className="hanafuda-captured-tray hanafuda-human-captured"
            data-testid="human-captured"
            aria-label="Your captured cards"
          >
            <div className="hanafuda-zone-header">
              <span className="caption">
                Your Captured Cards ({state.captured.human.length})
              </span>
            </div>
            {state.captured.human.length === 0 ? (
              <p className="text-muted text-xs">
                Capture cards by matching monthly flower suits (01 Pine through 12 Paulownia).
              </p>
            ) : (
              <ul className="hanafuda-captured-list">
                {state.captured.human.map((card) => (
                  <li key={card.id}>
                    <ViewTransition
                      name={`hanafuda-table-${card.id}`}
                      share={TABLE_TRANSITION_CLASSES}
                      enter={TABLE_TRANSITION_CLASSES}
                      exit={TABLE_TRANSITION_CLASSES}
                      default="none"
                    >
                      <HanafudaCardTile
                        card={card}
                        monthlyLog={yearlyLog.months[card.monthKey]}
                        year={yearlyLog.generatedYear}
                        flipped={isCardFlipped(card)}
                        zone="captured"
                        onFlip={toggleCardFlip}
                      />
                    </ViewTransition>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Monthly Shipped Log & Full 48-Card Deck Inspector */}
      <section
        className="hanafuda-log-section"
        data-testid="monthly-log-deck"
        aria-labelledby="monthly-log-heading"
      >
        <div className="hanafuda-log-header">
          <div>
            <h2 id="monthly-log-heading" className="caption">
              Monthly Shipped Log & 48-Card Washi Deck ({yearlyLog.generatedYear})
            </h2>
            <p className="mt-1 text-muted text-xs">
              Flip any month’s card back to inspect what shipped on otohime.dev that calendar month from{" "}
              <code>content/yearly-log.json</code>.
            </p>
          </div>
          <div className="hanafuda-month-pills" role="group" aria-label="Flip month log">
            {MONTH_KEYS.map((key) => {
              const mLog = yearlyLog.months[key];
              const isFlipped = flippedMonths[key];
              return (
                <button
                  key={key}
                  type="button"
                  className="btn btn-sm hanafuda-month-pill"
                  aria-pressed={isFlipped}
                  data-testid={`flip-month-${key}`}
                  onClick={() => toggleMonthFlip(key)}
                >
                  {key} {mLog.flower}
                  {mLog.shippedProjects.length > 0
                    ? ` (${mLog.shippedProjects.length})`
                    : mLog.notes.length > 0
                      ? ` (${mLog.notes.length}n)`
                      : ""}
                </button>
              );
            })}
          </div>
        </div>

        {/* Highlighted Monthly Log Inspector Card for selectedLogMonth */}
        <div
          className="hanafuda-month-spotlight"
          data-testid="monthly-log-spotlight"
          data-spotlight-month={selectedLogMonth}
        >
          <HanafudaCardBack
            card={
              HANAFUDA_DECK.find((c) => c.monthKey === selectedLogMonth) ??
              HANAFUDA_DECK[0]
            }
            monthlyLog={yearlyLog.months[selectedLogMonth]}
            year={yearlyLog.generatedYear}
          />
        </div>

        {/* All 48 SVG Cards across the 12 monthly flower suits */}
        <ul
          className="hanafuda-deck-gallery"
          data-testid="full-48-deck"
          aria-label="All 48 Hanafuda cards across 12 months"
        >
          {HANAFUDA_DECK.map((card) => {
            const flipped = isCardFlipped(card);
            return (
              <li
                key={card.id}
                className="hanafuda-deck-item"
                data-deck-item-id={card.id}
                data-deck-month={card.monthKey}
              >
                <HanafudaCardTile
                  card={card}
                  monthlyLog={yearlyLog.months[card.monthKey]}
                  year={yearlyLog.generatedYear}
                  flipped={flipped}
                  zone="deck"
                  onActivate={() => toggleCardFlip(card)}
                  onFlip={toggleCardFlip}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {/* Yaku Reference Drawer */}
      <details className="hanafuda-yaku-guide">
        <summary className="caption cursor-pointer">
          12 Standard Koi-Koi Yaku Reference (7+ points double; opponent Koi-Koi reversal doubles)
        </summary>
        <dl className="hanafuda-yaku-dl mt-3">
          {ALL_YAKU_IDS.map((id) => {
            const def = YAKU_DEFINITIONS[id];
            return (
              <div key={id} className="hanafuda-yaku-guide-row">
                <dt>
                  <strong>
                    {def.japaneseName} · {def.name}
                  </strong>{" "}
                  <span className="badge">{def.basePoints} pts</span>
                </dt>
                <dd className="text-muted text-xs">{def.description}</dd>
              </div>
            );
          })}
        </dl>
      </details>
    </div>
  );
}
