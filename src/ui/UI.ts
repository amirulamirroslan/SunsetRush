import { el } from './dom';
import { Hud } from './hud';
import { Menu, type MenuActions } from './menu';
import { Garage, type GarageActions } from './garage';
import { Results, type ResultsActions } from './results';
import { Modal, confirmDialog, helpDialog, pauseDialog, settingsDialog } from './overlays';
import type { SaveStore } from '../save/save';
import type { Track } from '../sim/Track';
import type { TouchState } from '../input/Controls';

export type Screen = 'menu' | 'garage' | 'hud' | 'results' | 'none';

export interface UIActions extends MenuActions, GarageActions, ResultsActions {
  pause(): void; resume(): void; restart(): void; quit(): void; respawn(): void;
  settingsChanged(): void; resetProgress(): void;
}

/** Owns every DOM screen and the modal layer. All game logic stays in Game; this only renders and reports intent. */
export class UI {
  readonly fx = el('canvas', { id: 'fx', 'aria-hidden': 'true' });
  readonly menu: Menu; readonly garage: Garage; readonly hud: Hud; readonly results: Results;
  readonly modal = new Modal();
  private current: Screen = 'none';
  private touch = false;

  constructor(host: HTMLElement, private readonly save: SaveStore, track: Track, touchState: TouchState, private readonly a: UIActions) {
    this.menu = new Menu(save, track, a);
    this.garage = new Garage(save, a);
    this.hud = new Hud(touchState, () => a.pause(), () => a.respawn());
    this.hud.setTrack(track);
    this.results = new Results(a);
    host.append(this.fx, this.menu.root, this.garage.root, this.hud.root, this.results.root, this.modal.root);
    save.onChange(() => { if (this.current === 'menu') this.menu.refresh(); });
  }

  setTouch(on: boolean): void { this.touch = on; document.body.classList.toggle('touch-ui', on); this.hud.setTouchUi(on); }
  get isTouch(): boolean { return this.touch; }

  show(screen: Screen): void {
    this.current = screen;
    this.menu.root.classList.toggle('on', screen === 'menu');
    this.garage.root.classList.toggle('on', screen === 'garage');
    this.results.root.classList.toggle('on', screen === 'results');
    this.hud.root.classList.toggle('on', screen === 'hud');
    this.hud.touchRoot.classList.toggle('on', screen === 'hud' && this.touch);
    if (screen === 'menu') { this.menu.closeSetup(); this.menu.refresh(); }
    if (screen === 'garage') this.garage.open();
  }

  openSettings(onClose?: () => void): void {
    this.modal.show(settingsDialog(this.save, {
      touch: this.touch,
      onChange: () => this.a.settingsChanged(),
      onReset: () => { void confirmDialog(this.modal, { title: 'Reset progress?', text: 'This erases your coins, unlocked cars and parts, best times and settings. It cannot be undone.', confirm: 'Reset everything', danger: true }).then(ok => { if (ok) this.a.resetProgress(); this.openSettings(onClose); }); },
    }, () => this.modal.hide()), onClose);
  }
  openHelp(): void { this.modal.show(helpDialog(() => this.modal.hide(), this.touch)); }
  openPause(onClose: () => void): void {
    this.modal.show(pauseDialog({
      resume: () => this.modal.hide(), restart: () => { this.modal.hide(); this.a.restart(); },
      settings: () => this.openSettings(() => this.openPause(onClose)), quit: () => { this.modal.hide(); this.a.quit(); },
    }), onClose);
  }
}
