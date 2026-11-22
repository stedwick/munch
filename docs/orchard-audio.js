(() => {
  'use strict';

  const assets = new URL('assets/sound/', document.currentScript.src);
  const soundtrack = new URL('orchard-loop.mp3', assets);
  const cues = {
    human: ['player-bite', 'player-bite-alt'],
    computer: ['computer-bite', 'computer-bite-alt'],
    poison: ['poison-bite'],
    fire: ['board-fire'],
    won: ['win'],
    lost: ['loss']
  };
  const effects = [...Object.values(cues).flat(), 'bite-rustle', 'victory-fireworks-finale'];
  const musicVolume = 0.54;

  window.MunchAudio = function makeOrchardAudio() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    const loads = new Map();
    const playing = new Set();
    const nextTake = { human: 0, computer: 0 };
    let context;
    let enabled = false;
    let session = 0;
    let round = 0;
    let musicPosition = 0;
    let music;

    function load(url) {
      if (!loads.has(url.href)) {
        loads.set(url.href, fetch(url)
          .then(response => {
            if (!response.ok) throw new Error('Audio failed to load');
            return response.arrayBuffer();
          })
          .then(bytes => context.decodeAudioData(bytes))
          .catch(() => {
            loads.delete(url.href);
            return null;
          }));
      }
      return loads.get(url.href);
    }

    function effect(name) {
      return load(new URL(name + '.mp3', assets));
    }

    function startMusic(buffer) {
      const source = context.createBufferSource();
      const gain = context.createGain();
      const now = context.currentTime;
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain).connect(context.destination);
      gain.gain.setValueAtTime(0, now);
      gain.gain.setTargetAtTime(musicVolume, now, 0.035);
      source.start(now, musicPosition);
      music = { source, gain, began: now, duration: buffer.duration };
    }

    function pauseMusic() {
      if (!music) return;
      const now = context.currentTime;
      musicPosition = (musicPosition + now - music.began) % music.duration;
      music.gain.gain.cancelScheduledValues(now);
      music.gain.gain.setTargetAtTime(0, now, 0.015);
      music.source.stop(now + 0.075);
      music = null;
    }

    function cancelEffects() {
      round += 1;
      for (const source of playing) source.stop();
      playing.clear();
    }

    function toggle() {
      if (enabled) {
        enabled = false;
        session += 1;
        cancelEffects();
        pauseMusic();
        return false;
      }

      try {
        context ??= new Audio();
      } catch {
        return false;
      }

      enabled = true;
      const currentSession = ++session;
      context.resume().catch(() => {});
      load(soundtrack).then(buffer => {
        if (buffer && enabled && session === currentSession) startMusic(buffer);
      });
      for (const name of effects) effect(name);
      return true;
    }

    function play(cue, count = 1) {
      const takes = cues[cue];
      if (!enabled || !takes) return;
      const take = nextTake[cue] ?? 0;
      if (takes.length > 1) nextTake[cue] = (take + 1) % takes.length;
      const currentRound = round;
      const triggeredAt = performance.now();

      function playEffect(name, delay = 0) {
        effect(name).then(buffer => {
          if (!buffer || !enabled || round !== currentRound || performance.now() - triggeredAt > 180) return;
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          playing.add(source);
          source.addEventListener('ended', () => playing.delete(source), { once: true });
          source.start(context.currentTime + delay);
        });
      }

      playEffect(takes[take]);
      if (cue === 'won') playEffect('victory-fireworks-finale');
      if (takes.length > 1 && count >= 7) playEffect('bite-rustle', 0.035);
    }

    document.addEventListener('munch:move', ({ detail }) => {
      if (detail.poison && detail.actor === 'human') play('fire');
    });
    document.addEventListener('munch:reset', cancelEffects);
    return { toggle, play };
  };
})();
