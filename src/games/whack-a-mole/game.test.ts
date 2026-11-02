import { describe, expect, it } from 'vitest';
import {
  COLUMNS,
  HOLE_RADIUS,
  POINTS_PER_MOLE,
  POP_GAP,
  ROUND_SECONDS,
  ROWS,
  UP_TIME,
  createState,
  popGap,
  popMole,
  step,
  upTime,
  whack,
} from './game';

const first = () => 0;

describe('whack-a-mole', () => {
  it('starts a full round with every mole down and no score', () => {
    const state = createState();
    expect(state.holes).toHaveLength(COLUMNS * ROWS);
    expect(state.holes.every((h) => h.upFor === 0)).toBe(true);
    expect(state.timeLeft).toBe(ROUND_SECONDS);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('pops a mole up once the first gap has passed', () => {
    const state = createState();
    step(state, POP_GAP.start - 0.01, first);
    expect(state.holes.some((h) => h.upFor > 0)).toBe(false);
    step(state, 0.02, first);
    expect(state.holes.filter((h) => h.upFor > 0)).toHaveLength(1);
  });

  it('drops a mole back down when its time is up', () => {
    const state = createState();
    popMole(state, first);
    state.nextPop = 100;
    step(state, UP_TIME.start + 0.01, first);
    expect(state.holes[0].upFor).toBe(0);
  });

  it('only pops moles into empty holes', () => {
    const state = createState();
    for (let i = 0; i < COLUMNS * ROWS; i++) expect(popMole(state, first)).toBe(true);
    expect(state.holes.every((h) => h.upFor > 0)).toBe(true);
    expect(popMole(state, first)).toBe(false);
  });

  it('scores a whack on a mole that is up and sends it down', () => {
    const state = createState();
    popMole(state, first);
    const hole = state.holes[0];
    expect(whack(state, hole.x + HOLE_RADIUS / 2, hole.y)).toBe(true);
    expect(state.score).toBe(POINTS_PER_MOLE);
    expect(hole.upFor).toBe(0);
  });

  it('scores nothing for whacking an empty hole or missing the mole', () => {
    const state = createState();
    const hole = state.holes[0];
    expect(whack(state, hole.x, hole.y)).toBe(false);
    popMole(state, first);
    expect(whack(state, hole.x + HOLE_RADIUS * 2, hole.y)).toBe(false);
    expect(state.score).toBe(0);
  });

  it('pops moles faster and keeps them up for less time as the round goes on', () => {
    const state = createState();
    const early = { gap: popGap(state), up: upTime(state) };
    state.timeLeft = 1;
    expect(popGap(state)).toBeLessThan(early.gap);
    expect(upTime(state)).toBeLessThan(early.up);
    state.timeLeft = 0;
    expect(popGap(state)).toBeCloseTo(POP_GAP.end);
    expect(upTime(state)).toBeCloseTo(UP_TIME.end);
  });

  it('ends the round when the time runs out, with every mole down', () => {
    const state = createState();
    popMole(state, first);
    state.timeLeft = 0.05;
    step(state, 0.1, first);
    expect(state.phase).toBe('over');
    expect(state.timeLeft).toBe(0);
    expect(state.holes.every((h) => h.upFor === 0)).toBe(true);
  });

  it('ignores whacks once the round is over', () => {
    const state = createState();
    popMole(state, first);
    state.phase = 'over';
    const hole = state.holes[0];
    expect(whack(state, hole.x, hole.y)).toBe(false);
    expect(state.score).toBe(0);
  });
});
