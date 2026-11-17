// Pre-rendered artwork for Pondlight. Every creature and prop is painted
// once, at three times its logical size, onto its own canvas when this
// module loads; the renderer then stamps the canvases with drawImage,
// which is both fast and far richer than re-drawing vector shapes every
// frame: gradients, feather scallops, scale patterns and glossy highlights
// all live here. The frog is Naiwa, the milk frog: bright yellow skin, a
// big milky-cream belly, deep green eyes and dark toe tips.
//
// A sprite is { c, w, h }: the canvas and its logical (unscaled) size.
// Every sprite is drawn centred on its anchor, so blit() takes the centre.

import { makeRng } from './random.js';

const mulberry32 = makeRng;

const SS = 3; // supersample factor: art is painted 3x and stamped down

function make(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SS);
  c.height = Math.ceil(h * SS);
  const ctx = c.getContext('2d');
  ctx.scale(SS, SS);
  ctx.translate(w / 2, h / 2);
  draw(ctx);
  return { c, w, h };
}

/** Stamp a sprite centred at (x, y). */
export function blit(ctx, spr, x, y, { rot = 0, scale = 1, alpha = 1, flipX = false } = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (flipX) ctx.scale(-1, 1);
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.drawImage(spr.c, (-spr.w / 2) * scale, (-spr.h / 2) * scale, spr.w * scale, spr.h * scale);
  ctx.restore();
}

