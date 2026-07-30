/**
 * The scene graph: thirty-four locations, nine days, one headland.
 *
 * Scenes are grouped by geography rather than by act, because the building is
 * the through-line and the acts move through it: the mainland and the boat,
 * the headland out of doors, the two floors of Pilotage House, the vaults
 * under it, and the beacon nine miles offshore.
 *
 * Navigation is authored as paired exits — every `goto` in one room has its
 * answering `goto` in the next — and act structure is expressed as conditions
 * on hotspots and layers rather than as separate rooms, so returning to a
 * place is never a visual or textual repeat.
 */

import type { Scene, SceneId } from '@/engine/types';

import { seaAndMainlandScenes } from './sea-and-mainland';
import { headlandScenes } from './headland';
import { pilotageGroundScenes } from './pilotage-ground';
import { pilotageUpperScenes } from './pilotage-upper';
import { vaultScenes } from './vaults';
import { beaconScenes } from './beacon';

export const scenes: Record<SceneId, Scene> = {
  ...seaAndMainlandScenes,
  ...headlandScenes,
  ...pilotageGroundScenes,
  ...pilotageUpperScenes,
  ...vaultScenes,
  ...beaconScenes,
};
