import {
  loadState,
  saveState,
  exportSave,
  importSaveFromFile,
} from './save.js';

const CHUNK_SIZE = 96;
const VIEW_DISTANCE = 2;
const INTERACT_RADIUS = 14;
const SPRITE_PATHS = {
  player: './assets/player.svg',
  npc: './assets/npc.svg',
  forage: './assets/forage.svg',
  water: './assets/water.svg',
  ember: './assets/ember.svg',
  keepsake: './assets/keepsake.svg',
};
const ITEM_TYPES = {
  forage: { color: '#c3c68f', weight: 1, hunger: -18 },
  water: { color: '#83c5ff', weight: 1.5, thirst: -22 },
  ember: { color: '#e8a878', weight: 2, warmth: -28 },
  keepsake: { color: '#f5e5c8', weight: 0.5, hunger: -5, thirst: -5, warmth: -5 },
};

const DIALOGUE_TEMPLATES = [
  {
    intro: [
      '"I keep moving so the cold never catches me."',
      '"Your pack looks heavy. Let your thoughts stay light."',
    ],
    followup: [
      '"We trade warmth for distance. Choose which you need."',
      '"Breath slow. Weight feels lighter when you remember you chose to carry it."',
    ],
  },
  {
    intro: [
      '"Silence is the only predator here."',
      '"Listen. Even the wind tells you when to stop and rest."',
    ],
    followup: [
      '"I dropped everything once. Found I only missed the conversations."',
      '"Carry a keepsake. Not for need, but for courage."',
    ],
  },
  {
    intro: [
      '"I mark my path by kindness shared."',
      '"Take this story, lighter than food, warmer than fire."',
    ],
    followup: [
      '"Stories travel farther than feet. Leave one with someone else."',
      '"You look tired. Set something down before it sets you down."',
    ],
  },
];

const PALETTES = [
  { ground: '#0b0d11', accent: '#1f2430', light: '#f5e5c8', mood: '#ca9a6a', haze: '#303742' },
  { ground: '#0f1115', accent: '#1a1d26', light: '#d8e0e0', mood: '#7ac9c2', haze: '#2b3140' },
  { ground: '#0a0b0e', accent: '#171a21', light: '#f0e0c0', mood: '#c6787d', haze: '#272b34' },
  { ground: '#0a0c10', accent: '#181e2c', light: '#d9d2ed', mood: '#8694f2', haze: '#242a39' },
  { ground: '#0f0f10', accent: '#242121', light: '#f3d9c0', mood: '#e3a56a', haze: '#312a28' },
];

const uiState = {
  backpackOpen: false,
  selectedItemId: null,
  elements: {},
};

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed, x, y) {
  const str = `${seed}:${x}:${y}`;
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return mulberry32(h >>> 0);
}

function ensureChunk(state, cx, cy) {
  const key = `${cx},${cy}`;
  if (state.world.discoveredChunks[key]) return state.world.discoveredChunks[key];

  const rand = hashSeed(state.world.seed, cx, cy);
  const palette = PALETTES[Math.floor(rand() * PALETTES.length)];
  const chill = rand();
  const biome = chill > 0.65 ? 'icy' : chill > 0.35 ? 'forest' : 'steppe';

  const chunk = { key, palette, biome, items: [], npcs: [] };

  const itemCount = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < itemCount; i += 1) {
    const entryTypes = Object.keys(ITEM_TYPES);
    const type = entryTypes[Math.floor(rand() * entryTypes.length)];
    chunk.items.push({
      id: `${key}-item-${i}`,
      type,
      x: cx * CHUNK_SIZE + rand() * CHUNK_SIZE,
      y: cy * CHUNK_SIZE + rand() * CHUNK_SIZE,
      weight: ITEM_TYPES[type].weight,
    });
  }

  if (rand() > 0.94) {
    const npcId = `${key}-npc`;
    const npcState = state.world.npcStates[npcId] || { encounters: 0, gifted: false };
    state.world.npcStates[npcId] = npcState;

    chunk.npcs.push({
      id: npcId,
      x: (cx + 0.5) * CHUNK_SIZE + (rand() - 0.5) * 24,
      y: (cy + 0.5) * CHUNK_SIZE + (rand() - 0.5) * 24,
      template: pickDialogueTemplate(rand),
    });
  }

  state.world.discoveredChunks[key] = chunk;
  state.world.items.push(...chunk.items);
  state.world.npcs.push(...chunk.npcs);
  return chunk;
}