/** A solid-white silhouette of a sprite, for hit flashes. */
function whiten(spr) {
  const c = document.createElement('canvas');
  c.width = spr.c.width;
  c.height = spr.c.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(spr.c, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  return { c, w: spr.w, h: spr.h };
}

function circle(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, rot, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function radial(ctx, x, y, r0, r1, stops) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

function linear(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

/* ---------------- the milk frog (Naiwa) ----------------
 * Painted facing up (-y); the renderer rotates the sprite to the aim.
 * Body radius in the art is FROG_BODY; scale = radius / FROG_BODY. */

export const FROG_BODY = 34;

function paintFrog(paddle) {
  return make(150, 150, (ctx) => {
    const legSwing = Math.sin(paddle * Math.PI * 2) * 7;
    const armSwing = Math.sin(paddle * Math.PI * 2 + Math.PI) * 5;

    // Hind legs: broad yellow thighs ending in feet with dark toe tips.
    for (const side of [-1, 1]) {
      const swing = side > 0 ? legSwing : -legSwing;
      ctx.save();
      ctx.translate(side * 26, 20 + swing * 0.4);
      ctx.rotate(side * (0.65 + swing * 0.012));
      ellipse(ctx, 0, 0, 17, 10.5, 0, radial(ctx, -4, -4, 2, 20, [[0, '#ffe066'], [0.7, '#f7c948'], [1, '#e0a100']]));
      // toes: three dark-tipped digits fanning from the foot's end
      for (let toe = -1; toe <= 1; toe += 1) {
        const tx = 13 + Math.abs(toe) * 1.5;
        const ty = toe * 6.5;
        ctx.strokeStyle = '#e8ac0a';
        ctx.lineWidth = 4.6;
        ctx.beginPath();
        ctx.moveTo(6, toe * 3.4);
        ctx.lineTo(tx - 2.5, ty);
        ctx.stroke();
        circle(ctx, tx, ty, 3.1, '#37474f');
      }
      ctx.restore();
    }
    // Front arms, smaller, paddling against the legs.
    for (const side of [-1, 1]) {
      const swing = side > 0 ? armSwing : -armSwing;
      ctx.save();
      ctx.translate(side * 31, -4 + swing * 0.5);
      ctx.rotate(side * (1.85 + swing * 0.014));
      ellipse(ctx, 0, 0, 11.5, 6.4, 0, radial(ctx, -3, -3, 2, 13, [[0, '#ffe066'], [1, '#e8ac0a']]));
      for (let toe = -1; toe <= 1; toe += 1) circle(ctx, 9.5, toe * 3.6, 2.1, '#37474f');
      ctx.restore();
    }

    // Body: a plump round gradient with a shaded rim.
    ctx.fillStyle = radial(ctx, -9, -12, 6, 40, [[0, '#ffec8b'], [0.45, '#ffd93b'], [0.8, '#f7c948'], [1, '#dfa008']]);
    ctx.beginPath();
    ctx.arc(0, 0, FROG_BODY, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(146, 96, 0, 0.35)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // The big milky belly, soft-edged, low on the body.
    const belly = radial(ctx, 0, 13, 4, 27, [[0, 'rgba(255, 250, 230, 0.98)'], [0.72, 'rgba(253, 243, 216, 0.95)'], [1, 'rgba(253, 243, 216, 0)']]);
    ellipse(ctx, 0, 13, 24.5, 20.5, 0, belly);
    // A faint warm patch high on the back.
    ellipse(ctx, -13, -17, 8.5, 5.5, -0.5, 'rgba(232, 172, 10, 0.35)');

    // Eye bumps, then deep green eyes with a living highlight.
    for (const side of [-1, 1]) {
      const ex = side * 14.5;
      const ey = -FROG_BODY + 7;
      circle(ctx, ex, ey, 10.5, radial(ctx, ex - 3, ey - 4, 2, 12, [[0, '#ffe066'], [1, '#e8ac0a']]));
      circle(ctx, ex, ey - 1.5, 7.6, radial(ctx, ex - 2, ey - 4, 1, 8, [[0, '#43d17c'], [0.55, '#1d9e46'], [1, '#0d5c26']]));
      circle(ctx, ex, ey - 1.5, 3.9, '#0a1f10');
      circle(ctx, ex - 2.2, ey - 4.6, 2.1, '#ffffff');
      circle(ctx, ex + 2.4, ey + 0.8, 1, 'rgba(255,255,255,0.85)');
    }

    // Nostrils and a contented smile.
    circle(ctx, -4.6, -21.5, 1.15, 'rgba(120, 78, 0, 0.65)');
    circle(ctx, 4.6, -21.5, 1.15, 'rgba(120, 78, 0, 0.65)');
    ctx.strokeStyle = 'rgba(122, 80, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -13.5, 9.5, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
    // Soft sheen across the crown.
    ellipse(ctx, -8, -24, 13, 6, -0.35, 'rgba(255, 255, 255, 0.20)');
  });
}

export const FROG_FRAMES = [0, 0.25, 0.5, 0.75].map(paintFrog);
export const FROG_WHITE = FROG_FRAMES.map(whiten);

/* ---------------- the pond pests ---------------- */

/** Gnats: two wing frames. Body radius in art 13, matching FOE.gnat. */
function paintGnat(wingsUp) {
  return make(64, 56, (ctx) => {
    const wy = wingsUp ? -11 : -5;
    // Translucent wings with a vein, beating behind the body.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 5, -4);
      ctx.rotate(side * (wingsUp ? 0.95 : 0.35));
      const wg = linear(ctx, 0, 0, side * 20, 0, [[0, 'rgba(255,255,255,0.85)'], [1, 'rgba(207, 239, 251, 0.25)']]);
      ellipse(ctx, side * 11, 0, 12.5, 4.6, 0, wg);
      ctx.strokeStyle = 'rgba(120, 144, 156, 0.5)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(side * 21, 0);
      ctx.stroke();
      ctx.restore();
    }
    void wy;
    // Dangling legs.
    ctx.strokeStyle = '#4e342e';
    ctx.lineWidth = 1.6;
    for (const side of [-1, 1]) for (let leg = 0; leg < 3; leg += 1) {
      ctx.beginPath();
      ctx.moveTo(side * (3 + leg * 2.4), 6);
      ctx.quadraticCurveTo(side * (7 + leg * 2.6), 11, side * (6 + leg * 3), 15.5);
      ctx.stroke();
    }
    // Segmented abdomen, thorax, head.
    ellipse(ctx, 0, 6.5, 8.6, 10.5, 0, radial(ctx, -3, 2, 2, 12, [[0, '#a1887f'], [1, '#5d4037']]));
    ctx.strokeStyle = 'rgba(38, 24, 18, 0.55)';
    ctx.lineWidth = 1.4;
    for (let band = 0; band < 3; band += 1) {
      ctx.beginPath();
      ctx.arc(0, 3.4 + band * 0.5, 7.6 - band * 1.6, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    circle(ctx, 0, -3, 8.8, radial(ctx, -3, -6, 2, 10, [[0, '#bcaaa4'], [1, '#6d4c41']]));
    // Compound eyes: clustered ruby facets.
    for (const side of [-1, 1]) {
      circle(ctx, side * 4.6, -7.5, 3.9, radial(ctx, side * 3.6, -8.8, 0.8, 4.4, [[0, '#ef9a9a'], [0.6, '#c62828'], [1, '#7f1010']]));
      circle(ctx, side * 3.8, -8.6, 1, 'rgba(255,255,255,0.8)');
    }
    // Antennae.
    ctx.strokeStyle = '#4e342e';
    ctx.lineWidth = 1.3;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 2.5, -11);
      ctx.quadraticCurveTo(side * 6, -16, side * 9.5, -15.5);
      ctx.stroke();
    }
  });
}
export const GNAT_FRAMES = [paintGnat(true), paintGnat(false)];
export const GNAT_WHITE = GNAT_FRAMES.map(whiten);

/** Darters: sleek fish facing +x, three tail-wag frames. Art radius 15. */
function paintDarter(wag) {
  return make(84, 52, (ctx) => {
    const tailSwing = Math.sin(wag * Math.PI * 2) * 5;
    // Tail fin, wagging.
    ctx.save();
    ctx.translate(-13, 0);
    ctx.rotate(tailSwing * 0.02);
    const fin = linear(ctx, 0, 0, -16, 0, [[0, 'rgba(41, 182, 246, 0.95)'], [1, 'rgba(2, 119, 189, 0.55)']]);
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-15, -10.5 + tailSwing * 0.4);
    ctx.lineTo(-11.5, 0);
    ctx.lineTo(-15, 10.5 + tailSwing * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Dorsal fin.
    ctx.fillStyle = 'rgba(2, 119, 189, 0.75)';
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.quadraticCurveTo(2, -15.5, 9, -8.5);
    ctx.closePath();
    ctx.fill();
    // Body: silver-blue with a deep back and a pale belly.
    const body = linear(ctx, 0, -13, 0, 13, [[0, '#0277bd'], [0.38, '#4fc3f7'], [0.72, '#b3e5fc'], [1, '#e1f5fe']]);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(21, 0);
    ctx.quadraticCurveTo(8, -11.5, -8, -9.5);
    ctx.quadraticCurveTo(-16, -6, -15, 0);
    ctx.quadraticCurveTo(-16, 6, -8, 9.5);
    ctx.quadraticCurveTo(8, 11.5, 21, 0);
    ctx.closePath();
    ctx.fill();
    // Scale arcs along the flank.
    ctx.strokeStyle = 'rgba(1, 87, 155, 0.28)';
    ctx.lineWidth = 1.1;
    for (let row = 0; row < 3; row += 1) for (let col = 0; col < 4; col += 1) {
      ctx.beginPath();
      ctx.arc(-6 + col * 6.5, -4.5 + row * 4.5, 3.4, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    }
    // Lateral line and gill.
    ctx.strokeStyle = 'rgba(1, 87, 155, 0.5)';
    ctx.beginPath();
    ctx.moveTo(13, 1.5);
    ctx.quadraticCurveTo(0, 3.4, -12, 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(9.5, 0, 6.4, -1.1, 1.1);
    ctx.stroke();
    // Eye and a determined mouth.
    circle(ctx, 13.5, -3, 3.1, '#ffffff');
    circle(ctx, 14.2, -3, 2.1, '#08304d');
    circle(ctx, 14.9, -3.8, 0.75, '#ffffff');
    ctx.strokeStyle = '#08304d';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(17.5, 3.4);
    ctx.lineTo(20.5, 2.2);
    ctx.stroke();
  });
}
export const DARTER_FRAMES = [0, 0.33, 0.66].map(paintDarter);
export const DARTER_WHITE = DARTER_FRAMES.map(whiten);

/** Spitter moths: two wing frames, patterned wings. Art radius 17. */
function paintMoth(flap) {
  return make(104, 84, (ctx) => {
    const lift = flap ? -7 : 2;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 6, -2);
      ctx.rotate(side * (flap ? 0.5 : 0.12));
      // Hind wing peeking below the fore wing.
      ellipse(ctx, side * 15, 9, 15, 8.5, side * 0.5, linear(ctx, 0, 0, side * 26, 6, [[0, '#9575cd'], [1, '#673ab7']]));
      // Fore wing with an eyespot and scalloped rim.
      const wg = linear(ctx, 0, -6, side * 30, lift, [[0, '#d1c4e9'], [0.55, '#b39ddb'], [1, '#7e57c2']]);
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.quadraticCurveTo(side * 16, -16 + lift, side * 30, -8 + lift);
      ctx.quadraticCurveTo(side * 33, 0 + lift, side * 26, 5 + lift);
      ctx.quadraticCurveTo(side * 14, 9, 0, 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(49, 27, 146, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(2, -2);
      ctx.quadraticCurveTo(side * 15, -8 + lift, side * 27, -5 + lift);
      ctx.stroke();
      circle(ctx, side * 20, -2 + lift * 0.6, 4.6, '#4a2d82');
      circle(ctx, side * 20, -2 + lift * 0.6, 2.4, '#ffd54f');
      circle(ctx, side * 20, -2 + lift * 0.6, 1.1, '#2a1650');
      ctx.restore();
    }
    // Fuzzy body: stacked arcs of lavender down.
    for (let i = 0; i < 5; i += 1) {
      ellipse(ctx, 0, 8 - i * 4.4, 8.6 - Math.abs(i - 2) * 0.8, 6.4, 0, i % 2 ? '#8e6bc8' : '#a583dd');
    }
    circle(ctx, 0, -12.5, 7.4, '#7e57c2');
    // Feathered antennae.
    ctx.strokeStyle = '#4527a0';
    ctx.lineWidth = 1.6;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 3, -18);
      ctx.quadraticCurveTo(side * 9, -26, side * 14, -25);
      ctx.stroke();
      for (let barb = 0; barb < 3; barb += 1) {
        ctx.beginPath();
        ctx.moveTo(side * (6 + barb * 2.6), -21.5 - barb * 1.4);
        ctx.lineTo(side * (8 + barb * 2.6), -25 - barb * 1.2);
        ctx.stroke();
      }
    }
    // Big pale eyes.
    circle(ctx, -3.8, -13.5, 2.7, '#ede7f6');
    circle(ctx, 3.8, -13.5, 2.7, '#ede7f6');
    circle(ctx, -3.8, -13.2, 1.3, '#311b92');
    circle(ctx, 3.8, -13.2, 1.3, '#311b92');
  });
}
export const MOTH_FRAMES = [paintMoth(true), paintMoth(false)];
export const MOTH_WHITE = MOTH_FRAMES.map(whiten);

/** Tank beetles: armoured dome, two leg frames. Art radius 23. */
function paintBeetle(step) {
  return make(96, 96, (ctx) => {
    // Six jointed legs, alternating with the step phase.
    ctx.strokeStyle = '#2d1a12';
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) for (let leg = 0; leg < 3; leg += 1) {
      const phase = (leg % 2 === 0) === step ? 3.4 : -3.4;
      const bx = -13 + leg * 13;
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(bx, side * 15);
      ctx.quadraticCurveTo(bx + phase, side * 27, bx + phase * 1.7, side * 33);
      ctx.stroke();
      circle(ctx, bx + phase * 1.7, side * 33, 2.2, '#1a0f0a');
    }
    // Shell dome with a shaded rim.
    ctx.fillStyle = radial(ctx, -7, -9, 5, 30, [[0, '#8d6e63'], [0.5, '#5d4037'], [0.85, '#4e342e'], [1, '#2d1a12']]);
    ctx.beginPath();
    ctx.arc(0, 0, 23, 0, Math.PI * 2);
    ctx.fill();
    // Segment plates: arcs across the dome, split by the centre ridge.
    ctx.strokeStyle = 'rgba(20, 10, 6, 0.6)';
    ctx.lineWidth = 2;
    for (const rr of [8.5, 15, 20.5]) {
      ctx.beginPath();
      ctx.arc(0, 0, rr, Math.PI * 0.12, Math.PI * 0.88);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, rr, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(20, 10, 6, 0.75)';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, -22.5);
    ctx.lineTo(0, 22.5);
    ctx.stroke();
    // Pitted texture.
    const rng = mulberry32(7);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 16; i += 1) {
      const a = rng() * Math.PI * 2;
      const d = 6 + rng() * 14.5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1.15, 0, Math.PI * 2);
      ctx.fill();
    }
    // Glossy crescent.
    ctx.strokeStyle = 'rgba(255, 236, 210, 0.5)';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(0, 0, 17.5, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
    // Head, mandibles and ember eyes at the front (-y).
    ellipse(ctx, 0, -22.5, 9.5, 6.4, 0, radial(ctx, -3, -25, 2, 11, [[0, '#6d4c41'], [1, '#332016']]));
    ctx.strokeStyle = '#1a0f0a';
    ctx.lineWidth = 2.6;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 6.5, -26.5);
      ctx.quadraticCurveTo(side * 11, -31, side * 8, -34.5);
      ctx.stroke();
    }
    circle(ctx, -4.6, -24.5, 2.2, '#ff7043');
    circle(ctx, 4.6, -24.5, 2.2, '#ff7043');
  });
}
export const BEETLE_FRAMES = [paintBeetle(true), paintBeetle(false)];
export const BEETLE_WHITE = BEETLE_FRAMES.map(whiten);

