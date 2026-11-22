(() => {
  'use strict';

  const core = window.MunchCore;
  const root = document.documentElement;
  const board = document.querySelector('[data-board]');
  if (!board) return;

  const sound = window.MunchAudio(root.dataset.soundTheme);
  const status = document.querySelector('[data-status]');
  const descriptions = [...document.querySelectorAll('[data-detail]')];
  const counters = [...document.querySelectorAll('[data-remaining]')];
  const previewCount = document.querySelector('[data-preview-count]');
  const directions = {
    ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1]
  };
  const messages = {
    human: 'Your turn',
    computer: 'Computer’s turn',
    poison: 'Poison apple!',
    won: 'You win!',
    lost: 'You lose!'
  };

  let rows = core.newBoard();
  let turn = 'human';
  let move = 0;
  let lastBite = null;
  let timer;
  let current = [0, 1];
  let restoreFocus = false;

  const cells = Array.from({ length: core.ROWS }, (_, row) => {
    return Array.from({ length: core.COLS }, (_, col) => makeCell(row, col));
  });
  board.replaceChildren(...cells.flat());

  function makeCell(row, col) {
    const button = document.createElement('button');
    button.className = 'cell';
    button.type = 'button';
    button.dataset.r = row;
    button.dataset.c = col;
    const poison = row === 0 && col === 0;
    button.toggleAttribute('data-poison', poison);
    button.setAttribute('aria-label', `${poison ? 'Poison apple' : 'Apple'}, row ${row + 1}, column ${col + 1}`);

    const art = document.createElement('span');
    art.className = 'cell-art';
    art.setAttribute('aria-hidden', 'true');
    button.appendChild(art);
    return button;
  }

  function announce(name, detail) {
    document.dispatchEvent(new CustomEvent(`munch:${name}`, { detail }));
  }

  function clearPreview() {
    for (const cell of board.querySelectorAll('[data-preview], [data-target], [data-edge]')) {
      cell.removeAttribute('data-preview');
      cell.removeAttribute('data-target');
      cell.removeAttribute('data-edge');
    }
    if (previewCount) previewCount.textContent = '';
  }

  function showPreview(active) {
    clearPreview();
    if (!active || turn !== 'human' || active.hasAttribute('data-empty')) return;
    const row = Number(active.dataset.r);
    const col = Number(active.dataset.c);
    const marked = core.biteCells(rows, row, col);
    const inBite = (r, c) => r >= row && c >= col && core.isOccupied(rows, r, c);

    for (const { row: r, col: c } of marked) {
      const cell = cells[r][c];
      const edges = [];
      if (!inBite(r - 1, c)) edges.push('top');
      if (!inBite(r, c + 1)) edges.push('right');
      if (!inBite(r + 1, c)) edges.push('bottom');
      if (!inBite(r, c - 1)) edges.push('left');
      cell.toggleAttribute('data-preview', true);
      cell.dataset.edge = edges.join(' ');
    }

    active.toggleAttribute('data-target', true);
    if (previewCount) {
      previewCount.textContent = row === 0 && col === 0
        ? 'Poison apple'
        : `${marked.length} ${marked.length === 1 ? 'apple' : 'apples'} in this bite`;
    }
  }

  function chooseFocus() {
    if (core.isOccupied(rows, ...current)) return;
    const first = core.biteCells(rows, 0, 0).find(({ row, col }) => row || col);
    current = first ? [first.row, first.col] : [0, 0];
  }

  function renderBoard() {
    chooseFocus();
    for (let r = 0; r < core.ROWS; r += 1) {
      for (let c = 0; c < core.COLS; c += 1) {
        const cell = cells[r][c];
        const occupied = core.isOccupied(rows, r, c);
        cell.toggleAttribute('data-empty', !occupied);
        cell.setAttribute('aria-disabled', String(!occupied || turn !== 'human'));
        cell.setAttribute('aria-hidden', String(!occupied));
        cell.tabIndex = occupied && current[0] === r && current[1] === c && turn === 'human' ? 0 : -1;
      }
    }
    board.setAttribute('aria-busy', String(turn === 'computer' || turn === 'poison'));
  }

  function renderStatus() {
    const count = core.remaining(rows);
    root.dataset.turn = turn;
    root.dataset.moves = String(move);
    if (status) status.textContent = status.dataset[turn] || messages[turn];
    for (const counter of counters) counter.textContent = String(count);
    for (const detail of descriptions) {
      if (turn === 'won') detail.textContent = detail.dataset.won || 'The computer ate the poison apple.';
      else if (turn === 'lost') detail.textContent = detail.dataset.lost || 'You ate the poison apple.';
      else if (lastBite) {
        const subject = lastBite.actor === 'human' ? 'You' : 'Computer';
        const eaten = lastBite.cells.length;
        detail.textContent = `${subject} ate ${eaten} ${eaten === 1 ? 'apple' : 'apples'}.`;
      } else detail.textContent = detail.dataset.start || 'Pick an apple to take a bite.';
    }
  }

  function switchTurn(nextTurn) {
    turn = nextTurn;
    renderBoard();
    renderStatus();
    announce('turn', { turn, remaining: core.remaining(rows), move });
  }

  function takeBite(actor, row, col) {
    clearPreview();
    for (const cell of board.querySelectorAll('[data-last]')) {
      cell.removeAttribute('data-last');
      cell.removeAttribute('data-impact');
      cell.style.removeProperty('--bite-delay');
    }

    const affected = core.biteCells(rows, row, col);
    const poison = row === 0 && col === 0;
    for (const { row: r, col: c } of affected) {
      const cell = cells[r][c];
      cell.dataset.last = actor;
      cell.style.setProperty('--bite-delay', `${(r - row + c - col) * 22}ms`);
      cell.toggleAttribute('data-impact', row === r && col === c);
    }

    rows = core.afterBite(rows, row, col);
    move += 1;
    lastBite = { actor, row, col, cells: affected, remaining: core.remaining(rows), move, poison };
    renderBoard();
    renderStatus();
    sound.play(poison ? 'poison' : actor, affected.length);
    announce('move', lastBite);
  }

  function finish(nextTurn) {
    switchTurn(nextTurn);
    sound.play(nextTurn);
    if (restoreFocus && (document.activeElement === document.body || board.contains(document.activeElement))) {
      const restart = [...document.querySelectorAll('[data-reset]')].find(button => button.getClientRects().length);
      restart?.focus({ preventScroll: true });
    }
    restoreFocus = false;
  }

  function computerTurn() {
    if (!core.remaining(rows)) {
      finish('lost');
      return;
    }

    const [row, col] = core.computerMove(rows, Math.random());
    takeBite('computer', row, col);
    const bite = lastBite;
    if (board.hasAttribute('data-sync-bite') && board.getAnimations) {
      const animations = board.getAnimations({ subtree: true }).filter(animation =>
        animation.animationName === 'picked' || animation.animationName === 'harvest-mark');
      Promise.allSettled(animations.map(animation => animation.finished))
        .then(() => {
          if (lastBite === bite && turn === 'computer') finishComputerBite();
        });
    } else {
      timer = setTimeout(finishComputerBite, 1000);
    }
  }

  function finishComputerBite() {
    if (!core.remaining(rows)) {
      finish('won');
      return;
    }
    switchTurn('human');
    if (restoreFocus && (document.activeElement === document.body || board.contains(document.activeElement))) {
      cells[current[0]][current[1]].focus({ preventScroll: true });
    } else if (board.hasAttribute('data-sync-bite') && matchMedia('(hover: hover)').matches) {
      showPreview(board.querySelector('.cell:hover'));
    }
    restoreFocus = false;
  }

  function reset() {
    clearTimeout(timer);
    clearPreview();
    for (const cell of board.querySelectorAll('[data-last]')) {
      cell.removeAttribute('data-last');
      cell.removeAttribute('data-impact');
      cell.style.removeProperty('--bite-delay');
    }
    rows = core.newBoard();
    current = [0, 1];
    move = 0;
    lastBite = null;
    restoreFocus = false;
    switchTurn('human');
    announce('reset');
  }

  board.addEventListener('pointerover', event => {
    if (event.pointerType !== 'touch') showPreview(event.target.closest('.cell'));
  });
  board.addEventListener('pointerleave', () => {
    showPreview(board.querySelector('.cell:focus-visible'));
  });
  board.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') showPreview(event.target.closest('.cell'));
  });
  board.addEventListener('pointercancel', clearPreview);
  board.addEventListener('focusin', event => {
    if (event.target.matches('.cell:focus-visible')) showPreview(event.target);
  });
  board.addEventListener('focusout', event => {
    if (!board.contains(event.relatedTarget)) clearPreview();
  });

  board.addEventListener('keydown', event => {
    const offset = directions[event.key];
    const active = event.target.closest('.cell');
    if (!offset || !active || turn !== 'human') return;
    event.preventDefault();

    const r = Number(active.dataset.r) + offset[0];
    const c = Math.min(Number(active.dataset.c) + offset[1], rows[r] - 1);
    if (!core.isOccupied(rows, r, c)) return;
    current = [r, c];
    renderBoard();
    cells[r][c].focus();
  });

  board.addEventListener('click', event => {
    const selected = event.target.closest('.cell');
    if (!selected || turn !== 'human') return;
    const row = Number(selected.dataset.r);
    const col = Number(selected.dataset.c);
    if (!core.isOccupied(rows, row, col)) return;

    restoreFocus = selected.matches(':focus-visible');
    if (document.activeElement === selected) selected.blur();
    current = [row, col];
    switchTurn(row === 0 && col === 0 ? 'poison' : 'computer');
    takeBite('human', row, col);
    timer = setTimeout(computerTurn, 1000);
  });

  for (const button of document.querySelectorAll('[data-reset]')) button.addEventListener('click', reset);
  for (const button of document.querySelectorAll('[data-sound]')) {
    const label = button.querySelector('[data-sound-label]');
    if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', 'Sound effects');
    button.setAttribute('aria-pressed', 'false');
    if (label) label.textContent = 'Sound off';
    button.addEventListener('click', () => {
      const enabled = sound.toggle();
      button.setAttribute('aria-pressed', String(enabled));
      if (label) label.textContent = enabled ? 'Sound on' : 'Sound off';
      if (enabled) sound.play('toggle');
    });
  }

  reset();
})();
