import { describe, expect, it } from 'vitest';
import {
  AMMO_PICKUP,
  ATTACK_COOLDOWN,
  CLIP_SIZE,
  HEALTH_PICKUP,
  KILL_POINTS,
  MAX_HEALTH,
  RELOAD_TIME,
  ROUND_TIME,
  START_RESERVE,
  castRay,
  createEnemy,
  createState,
  difficulty,
  fire,
  isWall,
  movePlayer,
  pause,
  play,
  reload,
  spawnInterval,
  step,
  totalScore,
  turn,
  type ShooterState,
} from './game';

/** A round already under way, with no monsters and no pickups in reach. */
function playing(): ShooterState {
  const state = createState(() => 0);
  state.pickups = [];
  play(state);
  return state;
}

/** Puts a monster `distance` cells straight ahead of the player, who starts 2 cells from a wall. */
function enemyAhead(state: ShooterState, distance: number, elapsed = 0) {
  const { player } = state;
  const enemy = createEnemy(
    player.x + Math.cos(player.angle) * distance,
    player.y + Math.sin(player.angle) * distance,
    elapsed,
  );
  state.enemies.push(enemy);
  return enemy;
}

describe('doom shooter', () => {
  it('starts ready, in the middle of the arena, with full health and a full clip', () => {
    const state = createState();
    expect(state.phase).toBe('ready');
    expect(isWall(state.player.x, state.player.y)).toBe(false);
    expect(state.player.health).toBe(MAX_HEALTH);
    expect(state.player.clip).toBe(CLIP_SIZE);
    expect(state.player.reserve).toBe(START_RESERVE);
    expect(totalScore(state)).toBe(0);
  });

  it('does nothing until the player enters the arena', () => {
    const state = createState();
    step(state, 1);
    expect(state.elapsed).toBe(0);
    expect(fire(state)).toBe(false);
    play(state);
    expect(state.phase).toBe('playing');
  });

  it('pauses and resumes', () => {
    const state = playing();
    pause(state);
    step(state, 1);
    expect(state.phase).toBe('paused');
    expect(state.elapsed).toBe(0);
    play(state);
    expect(state.phase).toBe('playing');
  });

  it('casts rays to the nearest wall', () => {
    // From the middle of row 1, facing north, the wall's face is half a cell away.
    expect(castRay(4.5, 1.5, -Math.PI / 2).distance).toBeCloseTo(0.5);
    expect(castRay(1.5, 1.5, 0).distance).toBeCloseTo(13.5);
  });

  it('moves forward and strafes relative to where the player faces', () => {
    const state = playing();
    state.player.angle = 0;
    movePlayer(state, 1, 0, 0.1);
    expect(state.player.x).toBeGreaterThan(8);
    expect(state.player.y).toBeCloseTo(8);
    const x = state.player.x;
    movePlayer(state, 0, 1, 0.1);
    expect(state.player.x).toBeCloseTo(x);
    expect(state.player.y).toBeGreaterThan(8);
  });

  it('never walks through a wall', () => {
    const state = playing();
    state.player.x = 1.5;
    state.player.y = 1.5;
    state.player.angle = Math.PI;
    for (let i = 0; i < 100; i++) movePlayer(state, 1, 0, 0.05);
    expect(state.player.x).toBeGreaterThan(1);
    expect(isWall(state.player.x, state.player.y)).toBe(false);
  });

  it('turns to aim', () => {
    const state = playing();
    state.player.angle = 0;
    turn(state, 0.5);
    expect(state.player.angle).toBeCloseTo(0.5);
  });

  it('uses one round per shot and defeats a monster in its sights', () => {
    const state = playing();
    enemyAhead(state, 1.5);
    expect(fire(state)).toBe(true);
    expect(state.player.clip).toBe(CLIP_SIZE - 1);
    expect(state.enemies).toHaveLength(0);
    expect(state.kills).toBe(1);
    expect(totalScore(state)).toBe(KILL_POINTS);
    expect(state.events).toEqual(['fire', 'hit', 'kill']);
  });

  it('misses a monster that is off the crosshair or behind a wall', () => {
    const state = playing();
    state.player.angle = 0;
    state.enemies.push(createEnemy(state.player.x + 3, state.player.y + 2, 0));
    fire(state);
    expect(state.enemies).toHaveLength(1);

    const walled = playing();
    walled.player.x = 7.5;
    walled.player.y = 3.5;
    walled.player.angle = Math.PI / 2;
    // Row 5 has a wall at columns 7 and 8, between the player and the monster.
    walled.enemies.push(createEnemy(7.5, 6.5, 0));
    fire(walled);
    expect(walled.enemies).toHaveLength(1);
  });

  it('waits between shots', () => {
    const state = playing();
    expect(fire(state)).toBe(true);
    expect(fire(state)).toBe(false);
    step(state, 0.5);
    expect(fire(state)).toBe(true);
  });

  it('reloads from the reserve, and reloads by itself on an empty clip', () => {
    const state = playing();
    state.player.clip = 0;
    expect(fire(state)).toBe(false);
    expect(state.player.reloadTimer).toBe(RELOAD_TIME);
    step(state, RELOAD_TIME + 0.01);
    expect(state.player.clip).toBe(CLIP_SIZE);
    expect(state.player.reserve).toBe(START_RESERVE - CLIP_SIZE);
  });

  it('cannot reload with a full clip or an empty reserve', () => {
    const state = playing();
    expect(reload(state)).toBe(false);
    state.player.clip = 3;
    state.player.reserve = 0;
    expect(reload(state)).toBe(false);
    expect(fire(state)).toBe(true);
  });

  it('builds a combo for quick kills, up to five times the points', () => {
    const state = playing();
    for (let i = 0; i < 7; i++) {
      enemyAhead(state, 1.5);
      fire(state);
      step(state, 0.5);
    }
    expect(state.combo).toBe(5);
    expect(state.killPoints).toBe(KILL_POINTS * (1 + 2 + 3 + 4 + 5 + 5 + 5));
  });

  it('drops the combo when the window runs out', () => {
    const state = playing();
    enemyAhead(state, 1.5);
    fire(state);
    step(state, 0.5);
    enemyAhead(state, 1.5);
    fire(state);
    expect(state.combo).toBe(2);
    step(state, 3.1);
    expect(state.combo).toBe(1);
  });

  it('adds points for every whole second survived', () => {
    const state = playing();
    state.spawnTimer = Infinity;
    for (let i = 0; i < 10; i++) step(state, 0.25);
    expect(totalScore(state)).toBe(10);
  });

  it('lets a monster in reach hurt the player, then wait before it bites again', () => {
    const state = playing();
    state.spawnTimer = Infinity;
    const enemy = enemyAhead(state, 0.5);
    enemy.attackCooldown = 0;
    step(state, 0.01);
    expect(state.player.health).toBe(MAX_HEALTH - enemy.damage);
    expect(state.events).toContain('hurt');
    step(state, ATTACK_COOLDOWN / 2);
    expect(state.player.health).toBe(MAX_HEALTH - enemy.damage);
  });

  it('sends monsters after the player, around walls', () => {
    const state = playing();
    state.spawnTimer = Infinity;
    state.player.x = 7.5;
    state.player.y = 3.5;
    const enemy = createEnemy(7.5, 6.5, 0);
    state.enemies.push(enemy);
    const start = Math.hypot(enemy.x - 7.5, enemy.y - 3.5);
    for (let i = 0; i < 60; i++) step(state, 0.05);
    expect(Math.hypot(enemy.x - 7.5, enemy.y - 3.5)).toBeLessThan(start);
    expect(isWall(enemy.x, enemy.y)).toBe(false);
  });

  it('spawns monsters faster and makes them tougher as the round goes on', () => {
    expect(difficulty(0)).toBe(1);
    expect(difficulty(ROUND_TIME)).toBe(4);
    expect(spawnInterval(ROUND_TIME)).toBeLessThan(spawnInterval(0));
    const early = createEnemy(1.5, 1.5, 0);
    const late = createEnemy(1.5, 1.5, ROUND_TIME);
    expect(late.speed).toBeGreaterThan(early.speed);
    expect(late.damage).toBeGreaterThan(early.damage);
    expect(late.health).toBeGreaterThan(early.health);

    const state = playing();
    state.player.health = Infinity;
    for (let i = 0; i < 40; i++) step(state, 0.05);
    expect(state.enemies.length).toBeGreaterThan(0);
  });

  it('collects health and ammo pickups, which come back later', () => {
    const state = playing();
    state.spawnTimer = Infinity;
    state.player.health = 50;
    state.pickups = [
      { kind: 'health', x: state.player.x, y: state.player.y, respawnTimer: 0 },
      { kind: 'ammo', x: state.player.x, y: state.player.y, respawnTimer: 0 },
    ];
    step(state, 0.01);
    expect(state.player.health).toBe(50 + HEALTH_PICKUP);
    expect(state.player.reserve).toBe(START_RESERVE + AMMO_PICKUP);
    expect(state.pickups.every((p) => p.respawnTimer > 0)).toBe(true);
    expect(state.events).toEqual(['pickup', 'pickup']);
  });

  it('leaves a health pickup where it is when health is full', () => {
    const state = playing();
    state.spawnTimer = Infinity;
    state.pickups = [{ kind: 'health', x: state.player.x, y: state.player.y, respawnTimer: 0 }];
    step(state, 0.01);
    expect(state.pickups[0].respawnTimer).toBe(0);
  });

  it('ends the round when health reaches zero', () => {
    const state = playing();
    state.spawnTimer = Infinity;
    state.player.health = 1;
    enemyAhead(state, 0.5).attackCooldown = 0;
    step(state, 0.01);
    expect(state.player.health).toBe(0);
    expect(state.phase).toBe('over');
    expect(state.endReason).toBe('health');
  });

  it('ends the round when the time runs out', () => {
    const state = playing();
    state.spawnTimer = Infinity;
    state.elapsed = ROUND_TIME - 0.01;
    step(state, 0.05);
    expect(state.phase).toBe('over');
    expect(state.endReason).toBe('time');
    expect(state.elapsed).toBe(ROUND_TIME);
    step(state, 1);
    expect(state.elapsed).toBe(ROUND_TIME);
  });
});