/** The Shadow Heron: three wing frames, facing +x. Art radius 54. */
function paintHeron(flap) {
  return make(300, 264, (ctx) => {
    const wingLift = [-14, 2, 12][flap];
    // Trailing legs with webbed feet.
    ctx.strokeStyle = '#263238';
    ctx.lineCap = 'round';
    ctx.lineWidth = 4.6;
    for (const off of [-9, 7]) {
      ctx.beginPath();
      ctx.moveTo(-38, 16 + off * 0.4);
      ctx.quadraticCurveTo(-58, 26 + off * 0.5, -74, 30 + off * 0.6);
      ctx.stroke();
      ctx.lineWidth = 3.2;
      for (let toe = -1; toe <= 1; toe += 1) {
        ctx.beginPath();
        ctx.moveTo(-74, 30 + off * 0.6);
        ctx.lineTo(-84, 30 + off * 0.6 + toe * 4.4);
        ctx.stroke();
      }
      ctx.lineWidth = 4.6;
    }
    // Tail feathers.
    ctx.fillStyle = '#37474f';
    for (let i = -2; i <= 2; i += 1) {
      ctx.save();
      ctx.translate(-44, 4);
      ctx.rotate(0.5 + i * 0.16);
      ellipse(ctx, -13, 0, 15, 4.4, 0, '#37474f');
      ctx.restore();
    }
    // Far wing.
    ctx.save();
    ctx.translate(-6, -14);
    ctx.rotate(-0.35 - wingLift * 0.01);
    ctx.fillStyle = '#2f3f47';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.quadraticCurveTo(-18, -26 + wingLift * 0.4, -44, -20 + wingLift * 0.5);
    ctx.quadraticCurveTo(-26, -4, -6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Body with rows of feather scallops.
    ctx.fillStyle = radial(ctx, -8, -12, 8, 62, [[0, '#78909c'], [0.55, '#546e7a'], [1, '#37474f']]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 54, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, 54, 40, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(28, 40, 46, 0.35)';
    ctx.lineWidth = 1.8;
    for (let row = 0; row < 4; row += 1) for (let col = 0; col < 6; col += 1) {
      ctx.beginPath();
      ctx.arc(-38 + col * 15 + (row % 2) * 7, -22 + row * 14, 8.6, Math.PI * 0.08, Math.PI * 0.92);
      ctx.stroke();
    }
    const shade = linear(ctx, 0, 8, 0, 42, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.30)']]);
    ctx.fillStyle = shade;
    ctx.fillRect(-56, 6, 112, 38);
    ctx.restore();
    // Near wing: layered coverts and long flight feathers.
    ctx.save();
    ctx.translate(2, -10);
    ctx.rotate(0.16 + wingLift * 0.012);
    const wg = linear(ctx, 0, -8, -30, 22, [[0, '#607d8b'], [1, '#33424b']]);
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(20, -6);
    ctx.quadraticCurveTo(-8, -22 + wingLift * 0.5, -38, -14 + wingLift * 0.6);
    ctx.quadraticCurveTo(-44, 2 + wingLift * 0.4, -30, 14);
    ctx.quadraticCurveTo(-4, 18, 16, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(24, 34, 40, 0.5)';
    ctx.lineWidth = 1.7;
    for (let f = 0; f < 4; f += 1) {
      ctx.beginPath();
      ctx.moveTo(12 - f * 9, 2 + f * 2.4);
      ctx.quadraticCurveTo(-8 - f * 6, -4 + wingLift * 0.4, -30 - f * 3.4, -8 + wingLift * 0.5 + f * 5);
      ctx.stroke();
    }
    ctx.restore();
    // Neck: a thick S rising to the head at the front (+x).
    ctx.strokeStyle = '#546e7a';
    ctx.lineWidth = 17;
    ctx.beginPath();
    ctx.moveTo(34, -8);
    ctx.bezierCurveTo(52, -26, 46, -44, 66, -52);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(37, -13);
    ctx.bezierCurveTo(53, -28, 49, -42, 64, -50);
    ctx.stroke();
    // Head with crest, dagger beak and a hunter's eye.
    const hx = 74;
    const hy = -54;
    for (let i = 0; i < 3; i += 1) {
      ctx.save();
      ctx.translate(hx - 8, hy - 6);
      ctx.rotate(-0.7 - i * 0.3);
      ellipse(ctx, -9, 0, 10.5, 3, 0, '#37474f');
      ctx.restore();
    }
    circle(ctx, hx, hy, 14.5, radial(ctx, hx - 4, hy - 5, 3, 16, [[0, '#78909c'], [1, '#455a64']]));
    ctx.fillStyle = linear(ctx, hx, hy - 4, hx + 52, hy + 3, [[0, '#ffca28'], [0.7, '#ffb300'], [1, '#e65100']]);
    ctx.beginPath();
    ctx.moveTo(hx + 9, hy - 5);
    ctx.lineTo(hx + 56, hy + 2.5);
    ctx.lineTo(hx + 9, hy + 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 60, 0, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(hx + 11, hy + 1.4);
    ctx.lineTo(hx + 52, hy + 2.4);
    ctx.stroke();
    circle(ctx, hx + 3.5, hy - 3.5, 4.7, radial(ctx, hx + 2, hy - 5, 1, 5.4, [[0, '#ffee58'], [0.6, '#ffb300'], [1, '#e65100']]));
    circle(ctx, hx + 3.8, hy - 3.5, 2.3, '#140d02');
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - 2, hy - 9.5);
    ctx.lineTo(hx + 9, hy - 7.5);
    ctx.stroke();
  });
}
export const HERON_FRAMES = [0, 1, 2].map(paintHeron);
export const HERON_WHITE = HERON_FRAMES.map(whiten);

/* ---------------- pickups and projectiles ---------------- */

export const FIREFLY_SPRITE = make(56, 56, (ctx) => {
  const halo = radial(ctx, 0, 0, 1, 26, [[0, 'rgba(255, 224, 102, 0.85)'], [0.35, 'rgba(255, 224, 102, 0.32)'], [1, 'rgba(255, 224, 102, 0)']]);
  circle(ctx, 0, 0, 26, halo);
  // Tiny wings and body inside the glow.
  ellipse(ctx, -4.5, -3.5, 4.6, 2.4, -0.6, 'rgba(255,255,255,0.75)');
  ellipse(ctx, 4.5, -3.5, 4.6, 2.4, 0.6, 'rgba(255,255,255,0.75)');
  ellipse(ctx, 0, 1, 3.6, 5, 0, '#8d6e00');
  circle(ctx, 0, 0.5, 3.1, radial(ctx, -1, -1.4, 0.6, 3.6, [[0, '#fffde7'], [0.6, '#ffe066'], [1, '#f9a825']]));
});

export const HEART_SPRITE = make(44, 44, (ctx) => {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(0, 13);
    ctx.bezierCurveTo(-19, 0, -12.5, -15.5, 0, -6.5);
    ctx.bezierCurveTo(12.5, -15.5, 19, 0, 0, 13);
    ctx.closePath();
  };
  ctx.save();
  ctx.shadowColor = 'rgba(255, 107, 129, 0.65)';
  ctx.shadowBlur = 9;
  path();
  ctx.fillStyle = linear(ctx, 0, -14, 0, 14, [[0, '#ff8fa3'], [0.5, '#ff6b81'], [1, '#e0385a']]);
  ctx.fill();
  ctx.restore();
  path();
  ctx.strokeStyle = 'rgba(120, 10, 40, 0.5)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ellipse(ctx, -6, -6.5, 4.6, 2.9, -0.6, 'rgba(255,255,255,0.75)');
});

export const DRAGONFLY_FRAMES = [0, 1].map((frame) => make(84, 64, (ctx) => {
  const lift = frame ? -3.4 : 2.6;
  for (const side of [-1, 1]) {
    const wg = linear(ctx, 0, 0, side * 30, lift, [[0, 'rgba(255,255,255,0.8)'], [1, 'rgba(179, 229, 252, 0.25)']]);
    ellipse(ctx, side * 19, -8 + lift, 19, 5, side * (frame ? -0.28 : 0.1), wg);
    ellipse(ctx, side * 15, 1 + lift * 0.4, 14.5, 4, side * 0.3, wg);
  }
  // Segmented abdomen trailing down, thorax, twin compound eyes.
  for (let i = 0; i < 6; i += 1) {
    ellipse(ctx, 0, 6 + i * 3.4, 4.4 - i * 0.42, 3.1, 0, i % 2 ? '#039be5' : '#29b6f6');
  }
  ellipse(ctx, 0, -1, 5.6, 7.6, 0, radial(ctx, -2, -3, 1.5, 8, [[0, '#4fc3f7'], [1, '#0277bd']]));
  circle(ctx, -3.7, -9.6, 3.3, radial(ctx, -4.6, -10.8, 0.7, 3.8, [[0, '#a5d6f7'], [1, '#01579b']]));
  circle(ctx, 3.7, -9.6, 3.3, radial(ctx, 2.8, -10.8, 0.7, 3.8, [[0, '#a5d6f7'], [1, '#01579b']]));
}));

export const BUBBLE_SPRITE = make(48, 48, (ctx) => {
  const body = radial(ctx, -6, -7, 2, 23, [[0, 'rgba(255,255,255,0.28)'], [0.55, 'rgba(207, 239, 251, 0.20)'], [0.88, 'rgba(129, 212, 250, 0.30)'], [1, 'rgba(129, 212, 250, 0.55)']]);
  circle(ctx, 0, 0, 21, body);
  ctx.strokeStyle = 'rgba(225, 248, 255, 0.9)';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(0, 0, 20.2, 0, Math.PI * 2);
  ctx.stroke();
  ellipse(ctx, -7.5, -9, 6.4, 3.9, -0.7, 'rgba(255,255,255,0.95)');
  circle(ctx, 7.5, 8.5, 2.1, 'rgba(255,255,255,0.5)');
  // A whisper of rainbow on the rim.
  ctx.strokeStyle = 'rgba(255, 183, 255, 0.35)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, 19, Math.PI * 0.55, Math.PI * 0.95);
  ctx.stroke();
});

export const SPORE_SPRITE = make(36, 36, (ctx) => {
  circle(ctx, 0, 0, 12.5, radial(ctx, -3.5, -4, 2, 13.5, [[0, 'rgba(220, 237, 200, 0.5)'], [1, 'rgba(139, 195, 74, 0.12)']]));
  circle(ctx, 0, 0, 7.6, radial(ctx, -2.4, -2.8, 1, 8.4, [[0, '#dcedc8'], [0.6, '#aed581'], [1, '#689f38']]));
  circle(ctx, -2.2, -1.6, 1.7, '#33691e');
  circle(ctx, 2.6, 2.2, 1.3, '#33691e');
  circle(ctx, 1.8, -3.2, 1, '#558b2f');
});

export const FEATHER_SPRITE = make(56, 30, (ctx) => {
  // A heron feather, pointing +x: shaft with fine barbs.
  ctx.strokeStyle = '#90a4ae';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 11; i += 1) {
    const x = -16 + i * 3.1;
    const len = 8.5 - Math.abs(i - 6) * 0.85;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 4.4, -len);
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 4.4, len);
    ctx.stroke();
  }
  const vane = linear(ctx, -18, 0, 20, 0, [[0, 'rgba(176, 190, 197, 0.5)'], [1, 'rgba(120, 144, 156, 0.9)']]);
  ellipse(ctx, 0, 0, 19, 6.8, 0, vane);
  ctx.strokeStyle = '#eceff1';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(21, 0);
  ctx.stroke();
});

