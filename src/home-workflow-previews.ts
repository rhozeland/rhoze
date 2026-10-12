import create from './assets/workflow-create.asset.json';
import discover from './assets/workflow-discover.asset.json';
import rewards from './assets/workflow-rewards.asset.json';

const previews: Record<string, {url: string}> = {create, discover, rewards};
document.querySelectorAll<HTMLImageElement>('img[data-workflow]').forEach(img => {
  const asset = previews[img.dataset.workflow ?? ''];
  if (asset) img.src = asset.url;
});