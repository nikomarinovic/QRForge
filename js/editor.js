/**
 * QRForge — Editor Engine
 * Handles live QR generation, customization, step nav, and export.
 */

// ─── State ────────────────────────────────────────────────
const state = {
  text:        'https://github.com/nikomarinovic',
  ecLevel:     'Q',
  size:        300,
  margin:      10,
  dotStyle:    'square',
  eyeStyle:    'square',
  useGradient: false,
  color:       '#c1e8ff',
  gradColor1:  '#3b82d4',
  gradColor2:  '#c1e8ff',
  gradDir:     'to bottom right',
  bgColor:     '#040d2e',
  transparentBg: false,
  logoDataUrl: null,
  logoSize:    20,
  exportScale: 2,
  exportFormat: 'png',
  exportFilename: 'qrforge-code',
  currentStep: 1,
};

let debounceTimer = null;

// ─── DOM Refs ────────────────────────────────────────────
const canvas        = document.getElementById('qrCanvas');
const ctx           = canvas.getContext('2d');
const updatingOverlay = document.getElementById('previewUpdating');

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindControls();
  bindStepNav();
  bindExport();
  renderQR();
  updateExportSummary();
});

// ─── Bind Controls ───────────────────────────────────────
function bindControls() {
  // Text
  document.getElementById('qrText').addEventListener('input', (e) => {
    state.text = e.target.value || ' ';
    scheduleRender();
  });

  // EC level
  bindChips('ecLevel', (val) => { state.ecLevel = val; scheduleRender(); });

  // Size
  const qrSizeInput = document.getElementById('qrSize');
  const sizeVal     = document.getElementById('sizeVal');
  const sizeLabel   = document.getElementById('sizeLabel');
  qrSizeInput.addEventListener('input', (e) => {
    state.size = parseInt(e.target.value);
    sizeVal.textContent = state.size;
    sizeLabel.textContent = state.size + 'px';
    scheduleRender();
  });

  // Margin
  const qrMarginInput = document.getElementById('qrMargin');
  const marginVal     = document.getElementById('marginVal');
  document.getElementById('marginLabel');
  qrMarginInput.addEventListener('input', (e) => {
    state.margin = parseInt(e.target.value);
    marginVal.textContent = state.margin;
    scheduleRender();
  });

  // Dot style
  bindChips('dotStyle', (val) => { state.dotStyle = val; scheduleRender(); });

  // Eye style
  bindChips('eyeStyle', (val) => { state.eyeStyle = val; scheduleRender(); });

  // Gradient toggle
  document.getElementById('useGradient').addEventListener('change', (e) => {
    state.useGradient = e.target.checked;
    document.getElementById('solidColorGroup').style.display = state.useGradient ? 'none' : '';
    document.getElementById('gradientGroup').style.display   = state.useGradient ? 'flex' : 'none';
    scheduleRender();
  });

  // QR color
  const qrColorPicker = document.getElementById('qrColor');
  const qrColorHex    = document.getElementById('qrColorHex');
  qrColorPicker.addEventListener('input', (e) => {
    state.color = e.target.value;
    qrColorHex.value = e.target.value;
    scheduleRender();
  });
  qrColorHex.addEventListener('input', (e) => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      state.color = val;
      qrColorPicker.value = val;
      scheduleRender();
    }
  });

  // Gradient colors
  const gradColor1Input = document.getElementById('gradColor1');
  const gradColor2Input = document.getElementById('gradColor2');
  gradColor1Input.addEventListener('input', (e) => {
    state.gradColor1 = e.target.value;
    updateGradPreview();
    scheduleRender();
  });
  gradColor2Input.addEventListener('input', (e) => {
    state.gradColor2 = e.target.value;
    updateGradPreview();
    scheduleRender();
  });
  document.getElementById('gradDirection').addEventListener('change', (e) => {
    state.gradDir = e.target.value;
    scheduleRender();
  });
  updateGradPreview();

  // Background color
  const bgColorPicker = document.getElementById('bgColor');
  const bgColorHex    = document.getElementById('bgColorHex');
  bgColorPicker.addEventListener('input', (e) => {
    state.bgColor = e.target.value;
    bgColorHex.value = e.target.value;
    scheduleRender();
  });
  bgColorHex.addEventListener('input', (e) => {
    const val = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      state.bgColor = val;
      bgColorPicker.value = val;
      scheduleRender();
    }
  });

  // Transparent BG
  document.getElementById('transparentBg').addEventListener('change', (e) => {
    state.transparentBg = e.target.checked;
    document.getElementById('bgColorGroup').style.opacity = state.transparentBg ? '0.4' : '1';
    document.getElementById('bgColorGroup').style.pointerEvents = state.transparentBg ? 'none' : '';
    scheduleRender();
  });

  // Logo upload
  const logoArea   = document.getElementById('logoUploadArea');
  const logoInput  = document.getElementById('logoInput');
  logoArea.addEventListener('click', () => logoInput.click());
  logoArea.addEventListener('dragover', (e) => { e.preventDefault(); logoArea.style.borderColor = 'var(--blue-400)'; });
  logoArea.addEventListener('dragleave', () => { logoArea.style.borderColor = ''; });
  logoArea.addEventListener('drop', (e) => {
    e.preventDefault();
    logoArea.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleLogoFile(file);
  });
  logoInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleLogoFile(e.target.files[0]);
  });

  document.getElementById('logoSize').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    state.logoSize = v;
    document.getElementById('logoSizeLabel').textContent = v + '%';
    document.getElementById('logoSizeVal').textContent = v + '%';
    scheduleRender();
  });

  document.getElementById('removeLogo').addEventListener('click', () => {
    state.logoDataUrl = null;
    document.getElementById('logoControls').style.display = 'none';
    document.getElementById('logoUploadArea').classList.remove('has-logo');
    document.getElementById('logoPreviewImg').style.display = 'none';
    document.getElementById('logoUploadIcon').style.display = '';
    document.getElementById('logoUploadText').textContent = 'Click to upload logo';
    document.getElementById('logoFileName').style.display = 'none';
    document.getElementById('logoInput').value = '';
    scheduleRender();
  });

  // Export scale
  bindChips('exportScale', (val) => { state.exportScale = parseInt(val); updateExportSummary(); });

  // Export format
  bindChips('exportFormat', (val) => {
    state.exportFormat = val;
    document.getElementById('copySvgBtn').style.display = val === 'svg' ? '' : 'none';
    updateExportSummary();
  });

  // Filename
  document.getElementById('exportFilename').addEventListener('input', (e) => {
    state.exportFilename = e.target.value || 'qrforge-code';
    updateExportSummary();
  });
}