function pickDialogueTemplate(rand) {
  return Math.floor(rand() * DIALOGUE_TEMPLATES.length);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadSprites() {
  const pairs = await Promise.all(
    Object.entries(SPRITE_PATHS).map(async ([key, src]) => ({
      key,
      img: await loadImage(src),
    }))
  );

  return Object.fromEntries(pairs.map(({ key, img }) => [key, img]));
}

function recalcCarryWeight(player) {
  const total = player.inventory.reduce((sum, item) => sum + (item.weight ?? 0), 0);
  player.carryWeight = Math.max(0, Math.round(total * 100) / 100);
}

function consumeKey(keys, key) {
  if (keys.has(key)) {
    keys.delete(key);
    return true;
  }
  return false;
}

function addItemToInventory(state, item) {
  const player = state.player;
  if (player.inventory.length >= player.maxInventory) {
    queueMessage(state, 'Backpack is stuffed. Drop something first.');
    return false;
  }

  player.inventory.push({ id: item.id, type: item.type, weight: item.weight ?? 0 });
  recalcCarryWeight(player);
  queueMessage(state, 'Packed away. Heavier already.');
  return true;
}

function useInventoryItem(state, itemId) {
  const idx = state.player.inventory.findIndex((entry) => entry.id === itemId);
  if (idx === -1) return;

  const item = state.player.inventory[idx];
  applyItemEffect(state.player, item.type);
  state.player.inventory.splice(idx, 1);
  recalcCarryWeight(state.player);
  queueMessage(state, 'You feel lighter for a moment.');
}

function dropInventoryItem(state, itemId) {
  const idx = state.player.inventory.findIndex((entry) => entry.id === itemId);
  if (idx === -1) return;

  const item = state.player.inventory[idx];
  const offsetAngle = Math.random() * Math.PI * 2;
  const offsetDistance = 10 + Math.random() * 6;
  const dropX = state.player.x + Math.cos(offsetAngle) * offsetDistance;
  const dropY = state.player.y + Math.sin(offsetAngle) * offsetDistance;

  state.world.items.push({
    id: `${item.id}-dropped-${Date.now()}`,
    type: item.type,
    x: dropX,
    y: dropY,
    weight: item.weight,
  });

  state.player.inventory.splice(idx, 1);
  recalcCarryWeight(state.player);
  queueMessage(state, 'It thuds softly onto the ground.');
}

function queueMessage(state, text, duration = 4) {
  state.world.activeDialogue = {
    npcId: null,
    lines: [text],
    index: 0,
    timer: duration,
  };
}

function setBackpackOpen(open) {
  uiState.backpackOpen = open;
  const panel = uiState.elements.backpackPanel;
  if (!panel) return;
  panel.setAttribute('data-open', open ? 'true' : 'false');
  panel.ariaHidden = open ? 'false' : 'true';
}

function selectInventoryItem(itemId) {
  uiState.selectedItemId = itemId;
  renderBackpackList(uiState.currentState);
}

function renderBackpackList(state) {
  if (!state) return;
  uiState.currentState = state;

  const list = uiState.elements.inventoryList;
  const meta = uiState.elements.inventoryMeta;
  if (!list || !meta) return;

  list.innerHTML = '';
  state.player.inventory.forEach((item) => {
    const li = document.createElement('li');
    li.className = item.id === uiState.selectedItemId ? 'inventory__item is-selected' : 'inventory__item';
    li.textContent = `${item.type} (${item.weight ?? 0}kg)`;
    li.addEventListener('click', () => selectInventoryItem(item.id));
    list.appendChild(li);
  });

  meta.textContent = `${state.player.inventory.length}/${state.player.maxInventory} slots · ${state.player.carryWeight.toFixed(1)}kg burden`;
}

function useSelectedItem(state) {
  if (!uiState.selectedItemId) return;
  useInventoryItem(state, uiState.selectedItemId);
  uiState.selectedItemId = null;
  renderBackpackList(state);
}

function dropSelectedItem(state) {
  if (!uiState.selectedItemId) return;
  dropInventoryItem(state, uiState.selectedItemId);
  uiState.selectedItemId = null;
  renderBackpackList(state);
}

async function setup() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const exportButton = document.getElementById('exportButton');
  const importFile = document.getElementById('importFile');
  const importButton = document.getElementById('importButton');
  const backpackToggle = document.getElementById('backpackToggle');
  const backpackPanel = document.getElementById('backpackPanel');
  const inventoryList = document.getElementById('inventoryList');
  const inventoryMeta = document.getElementById('inventoryMeta');
  const useButton = document.getElementById('useItem');
  const dropButton = document.getElementById('dropItem');

  const sprites = await loadSprites().catch((err) => {
    console.error('Failed to load sprites; falling back to primitives.', err);
    return {};
  });

  let state = loadState();
  state.world.items = state.world.items || [];
  state.world.npcs = state.world.npcs || [];
  state.world.discoveredChunks = state.world.discoveredChunks || {};
  state.world.activeDialogue = null;
  state.world.npcStates = state.world.npcStates || {};
  state.player.inventory = state.player.inventory || [];
  recalcCarryWeight(state.player);

  const keys = new Set();

  uiState.elements = { backpackPanel, inventoryList, inventoryMeta, useButton, dropButton };
  setBackpackOpen(false);

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (
      ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'e', 'enter', 'b', 'escape'].includes(key)
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

  backpackToggle.addEventListener('click', () => {
    setBackpackOpen(!uiState.backpackOpen);
  });
  useButton.addEventListener('click', () => useSelectedItem(state));
  dropButton.addEventListener('click', () => dropSelectedItem(state));

  let lastTime = performance.now();

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.25);
    lastTime = now;

    const currentSpeed = update(state, keys, dt);
    draw(ctx, state, sprites, canvas, currentSpeed, now / 1000);

    saveState(state);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

