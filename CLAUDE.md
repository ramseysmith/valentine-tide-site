# Valentine Tide site

Static site (`index.html`, `styles.css`, `script.js`, `assets/`, no build step).
Part of the Graysmith Labs portfolio. Served on a custom domain via the committed
`CNAME`. A local preview server is wired up in `.claude/launch.json` and
`.claude/serve.mjs`.

## Verification: what the sandbox cannot confirm

A push landing on the remote is not the same as the change being live. The site
is deploy dependent, so after pushing, treat the live site as **UNVERIFIED until
checked**: the deploy has to run and DNS or the custom domain has to resolve.
When you finish, either confirm the live URL yourself or clearly state that
deploy verification is still pending. For visual changes, prefer previewing
locally (see `.claude/launch.json`) before reporting them done.

## Git and shipping

There is no build, typecheck, or lint step here, and that is fine. Do not invent
an empty `test` script. This repo uses an SSH remote, so pushes depend on an SSH
key being available, and can fail silently without one. A commit is not shipped
until it is on the remote, so after committing confirm `git status` shows the
branch up to date with its upstream. If the push failed on auth, say the work is
local only and give the fix. The `/ship` skill runs this loop and skips absent
gates.

## Writing style for anything a human reads

Ramsey reads dashes as a tell that text was machine written. In copy, bios, and
commit messages, use no hyphens, em dashes, or en dashes in prose. Write compound
modifiers open, for example crash free and cross platform. Write ranges with the
word to. Code, class names, and file names keep whatever punctuation they need.

## Scope

Prefer the smallest change that fixes the issue. Confirm before any larger visual
redesign of surrounding sections.