// ─── Chip Helper ─────────────────────────────────────────
function bindChips(groupId, callback) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('[data-value]').forEach((chip) => {
    chip.addEventListener('click', () => {
      group.querySelectorAll('[data-value]').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
      callback(chip.dataset.value);
    });
  });
}

// ─── Step Nav ─────────────────────────────────────────────
function bindStepNav() {
  document.querySelectorAll('.step-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchStep(parseInt(btn.dataset.step)));
  });
  document.getElementById('nextToStep2').addEventListener('click', () => switchStep(2));
  document.getElementById('nextToStep3').addEventListener('click', () => switchStep(3));
  document.getElementById('backToStep1').addEventListener('click', () => switchStep(1));
  document.getElementById('backToStep2').addEventListener('click', () => switchStep(2));
}

function switchStep(step) {
  state.currentStep = step;

  document.querySelectorAll('.step-btn').forEach((btn) => {
    const active = parseInt(btn.dataset.step) === step;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active);
  });

  document.querySelectorAll('.step-panel').forEach((panel) => {
    const active = panel.id === `step-${step}`;
    panel.classList.toggle('active', active);
  });

  if (step === 3) updateExportSummary();
}

// ─── Logo File Handler ────────────────────────────────────
function handleLogoFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    state.logoDataUrl = e.target.result;
    const img = document.getElementById('logoPreviewImg');
    img.src = e.target.result;
    img.style.display = 'block';
    document.getElementById('logoUploadIcon').style.display = 'none';
    document.getElementById('logoUploadArea').classList.add('has-logo');
    document.getElementById('logoUploadText').textContent = 'Logo loaded';
    const fileNameEl = document.getElementById('logoFileName');
    fileNameEl.textContent = file.name;
    fileNameEl.style.display = '';
    document.getElementById('logoControls').style.display = 'flex';
    scheduleRender();
  };
  reader.readAsDataURL(file);
}

