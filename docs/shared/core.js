(() => {
  'use strict';

  const ROWS = 5;
  const COLS = 6;
  const losingPositions = new Set([
    '10000', '21000', '22100', '22210', '22221', '31100', '32000',
    '33110', '33211', '33322', '41110', '42111', '42200', '43000',
    '44222', '44311', '51111', '52110', '53200', '53320', '54000',
    '55220', '55300', '62211', '62220', '63111', '63300', '64200',
    '64332', '64433', '65000', '66333', '66432', '66542', '66652'
  ]);

  const newBoard = () => Array(ROWS).fill(COLS);
  const isOccupied = (rows, row, col) => col >= 0 && col < rows[row];
  const remaining = rows => rows.reduce((total, length) => total + length, 0);

  function afterBite(rows, row, col) {
    return rows.map((length, index) => index < row ? length : Math.min(length, col));
  }

  function biteCells(rows, row, col) {
    const cells = [];
    for (let r = row; r < ROWS; r += 1) {
      for (let c = col; c < rows[r]; c += 1) cells.push({ row: r, col: c });
    }
    return cells;
  }

  function computerMove(rows, roll) {
    const winningMoves = [];
    let fallback = [[0, 0]];
    let farthest = 0;

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < rows[row]; col += 1) {
        if (losingPositions.has(afterBite(rows, row, col).join(''))) {
          winningMoves.push([row, col]);
        } else if (row + col > farthest) {
          farthest = row + col;
          fallback = [[row, col]];
        } else if (row + col === farthest) {
          fallback.push([row, col]);
        }
      }
    }

    if (winningMoves.length === 0 && rows.join('') === '66333') {
      return roll < 0.5 ? [1, 4] : [4, 2];
    }

    const choices = winningMoves.length > 0 ? winningMoves : fallback;
    return choices[Math.round(roll * (choices.length - 1))];
  }

  const core = Object.freeze({ ROWS, COLS, newBoard, isOccupied, afterBite, biteCells, remaining, computerMove });
  if (typeof module !== 'undefined') module.exports = core;
  else window.MunchCore = core;
})();
