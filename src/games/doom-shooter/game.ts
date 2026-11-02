import { bestScore, canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

/** The arena, one character per cell: `#` is a wall, `.` is floor. */
export const ARENA = [
  '################',
  '#..............#',
  '#..##......##..#',
  '#..#........#..#',
  '#..............#',
  '#......##......#',
  '#..............#',
  '#...#......#...#',
  '#...#......#...#',
  '#..............#',
  '#......##......#',
  '#..............#',
  '#..#........#..#',
  '#..##......##..#',
  '#..............#',
  '################',
] as const;

export const ROUND_TIME = 90;
export const MAX_HEALTH = 100;
export const CLIP_SIZE = 12;
export const START_RESERVE = 36;
export const RELOAD_TIME = 1;
export const FIRE_COOLDOWN = 0.18;
export const MOVE_SPEED = 3.2;
export const PLAYER_RADIUS = 0.25;
export const ENEMY_RADIUS = 0.3;
/** How wide an enemy is for a shot, in cells either side of its middle. */
export const ENEMY_HIT_RADIUS = 0.4;
export const ATTACK_RANGE = 0.75;
export const ATTACK_COOLDOWN = 1;
export const MAX_ENEMIES = 12;
export const KILL_POINTS = 100;
export const SURVIVAL_POINTS = 5;
export const COMBO_WINDOW = 3;
export const MAX_COMBO = 5;
export const HEALTH_PICKUP = 30;
export const AMMO_PICKUP = 24;
export const PICKUP_RESPAWN = 12;
const PICKUP_RANGE = 0.5;
const SPAWN_SAFE_DISTANCE = 5;

const SPAWN_POINTS = [
  { x: 1.5, y: 1.5 },
  { x: 14.5, y: 1.5 },
  { x: 1.5, y: 14.5 },
  { x: 14.5, y: 14.5 },
  { x: 8, y: 1.5 },
  { x: 8, y: 14.5 },
  { x: 1.5, y: 8 },
  { x: 14.5, y: 8 },
];

const PICKUP_SPOTS: { kind: PickupKind; x: number; y: number }[] = [
  { kind: 'health', x: 5.5, y: 5.5 },
  { kind: 'health', x: 10.5, y: 10.5 },
  { kind: 'ammo', x: 10.5, y: 5.5 },
  { kind: 'ammo', x: 5.5, y: 10.5 },
];

export type PickupKind = 'health' | 'ammo';
export type GameEvent = 'fire' | 'hit' | 'kill' | 'hurt' | 'pickup' | 'empty' | 'reload';

export interface Player {
  x: number;
  y: number;
  /** Radians; 0 faces east and the angle grows clockwise on the map. */
  angle: number;
  health: number;
  clip: number;
  reserve: number;
  fireCooldown: number;
  /** Seconds left of a reload, or 0 when not reloading. */
  reloadTimer: number;
}

export interface Enemy {
  x: number;
  y: number;
  health: number;
  /** Cells per second. */
  speed: number;
  damage: number;
  attackCooldown: number;
  /** Seconds left of the flash after a hit. */
  hurtTimer: number;
}

export interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  /** Seconds until it comes back; 0 or less means it is in the arena. */
  respawnTimer: number;
}

export interface Puff {
  x: number;
  y: number;
  age: number;
}

export interface ShooterState {
  phase: 'ready' | 'playing' | 'paused' | 'over';
  endReason?: 'time' | 'health';
  player: Player;
  enemies: Enemy[];
  pickups: Pickup[];
  puffs: Puff[];
  elapsed: number;
  spawnTimer: number;
  kills: number;
  killPoints: number;
  combo: number;
  comboTimer: number;
  muzzleFlash: number;
  hitMarker: number;
  hurtFlash: number;
  pickupFlash: number;
  lastPickup?: PickupKind;
  /** What happened since the last frame, for sounds. `start` empties it. */
  events: GameEvent[];
  random: () => number;
}

