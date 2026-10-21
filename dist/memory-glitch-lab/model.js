// Native illustration: no model download, WebGL, or external image dependency.
const canvas = document.querySelector('#ghost-canvas');
let context;
let playful = false;
let observer;

function candy(x, y, rotation, color) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.fillStyle = color;
  for (const side of [-1, 1]) {
    context.beginPath();
    context.moveTo(side * 12, 0);
    context.lineTo(side * 27, -11);
    context.lineTo(side * 25, 10);
    context.closePath();
    context.fill();
  }
  context.beginPath();
  context.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#fff8e8aa';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(-5, -9);
  context.lineTo(5, 9);
  context.stroke();
  context.restore();
}

function draw() {
  if (!context) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / 400, canvas.height / 260);
  context.setTransform(scale, 0, 0, scale, (canvas.width - 400 * scale) / 2, (canvas.height - 260 * scale) / 2);
  const glow = context.createRadialGradient(200, 140, 15, 200, 140, 110);
  glow.addColorStop(0, '#b5a0ed35');
  glow.addColorStop(1, '#b5a0ed00');
  context.fillStyle = glow;
  context.fillRect(80, 20, 240, 230);
  context.fillStyle = '#09071233';
  context.beginPath();
  context.ellipse(200, 231, 63, 9, 0, 0, Math.PI * 2);
  context.fill();

  const body = context.createLinearGradient(155, 75, 235, 215);
  body.addColorStop(0, '#fffdf4');
  body.addColorStop(1, '#c7b9ef');
  context.fillStyle = body;
  context.beginPath();
  context.moveTo(137, 201);
  context.lineTo(141, 127);
  context.bezierCurveTo(141, 48, 259, 48, 259, 127);
  context.lineTo(263, 201);
  context.quadraticCurveTo(250, 189, 240, 202);
  context.quadraticCurveTo(228, 218, 215, 202);
  context.quadraticCurveTo(201, 186, 188, 203);
  context.quadraticCurveTo(174, 218, 162, 202);
  context.quadraticCurveTo(151, 191, 137, 201);
  context.fill();

  context.strokeStyle = '#30213f';
  context.fillStyle = '#30213f';
  context.lineWidth = 5;
  context.lineCap = 'round';
  for (const x of [181, 219]) {
    context.beginPath();
    if (playful) {
      context.moveTo(x - 5, 130);
      context.quadraticCurveTo(x, 122, x + 5, 130);
      context.stroke();
    } else {
      context.ellipse(x, 128, 5, 8, 0, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.beginPath();
  if (playful) {
    context.ellipse(200, 148, 10, 12, 0, 0, Math.PI * 2);
    context.fill();
  } else {
    context.arc(200, 142, 8, 0.1, Math.PI - 0.1);
    context.stroke();
  }
  context.fillStyle = '#f6a48b99';
  for (const x of [165, 235]) {
    context.beginPath();
    context.ellipse(x, 143, 8, 4, 0, 0, Math.PI * 2);
    context.fill();
  }

  candy(95, 161, -.4, '#f9a04c');
  candy(297, 189, .35, '#b792ee');
  context.strokeStyle = '#a797bc';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(299, 26);
  context.lineTo(299, 76);
  context.stroke();
  context.lineWidth = 2.5;
  for (const side of [-1, 1]) {
    for (let leg = 0; leg < 3; leg++) {
      context.beginPath();
      context.moveTo(299 + side * 6, 83 + leg * 3);
      context.lineTo(299 + side * 17, 76 + leg * 7);
      context.lineTo(299 + side * 22, 82 + leg * 7);
      context.stroke();
    }
  }
  context.fillStyle = '#a797bc';
  context.beginPath();
  context.ellipse(299, 85, 9, 11, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#30213f';
  for (const x of [296, 302]) {
    context.beginPath();
    context.arc(x, 83, 1.5, 0, Math.PI * 2);
    context.fill();
  }
}

export async function initModel() {
  if (context || !canvas) return;
  try {
    context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      draw();
    };
    observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement);
    resize();
  } catch {
    canvas.hidden = true;
    document.querySelector('#model-fallback').hidden = false;
  }
}

// Preserve the legacy lab's public interface and PNG export behavior.
export function setLaugh(value) {
  playful = Boolean(value);
  draw();
}

export function snapshotModel() {
  if (!context) return null;
  draw();
  return canvas;
}
