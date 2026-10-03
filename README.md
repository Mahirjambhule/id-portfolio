# Angel — portfolio

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, GSAP + ScrollTrigger and Lenis.

```bash
npm run dev     # http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
npm run lint
```

## Making it yours

| What | Where |
| --- | --- |
| Name, role, availability, badge serial, QR target, email, links, closing words | `src/lib/site.ts` |
| Hero headline, supporting line, buttons | `src/components/hero/hero.tsx` |
| Identity: what the scanner reads off the badge | `identity` in `src/lib/site.ts` |
| Identity: how slowly the scan reads (how much scroll it is given) | `SCAN` in `src/components/identity/identity.tsx` |
| Selected work: project names, lines, descriptions, stacks, links, and each one's accent and light | `src/lib/work.ts` |
| Selected work: the orbit, its motion, its material and the type on the cards | `src/components/work/` |
| How I work: each step's words | `src/lib/process.ts` |
| Contact: the back of the badge and the last words | `contact` and `closing` in `src/lib/site.ts` |
| How fast the page scrolls, and how long pinned sections are | `src/components/smooth-scroll.tsx`, `src/lib/pace.ts` |
| The olive branch's shadow: where it grows, how faint and soft it is | `WINDOW_BRANCH` in `hero-scene.tsx` and `.wall__leaves`; `LATE_BRANCH` in `contact.tsx` and `.contact-backdrop__leaves` |
| Colours (the one accent is the cobalt, `--color-cobalt`), fonts, the badge's materials | `src/app/globals.css` |
| The picture shown where a link to the site is shared | `src/app/opengraph-image.tsx` |
| The page shown for an address that does not exist | `src/app/not-found.tsx` |
| Logo | `public/angel-logo.png` |
| Portrait | `public/angel-portrait.png` |
| Resume | `public/angel-resume.pdf` |

The page runs Hero, Identity, Selected Work, How I Work, Contact. `src/components/about.tsx` is still in the
repository but is no longer on the page.

`url`, `email` and the links under `contact` in `site.ts` are placeholders, and the resume in
`public/` is a stand-in. Change them before going live: the QR code on the badge encodes `url`, and
the address of the picture shown where the site is shared is built from it.

That picture is the hero as a still: the greeting beside the studio pass, set in the site's own
type. It is made at build time from `site.ts`, the logo and the portrait, so it follows them when
they change. Its fonts are fetched from Google Fonts when it is built, as `next/font` fetches the
page's.

The scan and the closing section are each one pinned screen, so their words have to fit in it. On a
phone the scan's read-out sits under the card: where it does not fit, the closing line gives way
first, then everything closes up a little, then the link on to the work (measured on the device;
`CRAMPED` in `identity.tsx`). On a very tall screen the closing card is let down so that it and its
words share the middle (`CLOSE_ROOM` in `hero-scene.tsx`). The longer the facts and the closing
words, the sooner a phone has to give something up.

The scan moves only with the scroll, in both directions, and never by itself. It is slow because it
is given a great deal of scroll (`SCAN`, in seconds of film; at the page's pace, 5 is about a viewport
and three quarters): each turn of the wheel moves the beam a little, and the facts are read out one at
a time as it reaches them. Scrolled back up, the card comes back into the scanner and the facts go
again, one at a time, as the beam goes back up the card.

The card is carried to the scanner on its cord, and a fast scroll can get there before it has. So
the beam never reads an empty scanner: until the card hangs still inside it (`direction.placed`,
written by the scene), the beam waits at the top and the scanner says "Aligning". Once the card is
in place, the beam catches up with the page (`CATCH_UP`, `WAIT_MOST` in `identity.tsx`). At an
ordinary pace the card is there before the beam sets off, and the scan simply follows the scroll.

### Replacing the images

Overwrite `public/angel-logo.png` or `public/angel-portrait.png`, keeping the file name. Nothing else
needs to change:

- The logo can have any amount of empty margin, on a transparent or a flat background. Its artwork is
  measured and cropped automatically, and it is scaled to fit the space in the header and on the badge.
- The portrait is cropped to the badge's photo window. `object-position` on `.badge__portrait` in
  `globals.css` sets which part of the photo is kept.

The favicon (`src/app/icon.png`) is a separate file and does not follow the logo.

## How the hero works

```
src/components/hero/
  hero.tsx             Layout, copy and its reveal (Web Animations), scroll fade (GSAP)
  hero-scene.tsx       The wall, lanyard, badge, shadow and dust. One ticker drives it all
  badge-card.tsx       The badge's markup, rendered on the server
  lanyard-physics.ts   The simulation. No DOM, no framework
  lanyard-render.ts    Draws the braided cord, ferrule and ring on a canvas
  dust.ts              Dust motes
  foliage.ts           The shadow of an olive branch outside the window
```

