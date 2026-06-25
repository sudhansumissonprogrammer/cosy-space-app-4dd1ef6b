---
name: find-skills
description: Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.
---

# Find Skills

This skill helps you discover and install skills from the open agent skills ecosystem (skills.sh / `npx skills`).

## When to Use

- User asks "how do I do X" where X might be a common task with an existing skill
- "find a skill for X" / "is there a skill for X" / "can you do X"
- User wants to extend agent capabilities for a specific domain

## The Skills CLI

`npx skills` is the package manager for open agent skills.

Key commands:
- `npx skills find [query] [--owner <owner>]` — search interactively or by keyword
- `npx skills add <owner/repo@skill> -g -y` — install (global, no prompt)
- `npx skills check` — check for updates
- `npx skills update` — update all installed skills

Browse: https://skills.sh/

## Workflow

### 1. Understand the need
Identify domain (React, testing, design, deployment…), specific task, and whether a skill likely exists.

### 2. Check the leaderboard first
Look at https://skills.sh/ for well-known skills before searching. Top sources:
- `vercel-labs/agent-skills` — React, Next.js, web design (100K+ installs)
- `anthropics/skills` — Frontend design, document processing (100K+ installs)

### 3. Search
```bash
npx skills find <query>
```
Examples:
- "make my React app faster" → `npx skills find react performance`
- "PR reviews" → `npx skills find pr review`
- "changelog" → `npx skills find changelog`

### 4. Verify quality before recommending
Do NOT recommend based on search results alone. Check:
1. **Install count** — prefer 1K+; be cautious below 100
2. **Source reputation** — `vercel-labs`, `anthropics`, `microsoft` > unknown authors
3. **GitHub stars** on the source repo — <100 stars = skeptical

### 5. Present options
Show: skill name + what it does, install count + source, install command, skills.sh link.

Example:
```
Found a match — "react-best-practices" by vercel-labs (185K installs).
React/Next.js performance guidelines from Vercel Engineering.

Install:  npx skills add vercel-labs/agent-skills@react-best-practices -g -y
More:     https://skills.sh/vercel-labs/agent-skills/react-best-practices
```

### 6. Offer to install
```bash
npx skills add <owner/repo@skill> -g -y
```
`-g` = global/user-level, `-y` = skip prompts.

After install, the skill lives under `.workspace/skills/` and needs no `skills--apply_draft` call (the CLI handles activation).

## Common Categories

| Category | Example queries |
| --- | --- |
| Web Dev | react, nextjs, typescript, css, tailwind |
| Testing | testing, jest, playwright, e2e |
| DevOps | deploy, docker, kubernetes, ci-cd |
| Docs | docs, readme, changelog, api-docs |
| Code Quality | review, lint, refactor, best-practices |
| Design | ui, ux, design-system, accessibility |
| Productivity | workflow, automation, git |

## Search Tips
- Specific > generic ("react testing" beats "testing")
- Try synonyms ("deploy" → "deployment" → "ci-cd")
- Popular owners: `vercel-labs/agent-skills`, `ComposioHQ/awesome-claude-skills`

## When Nothing Matches
1. Tell the user no skill was found
2. Offer to do the task directly
3. Suggest `npx skills init <name>` if they do this often
