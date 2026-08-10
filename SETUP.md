# setup

What this machine needs in order to work on and publish this site. Written down
so it can be redone on a new machine, or after something breaks, without having
to remember anything.

Current machine: Ubuntu 26.04 under WSL2.

## what is installed

| tool | version | where | why |
|---|---|---|---|
| git | 2.53.0 | system | tracks file history, pushes to GitHub |
| gh (GitHub CLI) | 2.97.0 | `~/.local/bin/gh` | creates repos, configures GitHub Pages, logs in |

`gh` was installed from the official release binary rather than with
`sudo apt install`, because sudo needs an interactive password. Same program,
no root required. The tradeoff: apt would update it automatically during system
updates, this will not. See "updating gh" below.

`~/.local/bin` is added to `PATH` by a guarded block at the end of `~/.bashrc`.
Guarded means it checks first and will not add the same entry twice.

## installing gh from scratch

```bash
cd /tmp
VER=$(curl -sL https://api.github.com/repos/cli/cli/releases/latest | grep -m1 '"tag_name"' | cut -d'"' -f4)
NUM=${VER#v}
curl -sLo gh.tar.gz "https://github.com/cli/cli/releases/download/${VER}/gh_${NUM}_linux_amd64.tar.gz"
tar xzf gh.tar.gz
mkdir -p ~/.local/bin ~/.local/share/man/man1
install -m 755 "gh_${NUM}_linux_amd64/bin/gh" ~/.local/bin/gh
cp "gh_${NUM}_linux_amd64"/share/man/man1/*.1 ~/.local/share/man/man1/
```

Then open a new terminal and check with `gh --version`.

## updating gh

`gh` prints a notice when a newer version exists. To update, re-run the install
block above. It overwrites the old binary in place. Nothing else to clean up.

## logging in to GitHub

```bash
gh auth login
```

Answers: GitHub.com, HTTPS, yes to authenticating git with GitHub credentials,
login with a web browser. That last "yes" installs a credential helper so
`git push` never asks for a password.

Check it worked:

```bash
gh auth status
```

## current account

- GitHub account: `V0l0dka`
- git commit name: `V0l0dka`
- git commit email: `prostouser14@gmail.com`
- git credential helper: `gh auth git-credential` (set globally)

Note: the commit email is stamped on every commit and is publicly visible on
GitHub forever, including in old commits. To use GitHub's no-reply address
instead, copy it from GitHub Settings then Emails (it looks like
`12345+V0l0dka@users.noreply.github.com`) and run:

```bash
git config --global user.email "12345+V0l0dka@users.noreply.github.com"
```

Changing it only affects commits made after the change.

## not done yet

- No GitHub repository created. The repo name is a real decision, because
  `V0l0dka.github.io` is the one free root-level site on the account, while any
  other name publishes to `V0l0dka.github.io/<repo-name>`.
- GitHub Pages is not switched on.
- No site content or structure chosen yet.
