export const SAVE_KEY = 'scarcely.save.v1';

export function createInitialState() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    player: {
      name: 'wanderer',
      x: 160,
      y: 90,
      hunger: 0,
      thirst: 0,
      warmth: 0,
      inventory: [],
      maxInventory: 20,
      carryWeight: 0,
      baseSpeed: 48,
      minSpeed: 10,
    },
    world: {
      seed: Math.random().toString(36).slice(2),
      discoveredChunks: {},
      items: [
        { id: 'stick-1', x: 60, y: 60, weight: 1 },
        { id: 'stone-1', x: 200, y: 80, weight: 2 },
        { id: 'bundle-1', x: 140, y: 120, weight: 3 },
      ],
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
    data.player.baseSpeed = data.player.baseSpeed ?? 48;
    data.player.minSpeed = data.player.minSpeed ?? 10;

    data.world = data.world || {};
    data.world.items = data.world.items || [];

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
