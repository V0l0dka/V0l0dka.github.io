# global agent instructions

- Never use the em dash "—". Use plain dash "-" instead
- When writing commit messages, NEVER auto-add your agent name as co-author
- Never manually modify CHANGELOG.md files or any files that are marked as auto-generated
- When making technical decisions, do not give much weight to development cost.
  Instead, prefer quality, simplicity, robustness, scalability, and long term maintainability.
- For one-off or infrequent operational work, start with the simplest direct end-to-end path. Do not build wrappers, control planes, policy layers, custom verifiers, or automation unless the direct path exposes a concrete blocker or repeated need that justifies the added machinery.
- When doing bug fixes, always start with reproducing the bug in an E2E setting as closely aligned with how an end user would experience it as possible.
  This makes sure you find the real problem so your fix will actually solve it.
- When end-to-end testing a product, be picky about the UI you see and be obsessed with pixel perfection.
  If something clearly looks off, even if it is not directly related to what you are doing, try to get it fixed along the way.
- Apply that same high standard to engineering excellence: lint, test failures, and test flakiness.
  If you see one, even if it is not caused by what you are working on right now, still get it fixed.
- Before using "dynamic workflows", "ultra code" or any harness feature that immediately spawns a large swarm of subagents, always explain the tradeoffs and ask the user for explicit approval.

# project context

This is a personal pet-project website, hosted on GitHub Pages.

The owner is tech savvy but is not a developer. They read and reason about
technical detail fine, they just do not write code. That shapes how you work
here, it does not lower the technical bar.

## how to communicate

- Use real technical terms, then define them inline the first time they appear.
  "A build step (a command that turns source files into the final HTML/CSS/JS
  the browser downloads)" - not "some magic that makes it work".
- Explain *why*, not just *what*. The owner should be able to make the next
  decision themselves, not just approve this one.
- Never hide a tradeoff behind "best practice". Name the actual cost.
- When something breaks, say plainly what broke, what you changed, and how to
  tell it is fixed. No hedging, no false confidence.
- Prefer showing the exact command to run over describing it in prose.

## how to work in this repo

- Assume nothing is memorized. Every setup step the owner might need to repeat
  belongs in a file in the repo, not only in a chat message.
- Do not introduce a build tool, framework, or dependency without first saying,
  in one short paragraph, what it buys and what it costs in ongoing maintenance.
  Plain HTML/CSS/JS is a legitimate long term answer for a small site.
- Keep the number of moving parts small. Every extra tool is something the owner
  has to keep working later, alone.
- Anything that can silently break the live site (DNS, GitHub Pages settings,
  a deploy workflow, a domain renewal) gets written down in the repo with the
  exact place to click or command to run.
- Before any command that publishes, deletes, or overwrites, state what it will
  do and confirm.

## deployment

- Live at https://v0l0dka.github.io
- Repo `V0l0dka/V0l0dka.github.io`, public, default branch `main`.
- GitHub Pages is set to "deploy from branch": `main`, folder `/` (root).
  There is no build step and no Actions workflow. Whatever HTML sits in the
  repo is what the browser gets.
- `git push` is the deploy. It goes live in roughly 30-60 seconds.
- Never force push `main`. It is the branch Pages serves from.
- After a deploy, verify the live URL actually serves the change. GitHub Pages
  caches aggressively, so a stale page is not proof of failure - check with a
  hard reload before concluding anything.
- `.nojekyll` is intentional. Without it GitHub runs the site through Jekyll,
  which silently ignores any file or folder starting with `_`. Do not delete it.
- Because this is a root-level site, absolute paths like `/style.css` work.
  Prefer them over `../../style.css`.

## site structure

- `index.html` - the home page
- `404.html` - served by GitHub Pages for any unknown URL
- `style.css` - all styling, single file for now
- Split into more files only when one file genuinely becomes hard to navigate,
  not on principle.