export function createState(random: () => number = Math.random): ShooterState {
  return {
    phase: 'ready',
    player: {
      x: 8,
      y: 8,
      angle: -Math.PI / 2,
      health: MAX_HEALTH,
      clip: CLIP_SIZE,
      reserve: START_RESERVE,
      fireCooldown: 0,
      reloadTimer: 0,
    },
    enemies: [],
    pickups: PICKUP_SPOTS.map((spot) => ({ ...spot, respawnTimer: 0 })),
    puffs: [],
    elapsed: 0,
    spawnTimer: 1.5,
    kills: 0,
    killPoints: 0,
    combo: 1,
    comboTimer: 0,
    muzzleFlash: 0,
    hitMarker: 0,
    hurtFlash: 0,
    pickupFlash: 0,
    events: [],
    random,
  };
}

export function isWall(x: number, y: number): boolean {
  const row = ARENA[Math.floor(y)];
  return row === undefined || row[Math.floor(x)] !== '.';
}

/**
 * How far a ray from (x, y) at `angle` travels before it meets a wall, and
 * whether it met the wall on a north or south face.
 */
export function castRay(x: number, y: number, angle: number) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let cellX = Math.floor(x);
  let cellY = Math.floor(y);
  const deltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const deltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  const stepX = dx < 0 ? -1 : 1;
  const stepY = dy < 0 ? -1 : 1;
  let sideX = (dx < 0 ? x - cellX : cellX + 1 - x) * deltaX;
  let sideY = (dy < 0 ? y - cellY : cellY + 1 - y) * deltaY;

  for (let i = 0; i < 64; i++) {
    if (sideX < sideY) {
      cellX += stepX;
      if (isWall(cellX + 0.5, cellY + 0.5)) return { distance: sideX, northSouth: false };
      sideX += deltaX;
    } else {
      cellY += stepY;
      if (isWall(cellX + 0.5, cellY + 0.5)) return { distance: sideY, northSouth: true };
      sideY += deltaY;
    }
  }
  return { distance: 64, northSouth: false };
}

/** 1 at the start of a round, rising steadily to 4 when the time runs out. */
export function difficulty(elapsed: number): number {
  return 1 + (3 * Math.min(elapsed, ROUND_TIME)) / ROUND_TIME;
}

/** Seconds between monsters: 3 at the start, 0.75 at the end. */
export function spawnInterval(elapsed: number): number {
  return 3 / difficulty(elapsed);
}

/** Later monsters are faster, hit harder and take more shots. */
export function createEnemy(x: number, y: number, elapsed: number): Enemy {
  const level = difficulty(elapsed);
  return {
    x,
    y,
    health: Math.floor(level),
    speed: 1.2 + 0.4 * level,
    damage: Math.round(6 + 3 * level),
    attackCooldown: ATTACK_COOLDOWN / 2,
    hurtTimer: 0,
  };
}

/** Moves a body by (dx, dy), sliding along walls instead of entering them. */
function slide(body: { x: number; y: number }, dx: number, dy: number, radius: number) {
  const nx = body.x + dx;
  const edgeX = nx + Math.sign(dx) * radius;
  if (!isWall(edgeX, body.y - radius) && !isWall(edgeX, body.y + radius)) body.x = nx;
  const ny = body.y + dy;
  const edgeY = ny + Math.sign(dy) * radius;
  if (!isWall(body.x - radius, edgeY) && !isWall(body.x + radius, edgeY)) body.y = ny;
}

/** `forward` and `strafe` run from -1 to 1; strafe is positive to the right. */
export function movePlayer(state: ShooterState, forward: number, strafe: number, dt: number) {
  if (state.phase !== 'playing' || (forward === 0 && strafe === 0)) return;
  const { player } = state;
  const length = Math.hypot(forward, strafe);
  const distance = (MOVE_SPEED * dt) / Math.max(length, 1);
  const cos = Math.cos(player.angle);
  const sin = Math.sin(player.angle);
  slide(
    player,
    (forward * cos - strafe * sin) * distance,
    (forward * sin + strafe * cos) * distance,
    PLAYER_RADIUS,
  );
}

