# Whack-a-Mole

Whack the moles as they pop up out of a grid of nine holes, before they duck
back down.

## How to play

- Moles pop up one at a time from random empty holes, stay up for a moment, then
  drop back down.
- Click a mole while it's up to whack it.
- A round lasts 30 seconds. As the clock runs down, moles pop up more often and
  stay up for less time: at the start a new mole pops up every 1 second and stays
  up for 1.2 seconds, and by the end it's every 0.35 seconds for 0.6 seconds.
- Click again on the game over screen to play another round.

## Scoring

Each mole you whack scores 10 points. Clicking an empty hole costs nothing.

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `step`, `popMole`, `whack`, `popGap`,
  `upTime`) and the `whackAMole` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
