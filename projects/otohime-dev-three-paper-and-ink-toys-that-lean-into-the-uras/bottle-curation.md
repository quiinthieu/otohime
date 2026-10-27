# Bottle launch curation

Review date: **2026-10-26**. Reviewer: engineering run `run-9049` (pm-269/t-1587).
Each source below was opened individually over HTTPS and its returned page content inspected. Final URL is the shipped canonical URL, without trackers or fragments. Notes in `content/bottles.json` are original editorial sentences, not excerpts from the destination. These are deliberately chosen discoveries, not a crawler-generated list.

| Seed | Source inspected | Final URL | Content rationale / observed review evidence |
| --- | --- | --- | --- |
| neal | [Neal.fun](https://neal.fun/) | `https://neal.fun/` | Independent maker's playful web collection; page identifies Neal and his games. A compact starting point for curiosity. |
| nicky | [Nicky Case](https://ncase.me/) | `https://ncase.me/` | Personally authored playable explanations; inspected the play/read/watch sections and credits. Fits discovery through interaction. |
| ciechanowski | [Bartosz Ciechanowski](https://ciechanow.ski/) | `https://ciechanow.ski/` | Inspected the Moon article's diagram/slider explanations. Patient interactive science, aligned with Otohime's small scientific toys. |
| pudding | [The Pudding](https://pudding.cool/) | `https://pudding.cool/` | Independent visual publication; inspected story directory and team/support links. Included for visual storytelling and data as a creative medium. |
| red-blob | [Red Blob Games](https://www.redblobgames.com/) | `https://www.redblobgames.com/` | Amit Patel's interactive explanations, pathfinding and map-making demonstrations; inspected Learn/Play and authorship sections. Strong fit for people who like tinkering. |
| patatap | [Patatap](https://patatap.com/) | `https://patatap.com/` | Inspected the animation/sound description, creator credits and explicit flashing-images warning. The original Bottle note retains that warning. Audio begins on destination interaction. |
| window-swap | [WindowSwap](https://www.window-swap.com/) | `https://www.window-swap.com/` | Inspected rendered browser text: open a window, named Italian view, submission and pricing controls. A calm participatory artwork; optional subscription exists, no purchase needed to land. Video playback was not independently audited. |
| explorables | [Explorable Explanations](https://explorabl.es/) | `https://explorabl.es/` | Inspected its learning-through-play introduction, directory link and open-source credits. Community-made explanations with a clear playful purpose; discovery tiles require JS. |
| pixel-moon | [If the Moon Were Only 1 Pixel](https://joshworth.com/dev/pixelspace/pixelspace_solarsystem.html) | `https://www.joshworth.com/dev/pixelspace/pixelspace_solarsystem.html` | Observed redirect to www; inspected planetary labels, distance units and the scrolling narrative. A web artwork about space and scale, complementing the site's Orrery. |
| silk | [Silk](https://weavesilk.com/) | `https://weavesilk.com/` | Inspected color, mirror, spiral and undo controls plus Yuri Vishnevsky's credits. Generative drawing is an inviting companion to the site's paper experiments. |
| neon-flames | [Neonflames](https://29a.ch/sandbox/2011/neonflames/) | `https://29a.ch/sandbox/2011/neonflames/` | Inspected the experiment's Clear/Share/Download/Tweak controls and parent experiments link. A single-purpose independent drawing artwork. |
| little-alchemy | [Little Alchemy 2](https://littlealchemy2.com/) | `https://littlealchemy2.com/` | Inspected browser-rendered PLAY, air/earth/fire/water, cleanup/revert/settings and encyclopedia controls. A combination toy that rewards experimentation; no claim that every recipe was played. |

Review limits: content/identity/entry-control inspection, not an accessibility audit or a guarantee that external content will never change. No external HTML, screenshots, thumbnails or binaries are shipped. Three initially considered entries (Sandspiel, Orb.Farm and Radio Garden) were left out because the available first-load browser evidence showed blank/loading shells. They were not silently counted as exercised toys. Screenshot scratch files stayed outside Git.

The application never fetches submitted URLs, follows their redirects or embeds their content. Approval is a human editorial action inside the existing owner/admin area; seeds are reviewed source data shipped with the build. A rejected suggestion does not override a separately reviewed seed with the same URL (curated precedence).