export function turn(state: ShooterState, radians: number) {
  if (state.phase !== 'playing') return;
  const full = Math.PI * 2;
  state.player.angle = (((state.player.angle + radians) % full) + full) % full;
}

export function reload(state: ShooterState): boolean {
  const { player } = state;
  if (state.phase !== 'playing' || player.reloadTimer > 0) return false;
  if (player.clip === CLIP_SIZE || player.reserve === 0) return false;
  player.reloadTimer = RELOAD_TIME;
  state.events.push('reload');
  return true;
}

/** The nearest enemy on the crosshair that no wall hides, if any. */
export function enemyInSights(state: ShooterState): Enemy | undefined {
  const { player } = state;
  const cos = Math.cos(player.angle);
  const sin = Math.sin(player.angle);
  const wall = castRay(player.x, player.y, player.angle).distance;
  let nearest: Enemy | undefined;
  let nearestDistance = wall;
  for (const enemy of state.enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const along = dx * cos + dy * sin;
    const across = Math.abs(dy * cos - dx * sin);
    if (along > 0 && along < nearestDistance && across <= ENEMY_HIT_RADIUS) {
      nearest = enemy;
      nearestDistance = along;
    }
  }
  return nearest;
}

/** Fires one shot along the crosshair. Returns false if nothing fired. */
export function fire(state: ShooterState): boolean {
  const { player } = state;
  if (state.phase !== 'playing' || player.fireCooldown > 0 || player.reloadTimer > 0) return false;
  if (player.clip === 0) {
    if (!reload(state)) {
      state.events.push('empty');
      player.fireCooldown = FIRE_COOLDOWN;
    }
    return false;
  }

  player.clip -= 1;
  player.fireCooldown = FIRE_COOLDOWN;
  state.muzzleFlash = 0.08;
  state.events.push('fire');

  const enemy = enemyInSights(state);
  if (enemy) {
    enemy.health -= 1;
    enemy.hurtTimer = 0.15;
    state.hitMarker = 0.2;
    state.events.push('hit');
    if (enemy.health <= 0) defeat(state, enemy);
  }
  return true;
}

function defeat(state: ShooterState, enemy: Enemy) {
  state.enemies = state.enemies.filter((e) => e !== enemy);
  state.combo = state.comboTimer > 0 ? Math.min(state.combo + 1, MAX_COMBO) : 1;
  state.comboTimer = COMBO_WINDOW;
  state.kills += 1;
  state.killPoints += KILL_POINTS * state.combo;
  state.puffs.push({ x: enemy.x, y: enemy.y, age: 0 });
  state.events.push('kill');
}

export function survivalPoints(state: ShooterState): number {
  return SURVIVAL_POINTS * Math.floor(state.elapsed);
}

/** Points for defeated monsters plus points for every whole second survived. */
export function totalScore(state: ShooterState): number {
  return state.killPoints + survivalPoints(state);
}

/** Starts a ready round, or resumes a paused one. */
export function play(state: ShooterState) {
  if (state.phase === 'ready' || state.phase === 'paused') state.phase = 'playing';
}

export function pause(state: ShooterState) {
  if (state.phase === 'playing') state.phase = 'paused';
}

/** Steps from every floor cell to the player's cell, for monsters to follow. */
function distancesToPlayer(player: Player): number[][] {
  const distances = ARENA.map((row) => Array.from(row, () => Infinity));
  const start = { x: Math.floor(player.x), y: Math.floor(player.y) };
  distances[start.y][start.x] = 0;
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    for (const [dx, dy] of NEIGHBOURS) {
      const x = cell.x + dx;
      const y = cell.y + dy;
      if (isWall(x + 0.5, y + 0.5) || distances[y][x] !== Infinity) continue;
      distances[y][x] = distances[cell.y][cell.x] + 1;
      queue.push({ x, y });
    }
  }
  return distances;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function canSee(from: { x: number; y: number }, to: { x: number; y: number }) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return castRay(from.x, from.y, Math.atan2(to.y - from.y, to.x - from.x)).distance >= distance;
}

