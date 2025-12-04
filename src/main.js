import {
  loadState,
  saveState,
  exportSave,
  importSaveFromFile,
} from './save.js';

function setup() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const exportButton = document.getElementById('exportButton');
  const importFile = document.getElementById('importFile');
  const importButton = document.getElementById('importButton');

  let state = loadState();
  state = clampPlayerToCanvas(state, canvas);
  state.world.items = state.world.items || [];

  const keys = new Set();

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (
      ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'e', 'enter'].includes(
        key
      )
    ) {
      keys.add(key);
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
  });

  exportButton.addEventListener('click', () => {
    exportSave();
  });

  importButton.addEventListener('click', () => {
    importSaveFromFile(importFile);
  });

  let lastTime = performance.now();

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.25);
    lastTime = now;

    const currentSpeed = update(state, keys, dt, canvas);
    draw(ctx, state, canvas, currentSpeed);

    saveState(state);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

function clampPlayerToCanvas(state, canvas) {
  const margin = 4;
  state.player.x = Math.max(margin, Math.min(canvas.width - margin, state.player.x || margin));
  state.player.y = Math.max(margin, Math.min(canvas.height - margin, state.player.y || margin));
  return state;
}

function update(state, keys, dt, canvas) {
  const player = state.player;
  const baseSpeed = state.player.baseSpeed ?? 48;
  const minSpeed = state.player.minSpeed ?? 10;
  const carryWeight = state.player.carryWeight ?? 0;
  const weightFactor = 4;

  let speed = baseSpeed - weightFactor * carryWeight;
  speed = Math.max(minSpeed, speed);

  let dx = 0;
  let dy = 0;

  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;

    player.x += dx * speed * dt;
    player.y += dy * speed * dt;
  }

  clampPlayerToCanvas(state, canvas);

  const pickupRadius = 10;
  const wantsPickup = keys.has('e') || keys.has('enter');
  const items = state.world.items || [];

  if (wantsPickup && items.length) {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const item = items[i];
      const distance = Math.hypot(item.x - player.x, item.y - player.y);
      if (distance <= pickupRadius) {
        player.carryWeight = (player.carryWeight ?? 0) + (item.weight ?? 0);
        items.splice(i, 1);
      }
    }
  }

  return speed;
}

function draw(ctx, state, canvas, currentSpeed) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#131a23';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#55677a';
  for (let i = 0; i < canvas.width; i += 40) {
    ctx.fillRect(i, canvas.height - 14, 14, 14);
  }

  ctx.fillStyle = '#889977';
  const items = state.world.items || [];
  for (const item of items) {
    ctx.fillRect(item.x - 3, item.y - 3, 6, 6);
  }

  const player = state.player;
  ctx.fillStyle = '#f1e9d2';
  ctx.fillRect(player.x - 4, player.y - 4, 8, 8);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(8, 8, 120, 32);
  ctx.fillStyle = '#e7e4d7';
  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(`x: ${player.x.toFixed(1)}`, 12, 12);
  ctx.fillText(`y: ${player.y.toFixed(1)}`, 12, 26);

  ctx.fillStyle = '#ffffff';
  ctx.font = '8px monospace';
  ctx.fillText(`Weight: ${player.carryWeight ?? 0}`, 4, 10);
  ctx.fillText(`Speed: ${Math.round(currentSpeed ?? 0)}`, 4, 20);
}

document.addEventListener('DOMContentLoaded', setup);
