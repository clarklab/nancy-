/** Scene graph. Placeholder — replaced by the content pass. */
import type { Scene, SceneId } from '@/engine/types';

export const scenes: Record<SceneId, Scene> = {
  'placeholder-room': {
    id: 'placeholder-room',
    name: 'Placeholder',
    background: './art/scenes/placeholder.webp',
    weather: 'rain',
    ambience: 'rain-window',
    hotspots: [
      {
        id: 'exit',
        label: 'Away',
        cursor: 'walk-back',
        shape: { type: 'rect', rect: { x: 0.04, y: 0.72, w: 0.14, h: 0.2 } },
        onInteract: [{ kind: 'goto', scene: 'placeholder-room' }],
      },
    ],
  },
};