/** Where a monster heads next: straight at the player, or along the path to them. */
function chaseTarget(enemy: Enemy, player: Player, distances: number[][]) {
  if (canSee(enemy, player)) return player;
  const cellX = Math.floor(enemy.x);
  const cellY = Math.floor(enemy.y);
  let best = { x: cellX + 0.5, y: cellY + 0.5 };
  let bestDistance = distances[cellY]?.[cellX] ?? Infinity;
  for (const [dx, dy] of NEIGHBOURS) {
    const distance = distances[cellY + dy]?.[cellX + dx] ?? Infinity;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x: cellX + dx + 0.5, y: cellY + dy + 0.5 };
    }
  }
  return best;
}

function spawnEnemy(state: ShooterState) {
  const { player } = state;
  const open = SPAWN_POINTS.filter(
    (p) => Math.hypot(p.x - player.x, p.y - player.y) >= SPAWN_SAFE_DISTANCE,
  );
  if (open.length === 0) return;
  const point = open[Math.floor(state.random() * open.length) % open.length];
  state.enemies.push(createEnemy(point.x, point.y, state.elapsed));
}

/** Advances the round by `dt` seconds. */
export function step(state: ShooterState, dt: number): void {
  if (state.phase !== 'playing') return;
  const { player } = state;

  state.elapsed += dt;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  state.muzzleFlash = Math.max(0, state.muzzleFlash - dt);
  state.hitMarker = Math.max(0, state.hitMarker - dt);
  state.hurtFlash = Math.max(0, state.hurtFlash - dt);
  state.pickupFlash = Math.max(0, state.pickupFlash - dt);

  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) {
      player.reloadTimer = 0;
      const loaded = Math.min(CLIP_SIZE - player.clip, player.reserve);
      player.clip += loaded;
      player.reserve -= loaded;
    }
  }

  state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (state.comboTimer === 0) state.combo = 1;

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    if (state.enemies.length < MAX_ENEMIES) spawnEnemy(state);
    state.spawnTimer += spawnInterval(state.elapsed);
  }

  const distances = distancesToPlayer(player);
  for (const enemy of state.enemies) {
    enemy.hurtTimer = Math.max(0, enemy.hurtTimer - dt);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    const gap = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (gap <= ATTACK_RANGE) {
      if (enemy.attackCooldown === 0) {
        player.health = Math.max(0, player.health - enemy.damage);
        enemy.attackCooldown = ATTACK_COOLDOWN;
        state.hurtFlash = 0.3;
        state.combo = 1;
        state.comboTimer = 0;
        state.events.push('hurt');
      }
      continue;
    }
    const target = chaseTarget(enemy, player, distances);
    const tx = target.x - enemy.x;
    const ty = target.y - enemy.y;
    const length = Math.hypot(tx, ty);
    if (length === 0) continue;
    const distance = Math.min(enemy.speed * dt, length);
    slide(enemy, (tx / length) * distance, (ty / length) * distance, ENEMY_RADIUS);
  }

  for (const pickup of state.pickups) {
    if (pickup.respawnTimer > 0) {
      pickup.respawnTimer -= dt;
      continue;
    }
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) > PICKUP_RANGE) continue;
    if (pickup.kind === 'health') {
      if (player.health === MAX_HEALTH) continue;
      player.health = Math.min(MAX_HEALTH, player.health + HEALTH_PICKUP);
    } else {
      player.reserve += AMMO_PICKUP;
    }
    pickup.respawnTimer = PICKUP_RESPAWN;
    state.pickupFlash = 0.6;
    state.lastPickup = pickup.kind;
    state.events.push('pickup');
  }

  for (const puff of state.puffs) puff.age += dt;
  state.puffs = state.puffs.filter((p) => p.age < 0.5);

  if (player.health <= 0) {
    state.phase = 'over';
    state.endReason = 'health';
  } else if (state.elapsed >= ROUND_TIME) {
    state.elapsed = ROUND_TIME;
    state.phase = 'over';
    state.endReason = 'time';
  }
}

