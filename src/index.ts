import 'normalize.css';
import { World } from './world';
import { View } from './view';
import { AssetLoader } from './asset-loader';
import { Client } from './client';
import { ClientUi } from './client-ui';

const client = new Client();
const assetLoader = new AssetLoader();
const world = new World(client);
const clientUi = new ClientUi(client);

// Debugging:
Object.assign(window, {
  assetLoader,
  world,
  client,
  clientUi,
});

assetLoader.loadAll().then(() => {
  const view = new View(world, assetLoader, client);
  Object.assign(window, { view });

  const perspectiveCheckbox = document.getElementById('perspective') as HTMLInputElement;
  perspectiveCheckbox.addEventListener('change', updateSettings);

  updateSettings();
  view.draw();

  function updateSettings(): void {
    const perspective = perspectiveCheckbox.checked;
    if (view) {
      view.setPerspective(perspective);
    }
  }
});
