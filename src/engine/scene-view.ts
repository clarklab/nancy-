/**
 * Scene renderer.
 *
 * Draws the painted background, its conditional layers, weather and hotspots,
 * and translates pointer input into hotspot interactions. The whole scene is
 * laid out inside a fixed 16:10 "stage" so normalised hotspot coordinates map
 * exactly onto the artwork at every window size.
 */

import type { GameState } from './state';
import type { Hotspot, Scene, SceneLayer } from './types';
import { Weather } from './weather';

const STAGE_W = 1920;
const STAGE_H = 1200;

export interface SceneViewCallbacks {
  onHotspot(hotspot: Hotspot): void;
  onItemDropped(hotspot: Hotspot, itemId: string): void;
  /** Bubbles hover state up so the cursor and nameplate can react. */
  onHover(hotspot: Hotspot | null): void;
}

export class SceneView {
  readonly el: HTMLElement;
  private bg: HTMLElement;
  private layerHost: HTMLElement;
  private hotspotHost: HTMLElement;
  private weather: Weather;
  private state: GameState;
  private cb: SceneViewCallbacks;
  private scene: Scene | null = null;
  private hovered: Hotspot | null = null;
  /** Set while the player holds an inventory item, to bias hover feedback. */
  private carrying: string | null = null;

  constructor(state: GameState, cb: SceneViewCallbacks) {
    this.state = state;
    this.cb = cb;

    this.el = document.createElement('div');
    this.el.className = 'scene-view';
    this.el.innerHTML = `
      <div class="scene-stage">
        <div class="scene-bg"></div>
        <div class="scene-layers"></div>
        <canvas class="scene-weather"></canvas>
        <div class="scene-hotspots"></div>
        <div class="scene-vignette"></div>
      </div>`;

    this.bg = this.el.querySelector('.scene-bg')!;
    this.layerHost = this.el.querySelector('.scene-layers')!;
    this.hotspotHost = this.el.querySelector('.scene-hotspots')!;
    this.weather = new Weather(this.el.querySelector('.scene-weather')!);

    this.hotspotHost.addEventListener('pointerleave', () => this.setHover(null));
  }

  /** Called when state changes so conditional hotspots/layers re-evaluate. */
  refresh() {
    if (this.scene) this.renderLayers(this.scene), this.renderHotspots(this.scene);
  }

  setCarrying(itemId: string | null) {
    this.carrying = itemId;
    this.el.classList.toggle('is-carrying', !!itemId);
    this.refresh();
  }

  async show(scene: Scene, transition: string = 'fade') {
    const incoming = scene.background;
    // Decode before swapping so a transition never flashes an unpainted frame.
    await preload(incoming);

    this.scene = scene;
    this.el.dataset.transition = transition;
    this.el.classList.add('is-transitioning');

    // Force a reflow so the transition class actually animates.
    void this.el.offsetHeight;

    this.bg.style.backgroundImage = `url("${incoming}")`;
    this.el.style.setProperty('--scene-grade', scene.grade ?? 'none');
    this.renderLayers(scene);
    this.renderHotspots(scene);
    this.weather.set(scene.weather ?? 'none');

    await new Promise((r) => setTimeout(r, transition === 'none' ? 0 : 460));
    this.el.classList.remove('is-transitioning');
  }

  private renderLayers(scene: Scene) {
    const wanted = (scene.layers ?? []).filter((l) => this.state.check(l.visibleIf));
    const seen = new Set<string>();

    for (const layer of wanted) {
      seen.add(layer.id);
      let node = this.layerHost.querySelector<HTMLElement>(`[data-layer="${layer.id}"]`);
      if (!node) {
        node = document.createElement('div');
        node.className = 'scene-layer';
        node.dataset.layer = layer.id;
        node.style.backgroundImage = `url("${layer.src}")`;
        this.layerHost.appendChild(node);
        // Fade in rather than pop, so state changes feel lit rather than toggled.
        requestAnimationFrame(() => node!.classList.add('is-in'));
      }
      applyLayerStyle(node, layer);
    }

    for (const node of [...this.layerHost.children] as HTMLElement[]) {
      if (!seen.has(node.dataset.layer!)) {
        node.classList.remove('is-in');
        setTimeout(() => node.remove(), 400);
      }
    }
  }