// Everything below draws, listens or plays sounds, so only `start` uses it.

const FOV = Math.PI / 2.7;
const COLUMN_WIDTH = 2;
const COLUMNS = WIDTH / COLUMN_WIDTH;
const PLANE = Math.tan(FOV / 2);

function drawWorld(ctx: CanvasRenderingContext2D, state: ShooterState): number[] {
  const { colors } = theme;
  const { player } = state;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT / 2);
  ctx.fillStyle = colors.surface;
  ctx.fillRect(0, HEIGHT / 2, WIDTH, HEIGHT / 2);

  const depths: number[] = [];
  for (let column = 0; column < COLUMNS; column++) {
    const offset = Math.atan(((column + 0.5) / COLUMNS - 0.5) * 2 * PLANE);
    const ray = castRay(player.x, player.y, player.angle + offset);
    const depth = Math.max(ray.distance * Math.cos(offset), 0.05);
    depths.push(depth);

    const height = HEIGHT / depth;
    const top = (HEIGHT - height) / 2;
    const x = column * COLUMN_WIDTH;
    ctx.fillStyle = colors.wood;
    ctx.fillRect(x, top, COLUMN_WIDTH, height);
    ctx.fillStyle = colors.stripeA;
    ctx.fillRect(x, top, COLUMN_WIDTH, height * 0.12);
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = Math.min(0.85, depth / 10 + (ray.northSouth ? 0.2 : 0));
    ctx.fillRect(x, top, COLUMN_WIDTH, height);
    ctx.globalAlpha = 1;
  }
  return depths;
}

interface Sprite {
  x: number;
  y: number;
  draw: (ctx: CanvasRenderingContext2D, x: number, floor: number, scale: number) => void;
}

function drawSprites(
  ctx: CanvasRenderingContext2D,
  state: ShooterState,
  depths: number[],
  sprites: Sprite[],
) {
  const { player } = state;
  const cos = Math.cos(player.angle);
  const sin = Math.sin(player.angle);
  const placed = sprites
    .map((sprite) => {
      const dx = sprite.x - player.x;
      const dy = sprite.y - player.y;
      return { sprite, depth: dx * cos + dy * sin, across: dy * cos - dx * sin };
    })
    .filter((p) => p.depth > 0.2)
    .sort((a, b) => b.depth - a.depth);

  for (const { sprite, depth, across } of placed) {
    const scale = HEIGHT / depth;
    const screenX = (WIDTH / 2) * (1 + across / (depth * PLANE));
    const first = Math.max(0, Math.floor((screenX - scale / 2) / COLUMN_WIDTH));
    const last = Math.min(COLUMNS - 1, Math.ceil((screenX + scale / 2) / COLUMN_WIDTH));
    if (first > last) continue;

    // Clip to the columns where the sprite is nearer than the wall.
    ctx.save();
    ctx.beginPath();
    let visible = false;
    for (let column = first; column <= last; column++) {
      if (depths[column] > depth) {
        ctx.rect(column * COLUMN_WIDTH, 0, COLUMN_WIDTH, HEIGHT);
        visible = true;
      }
    }
    if (visible) {
      ctx.clip();
      sprite.draw(ctx, screenX, HEIGHT / 2 + scale / 2, scale);
    }
    ctx.restore();
  }
}

