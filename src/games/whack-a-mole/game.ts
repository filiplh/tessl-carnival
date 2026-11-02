import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const ROUND_SECONDS = 30;
export const POINTS_PER_MOLE = 10;
export const COLUMNS = 3;
export const ROWS = 3;
export const HOLE_RADIUS = 48;
/** How long a mole stays up, at the start and at the end of a round. */
export const UP_TIME = { start: 1.2, end: 0.6 } as const;
/** Seconds between moles popping up, at the start and at the end of a round. */
export const POP_GAP = { start: 1.0, end: 0.35 } as const;
const BONK_SECONDS = 0.3;

export interface Hole {
  x: number;
  y: number;
  /** Seconds the mole in this hole stays up; 0 when it is down. */
  upFor: number;
  /** Seconds left on the bonk effect after a whack; 0 when there is none. */
  bonk: number;
}

export interface WhackAMoleState {
  holes: Hole[];
  /** Seconds left in the round. */
  timeLeft: number;
  /** Seconds until the next mole pops up. */
  nextPop: number;
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): WhackAMoleState {
  const gapX = WIDTH / (COLUMNS + 1);
  const top = 120;
  const gapY = (HEIGHT - 60 - top) / (ROWS - 1);
  const holes: Hole[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      holes.push({ x: gapX * (col + 1), y: top + gapY * row, upFor: 0, bonk: 0 });
    }
  }
  return { holes, timeLeft: ROUND_SECONDS, nextPop: POP_GAP.start, score: 0, phase: 'playing' };
}

/** How far through the round we are, from 0 at the start to 1 at the end. */
export function progress(state: WhackAMoleState): number {
  return Math.min(Math.max(1 - state.timeLeft / ROUND_SECONDS, 0), 1);
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** Moles pop up more often and stay up for less time as the round goes on. */
export function popGap(state: WhackAMoleState): number {
  return lerp(POP_GAP.start, POP_GAP.end, progress(state));
}

export function upTime(state: WhackAMoleState): number {
  return lerp(UP_TIME.start, UP_TIME.end, progress(state));
}

/** Pops a mole up in a random empty hole. Returns false if every hole has a mole. */
export function popMole(state: WhackAMoleState, random: () => number = Math.random): boolean {
  const empty = state.holes.filter((hole) => hole.upFor === 0);
  if (empty.length === 0) return false;
  const hole = empty[Math.min(Math.floor(random() * empty.length), empty.length - 1)];
  hole.upFor = upTime(state);
  return true;
}

export function isOnHole(hole: Hole, x: number, y: number): boolean {
  return Math.hypot(x - hole.x, y - hole.y) <= HOLE_RADIUS;
}

/** Whacks at a point. Scores and returns true if it hit a mole that was up. */
export function whack(state: WhackAMoleState, x: number, y: number): boolean {
  if (state.phase !== 'playing') return false;
  const hole = state.holes.find((h) => h.upFor > 0 && isOnHole(h, x, y));
  if (!hole) return false;
  hole.upFor = 0;
  hole.bonk = BONK_SECONDS;
  state.score += POINTS_PER_MOLE;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: WhackAMoleState, dt: number, random: () => number = Math.random) {
  if (state.phase !== 'playing') return;

  for (const hole of state.holes) {
    hole.upFor = Math.max(hole.upFor - dt, 0);
    hole.bonk = Math.max(hole.bonk - dt, 0);
  }

  state.timeLeft = Math.max(state.timeLeft - dt, 0);
  if (state.timeLeft === 0) {
    state.phase = 'over';
    for (const hole of state.holes) hole.upFor = 0;
    return;
  }

  state.nextPop -= dt;
  while (state.nextPop <= 0) {
    popMole(state, random);
    state.nextPop += popGap(state);
  }
}

function draw(ctx: CanvasRenderingContext2D, state: WhackAMoleState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  for (const hole of state.holes) {
    // The mole, peeking out of its hole.
    if (hole.upFor > 0) {
      ctx.fillStyle = colors.wood;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y - 10, HOLE_RADIUS * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.beginPath();
      ctx.arc(hole.x - 12, hole.y - 18, 5, 0, Math.PI * 2);
      ctx.arc(hole.x + 12, hole.y - 18, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.stripeA;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y - 6, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // The front lip of the hole hides the bottom of the mole.
    ctx.fillStyle = colors.surface;
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y + 18, HOLE_RADIUS, HOLE_RADIUS * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    if (hole.bonk > 0) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 3;
      ctx.globalAlpha = hole.bonk / BONK_SECONDS;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y - 10, HOLE_RADIUS * (1.2 - hole.bonk), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Time ${Math.ceil(state.timeLeft)}s`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Time's up! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const whackAMole: CarnivalGame = {
  id: 'whack-a-mole',
  name: 'Whack-a-Mole',
  description:
    'Whack the moles before they duck back down. They get quicker as the clock runs out.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      whack(
        state,
        ((event.clientX - rect.left) / rect.width) * WIDTH,
        ((event.clientY - rect.top) / rect.height) * HEIGHT,
      );
    };
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't skip the whole round.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(whackAMole.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default whackAMole;