function update(state, keys, dt) {
  const player = state.player;
  const baseSpeed = player.baseSpeed ?? 48;
  const minSpeed = player.minSpeed ?? 10;
  const carryWeight = player.carryWeight ?? 0;
  const weightFactor = 5;

  if (consumeKey(keys, 'b')) {
    setBackpackOpen(!uiState.backpackOpen);
  }
  if (consumeKey(keys, 'escape')) {
    setBackpackOpen(false);
  }

  if (player.isCollapsed) {
    player.collapseTimer -= dt;
    applyNeeds(state, dt * 0.3);
    if (player.collapseTimer <= 0) {
      player.isCollapsed = false;
      player.hunger = 40;
      player.thirst = 40;
      player.warmth = 45;
      queueMessage(state, 'You come to, aching but alive.', 6);
    }
    return 0;
  }

  let speed = baseSpeed - weightFactor * carryWeight;
  const burdenPenalty = Math.min(0.35, carryWeight * 0.02);

  const needStrain = Math.max(player.hunger, player.thirst, player.warmth) / 100;
  const severeNeed = Math.max(0, needStrain - 0.7);
  speed *= 1 - burdenPenalty - needStrain * 0.35 - severeNeed * 0.2;
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

  const cx = Math.floor(player.x / CHUNK_SIZE);
  const cy = Math.floor(player.y / CHUNK_SIZE);
  for (let x = cx - VIEW_DISTANCE; x <= cx + VIEW_DISTANCE; x += 1) {
    for (let y = cy - VIEW_DISTANCE; y <= cy + VIEW_DISTANCE; y += 1) {
      ensureChunk(state, x, y);
    }
  }

  const wantsPickup = consumeKey(keys, 'e') || consumeKey(keys, 'enter');
  if (wantsPickup) {
    if (state.world.activeDialogue) {
      advanceDialogue(state);
    } else {
      pickUpNearby(state, player);
      talkToNearby(state, player);
    }
  }

  applyNeeds(state, dt);
  cullFarEntities(state, player);

  return speed;
}