function enemySprite(enemy: Enemy): Sprite {
  const { colors } = theme;
  return {
    x: enemy.x,
    y: enemy.y,
    draw(ctx, x, floor, scale) {
      const body = scale * 0.32;
      const middle = floor - scale * 0.38;
      ctx.fillStyle = enemy.hurtTimer > 0 ? colors.text : colors.danger;
      ctx.beginPath();
      ctx.ellipse(x, middle, body, body * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      // Horns.
      ctx.fillStyle = colors.stripeA;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + side * body * 0.4, middle - body * 0.9);
        ctx.lineTo(x + side * body * 0.95, middle - body * 1.6);
        ctx.lineTo(x + side * body * 0.8, middle - body * 0.6);
        ctx.fill();
      }
      ctx.fillStyle = colors.accent;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x + side * body * 0.38, middle - body * 0.25, body * 0.17, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = colors.background;
      ctx.fillRect(x - body * 0.45, middle + body * 0.3, body * 0.9, body * 0.2);
    },
  };
}

function pickupSprite(pickup: Pickup): Sprite {
  const { colors } = theme;
  return {
    x: pickup.x,
    y: pickup.y,
    draw(ctx, x, floor, scale) {
      const size = scale * 0.22;
      const top = floor - size;
      if (pickup.kind === 'health') {
        ctx.fillStyle = colors.stripeB;
        ctx.fillRect(x - size / 2, top, size, size);
        ctx.fillStyle = colors.danger;
        ctx.fillRect(x - size * 0.1, top + size * 0.15, size * 0.2, size * 0.7);
        ctx.fillRect(x - size * 0.35, top + size * 0.4, size * 0.7, size * 0.2);
      } else {
        ctx.fillStyle = colors.wood;
        ctx.fillRect(x - size / 2, top, size, size);
        ctx.fillStyle = colors.accent;
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(
            x - size * 0.35 + i * size * 0.27,
            top + size * 0.2,
            size * 0.16,
            size * 0.6,
          );
        }
      }
    },
  };
}