/* ---------------- pond dressing ---------------- */

/** Lily pads: three variants, one flowering. Painted facing up with the
 *  notch at the top; the renderer rotates each pad by its own notch. */
export const PAD_SPRITES = [0, 1, 2].map((variant) => make(150, 150, (ctx) => {
  const rng = mulberry32(40 + variant * 13);
  const R = 66;
  const greens = [['#4caf6d', '#2e7d4f', '#1c5233'], ['#43a15f', '#2a7043', '#17402a'], ['#57b877', '#358550', '#1f5c39']][variant];
  ctx.fillStyle = radial(ctx, -14, -16, 8, R + 8, [[0, greens[0]], [0.6, greens[1]], [1, greens[2]]]);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, R, 0.42, Math.PI * 2 - 0.42);
  ctx.closePath();
  ctx.fill();
  // Rim light on the upper edge, shadow in the notch.
  ctx.strokeStyle = 'rgba(200, 255, 214, 0.35)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, R - 2.4, Math.PI * 1.05, Math.PI * 1.75);
  ctx.stroke();
  // Veins running from the heart of the pad.
  ctx.strokeStyle = 'rgba(16, 60, 34, 0.4)';
  ctx.lineWidth = 1.7;
  for (let i = 0; i < 9; i += 1) {
    const a = 0.55 + (i / 8) * (Math.PI * 2 - 1.1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(a) * R * 0.45, Math.sin(a) * R * 0.45, Math.cos(a) * (R - 5), Math.sin(a) * (R - 5));
    ctx.stroke();
  }
  // Speckles and a chewed bite or two.
  ctx.fillStyle = 'rgba(255, 255, 220, 0.10)';
  for (let i = 0; i < 12; i += 1) {
    const a = rng() * Math.PI * 2;
    const d = 12 + rng() * (R - 18);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1 + rng() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (variant === 1) {
    ctx.fillStyle = 'rgba(11, 46, 29, 0.85)';
    ctx.beginPath();
    ctx.arc(R * 0.78, -R * 0.42, 6.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (variant === 2) {
    // A lotus in layered pink petals with a golden heart.
    const fx = 26;
    const fy = -24;
    for (let ring = 0; ring < 2; ring += 1) {
      const n = ring ? 5 : 7;
      const rr = ring ? 5.4 : 10.5;
      const len = ring ? 8.5 : 13;
      for (let p = 0; p < n; p += 1) {
        const a = (p / n) * Math.PI * 2 + ring * 0.5;
        ctx.save();
        ctx.translate(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillStyle = linear(ctx, 0, len / 2, 0, -len / 2, [[0, '#f8bbd0'], [0.6, '#f48fb1'], [1, '#ec407a']]);
        ctx.beginPath();
        ctx.moveTo(0, len / 2);
        ctx.quadraticCurveTo(-len * 0.42, -len * 0.1, 0, -len / 2);
        ctx.quadraticCurveTo(len * 0.42, -len * 0.1, 0, len / 2);
        ctx.fill();
        ctx.restore();
      }
    }
    circle(ctx, fx, fy, 4.4, radial(ctx, fx - 1.4, fy - 1.6, 0.8, 5, [[0, '#fff59d'], [1, '#f9a825']]));
  }
}));

/** A reed cluster, anchored at its base centre (drawn upward). */
export const REED_SPRITE = make(90, 190, (ctx) => {
  ctx.translate(0, 92);
  const rng = mulberry32(99);
  for (let blade = 0; blade < 9; blade += 1) {
    const bx = -30 + blade * 7.5 + rng() * 4;
    const h = 118 + rng() * 62;
    const lean = (rng() - 0.5) * 22;
    const g = linear(ctx, 0, 0, 0, -h, [[0, '#1f5c39'], [1, '#43a15f']]);
    ctx.strokeStyle = g;
    ctx.lineWidth = 3.6 - Math.abs(blade - 4) * 0.24;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, 0);
    ctx.quadraticCurveTo(bx + lean * 0.3, -h * 0.6, bx + lean, -h);
    ctx.stroke();
    if (blade % 3 === 1) {
      // A brown cattail head.
      ctx.save();
      ctx.translate(bx + lean * 0.82, -h * 0.78);
      ctx.rotate(lean * 0.01);
      ctx.fillStyle = linear(ctx, -4, 0, 4, 0, [[0, '#8d5a2b'], [0.5, '#6d3f1d'], [1, '#4e2a10']]);
      ctx.beginPath();
      ctx.roundRect(-3.6, -13, 7.2, 26, 3.6);
      ctx.fill();
      ctx.strokeStyle = '#6d3f1d';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(0, -21);
      ctx.stroke();
      ctx.restore();
    }
  }
});

/** A soft caustic light tile, tiled over the water at low alpha. */
export const CAUSTIC_TILE = (() => {
  const size = 288;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rng = mulberry32(2026);
  for (let i = 0; i < 46; i += 1) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 12 + rng() * 30;
    // Wrap each blob across the edges so the tile repeats seamlessly.
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      const g = ctx.createRadialGradient(x + dx, y + dy, 1, x + dx, y + dy, r);
      g.addColorStop(0, 'rgba(190, 242, 255, 0.10)');
      g.addColorStop(1, 'rgba(190, 242, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return { c, w: size, h: size };
})();

/** A finished vignette for the whole field, painted once. */
export function makeVignette(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(width / 2, height / 2, height * 0.52, width / 2, height / 2, height * 1.02);
  g.addColorStop(0, 'rgba(2, 16, 22, 0)');
  g.addColorStop(0.75, 'rgba(2, 16, 22, 0.12)');
  g.addColorStop(1, 'rgba(2, 16, 22, 0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  return c;
}
