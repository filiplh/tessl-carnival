# Arena Blaster

A fast first-person arena shooter, inspired by the classic 90s shooters. Horned
gloomers pour into a small walled arena and chase you down. Blast them and
survive 90 seconds.

Everything here is original: the arena, the monsters and the blaster are drawn
with plain shapes in the carnival's theme, and the sounds are short tones made
in the browser, so the game ships no images or sound files.

## How to play

- Click the arena to enter it. The game locks the mouse pointer while you play.
- **W, A, S, D** move and strafe. The arrow keys also move forward and back,
  and turn.
- **Move the mouse** to aim, and **click** to shoot. Hold the button to keep
  firing.
- **R** reloads. A clip holds 12 rounds, and an empty clip reloads by itself
  while you have rounds in reserve. A reload takes a second.
- **Escape** pauses and releases the mouse. Click to jump back in.
- Monsters bite when they reach you. Health packs (white with a red cross) give
  30 health, and ammo crates give 24 rounds. Each comes back 12 seconds after
  you take it. A health pack stays put while your health is full.
- Monsters come more often as the round goes on: one every 3 seconds at the
  start, and one every 0.75 seconds at the end, up to 12 at once. Later monsters
  are faster, bite harder and take up to 4 shots.
- The round ends when your health reaches 0 or the 90 seconds run out. Click to
  play again.

The HUD shows your score, combo, time left, health and ammo.

## Scoring

- Each monster you defeat is worth 100 points times your combo.
- Defeat another monster within 3 seconds of the last to raise the combo by one,
  up to x5. The combo drops back to x1 when 3 seconds pass without a kill, or
  when a monster bites you.
- You also get 5 points for every whole second you survive.

Your final score is saved to the carnival's score board when the round ends,
and the game over screen shows it next to your best.

## Files

- `game.ts`: the game logic (`createState`, `play`, `pause`, `movePlayer`,
  `turn`, `fire`, `reload`, `step`, `totalScore`, `castRay`) and the
  `doomShooter` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