// ─── Gradient Preview Bar ─────────────────────────────────
function updateGradPreview() {
  const bar = document.getElementById('gradPreviewBar');
  if (bar) {
    bar.style.background = `linear-gradient(to right, ${state.gradColor1}, ${state.gradColor2})`;
  }
}

// ─── Debounced Render ─────────────────────────────────────
function scheduleRender() {
  if (debounceTimer) clearTimeout(debounceTimer);
  updatingOverlay.classList.add('show');
  debounceTimer = setTimeout(() => {
    renderQR();
    updatingOverlay.classList.remove('show');
  }, 120);
}

// ─── QR Render Engine ─────────────────────────────────────
function renderQR(targetCtx, targetSize) {
  const sz  = targetSize || state.size;
  const cv  = targetCtx ? null : canvas;

  if (!targetCtx) {
    canvas.width  = sz;
    canvas.height = sz;
  }

  const drawCtx = targetCtx || ctx;
  const size    = sz;

  // Get matrix from qrcodejs
  const tmp = document.createElement('div');
  tmp.style.cssText = 'position:absolute;visibility:hidden;top:-99999px;';
  document.body.appendChild(tmp);

  let matrix = null;
  try {
    const ecMap = { L: QRCode.CorrectLevel.L, M: QRCode.CorrectLevel.M, Q: QRCode.CorrectLevel.Q, H: QRCode.CorrectLevel.H };
    const qrObj = new QRCode(tmp, {
      text: state.text || ' ',
      width: 256, height: 256,
      correctLevel: ecMap[state.ecLevel] ?? QRCode.CorrectLevel.Q,
    });
    if (qrObj._oQRCode) matrix = qrObj._oQRCode.modules;
  } catch(e) {
    console.warn('QR generation error:', e);
  }
  document.body.removeChild(tmp);

  if (!matrix) return;

  const cells    = matrix.length;
  const margin   = state.margin;
  const cellSize = (size - margin * 2) / cells;

  // Draw background
  drawCtx.clearRect(0, 0, size, size);
  if (!state.transparentBg) {
    drawCtx.fillStyle = state.bgColor;
    drawCtx.fillRect(0, 0, size, size);
  }

  // Build fill style
  let dotFill;
  if (state.useGradient) {
    const g = drawCtx.createLinearGradient(
      0, 0,
      state.gradDir.includes('right') ? size : 0,
      state.gradDir.includes('bottom') ? size : 0
    );
    g.addColorStop(0, state.gradColor1);
    g.addColorStop(1, state.gradColor2);
    dotFill = g;
  } else {
    dotFill = state.color;
  }

  // Draw data dots (excluding eye regions)
  const eyeRegions = [
    { r: 0, c: 0, w: 7, h: 7 },
    { r: 0, c: cells - 7, w: 7, h: 7 },
    { r: cells - 7, c: 0, w: 7, h: 7 },
  ];
  function isEye(r, c) {
    return eyeRegions.some(
      (e) => r >= e.r && r < e.r + e.h && c >= e.c && c < e.c + e.w
    );
  }

  drawCtx.fillStyle = dotFill;

  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (!matrix[r][c]) continue;
      if (isEye(r, c)) continue;

      const x  = margin + c * cellSize;
      const y  = margin + r * cellSize;
      const s  = cellSize * 0.82;
      const ox = (cellSize - s) / 2;

      drawDot(drawCtx, x + ox, y + ox, s, state.dotStyle, dotFill);
    }
  }

  // Draw eyes
  eyeRegions.forEach(({ r, c }) => {
    drawEye(drawCtx, margin + c * cellSize, margin + r * cellSize, cellSize * 7, cellSize, dotFill, state.eyeStyle);
  });

  // Draw logo
  if (state.logoDataUrl) {
    drawLogo(drawCtx, size);
  }

  // Update labels
  const previewLabel = document.getElementById('previewSizeLabel');
  if (previewLabel) previewLabel.textContent = `${size} × ${size} px`;
  const ecLabel = document.getElementById('previewEcLabel');
  if (ecLabel) ecLabel.textContent = `Error correction: ${state.ecLevel}`;
}