function pickUpNearby(state, player) {
  const items = state.world.items;
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    const distance = Math.hypot(item.x - player.x, item.y - player.y);
    if (distance <= INTERACT_RADIUS) {
      const added = addItemToInventory(state, item);
      if (added) {
        items.splice(i, 1);
      }
    }
  }
}

function talkToNearby(state, player) {
  const npcs = state.world.npcs;
  for (let i = 0; i < npcs.length; i += 1) {
    const npc = npcs[i];
    const distance = Math.hypot(npc.x - player.x, npc.y - player.y);
    if (distance <= INTERACT_RADIUS) {
      const npcState = state.world.npcStates[npc.id] || { encounters: 0, gifted: false };
      state.world.npcStates[npc.id] = npcState;
      const dialogue = buildNpcDialogue(state, npc, npcState);
      state.world.activeDialogue = {
        npcId: npc.id,
        lines: dialogue.lines,
        index: 0,
        onComplete: dialogue.onComplete,
      };
      return;
    }
  }
}

function buildNpcDialogue(state, npc, npcState) {
  const template = DIALOGUE_TEMPLATES[npc.template] || DIALOGUE_TEMPLATES[0];
  const player = state.player;
  const needy = Math.max(player.hunger, player.thirst, player.warmth) > 70;
  const hasMet = npcState.encounters > 0;

  const lines = [];
  lines.push(...(hasMet ? template.followup : template.intro));
  if (needy) {
    lines.push('"You\'re fraying. Eat, sip, warm. Your feet will follow."');
  }

  const onComplete = () => {
    npcState.encounters += 1;
    player.carryWeight = Math.max(0, player.carryWeight - 0.15);
    if (!npcState.gifted) {
      npcState.gifted = true;
      addItemToInventory(state, {
        id: `${npc.id}-keepsake`,
        type: 'keepsake',
        weight: ITEM_TYPES.keepsake.weight,
      });
      queueMessage(state, 'They press a keepsake into your palm.');
    }
  };

  return { lines, onComplete };
}

function advanceDialogue(state) {
  const dialogue = state.world.activeDialogue;
  if (!dialogue) return;

  if (dialogue.index < (dialogue.lines?.length ?? 0) - 1) {
    dialogue.index += 1;
    return;
  }

  if (dialogue.onComplete) {
    dialogue.onComplete();
  }
  state.world.activeDialogue = null;
}

function applyNeeds(state, dt) {
  const player = state.player;
  const biome = getBiomeAt(state, player.x, player.y);
  const coldPenalty = biome === 'icy' ? 1.25 : biome === 'forest' ? 0.75 : 0.6;

  player.hunger = clamp(player.hunger + 6 * dt, 0, 100);
  player.thirst = clamp(player.thirst + 8 * dt, 0, 100);
  player.warmth = clamp(player.warmth + 4 * dt * coldPenalty, 0, 100);

  const criticalNeed = Math.max(player.hunger, player.thirst, player.warmth);
  if (criticalNeed >= 100) {
    player.criticalTimer += dt;
  } else {
    player.criticalTimer = Math.max(0, player.criticalTimer - dt * 0.5);
  }

  if (player.criticalTimer >= 5) {
    triggerCollapse(state);
  }

  if (state.world.activeDialogue && typeof state.world.activeDialogue.timer === 'number') {
    state.world.activeDialogue.timer -= dt;
    if (state.world.activeDialogue.timer <= 0 && state.world.activeDialogue.onComplete) {
      state.world.activeDialogue.onComplete();
    }
    if (state.world.activeDialogue.timer <= 0) {
      state.world.activeDialogue = null;
    }
  }
}

