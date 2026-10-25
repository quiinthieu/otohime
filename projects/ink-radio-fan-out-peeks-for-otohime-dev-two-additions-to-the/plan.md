# Ink Radio and Peeks (pm-247)

## Outcome

Add site-wide Fan-out Peeks to selected tags, credits and project links, then add an experimental Ink Radio below Television on `/music`. Both use the existing paper and ink visual language. Core links and music remain usable if enhancements fail.

## Delivery decisions

- Peeks use declarative markers and one shared client layer. A committed relation index comes from existing site and article content; each marked target resolves to three distinct internal items. Keep the original link behavior. Hover opens after brief intent, focus opens immediately, touch long-press opens after about 450 ms and cancels on movement. Escape closes. Cards are ordinary links. Reduced motion removes fanning and stagger.
- Keep peek styling in a separate CSS file. Do not increase the custom property count in `app/(site)/globals.css`.
- Radio Browser is used only when generating a committed station snapshot. Verify its live API, terms and fields before generating. Filter HTTPS, healthy, geolocated MP3/AAC stations; curate names and destinations. Record source and retrieval date. Runtime never needs directory availability.
- Radio is lazy loaded on `/music`. The user must explicitly start playback. Stop the Television when Radio starts and stop Radio when Television starts, using one local playback coordination path. Provide slider keyboard controls, visible nearby station choices, live status, no-signal fallback and reduced-motion behavior.
- Automated browser checks stub audio and simulate failure. They make no claim that a live third-party stream works. QA independently tries a real HTTPS station and a blocked source; availability is reported as an external limitation, not hidden.

## Contracts, in execution order

1. **Peek relation data.** Build and test deterministic three-item relationships from current content. Verify output freshness and valid internal destinations. This is internal plumbing.
2. **Fan-out Peeks.** Add the shared layer, marked links, CSS, interactions and View Transition navigation. Check hover, keyboard, touch and reduced motion. Ensure existing links still navigate without the layer.
3. **Radio snapshot and tuning logic.** Verify Radio Browser facts live, commit curated HTTPS stations and attribution, add projection/selection and failure-state pure logic with tests. This is internal plumbing.
4. **Ink Radio.** Add the lazy `/music` section, SVG controls and audio lifecycle. Coordinate Television playback and test the no-signal and no-autoplay paths.
5. **Independent QA.** Exercise new behavior in a built app, including negative controls on unmarked links and rejected HTTP streams. Record real/fake boundaries and regressions.

Every software engineer task runs its listed checkout-local verification at the delivery SHA. No task requires a scheduled run, operator step or soak. The implementation tasks stop after push; staging and independent browser evidence belong to QA and acceptance.