// ─── Draw Dot ─────────────────────────────────────────────
function drawDot(ctx, x, y, size, style, fill) {
  ctx.fillStyle = fill;
  if (style === 'circle') {
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
  } else if (style === 'rounded') {
    const r = size * 0.35;
    roundRectPath(ctx, x, y, size, size, r);
    ctx.fill();
  } else if (style === 'classy') {
    // Diamond
    ctx.beginPath();
    ctx.moveTo(x + size/2, y);
    ctx.lineTo(x + size, y + size/2);
    ctx.lineTo(x + size/2, y + size);
    ctx.lineTo(x, y + size/2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(x, y, size, size);
  }
}

// ─── Draw Eye ─────────────────────────────────────────────
function drawEye(ctx, x, y, totalSize, cellSize, fill, style) {
  const gap = cellSize;
  const innerSide = cellSize * 3;
  const innerOff  = (totalSize - innerSide) / 2;

  // Clear eye area with bg
  if (!state.transparentBg) {
    ctx.fillStyle = state.bgColor;
  } else {
    ctx.clearRect(x, y, totalSize, totalSize);
  }
  if (!state.transparentBg) ctx.fillRect(x, y, totalSize, totalSize);

  ctx.fillStyle = fill;

  if (style === 'circle') {
    // Outer ring as arc
    ctx.beginPath();
    ctx.arc(x + totalSize/2, y + totalSize/2, totalSize/2, 0, Math.PI*2);
    ctx.fill();
    // Punch hole
    ctx.fillStyle = state.transparentBg ? 'rgba(0,0,0,0)' : state.bgColor;
    if (state.transparentBg) {
      ctx.globalCompositeOperation = 'destination-out';
    }
    ctx.beginPath();
    ctx.arc(x + totalSize/2, y + totalSize/2, totalSize/2 - gap, 0, Math.PI*2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // Inner dot
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x + totalSize/2, y + totalSize/2, innerSide/2, 0, Math.PI*2);
    ctx.fill();
  } else if (style === 'rounded') {
    const rOuter = cellSize * 1.4;
    roundRectPath(ctx, x, y, totalSize, totalSize, rOuter);
    ctx.fill();
    ctx.fillStyle = state.transparentBg ? 'rgba(0,0,0,0)' : state.bgColor;
    if (state.transparentBg) ctx.globalCompositeOperation = 'destination-out';
    roundRectPath(ctx, x + gap, y + gap, totalSize - gap*2, totalSize - gap*2, rOuter * 0.7);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = fill;
    roundRectPath(ctx, x + innerOff, y + innerOff, innerSide, innerSide, cellSize * 0.6);
    ctx.fill();
  } else if (style === 'leaf') {
    // Leaf: rounded top-left only
    roundRectPath(ctx, x, y, totalSize, totalSize, [cellSize*1.4, cellSize*0.3, cellSize*1.4, cellSize*0.3]);
    ctx.fill();
    ctx.fillStyle = state.transparentBg ? 'rgba(0,0,0,0)' : state.bgColor;
    if (state.transparentBg) ctx.globalCompositeOperation = 'destination-out';
    roundRectPath(ctx, x+gap, y+gap, totalSize-gap*2, totalSize-gap*2, [cellSize, cellSize*0.2, cellSize, cellSize*0.2]);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = fill;
    roundRectPath(ctx, x+innerOff, y+innerOff, innerSide, innerSide, cellSize*0.5);
    ctx.fill();
  } else {
    // Square
    ctx.fillRect(x, y, totalSize, totalSize);
    ctx.fillStyle = state.transparentBg ? 'rgba(0,0,0,0)' : state.bgColor;
    if (state.transparentBg) ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(x+gap, y+gap, totalSize-gap*2, totalSize-gap*2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = fill;
    ctx.fillRect(x+innerOff, y+innerOff, innerSide, innerSide);
  }
}

// ─── Draw Logo ────────────────────────────────────────────
function drawLogo(ctx, size) {
  const img = new Image();
  img.onload = () => {
    const logoSidePx = size * (state.logoSize / 100);
    const lx = (size - logoSidePx) / 2;
    const ly = (size - logoSidePx) / 2;

    // Rounded white bg behind logo
    const pad = logoSidePx * 0.12;
    ctx.fillStyle = state.transparentBg ? 'rgba(255,255,255,0.9)' : state.bgColor;
    roundRectPath(ctx, lx - pad, ly - pad, logoSidePx + pad*2, logoSidePx + pad*2, pad * 1.5);
    ctx.fill();

    ctx.drawImage(img, lx, ly, logoSidePx, logoSidePx);
  };
  img.src = state.logoDataUrl;
}

// ─── Round Rect Helper ────────────────────────────────────
function roundRectPath(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = [r, r, r, r];
  const [tl, tr, br, bl] = r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y,         x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h,     x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x,     y + h,     x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x,     y,         x + tl, y);
  ctx.closePath();
}

// ─── Export ───────────────────────────────────────────────
function bindExport() {
  document.getElementById('downloadBtn').addEventListener('click', handleDownload);
  document.getElementById('copySvgBtn').addEventListener('click', handleCopySvg);
}

function handleDownload() {
  const btn = document.getElementById('downloadBtn');
  btn.textContent = 'Preparing...';
  btn.disabled = true;

  setTimeout(() => {
    if (state.exportFormat === 'svg') {
      downloadSVG();
    } else {
      downloadPNG();
    }

    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M4 7l4 4 4-4M2 13h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Download QR Code`;
    btn.disabled = false;

    const toast = document.getElementById('downloadToast');
    toast.style.display = '';
    setTimeout(() => toast.style.display = 'none', 2800);
  }, 200);
}

function downloadPNG() {
  const scale = state.exportScale;
  const scaledSize = state.size * scale;

  const offscreen = document.createElement('canvas');
  offscreen.width  = scaledSize;
  offscreen.height = scaledSize;
  const offCtx = offscreen.getContext('2d');

  // Temporarily render at scaled size
  const origSize = state.size;
  renderQR(offCtx, scaledSize);

  setTimeout(() => {
    const link = document.createElement('a');
    link.download = `${state.exportFilename}.png`;
    link.href = offscreen.toDataURL('image/png');
    link.click();
  }, 200);
}

function downloadSVG() {
  const svg = buildSVG();
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${state.exportFilename}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function handleCopySvg() {
  const svg = buildSVG();
  navigator.clipboard.writeText(svg).then(() => {
    const btn = document.getElementById('copySvgBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/></svg> Copy SVG to Clipboard`;
    }, 2000);
  });
}