function puffSprite(puff: Puff): Sprite {
  const { colors } = theme;
  return {
    x: puff.x,
    y: puff.y,
    draw(ctx, x, floor, scale) {
      const progress = puff.age / 0.5;
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(x, floor - scale * 0.38, scale * (0.15 + progress * 0.35), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    },
  };
}

function drawWeapon(ctx: CanvasRenderingContext2D, state: ShooterState) {
  const { colors } = theme;
  const recoil = state.muzzleFlash > 0 ? 10 : 0;
  const lowered = state.player.reloadTimer > 0 ? 50 : 0;
  const x = WIDTH / 2;
  const y = HEIGHT - 90 + recoil + lowered;

  if (state.muzzleFlash > 0) {
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(x, y - 12, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = colors.muted;
  ctx.fillRect(x - 12, y, 24, 70);
  ctx.fillStyle = colors.surface;
  ctx.fillRect(x - 30, y + 40, 60, 60);
  ctx.fillStyle = colors.stripeA;
  ctx.fillRect(x - 30, y + 40, 60, 8);
}

function drawCrosshair(ctx: CanvasRenderingContext2D, state: ShooterState) {
  const { colors } = theme;
  const x = WIDTH / 2;
  const y = HEIGHT / 2;
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 10, y);
  ctx.lineTo(x - 4, y);
  ctx.moveTo(x + 4, y);
  ctx.lineTo(x + 10, y);
  ctx.moveTo(x, y - 10);
  ctx.lineTo(x, y - 4);
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x, y + 10);
  ctx.stroke();

  if (state.hitMarker > 0) {
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 14);
    ctx.lineTo(x - 7, y - 7);
    ctx.moveTo(x + 14, y - 14);
    ctx.lineTo(x + 7, y - 7);
    ctx.moveTo(x - 14, y + 14);
    ctx.lineTo(x - 7, y + 7);
    ctx.moveTo(x + 14, y + 14);
    ctx.lineTo(x + 7, y + 7);
    ctx.stroke();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, state: ShooterState) {
  const { colors } = theme;
  const { player } = state;

  if (state.hurtFlash > 0) {
    ctx.fillStyle = colors.danger;
    ctx.globalAlpha = state.hurtFlash * 1.5;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = colors.background;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(0, 0, WIDTH, 36);
  ctx.fillRect(0, HEIGHT - 36, WIDTH, 36);
  ctx.globalAlpha = 1;

  ctx.font = canvasFont('body', 'bold');
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = colors.text;
  ctx.fillText(`Score ${totalScore(state)}`, 16, 18);
  ctx.textAlign = 'center';
  ctx.fillStyle = state.combo > 1 ? colors.accent : colors.muted;
  ctx.fillText(`Combo x${state.combo}`, WIDTH / 2, 18);
  ctx.textAlign = 'right';
  const left = Math.ceil(ROUND_TIME - state.elapsed);
  ctx.fillStyle = left <= 10 ? colors.danger : colors.text;
  ctx.fillText(`Time ${left}`, WIDTH - 16, 18);

  ctx.textAlign = 'left';
  ctx.fillStyle = player.health <= 30 ? colors.danger : colors.text;
  ctx.fillText(`Health ${player.health}`, 16, HEIGHT - 18);
  ctx.textAlign = 'right';
  ctx.fillStyle = player.clip === 0 ? colors.danger : colors.text;
  const ammo = player.reloadTimer > 0 ? 'Reloading' : `Ammo ${player.clip}/${CLIP_SIZE}`;
  ctx.fillText(`${ammo}  +${player.reserve}`, WIDTH - 16, HEIGHT - 18);

  if (state.pickupFlash > 0 && state.lastPickup) {
    ctx.globalAlpha = Math.min(1, state.pickupFlash * 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = state.lastPickup === 'health' ? colors.stripeB : colors.accent;
    const text =
      state.lastPickup === 'health' ? `+${HEALTH_PICKUP} health` : `+${AMMO_PICKUP} ammo`;
    ctx.fillText(text, WIDTH / 2, HEIGHT / 2 + 60);
    ctx.globalAlpha = 1;
  }
  ctx.textBaseline = 'alphabetic';
}

function drawOverlay(ctx: CanvasRenderingContext2D, lines: [string, 'title' | 'body', string][]) {
  ctx.fillStyle = theme.colors.background;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  let y = HEIGHT / 2 - (lines.length - 1) * 18;
  for (const [text, size, colour] of lines) {
    ctx.font = canvasFont(size, size === 'title' ? 'bold' : 'normal');
    ctx.fillStyle = colour;
    ctx.fillText(text, WIDTH / 2, y);
    y += size === 'title' ? 48 : 30;
  }
}

function draw(ctx: CanvasRenderingContext2D, state: ShooterState, best: number | undefined) {
  const { colors } = theme;
  const depths = drawWorld(ctx, state);
  drawSprites(ctx, state, depths, [
    ...state.pickups.filter((p) => p.respawnTimer <= 0).map(pickupSprite),
    ...state.enemies.map(enemySprite),
    ...state.puffs.map(puffSprite),
  ]);
  drawWeapon(ctx, state);
  drawCrosshair(ctx, state);
  drawHud(ctx, state);

  if (state.phase === 'ready') {
    drawOverlay(ctx, [
      ['Arena Blaster', 'title', colors.accent],
      ['WASD to move, mouse to aim, click to shoot, R to reload', 'body', colors.text],
      ['Esc pauses. Survive 90 seconds of horned gloomers.', 'body', colors.muted],
      ['Click to enter the arena', 'body', colors.accent],
    ]);
  } else if (state.phase === 'paused') {
    drawOverlay(ctx, [
      ['Paused', 'title', colors.accent],
      ['Click to jump back in', 'body', colors.text],
    ]);
  } else if (state.phase === 'over') {
    drawOverlay(ctx, [
      [state.endReason === 'health' ? 'Overrun!' : "Time's up!", 'title', colors.accent],
      [`You scored ${totalScore(state)}`, 'body', colors.text],
      [
        `${state.kills} defeated for ${state.killPoints}, survival ${survivalPoints(state)}`,
        'body',
        colors.muted,
      ],
      [`Best ${best ?? totalScore(state)}`, 'body', colors.text],
      ['Click to play again', 'body', colors.accent],
    ]);
  }
}

/** Short synthesised blips, so the game ships no sound files. */
function createSounds() {
  let audio: AudioContext | undefined;
  const tones: Record<GameEvent, [OscillatorType, number, number, number]> = {
    fire: ['square', 140, 50, 0.12],
    hit: ['triangle', 700, 500, 0.08],
    kill: ['sawtooth', 300, 60, 0.3],
    hurt: ['sawtooth', 110, 70, 0.25],
    pickup: ['sine', 660, 1320, 0.2],
    empty: ['square', 60, 60, 0.05],
    reload: ['triangle', 220, 330, 0.15],
  };

  return {
    /** Browsers only allow sound after a click, so this runs from one. */
    unlock() {
      try {
        audio ??= new AudioContext();
        void audio.resume();
      } catch {
        audio = undefined;
      }
    },
    play(event: GameEvent) {
      if (!audio || audio.state !== 'running') return;
      const [type, from, to, length] = tones[event];
      const now = audio.currentTime;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, now);
      oscillator.frequency.exponentialRampToValueAtTime(to, now + length);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + length);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + length);
    },
    close() {
      void audio?.close();
      audio = undefined;
    },
  };
}

