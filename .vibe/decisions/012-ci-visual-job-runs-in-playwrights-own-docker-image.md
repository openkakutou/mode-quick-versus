# 012 — CI's visual-regression job runs in Playwright's own Docker image

## Context

`ci.yml`'s `visual` job installed Chromium directly onto the bare
`ubuntu-24.04` runner (`npx playwright install --with-deps chromium`),
while `deploy-pages.yml`'s own `build` job ran the same visual-regression
suite inside Playwright's own published Docker image
(`mcr.microsoft.com/playwright`, pinned by digest) — a deliberate choice
recorded in that workflow's own comments, but never applied to `ci.yml`.

Backlog item 014 regenerated the committed baselines through
`deploy-pages.yml`'s container to fix that workflow's own persistent
failure. Doing so immediately broke `ci.yml`'s `visual` job instead: the
bare-runner-plus-separately-installed-Chromium combination renders
sub-pixel-different font/GL output from the container, the same ~1%
pixel-ratio mismatch either direction — not flakiness, a permanent
environment difference. One committed set of baseline PNGs cannot satisfy
two workflows rendering in two different environments at once.

## Decision

`ci.yml`'s `visual` job now runs inside the exact same pinned
`mcr.microsoft.com/playwright` image as `deploy-pages.yml`'s `build` job,
referenced by the same digest. The `Cache Playwright browsers`/`Install
Playwright browsers` steps are removed — the image already bundles a
matching Chromium build and font set, so there is nothing left to install
or cache. Confirmed green against the item-014-regenerated baselines via a
real `workflow_dispatch` run inside the container (not assumed from the
image's published contents alone).

## Consequence

Exactly one visual-rendering environment exists across this repo's CI
surface from now on. Bumping `@playwright/test` in `package.json` must be
paired with bumping the image digest in **both** `ci.yml` and
`deploy-pages.yml` together, and every baseline regenerated through the new
image before merging — otherwise this exact mismatch reappears, in
whichever of the two workflows didn't get the bump. Mirrors the sibling
`character-viewer-web`/`character-editor`/`stage-viewer-web` repos' own fix
for this identical failure mode (their own `.vibe/decisions/023` and
equivalents), and `web-ui-kit`'s `.vibe/decisions/015`.