function applyItemEffect(player, type) {
  const effect = ITEM_TYPES[type];
  if (!effect) return;

  player.hunger = clamp(player.hunger + (effect.hunger ?? 0), 0, 100);
  player.thirst = clamp(player.thirst + (effect.thirst ?? 0), 0, 100);
  player.warmth = clamp(player.warmth + (effect.warmth ?? 0), 0, 100);
}

function triggerCollapse(state) {
  const player = state.player;
  if (player.isCollapsed) return;

  player.isCollapsed = true;
  player.collapseTimer = 5;
  player.criticalTimer = 0;

  if (player.inventory.length) {
    const heaviest = [...player.inventory].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];
    dropInventoryItem(state, heaviest.id);
  }

  queueMessage(state, 'Your body quits. The world narrows to breath and cold.', 6);
}

function cullFarEntities(state, player) {
  const margin = CHUNK_SIZE * (VIEW_DISTANCE + 1);
  state.world.items = state.world.items.filter((item) =>
    Math.abs(item.x - player.x) < margin && Math.abs(item.y - player.y) < margin
  );
  state.world.npcs = state.world.npcs.filter((npc) =>
    Math.abs(npc.x - player.x) < margin && Math.abs(npc.y - player.y) < margin
  );
}

function draw(ctx, state, sprites, canvas, currentSpeed, time) {
  const player = state.player;
  const palette = getPaletteAt(state, player.x, player.y);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  const cameraX = player.x - canvas.width / 2;
  const cameraY = player.y - canvas.height / 2;

  drawGroundTexture(ctx, palette, cameraX, cameraY, canvas);
  drawItems(ctx, state.world.items, palette, cameraX, cameraY, time, sprites);
  drawNpcs(ctx, state.world.npcs, palette, cameraX, cameraY, time, sprites);
  drawPlayer(ctx, player, palette, cameraX, cameraY, currentSpeed, time, sprites);

  ctx.restore();
  drawAtmosphere(ctx, canvas, state.player);
  drawDialogue(ctx, canvas, state.world.activeDialogue, palette);
  renderBackpackList(state);
}

