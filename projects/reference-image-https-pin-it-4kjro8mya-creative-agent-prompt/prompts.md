# Ink & Watercolour Portraits — prompt pack

Plan: pm-240. This is creative direction, not a claim that any picture exists.
Use the shared block verbatim before each concept. Generate each painting separately.

## Reference and originality

Style reference: https://www.pinterest.com/pin/248120260716380781/
Original image: https://i.pinimg.com/originals/41/9a/49/419a49689748e94025c4a9f00d06347b.jpg
The prior research inspected the image. The publishing run must view it again.
Study its varied black contours, teal/ochre transparent washes, overshooting strokes,
sparse face and dissolving silhouette. Borrow those visual techniques, not its face or pose.
The Reader is seated and seen from the front at three-quarter angle, without a headscarf.
All subjects are original adults, age 20–30. Exactly one woman per painting.

## Shared style

> Expressive hand-drawn ink and watercolour illustration of one young adult woman, in the manner of a quick sketchbook study. Energetic black ink contours of varying weight, confident minimal strokes for the face, overlapping and overshooting lines, a few scribbles and unfinished passages. Loose transparent watercolour washes with concentrated pigment in places, hard irregular wet edges, granulation, bleeding, small splatters. Clothing, hair and fabric folds handled impressionistically; large areas left as bare off-white paper (#faf8f3); contours dissolve into the paper toward the bottom. Restrained palette of three to five colours with saturated accents against pale washes and deep ink black. Asymmetrical editorial composition, portrait 3:4, no border, no text, no watermark, no signature. Not: polished digital painting, anime rendering, photorealism, clean uniform outlines, detailed background, paper grain, sketchbook spine.

Keep a subtle natural pigment texture and paper tone; avoid a photographic paper grain overlay.
Let visible anatomical landmarks guide convincing hands; partially occluded fingers need not all be shown.
No decorative frame in the artwork; the site's existing sheet border is separate.

## Individual compositions

1. **Reader.** Seated, three-quarter view from the front, book held low in her lap, head tilted down, hair loosely tied and partly loose; oversized teal-blue coat, warm ochre scarf; palette teal, ochre, ink, a touch of red. Focal: the hands on the book. (Changed from the brief's profile so it is not the reference.)
2. **Wildflowers.** Standing, body turned left, face toward the viewer, messy low bun; loose cream blouse, muted burgundy skirt; small bouquet of wildflowers held at chest height; palette burgundy, cream, sap green, a yellow accent. Focal: the bouquet against the blouse.
3. **Rain.** Full profile facing left, shoulder-length black hair, chin slightly lifted; moss-green trench coat, mustard scarf; a transparent umbrella drawn as a few arcs, rain as diagonal dry strokes; palette moss, mustard, grey wash. Focal: the face under the umbrella's edge.
4. **Café.** Seated at a table, chin on one hand, elbow on the table, elegant short bob; dark navy cardigan over an ivory blouse; one coffee cup, nothing else on the table; palette navy, ivory, a warm brown; the far side of the table left blank. Focal: the eyes, looking past the viewer.
5. **Leaves.** Walking, three-quarter from behind, head turned back over her shoulder, long hair streaming; rust-red overcoat, charcoal skirt; six or seven leaves drawn as single strokes around her; palette rust, charcoal, ochre. Focal: the turn of the head.
6. **Violin.** Standing, three-quarter, eyes closed, relaxed updo; flowing midnight-blue dress; violin under the chin, bow mid-stroke; palette midnight blue, warm wood brown, ink. Focal: the bow hand.
7. **Window.** Seated on a sill in profile, knees drawn up, loosely braided hair; pale lavender sweater, soft grey trousers; a cup of tea held in both hands; the window as two vertical lines and a pale wash of light; palette lavender, grey, a warm yellow wash. Focal: the cup and the light on her face.
8. **Painter.** Three-quarter view, messy ponytail, looking down at a brush in one hand and a small palette in the other; white shirt under a cobalt-blue work jacket; a splash of cobalt on the sleeve; palette cobalt, white, a few palette daubs. Focal: the brush tip.
9. **Breeze.** Frontal, hair blowing across her face hiding one eye, a single flower held up near her shoulder; flowing sage-green dress, pale blush-pink shawl; palette sage, blush, ink. Focal: the visible eye.
10. **Letter.** Seated at a small wooden table seen from a high three-quarter angle, head bent, loosely pinned hair with strands falling; warm brown cardigan, muted blue skirt; a pen and one sheet, a second sheet beside it; palette brown, muted blue, ochre table. Focal: the writing hand.

## Deliverable mapping

| PNG master filename | JPEG derivative label | Gallery title | Caption |
|---|---|---|---|
| 01_Quiet_Reader.png | 13-reader.jpg | Reader | Page forty, and the kettle can wait. |
| 02_Flower_Girl.png | 14-flowers.jpg | Wildflowers | Picked on the way, for no one in particular. |
| 03_Rainy_Afternoon.png | 15-rain.jpg | Rain | A clear umbrella keeps the sky in view. |
| 04_Cafe_Dreamer.png | 16-cafe.jpg | Café | The cup went cold while she was elsewhere. |
| 05_Autumn_Wanderer.png | 17-leaves.jpg | Leaves | The wind had the last word. |
| 06_Violinist.png | 18-violin.jpg | Violin | Eyes closed, the hard bar coming up. |
| 07_Morning_by_the_Window.png | 19-window.jpg | Window | Tea, and a street that is not awake yet. |
| 08_Painter.png | 20-painter.jpg | Painter | Cobalt on the sleeve, as usual. |
| 09_Spring_Breeze.png | 21-breeze.jpg | Breeze | Hair across her face, one stem held still. |
| 10_Letter_Writer.png | 22-letter.jpg | Letter | Three lines in, and already a second sheet. |

## Generation and selection

Consult current primary xAI docs before submitting. Planning baseline: model
`grok-imagine-image-2.0`, aspect_ratio `3:4`, resolution `2k`; use the documented
JSON edit endpoint for a style reference, or text generation if editing copies the
reference composition. Never silently substitute a different model mid-collection.
Start with one candidate per concept; generate replacements only for named defects,
up to four candidates per concept (40 total). Reuse an approved keeper as a style
reference if needed, without duplicating its pose. Do not pass an undocumented seed.
Log actual model, quality, dimensions, full prompt, endpoint, request/attempt id,
reference hashes, raw candidate hash, chosen/rejected status and reason. A seed is
recorded only if actually supported and returned; otherwise write `not supported`.
This supports traceability, not a promise of deterministic output.

Keep native output in scratch, losslessly encode the selected master as PNG, and
preserve its native pixel dimensions. Target at least 1536×2048; never upscale to
pretend that a lower resolution is native. If the available API cannot meet the
preferred size, record the actual largest native 3:4 size and the limitation.
Create a 1152×1536 JPEG derivative under 600,000 bytes without cropping the figure.
Upload the named masters and derivatives to xAI Files without file expiry and create
non-expiring public URLs. Verify anonymous downloads before activating any gallery row.
Do not commit images, contact sheets, credentials or signed/temporary URLs.

View all ten individually at full resolution and together on a temporary contact
sheet. Record an individual pass/reject decision for anatomy, face/hands, ink variation,
organic washes, palette, one adult woman, sparse background, absence of text/signatures,
pose originality and collection consistency. Regenerate a failing concept and inspect
the replacement. The contact sheet is optional and stored with durable review artifacts,
not git. QA independently downloads and inspects all ten selected masters.

## Primary API references checked on 2026-10-25

- [Generation](https://docs.x.ai/developers/model-capabilities/images/generation)
- [Editing](https://docs.x.ai/developers/model-capabilities/images/editing)
- [Persistent public URLs](https://docs.x.ai/developers/files/public-urls)
- [Persisting generated output](https://docs.x.ai/developers/model-capabilities/imagine/files/outputs)

These supersede the older API/settings suggestions in research.md.
