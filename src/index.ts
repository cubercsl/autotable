import './i18n';
import { AssetLoader } from './asset-loader';
import { Game } from './game';
const assetLoader = new AssetLoader();


assetLoader.loadAll().then(() => {
  const game = new Game(assetLoader);
  document.getElementById('toggle-sidebar')?.click();
  document.getElementById('main')?.removeChild(document.getElementById('loading')!);
  // for debugging
  Object.assign(window, {game});
  game.start();
});
