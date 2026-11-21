import './ui/styles.css';
import { Game } from './core/Game';
import { showStartupFailure } from './ui/StartupFailure';

let game: Game | undefined;
try { game = new Game(); void game.init(); }
catch (error) { console.error(error); showStartupFailure(error); }
if (import.meta.hot) import.meta.hot.dispose(() => game?.close());