  private renderHotspots(scene: Scene) {
    this.hotspotHost.textContent = '';
    this.hovered = null;

    for (const hs of scene.hotspots) {
      if (!this.state.check(hs.visibleIf)) continue;
      const enabled = this.state.check(hs.enabledIf);

      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'hotspot';
      node.dataset.cursor = hs.cursor;
      node.dataset.id = hs.id;
      node.setAttribute('aria-label', hs.label);
      node.classList.toggle('is-disabled', !enabled);

      // Travel hotspots read as navigation and get an arrow affordance.
      if (hs.cursor.startsWith('walk')) node.classList.add('is-travel');
      if (hs.huntable) node.classList.add('is-huntable');

      // A hotspot that would consume the carried item glows to invite the drop.
      if (this.carrying && hs.accepts?.some((a) => a.item === this.carrying)) {
        node.classList.add('is-target');
      }

      applyShape(node, hs);

      node.addEventListener('pointerenter', () => this.setHover(hs));
      node.addEventListener('focus', () => this.setHover(hs));
      node.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.cb.onHotspot(hs);
      });

      // Drag-and-drop of inventory items onto the world.
      node.addEventListener('dragover', (ev) => {
        if (!hs.accepts?.length && !hs.onWrongItem) return;
        ev.preventDefault();
        node.classList.add('is-dragover');
      });
      node.addEventListener('dragleave', () => node.classList.remove('is-dragover'));
      node.addEventListener('drop', (ev) => {
        ev.preventDefault();
        node.classList.remove('is-dragover');
        const item = ev.dataTransfer?.getData('text/item');
        if (item) this.cb.onItemDropped(hs, item);
      });

      this.hotspotHost.appendChild(node);
    }
  }

  private setHover(hs: Hotspot | null) {
    if (this.hovered === hs) return;
    this.hovered = hs;
    this.cb.onHover(hs);
  }

  /** Briefly outlines every huntable hotspot — the accessibility "look" key. */
  revealHotspots() {
    this.hotspotHost.classList.add('is-revealing');
    setTimeout(() => this.hotspotHost.classList.remove('is-revealing'), 1600);
  }

  destroy() {
    this.weather.destroy();
  }
}

function applyLayerStyle(node: HTMLElement, layer: SceneLayer) {
  node.style.mixBlendMode = layer.blend ?? 'normal';
  node.style.setProperty('--layer-opacity', String(layer.opacity ?? 1));
  node.dataset.animate = layer.animate ?? 'none';
}

/** Positions a hotspot node from its normalised shape. */
function applyShape(node: HTMLElement, hs: Hotspot) {
  if (hs.shape.type === 'rect') {
    const { x, y, w, h } = hs.shape.rect;
    node.style.left = `${x * 100}%`;
    node.style.top = `${y * 100}%`;
    node.style.width = `${w * 100}%`;
    node.style.height = `${h * 100}%`;
  } else {
    // Polygons get a bounding box for hit area plus a clip-path for the shape,
    // so irregular targets (a mirror, a stair rail) feel precise.
    const xs = hs.shape.points.map((p) => p[0]);
    const ys = hs.shape.points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    node.style.left = `${minX * 100}%`;
    node.style.top = `${minY * 100}%`;
    node.style.width = `${(maxX - minX) * 100}%`;
    node.style.height = `${(maxY - minY) * 100}%`;
    const local = hs.shape.points.map(
      ([px, py]) =>
        `${((px - minX) / (maxX - minX || 1)) * 100}% ${((py - minY) / (maxY - minY || 1)) * 100}%`,
    );
    node.style.clipPath = `polygon(${local.join(',')})`;
  }
}

const preloaded = new Map<string, Promise<void>>();

/** Decodes an image once and caches the promise, so revisits are instant. */
export function preload(src: string): Promise<void> {
  let p = preloaded.get(src);
  if (!p) {
    p = new Promise<void>((resolve) => {
      const img = new Image();
      // Never block the game on a missing asset — resolve either way.
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
    preloaded.set(src, p);
  }
  return p;
}

export const STAGE = { W: STAGE_W, H: STAGE_H };
