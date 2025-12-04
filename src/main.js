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

  const keys = new Set();

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
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

    update(state, keys, dt, canvas);
    draw(ctx, state, canvas);

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
  const speed = 48; // pixels per second

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
}

function draw(ctx, state, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#131a23';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#55677a';
  for (let i = 0; i < canvas.width; i += 40) {
    ctx.fillRect(i, canvas.height - 14, 14, 14);
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
}

document.addEventListener('DOMContentLoaded', setup);
