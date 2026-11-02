---
name: review-carnival-house-rules
description: Review a change to a carnival game for the house rules in AGENTS.md that keep every game on the midway, its scores in the shared scores module, and its drawing on the carnival's theme. Use as one lens in a code review run on changes under src/games/.
---

# Review lens: Carnival House Rules

Review changes to games under `src/games/` against house rules 1 to 3 in the root `AGENTS.md`, for a game that drifts away from the shared base the midway and the other games rely on.

## Scope

- **Registration** Whether the game reaches the midway the way every other game does: a folder `src/games/<game-id>/` whose `game.ts` default-exports its `CarnivalGame`, with an `id` equal to the folder name. `src/games/index.ts` finds games from there, so a change that registers a game any other way, or edits `src/games/index.ts` to add one or to loosen its checks, works around the rule.
- **Scores** Whether a round's score reaches the shared scores module: `recordScore(game.id, score)` imported from `src/carnival`, called once when a round ends. A game that touches local storage itself, keeps its own high score table, records more than once per round or never records, leaves the midway's booth card and best score wrong for that game.
- **Theme** Whether the game draws with `theme` and `canvasFont` from `src/carnival/theme.ts`. A hex, `rgb()` or named colour, or a font string written inside a game, does not follow the theme when it changes, so the booth stops matching the rest of the midway.

## Method

Read the house rules in the root `AGENTS.md` first; they are the contract, and they win over this summary.

Start at the changed `game.ts` and follow what it imports from `src/carnival`. Trace the end of a round to where its score is recorded, and every `fillStyle`, `strokeStyle`, `font` and similar drawing assignment back to where its value comes from.

For a new game folder, compare it with `src/games/water-cannon/`, the pattern every game copies.

## Threshold

Report a change that breaks one of house rules 1 to 3 in code a player runs.

State the consequence as the code has it. `src/games/index.ts` throws when a `game.ts` has no default export, or when its `id` differs from its folder name, so the midway fails to load for every game, not only this one, and `src/games/index.test.ts` fails. Those two are therefore enforced already: report them only when the change also weakens that check. A score kept outside `recordScore` is missing from the booth card. A colour or font outside the theme looks wrong only next to the other booths, and keeps looking wrong after the theme changes.

Do not report:

- Code outside `src/games/`. `src/carnival/` defines the theme and the scores, and `src/midway/palette.ts` keeps the map's own scenery colours.
- Values derived from the theme, such as a colour picked from `theme.colors`, a size computed from `theme.font` or `theme.canvas`, or an alpha applied to a theme colour.
- Test data in `game.test.ts`.
- Anything lint, the type-checker or the tests already enforce. When `npm run check` would fail on it, the check is the report.
- Rules 4 to 7 and other concerns, which belong to the other lenses.

## Reporting

- Name the rule by its number in `AGENTS.md`, the line that breaks it, and what the player or the midway sees as a result.
- State the fix in the carnival's own terms: the theme key or `canvasFont` size to use, where `recordScore` belongs in the round's end, or the folder and default export the game needs.
- When no theme key fits a colour the game needs, say so: adding one is a change to `src/carnival/`, which is its own change under house rule 7.
