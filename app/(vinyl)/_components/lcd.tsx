import type { Lcd as LcdText } from "../_lib/deck.ts";
import type { VinylRecord } from "../_lib/records.ts";

// The now-playing display. The live region announces the record and its
// status; the ticking time sits outside it, so it is never read out.
export function Lcd({ lcd, record }: { lcd: LcdText; record: VinylRecord | null }) {
  const tracks = record?.tracks ?? [];
  return (
    <section className="lcd" aria-label="Now playing">
      <div className="lcd-live" aria-live="polite" aria-atomic="true">
        <p className="lcd-title">{lcd.title}</p>
        <p className="lcd-artist">{lcd.artist || " "}</p>
        <p className="lcd-status">{lcd.status}</p>
      </div>
      <p className="lcd-time">{lcd.time || "-:-- / -:--"}</p>
      {tracks.length > 0 && (
        <div className="sides">
          {(["A", "B"] as const).map((side) => {
            const list = tracks.filter((t) => t.side === side);
            return list.length ? (
              <div key={side}>
                <p className="side">Side {side}</p>
                <ol>
                  {list.map((t, i) => (
                    <li key={i}>{t.title}</li>
                  ))}
                </ol>
              </div>
            ) : null;
          })}
        </div>
      )}
    </section>
  );
}