The badge is real DOM, so its type stays sharp at any pixel density. It hangs from a
cord simulated as a double pendulum with an elastic, slack-capable cord (XPBD, fixed sub-steps, so it
behaves the same at 60, 120 or 144 Hz). Everything the visitor does is an input to that simulation
rather than a separate animation:

- **Load** lowers the pivot from above the viewport. The cord runs out while the badge is still
  moving, so it stretches, recoils and swings.
- **Pointer** moves the air (a small sideways force), bows the cord and sets where the badge turns to
  face. Reflections, edge glints, shading and the shadow are all derived from the badge's angles.
- **Scroll** raises the pivot again and gives the badge one push.

The copy is revealed when the swing has calmed below a threshold, not on a timer. The browser plays
that reveal itself (the Web Animations API), so it does not wait on the main thread, which the scene
keeps busy.

The room has a breeze of its own, which the badge sways in. The scene publishes it as
`direction.air`, and the shadow of an olive branch outside the window stirs in the same air: the
stem leans, the twigs rock and each leaf flutters and turns, so its shadow narrows and widens. The
branch is grown from a seed (no image), drawn at half resolution into the upper half of the window's
light, and softened and slanted to match that light by CSS. It comes up with the light once the
badge has settled, and keeps moving wherever the wall can be seen.

The badge, its cord and its shadow are drawn every frame. The dust and the branch move slowly, so
they are drawn thirty times a second (`DUST_RATE` here, `RATE` in `foliage.ts`), which shows all
there is to see for half the work.

Tuning lives at the top of `hero-scene.tsx` (`GRAVITY`, `DROP_*`, `SETTLE_*`, `YAW_REACH`, …) and in
`paramsFor()` for drag, stiffness and the cord's bending.

Visitors who ask for reduced motion get the finished composition with no drop, swing or parallax.

Three.js is deliberately not used. The badge needs crisp DOM text and the cord is a 2D simulation, so
WebGL would have added well over 100 kB of script for no visible gain.

## How Selected Work works

```
src/components/work/
  work.tsx          The orbit: the 3D space, the film of turns, the pointer, the room's light
  work.css          The room, the stage, the slabs' material and the type set on them
src/lib/work.ts     The projects: their words, their accent and the light they hang in
src/lib/pace.ts     The page's pace: how much scroll one second of animation is worth
```

The section opens on its title, "Selected *work*", which stays at the top of the stage the whole way
through. Under it the projects ride one elliptical orbit round a point behind the middle of the stage,
like pieces on a turntable in a gallery. The one at the front faces the visitor square on. Its
neighbours wait behind it on either side: smaller (0.82), fainter, slightly out of focus, a little
higher and turned to follow the curve. The fourth is out of sight across the back. Every card is a
slab with real thickness in one shared 3D space (`perspective()` on the orbit, `preserve-3d` down to
each layer, no WebGL): a back and a face a little apart, so it shows an edge as it turns, and a
shadow on a plane of its own behind it.

The stage pins, and from there the wheel turns the orbit instead of moving the page. All of it is
one GSAP timeline with the scroll as its playhead: every step of the wheel turns the orbit a little,
the next project swings round to the front while the last is carried away behind, and nothing snaps
or moves by itself. The visitor goes in, through and out at their own speed, in either direction,
and a reload comes back to the same frame. A neighbour can be clicked to bring it round, and a link
the keyboard reaches is brought round to meet it.

Only the card at the front answers the pointer. It tilts away from it (3° at most), its reflection
follows it, its shadow moves the other way, and its words lift a little towards it. On the clock
rather than the film, it floats a few pixels and its long reflection drifts.