function buildSVG() {
  // Re-derive matrix for SVG
  const tmp = document.createElement('div');
  tmp.style.cssText = 'position:absolute;visibility:hidden;top:-99999px;';
  document.body.appendChild(tmp);
  let matrix = null;
  try {
    const ecMap = { L: QRCode.CorrectLevel.L, M: QRCode.CorrectLevel.M, Q: QRCode.CorrectLevel.Q, H: QRCode.CorrectLevel.H };
    const qr = new QRCode(tmp, { text: state.text || ' ', width: 256, height: 256, correctLevel: ecMap[state.ecLevel] });
    if (qr._oQRCode) matrix = qr._oQRCode.modules;
  } catch(e) {}
  document.body.removeChild(tmp);
  if (!matrix) return '';

  const size  = state.size;
  const cells = matrix.length;
  const margin = state.margin;
  const cellSize = (size - margin * 2) / cells;
  const s = cellSize * 0.82;
  const off = (cellSize - s) / 2;

  const bgRect = state.transparentBg ? '' : `<rect width="${size}" height="${size}" fill="${state.bgColor}"/>`;

  let color1 = state.useGradient ? state.gradColor1 : state.color;
  let color2 = state.useGradient ? state.gradColor2 : state.color;

  let defs = '';
  let fill = state.color;
  if (state.useGradient) {
    defs = `<defs><linearGradient id="qfg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/></linearGradient></defs>`;
    fill = 'url(#qfg)';
  }

  let dots = '';
  const eyeRegions = [
    { r: 0, c: 0 }, { r: 0, c: cells - 7 }, { r: cells - 7, c: 0 }
  ];
  function isEye(r, c) {
    return eyeRegions.some((e) => r >= e.r && r < e.r + 7 && c >= e.c && c < e.c + 7);
  }

  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (!matrix[r][c] || isEye(r, c)) continue;
      const x = margin + c * cellSize + off;
      const y = margin + r * cellSize + off;
      if (state.dotStyle === 'circle') {
        dots += `<circle cx="${x + s/2}" cy="${y + s/2}" r="${s/2}" fill="${fill}"/>`;
      } else if (state.dotStyle === 'rounded') {
        dots += `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s*0.35}" fill="${fill}"/>`;
      } else if (state.dotStyle === 'classy') {
        const cx = x + s/2, cy = y + s/2;
        dots += `<polygon points="${cx},${y} ${x+s},${cy} ${cx},${y+s} ${x},${cy}" fill="${fill}"/>`;
      } else {
        dots += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${fill}"/>`;
      }
    }
  }

  // Eyes in SVG
  eyeRegions.forEach(({ r, c }) => {
    const ex = margin + c * cellSize;
    const ey = margin + r * cellSize;
    const es = cellSize * 7;
    const gap = cellSize;
    const inner = cellSize * 3;
    const innerOff = (es - inner) / 2;
    const bg = state.transparentBg ? 'transparent' : state.bgColor;
    dots += `<rect x="${ex}" y="${ey}" width="${es}" height="${es}" rx="${cellSize*1.2}" fill="${fill}"/>`;
    dots += `<rect x="${ex+gap}" y="${ey+gap}" width="${es-gap*2}" height="${es-gap*2}" rx="${cellSize*0.7}" fill="${bg}"/>`;
    dots += `<rect x="${ex+innerOff}" y="${ey+innerOff}" width="${inner}" height="${inner}" rx="${cellSize*0.5}" fill="${fill}"/>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${defs}${bgRect}${dots}</svg>`;
}

// ─── Export Summary ───────────────────────────────────────
function updateExportSummary() {
  const el = document.getElementById('exportSummary');
  if (!el) return;
  const scaledSize = state.size * state.exportScale;
  const rows = [
    ['Format',      state.exportFormat.toUpperCase()],
    ['Dimensions',  `${scaledSize} × ${scaledSize} px`],
    ['Scale',       `${state.exportScale}×`],
    ['Filename',    `${state.exportFilename}.${state.exportFormat}`],
    ['Dot style',   state.dotStyle],
    ['EC Level',    state.ecLevel],
  ];
  el.innerHTML = rows.map(([k, v]) =>
    `<div style="display:flex;justify-content:space-between;"><span style="color:var(--text-muted)">${k}</span><span>${v}</span></div>`
  ).join('');
}
