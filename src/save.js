export const SAVE_KEY = 'scarcely.save.v1';

export function createInitialState() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    player: {
      name: 'wanderer',
      x: 0,
      y: 0,
      hunger: 0,
      thirst: 0,
      warmth: 0,
      inventory: [],
      maxInventory: 20,
      carryWeight: 0,
      baseSpeed: 52,
      minSpeed: 12,
    },
    world: {
      seed: Math.random().toString(36).slice(2),
      discoveredChunks: {},
      items: [],
      npcs: [],
      activeDialogue: null,
    },
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return createInitialState();
    }

    const data = JSON.parse(raw);

    if (data.version !== 1) {
      console.warn('Unsupported save version; starting new game.', data.version);
      return createInitialState();
    }

    data.player = data.player || {};
    data.player.carryWeight = data.player.carryWeight ?? 0;
    data.player.baseSpeed = data.player.baseSpeed ?? 52;
    data.player.minSpeed = data.player.minSpeed ?? 12;
    data.player.hunger = data.player.hunger ?? 0;
    data.player.thirst = data.player.thirst ?? 0;
    data.player.warmth = data.player.warmth ?? 0;
    data.player.x = data.player.x ?? 0;
    data.player.y = data.player.y ?? 0;

    data.world = data.world || {};
    data.world.items = data.world.items || [];
    data.world.npcs = data.world.npcs || [];
    data.world.discoveredChunks = data.world.discoveredChunks || {};
    data.world.activeDialogue = data.world.activeDialogue || null;
    data.world.seed = data.world.seed || Math.random().toString(36).slice(2);

    return data;
  } catch (err) {
    console.error('Failed to load save; starting new game.', err);
    return createInitialState();
  }
}

export function saveState(state) {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(SAVE_KEY, json);
  } catch (err) {
    console.error('Failed to save game state:', err);
  }
}

export function exportSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    alert('No save data to export yet. Move around to create a save.');
    return;
  }

  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'scarcely-save.json';
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

export function importSaveFromFile(fileInput) {
  if (!fileInput.files || !fileInput.files.length) {
    alert('Choose a save file first.');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const data = JSON.parse(text);

      if (data.version !== 1) {
        alert('Unsupported save file version.');
        return;
      }

      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      alert('Save imported. Reloading the game...');
      window.location.reload();
    } catch (err) {
      console.error('Import failed:', err);
      alert('Invalid save file.');
    }
  };

  reader.readAsText(file);
}
