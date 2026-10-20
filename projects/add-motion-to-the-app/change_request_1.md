---
plan_id: pm-206
run_id: run-6921
kind: change_request
cycle: 1
---

# Change request: signing in and leaving the 403 still break the motion promise (pm-206)

Service: the otohime site (Next.js on Vercel, otohime.dev), `app/(site)` route group. Production
serves `90e4ebe`.

## What a person still cannot do

1. **Sign in without an error.** Each sign-in through `/sign-in` crossfades to `/dashboard`, but
   the browser logs an uncaught page error there: `Transition was skipped. Navigation transition
   active`. The plan promised no console error and no page error on any route. An operator who
   watches client errors gets one for every sign-in.
2. **Leave the 403 with the fade the plan promised.** On the forbidden page ("This room is
   locked"), the page's own **Go home** button changes to `/` in one frame: no page-out and no
   page-in, at 1366×768 and 390×844. Leaving the same page by the nav (Projects, Dashboard) does
   fade.
3. (Smaller.) Leaving the 404 by its link: the 404 fades out, but Home does not fade in, while
   Home does fade in when you arrive from `/work`.

## Evidence

- Sign-in error: 4 of 4 sign-ins, at both viewports and with motion on and reduced. With
  `@view-transition` stripped from the documents and stylesheets (Playwright `page.route`), 0 of 2.
  So the cross-document hop opt-in (pm-206 t-1184) meets a React `<ViewTransition>` start on the
  `/dashboard` load. Better Auth's sign-in follows `callbackURL` with a full page load, so every
  sign-in is a cross-document hop. Signed-in hops from a project to `/projects` or `/` are clean.
  `scripts/probe-motion.sh` runs without a database, so it never signs in and stays green
  (312 ok against otohime.dev).
- 403: a plain user on `/admin/roles` clicks "Go home". The sampled `document.getAnimations()`
  shows no `::view-transition-*` animation, and it is the same document. The nav links from the same
  page show `old(_t_0_): fade-out 150` and `new(_t_1_): fade-in 150+210`.
- 404: from `/does-not-exist`, the main link to `/` shows only `old(_t_0_): fade-out 150`. From
  `/work`, the nav Home shows both the fade-out and `new(_T_1_): fade-in 150+210`.
- How to reproduce: the local stack from `scripts/e2e-local.sh` (docker Postgres, migrations,
  `next start`). Create an account through `/api/auth/sign-up/email`, sign in through the form, and
  listen for `pageerror`. Full walkthrough: `acceptance_report_1.md`.

## The work, for the product owner

- Signing in must end on `/dashboard` with the crossfade and **no** page error. The same holds for
  any other full-page load into a signed-in room (`?next=/account`). A check that proves it must
  sign in, so it needs the database: extend the motion probe or the e2e walk, so the gate turns red
  on this error.
- Every exit from the 403 and the 404, including their own buttons, must fade out and fade the next
  page in, like `/work`. A probe or e2e check must click the buttons themselves, not only the nav.
- Reduced motion and JavaScript off must stay still. The 312 probe checks and the walks must stay
  green.
