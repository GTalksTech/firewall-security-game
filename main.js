// Entry point: load the level content, validate it, then start the game.
// The game needs only its own static files; nothing else is fetched (SC-009).

import { validateContent } from './engine/content.js';
import { createSession } from './engine/state.js';
import { mount } from './ui/controls.js';

const app = document.getElementById('app');
const statusBar = document.getElementById('status-bar');
const live = document.getElementById('live');

async function loadContent() {
  try {
    const response = await fetch('data/levels.json');
    if (!response.ok) throw new Error(`the server answered ${response.status}`);
    return { content: await response.json(), error: null };
  } catch (err) {
    return { content: null, error: `data/levels.json could not be loaded (${err.message}).` };
  }
}

async function start() {
  app.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'Loading levels…' }));
  statusBar.replaceChildren();

  const { content, error } = await loadContent();
  const validation = validateContent(content);
  if (error) validation.fileErrors.unshift(error);

  // Fresh listeners on each load: replace the roots' listeners by cloning.
  const session = createSession(content, validation);
  mount({ session, content, app, statusBar, live, onRetryLoad: () => window.location.reload() });
}

start();
