/**
 * QRForge — Landing Page Script
 * Hero QR demo, CTA QR, scroll reveal animations
 */

document.addEventListener('DOMContentLoaded', () => {
  initHeroQR();
  initScrollReveal();
});

// ─── Hero QR Demo ────────────────────────────────────────
function initHeroQR() {
  const heroCanvas = document.getElementById('heroQr');
  const ctaCanvas  = document.getElementById('ctaQr');

  // Draw a stylized QR on the hero canvas using a simple matrix approach
  const texts = ['https://qrforge.app', 'https://github.com/nikomarinovic', 'QRForge — Design your code'];
  let textIdx = 0;

  function drawDemoQR(canvas, text, opts = {}) {
    const size    = canvas.width;
    const ctx     = canvas.getContext('2d');
    const cells   = 21;
    const margin  = opts.margin ?? 2;
    const cell    = (size - margin * 2 * (size / cells)) / cells;

    ctx.clearRect(0, 0, size, size);

    // Background
    const bg = opts.bg ?? 'rgba(0,8,56,0.8)';
    ctx.fillStyle = bg;
    ctx.roundRect(0, 0, size, size, 12);
    ctx.fill();

    // Use qrcode lib to get the matrix
    const qr = new QRCode(document.createElement('div'), {
      text,
      width: size,
      height: size,
      correctLevel: QRCode.CorrectLevel.H,
    });
    const img = qr._oDrawing._elImage;

    // Fallback: draw a pattern visually
    drawStyledQR(ctx, size, text, opts);
  }

  function drawStyledQR(ctx, size, text, opts = {}) {
    // Create a temp QR via the lib in a hidden div
    const tmp = document.createElement('div');
    tmp.style.cssText = 'position:absolute;visibility:hidden;top:-9999px;';
    document.body.appendChild(tmp);

    let qrObj;
    try {
      qrObj = new QRCode(tmp, {
        text,
        width: 256,
        height: 256,
        correctLevel: QRCode.CorrectLevel.H,
      });
    } catch(e) {
      document.body.removeChild(tmp);
      return;
    }

    const qrImg = tmp.querySelector('img') || tmp.querySelector('canvas');

    setTimeout(() => {
      let matrix = null;

      // Extract the module matrix from the internal QR object
      if (qrObj._oQRCode) {
        matrix = qrObj._oQRCode.modules;
      }

      document.body.removeChild(tmp);

      if (!matrix) return;

      const cells = matrix.length;
      const margin = opts.margin ?? 3;
      const cellSize = (size - margin * 2) / cells;

      // Background
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = opts.bg ?? 'rgba(0,10,48,0.95)';
      roundRect(ctx, 0, 0, size, size, 12);
      ctx.fill();

      const grad = opts.gradient
        ? (() => {
            const g = ctx.createLinearGradient(0, 0, size, size);
            g.addColorStop(0, opts.color1 ?? '#3b82d4');
            g.addColorStop(1, opts.color2 ?? '#c1e8ff');
            return g;
          })()
        : (opts.color ?? '#c1e8ff');

      const style = opts.style ?? 'rounded';

      for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
          if (!matrix[r][c]) continue;
          const x = margin + c * cellSize;
          const y = margin + r * cellSize;
          const s = cellSize * 0.82;
          const off = (cellSize - s) / 2;

          ctx.fillStyle = grad;

          if (style === 'circle') {
            ctx.beginPath();
            ctx.arc(x + cellSize/2, y + cellSize/2, s/2, 0, Math.PI*2);
            ctx.fill();
          } else if (style === 'rounded') {
            roundRect(ctx, x + off, y + off, s, s, s * 0.35);
            ctx.fill();
          } else {
            ctx.fillRect(x + off, y + off, s, s);
          }
        }
      }

      // Overlay eye corners with accent style
      drawEyes(ctx, matrix, cells, size, margin, cellSize, opts);

    }, 80);
  }

  function drawEyes(ctx, matrix, cells, size, margin, cellSize, opts) {
    const eyePositions = [
      { row: 0, col: 0 },
      { row: 0, col: cells - 7 },
      { row: cells - 7, col: 0 },
    ];
    const eyeColor = opts.eyeColor ?? (opts.gradient ? opts.color1 ?? '#3b82d4' : opts.color ?? '#c1e8ff');
    ctx.fillStyle = opts.bg ?? 'rgba(0,10,48,0.95)';
    eyePositions.forEach(({ row, col }) => {
      const x = margin + col * cellSize;
      const y = margin + row * cellSize;
      const s = cellSize * 7;
      // Clear and redraw eye
      ctx.fillRect(x, y, s, s);
      // Outer ring
      ctx.fillStyle = eyeColor;
      roundRect(ctx, x, y, s, s, cellSize * 1.2);
      ctx.fill();
      // Inner white gap
      ctx.fillStyle = opts.bg ?? 'rgba(0,10,48,0.95)';
      const gap = cellSize;
      roundRect(ctx, x + gap, y + gap, s - gap*2, s - gap*2, cellSize * 0.7);
      ctx.fill();
      // Center square
      ctx.fillStyle = eyeColor;
      const inner = cellSize * 3;
      const iOff = (s - inner) / 2;
      roundRect(ctx, x + iOff, y + iOff, inner, inner, cellSize * 0.6);
      ctx.fill();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Draw hero QR
  if (heroCanvas) {
    drawStyledQR(heroCanvas.getContext('2d') ? heroCanvas : heroCanvas, heroCanvas.width, texts[0], {
      gradient: true,
      color1: '#3b82d4',
      color2: '#c1e8ff',
      style: 'rounded',
      bg: 'rgba(4,13,46,0.97)',
    });
    heroCanvas.__drawFn = (text) => drawStyledQR(heroCanvas, heroCanvas.width, text, {
      gradient: true, color1: '#3b82d4', color2: '#c1e8ff', style: 'rounded', bg: 'rgba(4,13,46,0.97)',
    });

    // Cycle through demo texts
    setInterval(() => {
      textIdx = (textIdx + 1) % texts.length;
      if (heroCanvas.__drawFn) heroCanvas.__drawFn(texts[textIdx]);
    }, 3500);
  }

  // Draw CTA QR
  if (ctaCanvas) {
    drawStyledQR(ctaCanvas, ctaCanvas.width, 'https://github.com/nikomarinovic', {
      gradient: true,
      color1: '#1a3f75',
      color2: '#7bc8f0',
      style: 'circle',
      bg: 'rgba(4,13,46,0.97)',
    });
  }
}

// ─── Scroll Reveal ───────────────────────────────────────
function initScrollReveal() {
  const els = document.querySelectorAll('.scroll-reveal');
  if (!els.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Stagger siblings that are all entering at once
          const delay = entry.target.dataset.delay ?? 0;
          setTimeout(() => entry.target.classList.add('revealed'), parseInt(delay));
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );

  // Stagger cards within the grid
  document.querySelectorAll('.features-grid .feature-card').forEach((card, i) => {
    card.dataset.delay = i * 80;
  });

  els.forEach((el) => observer.observe(el));
}