const MOUSE_SENSITIVITY = 0.0025;
const KEY_TURN_SPEED = 2.6;

export const doomShooter: CarnivalGame = {
  id: 'doom-shooter',
  name: 'Arena Blaster',
  description:
    'A fast first-person arena shooter. Blast the horned gloomers and survive 90 seconds.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    let best = bestScore(doomShooter.id);
    let firing = false;
    const keys = new Set<string>();
    const sounds = createSounds();

    const lock = () => {
      try {
        const request = canvas.requestPointerLock?.() as unknown;
        if (request instanceof Promise) request.catch(() => {});
      } catch {
        // Without pointer lock, the mouse still aims while it is over the canvas.
      }
    };
    const unlock = () => {
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
    const pauseGame = () => {
      pause(state);
      keys.clear();
      firing = false;
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      sounds.unlock();
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      }
      if (state.phase !== 'playing') {
        play(state);
        lock();
        return;
      }
      if (document.pointerLockElement !== canvas) lock();
      firing = true;
      fire(state);
    };
    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 0) firing = false;
    };
    const onMouseMove = (event: MouseEvent) => {
      turn(state, event.movementX * MOUSE_SENSITIVITY);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        pauseGame();
        unlock();
        return;
      }
      if (state.phase !== 'playing') return;
      if (event.code === 'KeyR') reload(state);
      keys.add(event.code);
      if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onLockChange = () => {
      if (document.pointerLockElement !== canvas) pauseGame();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', pauseGame);
    document.addEventListener('pointerlockchange', onLockChange);

    const held = (...codes: string[]) => (codes.some((code) => keys.has(code)) ? 1 : 0);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;

      turn(state, (held('ArrowRight') - held('ArrowLeft')) * KEY_TURN_SPEED * dt);
      movePlayer(
        state,
        held('KeyW', 'ArrowUp') - held('KeyS', 'ArrowDown'),
        held('KeyD') - held('KeyA'),
        dt,
      );
      if (firing) fire(state);
      step(state, dt);
      for (const event of state.events) sounds.play(event);
      state.events = [];

      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(doomShooter.id, totalScore(state));
        best = bestScore(doomShooter.id);
        scoreRecorded = true;
        firing = false;
        keys.clear();
        unlock();
      }
      draw(ctx, state, best);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', pauseGame);
      document.removeEventListener('pointerlockchange', onLockChange);
      unlock();
      sounds.close();
    };
  },
};

export default doomShooter;