function drawTintedSprite(ctx, sprite, x, y, width, height, tint) {
  ctx.save();
  ctx.drawImage(sprite, x, y, width, height);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

function drawGroundTexture(ctx, palette, cameraX, cameraY, canvas) {
  ctx.fillStyle = palette.accent;
  for (let x = -8; x < canvas.width + 8; x += 16) {
    const worldX = x + cameraX;
    const noise = Math.sin(worldX * 0.03) * 2;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(x, (canvas.height - 14) + noise, 14, 14);
  }

  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = palette.haze;
  for (let y = 0; y < canvas.height + 32; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y + ((Math.sin((y + cameraX) * 0.02) + Math.cos((y + cameraY) * 0.01)) * 4));
    ctx.lineTo(canvas.width, y + ((Math.cos((y + cameraX) * 0.03) + Math.sin((y + cameraY) * 0.02)) * 4));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawItems(ctx, items, palette, cameraX, cameraY, time, sprites) {
  for (const item of items) {
    const info = ITEM_TYPES[item.type] || { color: palette.light };
    const screenX = item.x - cameraX;
    const screenY = item.y - cameraY;

    const bob = Math.sin(time * 3 + (item.x + item.y) * 0.05) * 1.5;
    const sprite = sprites[item.type];
    if (sprite) {
      const size = 20;
      drawTintedSprite(ctx, sprite, screenX - size / 2, screenY - size / 2 + bob, size, size, palette.light);
    } else {
      ctx.fillStyle = info.color;
      ctx.fillRect(screenX - 3, screenY - 3 + bob, 6, 6);
    }
  }
}

function drawNpcs(ctx, npcs, palette, cameraX, cameraY, time, sprites) {
  ctx.fillStyle = palette.mood;
  for (const npc of npcs) {
    const screenX = npc.x - cameraX;
    const screenY = npc.y - cameraY;
    const pulse = 1 + Math.sin(time * 2.5 + npc.x * 0.01) * 0.4;
    const sprite = sprites.npc;
    if (sprite) {
      const size = 22 + pulse * 2;
      drawTintedSprite(ctx, sprite, screenX - size / 2, screenY - size / 2, size, size, palette.mood);
    } else {
      ctx.beginPath();
      ctx.moveTo(screenX, screenY - 6 * pulse);
      ctx.lineTo(screenX - 4 * pulse, screenY + 4 * pulse);
      ctx.lineTo(screenX + 4 * pulse, screenY + 4 * pulse);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawPlayer(ctx, player, palette, cameraX, cameraY, currentSpeed, time, sprites) {
  const screenX = player.x - cameraX;
  const screenY = player.y - cameraY;

  const burden = Math.min(1, (player.carryWeight ?? 0) / 12);
  const wobble = Math.sin(time * (4 + burden * 6)) * 2 * burden;

  ctx.save();
  ctx.translate(screenX, screenY + wobble);

  const sprite = sprites.player;
  if (sprite) {
    const size = 28 + burden * 6;
    drawTintedSprite(ctx, sprite, -size / 2, -size / 2 - burden * 3, size, size, palette.haze);
  } else {
    const packHeight = 6 + burden * 10;
    const packWidth = 8 + burden * 4;
    ctx.fillStyle = palette.haze;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-packWidth / 2, -packHeight - 2, packWidth, packHeight);
    ctx.globalAlpha = 1;

    ctx.fillStyle = palette.light;
    ctx.fillRect(-4, -4, 8, 8);
  }

  const stumble = Math.max(0, 1 - currentSpeed / (player.baseSpeed || 48));
  if (stumble > 0.25) {
    ctx.strokeStyle = palette.mood;
    ctx.globalAlpha = 0.6 * stumble;
    ctx.beginPath();
    ctx.arc(0, 10, 8 + wobble, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAtmosphere(ctx, canvas, player) {
  const strain = Math.max(player.hunger, player.thirst, player.warmth) / 100;
  if (strain <= 0) return;

  const gradient = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    Math.max(20, 80 - strain * 40),
    canvas.width / 2,
    canvas.height / 2,
    Math.max(canvas.width, canvas.height) / 1.1
  );
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(38,12,12,${0.2 + strain * 0.45})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawDialogue(ctx, canvas, dialogue, palette) {
  if (!dialogue) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(14, canvas.height - 56, canvas.width - 28, 42);

  ctx.font = '11px "DM Sans", "Segoe UI", sans-serif';
  ctx.fillStyle = palette.light;
  ctx.textBaseline = 'middle';

  const text = dialogue.lines?.[dialogue.index ?? 0] || '';
  ctx.fillText(text, 22, canvas.height - 36);
  ctx.fillStyle = palette.haze;
  ctx.fillText(dialogue.npcId ? 'Tap E or Enter to listen on' : 'Tap E or Enter to continue', canvas.width - 170, canvas.height - 20);
  ctx.restore();
}

function getPaletteAt(state, x, y) {
  const chunk = ensureChunk(state, Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE));
  return chunk.palette;
}

function getBiomeAt(state, x, y) {
  const chunk = ensureChunk(state, Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE));
  return chunk.biome;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

document.addEventListener('DOMContentLoaded', setup);