The cards carry nothing but words, set like a page of a catalogue: the project's category over a
hairline, its name large with one line under it (the line's last words in italic), and under a
second hairline what it is, what it was built with and "View project". The face is left clear
above the name, so the room's reflections have the acrylic to themselves. Under the orbit lies a
turntable in fine graphite, a rim with marks round it and a mark under each card, which turns with
the orbit; the mark under the card at the front is filled in.

- `TURN` (a quarter of the orbit) and `LINGER` at the top of `work.tsx` are in seconds;
  `scrollFor()` from `src/lib/pace.ts` turns them into scroll distance. Change
  `VIEWPORTS_PER_SECOND` there to make every pinned section on the page faster or slower together.
- `ACROSS`, `DEPTH`, `RISE`, `LENS` and `YAW` set the orbit's shape, in card sizes, and `SIDE` how a
  card looks a quarter of the way round. Cards are sized to the stage when it is measured:
  landscape on a wide screen, portrait on a narrow one.
- Add or remove projects in `src/lib/work.ts`, giving each an accent and a light. The orbit is laid
  out for four and takes three to six; the room's light, the turntable's marks and the small orbit
  under the cards follow the list.
- Reduced motion, no JavaScript, or a viewport under 560px tall: the cards are simply stacked under
  the title, with no pinning.

On a large display (an iMac or a Studio Display) the card grows up to `CARD_MOST` (1160px) wide, and
the type on it grows with it. Each card is also stacked by how near it is (`z-index`), so the
nearer cards stay in front even in a browser that draws the 3D space flat.

It is built to hold 60 frames a second on an integrated GPU, which shapes a few choices:

- Once the stage has locked into place it is opaque (`data-sealed` on the stage), so nothing behind
  it is drawn while the orbit turns. Its top closes over the wall within the first step of the wheel.
- Nothing is painted again while it moves. During a turn the slabs are scaled as they were painted,
  and painted afresh, sharp, once they rest (`[data-turning]` in `work.css`). The reflections and the
  shadows have layers of their own, the shadows are box shadows painted once rather than blur
  filters, and the neighbours' blur goes in half-pixel steps, so it can be kept from frame to frame.
- The room's dust is drawn thirty times a second (`DUST_RATE` in `work.tsx`), and only while the
  stage can be seen. The room is not drawn at all while the stage is more than a screen away.

## How I Work works

```
src/components/process/
  process.tsx         The four cards, and how the scroll sets them
  process.css         Their paper and their type
src/lib/process.ts    The words: where each step comes, its name, a sentence and what comes of it
```

Between the selected work and the closing section, four cards hang on the same wall, one for each
step of a project. They carry nothing but words: where the step comes ("First", "Then", "Next",
"Finally", in place of a number), its name with the words that finish it in italic on a line of
their own, a sentence, and under a hairline what comes of it. The section begins under the short
tail of the selected work (12vh, `.work__tail`), so the wall runs on unbroken between the two.

Each card is a panel that pivots onto the wall as the scroll brings its row in. It starts turned
away on its upright axis, held out in front of the wall and a little low, and swings round to face
the visitor as it is laid flat: the first in a row first, the two halves of a row turning in from
either side like a pair of doors (a card alone in its row, on a phone, turns in from alternate
sides). All the cards in a row are seen from one eye at its middle, so each is foreshortened as it
really would be. The light moves on a panel as it turns: it is shaded while it faces away from the
window, a sheen crosses it, and its shadow on the wall closes up and sharpens as it lands. Then its
hairlines are ruled from the left and its words stand up onto it, line by line.

`SET`, `STAGGER`, `FROM`, `LIGHT` and `PARTS` at the top of `process.tsx` set where it happens, how far
the panels turn and travel, how they are lit and the order. Every card is drawn from the scroll
position alone, so it goes back the way it came on the way up. In place, a card has no transform at
all, so its words are as sharp as the rest of the page. With reduced motion the cards are simply
there. Four across on a wide screen, two on a tablet, one on a phone.

## Things made by hand

A few marks on the page are drawn rather than set. The stamp and the underline are on the film of
the section they are in, so the scroll draws them, forwards and back; the branch and the button
answer the air and the pointer instead.

- **The stamp.** Once the scan is through, the read-out is stamped "Identity verified" in the cobalt
  ink of the seal, with the badge's serial and edition set round the ring. It is pressed down fast
  and stops dead, then the tick is inked in. It only appears where the read-out has room for it
  beside the closing statement (a container query on `.identity__verdict`).
- **The pen.** As the closing words land, their last word is underlined by hand.
  `src/lib/pen.ts` builds the stroke: a pointed pen along Bézier curves that swells under pressure,
  revealed by a mask drawn along the path the nib takes.
- **The branch, again.** The closing section hangs the same olive branch in its daylight: from the
  top right corner, long, and as faint as that light is strong.
- **The button.** "Start a project" leans towards a pointer that comes near it, its arrow a little
  further than the rest (`REACH`, `PULL` and `LEAD` at the top of `hero.tsx`). Fine pointers only.
- **The empty lanyard.** An address that does not exist opens on the same lit wall, with the hero's
  cord, ferrule and ring hanging from it and nothing on them, still stirring in the air: "Nothing
  hangs here." It is SVG built from the hero's own measurements (`lanyard-render.ts`), and needs no
  script.

Reduced motion keeps the branches and the lanyard still and the button in place. Without script the
stamp and the underline are simply there.
