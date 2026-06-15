// Canvas-based collage: take 1–4 photos, scatter them as polaroids
// on a peach paper background, return a JPEG blob ready to upload.

const CANVAS_SIZE = 900;
const PAPER_COLOR = "#fde2cf";

const TAPE_COLORS = ["#f7c5cc", "#ffd966", "#b8dbc4", "#ffb59a"];

export async function makeCollage(files) {
  const images = await Promise.all(files.map(loadImage));
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");

  // peach paper background
  ctx.fillStyle = PAPER_COLOR;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // soft radial wash
  const wash = ctx.createRadialGradient(
    CANVAS_SIZE * 0.2, CANVAS_SIZE * 0.2, 0,
    CANVAS_SIZE * 0.2, CANVAS_SIZE * 0.2, CANVAS_SIZE
  );
  wash.addColorStop(0, "rgba(255, 220, 195, 0.5)");
  wash.addColorStop(1, "rgba(247, 200, 169, 0.0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const layouts = layoutFor(images.length);

  layouts.forEach((slot, i) => {
    drawPolaroid(ctx, images[i], slot, i);
  });

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("collage failed"))),
      "image/jpeg",
      0.9
    );
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Hand-tuned positions per photo count — overlapping, tilted, scrapbook-y
function layoutFor(count) {
  const s = CANVAS_SIZE;
  if (count === 1) {
    return [{ cx: s/2, cy: s/2, w: 560, h: 560, rot: -3 }];
  }
  if (count === 2) {
    return [
      { cx: s*0.36, cy: s*0.48, w: 440, h: 440, rot: -8 },
      { cx: s*0.66, cy: s*0.55, w: 440, h: 440, rot: 6 },
    ];
  }
  if (count === 3) {
    return [
      { cx: s*0.30, cy: s*0.36, w: 380, h: 380, rot: -10 },
      { cx: s*0.70, cy: s*0.38, w: 380, h: 380, rot: 7 },
      { cx: s*0.50, cy: s*0.70, w: 400, h: 400, rot: -3 },
    ];
  }
  // 4
  return [
    { cx: s*0.30, cy: s*0.32, w: 340, h: 340, rot: -9 },
    { cx: s*0.70, cy: s*0.34, w: 340, h: 340, rot: 6 },
    { cx: s*0.32, cy: s*0.70, w: 340, h: 340, rot: 5 },
    { cx: s*0.70, cy: s*0.72, w: 340, h: 340, rot: -7 },
  ];
}

function drawPolaroid(ctx, img, slot, index) {
  const { cx, cy, w, h, rot } = slot;
  const borderTop = 18;
  const borderSide = 18;
  const borderBottom = 60;
  const pw = w + borderSide * 2;
  const ph = h + borderTop + borderBottom;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rot * Math.PI) / 180);

  // drop shadow
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;

  // polaroid white
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(-pw / 2, -ph / 2, pw, ph);

  ctx.shadowColor = "transparent";

  // crop the image to the slot rect
  const slotRatio = w / h;
  const imgRatio = img.width / img.height;
  let sx, sy, sw, sh;
  if (imgRatio > slotRatio) {
    sh = img.height;
    sw = sh * slotRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / slotRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);

  ctx.restore();

  // tape strip on top — drawn separately so its shadow doesn't darken the photo
  drawTape(ctx, cx, cy, ph, rot, TAPE_COLORS[index % TAPE_COLORS.length]);
}

function drawTape(ctx, cx, cy, polaroidHeight, polaroidRot, color) {
  const tw = 160;
  const th = 28;
  const tapeRot = polaroidRot - 6;
  ctx.save();
  ctx.translate(cx, cy - polaroidHeight / 2 + 4);
  ctx.rotate((tapeRot * Math.PI) / 180);
  ctx.globalAlpha = 0.88;
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = color;
  ctx.fillRect(-tw / 2, -th / 2, tw, th);
  ctx.restore();
}
