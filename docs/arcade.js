(() => {
  'use strict';

  const root = document.documentElement;
  const tray = document.querySelector('.console');
  const board = document.querySelector('[data-board]');
  const cells = [...board.children];
  const effects = document.querySelector('.effects');
  const sign = document.querySelector('[data-challenge]');
  const result = document.querySelector('.result');
  const resultTitle = document.querySelector('[data-result-title]');
  const rules = document.querySelector('#full-rules');
  const poison = board.querySelector('[data-poison]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const poisonLabel = poison.getAttribute('aria-label');
  const remainingLabel = document.querySelector('[data-remaining-label]');
  let stopFireworks;

  const flames = document.createElement('span');
  flames.className = 'flames';
  flames.setAttribute('aria-hidden', 'true');
  flames.innerHTML = '<i></i><i></i><i></i>';
  poison.prepend(flames);

  const warning = document.createElement('span');
  warning.className = 'poison-mark';
  warning.setAttribute('aria-hidden', 'true');
  warning.textContent = '×';
  poison.append(warning);

  const burnLayer = document.createElement('div');
  burnLayer.className = 'burn-layer';
  burnLayer.setAttribute('aria-hidden', 'true');
  for (const [index, cell] of cells.entries()) {
    const distance = Number(cell.dataset.r) + Number(cell.dataset.c);
    const delay = `${distance * 53 + (index * 31) % 43}ms`;
    const tile = document.createElement('span');
    tile.className = 'burn-tile';
    tile.style.setProperty('--burn-delay', delay);
    tile.style.setProperty('--coal-x', `${26 + (index * 17) % 49}%`);
    tile.style.setProperty('--fire-lean', `${(index * 7) % 17 - 8}deg`);
    cell.style.setProperty('--burn-delay', delay);

    const fire = document.createElement('span');
    fire.className = 'burn-fire';
    tile.append(fire);
    burnLayer.append(tile);
  }
  board.append(burnLayer);

  document.querySelector('[data-rules-open]').addEventListener('click', () => rules.showModal());

  function cellAt(row, col) {
    return cells[row * window.MunchCore.COLS + col];
  }

  function setHeat(remaining) {
    const heat = remaining > 18 ? 0 : remaining > 10 ? 1 : remaining > 4 ? 2 : 3;
    root.dataset.heat = heat;
    remainingLabel.textContent = remaining === 1 ? 'apple left' : 'apples left';
    poison.setAttribute('aria-label', heat > 1 ? `${poisonLabel}, burning` : poisonLabel);
  }

  function preserveLift(event) {
    if (reducedMotion.matches || !event.target.closest('[data-target]')) return;
    const lifted = [...board.querySelectorAll('[data-preview]')].map(cell => ({
      cell,
      transform: getComputedStyle(cell.querySelector('.cell-art')).transform,
      floor: getComputedStyle(cell, '::before').backgroundColor
    }));
    for (const { cell, transform, floor } of lifted) {
      cell.style.setProperty('--pick-start', transform);
      cell.style.setProperty('--pick-floor', floor);
    }
  }

  board.addEventListener('click', preserveLift, { capture: true });

  function socketPosition(cell) {
    const frame = tray.getBoundingClientRect();
    const target = cell.getBoundingClientRect();
    return {
      x: target.left - frame.left + target.width / 2,
      y: target.top - frame.top + target.height / 2,
      width: target.width
    };
  }

  function throwSeeds({ x, y, width }, actor, count = 6) {
    if (reducedMotion.matches) return;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2;
      const radius = width * (.47 + (index % 3) * .16);
      const seed = document.createElement('i');
      seed.className = 'seed';
      seed.dataset.actor = actor;
      seed.style.setProperty('--x', `${x}px`);
      seed.style.setProperty('--y', `${y}px`);
      seed.style.setProperty('--dx', `${Math.cos(angle) * radius}px`);
      seed.style.setProperty('--dy', `${Math.sin(angle) * radius}px`);
      seed.style.setProperty('--angle', `${angle}rad`);
      seed.addEventListener('animationend', () => seed.remove(), { once: true });
      effects.append(seed);
    }
  }

  document.addEventListener('munch:move', ({ detail }) => {
    for (const { row, col } of detail.cells) {
      cellAt(row, col).dataset.eatenBy = detail.actor;
    }
    setHeat(detail.remaining);
    throwSeeds(socketPosition(cellAt(detail.row, detail.col)), detail.poison ? 'poison' : detail.actor);
  });

  document.addEventListener('munch:turn', ({ detail: { turn } }) => {
    if (turn === 'human') sign.textContent = 'Can you beat the computer?';
    if (turn === 'computer') sign.textContent = 'The computer is thinking.';
    if (turn === 'poison') sign.textContent = 'Poison bite!';
    if (turn !== 'won' && turn !== 'lost') return;

    resultTitle.textContent = turn === 'won' ? 'You win!' : 'Computer wins';
    sign.textContent = turn === 'won' ? 'Orchard champion!' : 'The computer wins';

    const socket = socketPosition(poison);
    result.style.setProperty('--receipt-x', `${socket.x - result.offsetLeft - result.offsetWidth * .2}px`);
    result.style.setProperty('--receipt-y', `${socket.y - result.offsetTop - result.offsetHeight * .24}px`);
    if (turn === 'won') stopFireworks = window.MunchFireworks(tray, reducedMotion);
    else throwSeeds(socket, 'poison', 10);
  });

  document.addEventListener('munch:reset', () => {
    for (const cell of board.querySelectorAll('[data-eaten-by]')) {
      cell.removeAttribute('data-eaten-by');
      cell.style.removeProperty('--pick-start');
      cell.style.removeProperty('--pick-floor');
    }
    stopFireworks?.();
    stopFireworks = undefined;
    effects.replaceChildren();
    setHeat(window.MunchCore.ROWS * window.MunchCore.COLS);
  });

  setHeat(cells.length);
})();
