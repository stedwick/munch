(() => {
  'use strict';

  const show = [
    { x: .24, height: .10, launch: 0, burst: .40, shape: 'bloom', colors: ['255,161,55', '255,215,112'], size: .98 },
    { x: .76, height: -.11, launch: .22, burst: .64, shape: 'bloom', colors: ['255,82,153', '255,170,214'], size: 1.04 },
    { x: .49, height: -.43, launch: .49, burst: .94, shape: 'ring', colors: ['100,178,255', '192,219,255'], size: .9 },
    { x: .16, height: .68, launch: .88, burst: 1.29, shape: 'split', colors: ['114,242,131', '217,255,151'], size: .89 },
    { x: .85, height: .59, launch: 1.13, burst: 1.53, shape: 'split', colors: ['255,124,94', '255,210,133'], size: .87 },
    { x: .54, height: .07, launch: 1.43, burst: 1.91, shape: 'willow', colors: ['255,169,49', '255,229,145'], size: 1.25 }
  ];

  const duration = 4.35;
  const white = '255,248,219';
  const tau = Math.PI * 2;
  const rgba = (rgb, alpha) => `rgba(${rgb},${alpha})`;

  function randomNumbers(seed) {
    let state = seed;
    return () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function star(angle, speed, life, trail, color, phase, start = 0, x = 0, y = 0) {
    return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, trail, color, phase, start, x, y };
  }

  function distance(time) {
    return -Math.expm1(-1.4 * time) / 1.4;
  }

  function makeStars(shell, seed, compact) {
    const random = randomNumbers(seed + 137);
    const willow = shell.shape === 'willow';
    const ring = shell.shape === 'ring';
    const count = compact ? 79 : 94;
    const colors = shell.colors;
    const stars = [];
    for (let i = 0; i < count; i += 1) {
      const inner = i >= count * .76;
      const angle = (i + random() * .65) / count * tau;
      const speed = shell.size * (inner ? 1.19 + .49 * random() : 1.58 + .65 * random());
      const life = (willow ? 1.29 : .72) + random() * (willow ? .85 : .65);
      const tail = willow ? .42 + random() * .31 : .16 + random() * .19;
      const color = colors[inner || i % 3 === 0 ? 1 : 0];
      const particle = star(angle, speed, life, tail, color, random() * tau);
      if (ring) {
        // Tilt the thin outer ring and leave a bright center of smaller stars.
        const x = particle.vx;
        const y = particle.vy * .45;
        particle.vx = x * .89 + y * .46;
        particle.vy = -x * .46 + y * .89;
        if (inner) {
          particle.vx *= .37;
          particle.vy *= .6;
        }
      }
      stars.push(particle);

      if ((shell.shape === 'split' || willow) && i % (compact ? 6 : 5) === 0) {
        const splitAt = (willow ? .63 : .40) + random() * .29;
        const x = particle.vx * distance(splitAt);
        const y = particle.vy * distance(splitAt) + .51 * splitAt ** 2;
        const fragments = willow ? 2 : 5;
        for (let part = 0; part < fragments; part += 1) {
          const splitAngle = angle + tau * part / fragments;
          stars.push(star(splitAngle, .16 + random() * .51, .29 + random() * .42, .13, colors[1], random() * tau, splitAt, x, y));
        }
      }
    }
    return stars;
  }

  function position(particle, time, x, y, scale) {
    const reach = distance(time);
    return [
      x + scale * (particle.x + particle.vx * reach),
      y + scale * (particle.y + particle.vy * reach + .51 * time * time)
    ];
  }

  function glow(context, x, y, radius, color, strength) {
    const light = context.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, rgba(white, strength));
    light.addColorStop(.22, rgba(color, strength * .62));
    light.addColorStop(1, rgba(color, 0));
    context.fillStyle = light;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function trace(context, color, width, points) {
    context.beginPath();
    context.moveTo(...points[0]);
    for (let i = 1; i < points.length; i += 1) context.lineTo(...points[i]);
    context.strokeStyle = color;
    context.lineWidth = width;
    context.stroke();
  }

  function drawRocket(context, shell, x, y, floor, scale, time) {
    const flight = shell.burst - shell.launch;
    const age = time - shell.launch;
    const curve = shell.x < .5 ? -.83 : .83;
    function point(at) {
      const progress = Math.max(0, at / flight);
      return [
        x + curve * scale * (1 - progress) ** 2,
        y + (floor - y) * (1 - progress) ** 1.35
      ];
    }

    const head = point(age);
    const middle = point(age - .065);
    const tail = point(age - .17);
    trace(context, rgba(shell.colors[0], .36), 5, [tail, point(age - .11), middle, head]);
    trace(context, rgba(shell.colors[1], .94), 2.8, [middle, point(age - .034), head]);
    trace(context, rgba(white, .92), 1.6, [point(age - .019), head]);
    glow(context, head[0], head[1], 12, shell.colors[1], .44);
  }

  function drawBurst(context, shell, x, y, scale, time) {
    const age = time - shell.burst;
    if (age < .27) {
      const brightness = (1 - age / .27) ** 2;
      glow(context, x, y, scale * (.21 + age * 1.15), shell.colors[1], brightness * .72);
    }

    const weight = Math.max(1.54, Math.min(scale / 71, 2.6));
    for (const particle of shell.stars) {
      const elapsed = age - particle.start;
      if (elapsed < 0 || elapsed > particle.life + particle.trail) continue;
      const headTime = Math.min(elapsed, particle.life);
      const burn = Math.max(0, 1 - headTime / particle.life);
      const cool = 1 - Math.max(0, elapsed - particle.life) / particle.trail;
      const shine = (.77 + .23 * Math.sin(elapsed * 43 + particle.phase)) * cool;
      const head = position(particle, headTime, x, y, scale);
      const end = Math.max(0, elapsed - particle.trail);
      const tail = position(particle, end, x, y, scale);
      const bend = position(particle, (2 * end + headTime) / 3, x, y, scale);
      const middle = position(particle, (end + 2 * headTime) / 3, x, y, scale);
      trace(context, rgba(particle.color, (.17 + .23 * burn) * shine), weight * 1.9, [tail, bend, middle, head]);
      trace(context, rgba(particle.color, (.32 + .55 * burn) * shine), weight * (.42 + .55 * burn), [bend, middle, head]);
      if (burn > .05) {
        context.fillStyle = rgba(white, burn * shine);
        context.fillRect(head[0] - .65, head[1] - .65, 1.3, 1.3);
      }
    }
  }

  window.MunchFireworks = function playFireworks(tray, reducedMotion) {
    if (reducedMotion.matches) return;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    canvas.className = 'fireworks';
    canvas.setAttribute('aria-hidden', 'true');
    tray.append(canvas);

    const display = show.map((shell, index) => ({ ...shell, stars: makeStars(shell, index, innerWidth < 640) }));
    const started = performance.now();
    let frame;

    function stop() {
      cancelAnimationFrame(frame);
      canvas.remove();
    }

    function paint(now) {
      const time = Math.max(0, (now - started) / 1000);
      if (time >= duration || reducedMotion.matches) {
        stop();
        return;
      }

      const width = document.documentElement.clientWidth;
      const height = window.innerHeight;
      const density = Math.min(devicePixelRatio, 1.75);
      const pixelsWide = Math.round(width * density);
      const pixelsHigh = Math.round(height * density);
      if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
        canvas.width = pixelsWide;
        canvas.height = pixelsHigh;
      }

      const bounds = tray.getBoundingClientRect();
      const scale = Math.min(width * (width < 640 ? .229 : .215), height * .245, 245);
      const sky = Math.max(91, Math.min(height * .34, bounds.top - 31));
      const floor = Math.min(height - 20, Math.max(height * .63, bounds.bottom + 13));
      const twilight = Math.max(0, Math.min(1, time / .27, (duration - time) / .77));
      context.setTransform(density, 0, 0, density, 0, 0);
      context.globalCompositeOperation = 'source-over';
      context.clearRect(0, 0, width, height);
      const shade = context.createLinearGradient(0, 0, 0, height);
      shade.addColorStop(0, rgba('11,21,45', .73 * twilight));
      shade.addColorStop(.52, rgba('17,22,49', .47 * twilight));
      shade.addColorStop(1, rgba('17,22,49', 0));
      context.fillStyle = shade;
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      context.lineCap = 'round';
      context.lineJoin = 'round';

      for (const shell of display) {
        const x = width * shell.x;
        const y = Math.max(49, sky + scale * shell.height);
        if (time >= shell.burst && time < shell.burst + 2.85) drawBurst(context, shell, x, y, scale, time);
        else if (time >= shell.launch && time < shell.burst) drawRocket(context, shell, x, y, floor, scale, time);
      }

      frame = requestAnimationFrame(paint);
    }

    frame = requestAnimationFrame(paint);
    return stop;
  };
})();
