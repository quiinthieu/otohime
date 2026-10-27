"use client";
import { addTransitionType, startTransition, useEffect, useRef, useState, useSyncExternalStore, ViewTransition } from "react";
import { projectStories } from "@/content/project-stories";
import { acceptsArrow, advanceCard, selectProject } from "@/lib/kamishibai";
import { babble } from "@/lib/ink-babble";
import { getServerSound, getSound, setSound, startStoryVoice, stopStoryVoice, subscribeSound } from "@/lib/sound-client";
import { CardArt } from "./art";
const slides = { "kamishibai-next": "kamishibai-next", "kamishibai-prev": "kamishibai-prev", default: "none" };
export default function Stage({ readAll }: { readAll: () => void }) {
  const [state, setState] = useState(() => selectProject(Object.keys(projectStories)[0]));
  const current = useRef(state);
  const sound = useSyncExternalStore(subscribeSound, getSound, getServerSound);
  const story = projectStories[state.project];
  const card = story.cards[state.card];
  useEffect(() => () => stopStoryVoice(), []);
  function change(project: string, index: number, direction: number) {
    stopStoryVoice();
    const next = { project, card: index };
    const old = current.current;
    if (old.project === project && old.card === index) return;
    current.current = next;
    startStoryVoice(babble(projectStories[project].cards[index].caption, index + 269));
    const update = () => setState(next);
    if (typeof document.startViewTransition === "function") {
      startTransition(() => { addTransitionType(direction < 0 ? "kamishibai-prev" : "kamishibai-next"); update(); });
    } else update();
  }
  function advance(delta: number) {
    const s = current.current;
    change(s.project, advanceCard(s.card, delta, projectStories[s.project].cards.length), delta);
  }
  return <div className="kamishibai-enhanced" data-own-sound="" onKeyDown={e => {
    const target = e.target;
    if (!(target instanceof HTMLElement) || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    if (!acceptsArrow({ tagName: target.tagName, blocked: !!target.closest('[contenteditable]:not([contenteditable="false"]), dialog, [role="dialog"], [data-pocket]') }, e.key)) return;
    e.preventDefault(); advance(e.key === "ArrowRight" ? 1 : -1);
  }}>
    <div className="kamishibai-tools">
      <label>Project <select value={state.project} onChange={e => change(e.target.value, 0, 1)}>
        {Object.values(projectStories).map(p => <option key={p.href} value={p.href}>{p.title}</option>)}
      </select></label>
      <button className="btn" type="button" aria-pressed={sound} onClick={() => {
        setSound(!sound);
        if (!sound) startStoryVoice(babble(card.caption, state.card + 269));
      }}>{sound ? "Mute theatre sound" : "Enable theatre sound"}</button>
    </div>
    <p className="kamishibai-stage-label">紙芝居 · {story.title}</p>
    <div className="kamishibai-wood">
      <div className="kamishibai-stack">
        <ViewTransition key={card.id} name="kamishibai-story-card" share={slides} enter={slides} exit={slides} default="none">
          <article className="kamishibai-card" aria-labelledby="kamishibai-card-title">
            <CardArt card={card} /><h3 id="kamishibai-card-title">{card.title}</h3><p>{card.caption}</p>
          </article>
        </ViewTransition>
      </div>
    </div>
    <div className="kamishibai-tools" role="group" aria-label="Story navigation">
      <button className="btn" type="button" aria-disabled={state.card === 0} onClick={() => advance(-1)}>Previous card</button>
      <p role="status" aria-live="polite">Card {state.card + 1} of {story.cards.length}</p>
      <button className="btn" type="button" aria-disabled={state.card === story.cards.length - 1} onClick={() => advance(1)}>Next card</button>
    </div>
    <p className="kamishibai-tools"><button className="btn" type="button" onClick={readAll}>Read all cards</button><a href={story.href}>Visit {story.title} →</a></p>
    <p className="kamishibai-hint">Use left and right arrows while a theatre button has focus. Sound is optional gibberish, never recorded speech.</p>
  </div>;
}
