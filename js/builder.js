/**
 * QRForge Builder — Engine v4
 * - No hex text inputs: color pickers only, label shows value read-only
 * - Context preview on steps 1 & 2, QR preview on steps 3 & 4
 * - All customization: dots, eyes, gradient, text labels, frames, logo
 * - Real-time canvas render + SVG export
 */

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
const S = {
  step:    1,
  qrType:  'website',
  qrText:  'https://qrforge.app',

  dotStyle:  'square',
  eyeStyle:  'square',

  useGradient: false,
  dotColor:    '#1a3f75',
  bgColor:     '#ffffff',
  gradColor1:  '#1a3f75',
  gradColor2:  '#2563b0',
  gradDir:     'diagonal',
  bgGrad:      '#ffffff',
  transBg:     false,

  topText:       '',
  bottomText:    '',
  labelFontSize: 14,
  labelColor:    '#1d1d1f',

  frameStyle: 'none',
  framePad:   16,

  canvasSize:  260,
  margin:      12,
  ecLevel:     'Q',

  logoDataUrl: null,
  logoSize:    22,

  exportScale: 2,
  filename:    'qrforge-code',
};

const fieldValues = {};
let renderTimer = null;

// ═══════════════════════════════════════════════════════
// QR TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════
const QR_TYPES = {
  website: {
    label: 'Website',
    fields: [{ id:'url', label:'Website URL', type:'url', placeholder:'https://your-website.com', required:true }],
    encode: f => f.url || 'https://example.com'
  },
  wifi: {
    label: 'WiFi',
    fields: [
      { id:'ssid',       label:'Network Name (SSID)', type:'text',   placeholder:'My Network',   required:true },
      { id:'password',   label:'Password',            type:'text',   placeholder:'password123' },
      { id:'encryption', label:'Encryption',          type:'select', options:['WPA','WEP','None'], required:true },
      { id:'hidden',     label:'Hidden network',      type:'select', options:['false','true'] }
    ],
    encode: f => {
      const enc = f.encryption === 'None' ? 'nopass' : (f.encryption || 'WPA');
      const pwd = enc === 'nopass' ? '' : `P:${f.password || ''};`;
      return `WIFI:T:${enc};S:${f.ssid || ''};${pwd}H:${f.hidden === 'true' ? 'true' : 'false'};;`;
    }
  },
  email: {
    label: 'Email',
    fields: [
      { id:'to',      label:'To',      type:'email',    placeholder:'recipient@email.com', required:true },
      { id:'subject', label:'Subject', type:'text',     placeholder:'Hello there' },
      { id:'body',    label:'Message', type:'textarea', placeholder:'Write your message…' }
    ],
    encode: f => {
      const p = [];
      if (f.subject) p.push(`subject=${encodeURIComponent(f.subject)}`);
      if (f.body)    p.push(`body=${encodeURIComponent(f.body)}`);
      return `mailto:${f.to || ''}${p.length ? '?' + p.join('&') : ''}`;
    }
  },
  phone: {
    label: 'Phone',
    fields: [{ id:'phone', label:'Phone Number', type:'tel', placeholder:'+1 234 567 8900', required:true }],
    encode: f => `tel:${(f.phone || '').replace(/\s/g,'')}`
  },
  sms: {
    label: 'SMS',
    fields: [
      { id:'phone',   label:'Phone Number', type:'tel',      placeholder:'+1 234 567 8900', required:true },
      { id:'message', label:'Message',      type:'textarea', placeholder:'Your SMS text…' }
    ],
    encode: f => `SMSTO:${(f.phone || '').replace(/\s/g,'')}:${f.message || ''}`
  },
  vcard: {
    label: 'vCard',
    fields: [
      { id:'firstName', label:'First Name', type:'text',  placeholder:'Jane',               required:true },
      { id:'lastName',  label:'Last Name',  type:'text',  placeholder:'Smith' },
      { id:'phone',     label:'Phone',      type:'tel',   placeholder:'+1 234 567 8900' },
      { id:'email',     label:'Email',      type:'email', placeholder:'jane@company.com' },
      { id:'company',   label:'Company',    type:'text',  placeholder:'Acme Inc.' },
      { id:'title',     label:'Job Title',  type:'text',  placeholder:'Designer' },
      { id:'website',   label:'Website',    type:'url',   placeholder:'https://jane.design' }
    ],
    encode: f => {
      const lines = ['BEGIN:VCARD','VERSION:3.0',
        `N:${f.lastName||''};${f.firstName||''};;;`,
        `FN:${[f.firstName,f.lastName].filter(Boolean).join(' ')}`];
      if (f.phone)   lines.push(`TEL:${f.phone}`);
      if (f.email)   lines.push(`EMAIL:${f.email}`);
      if (f.company) lines.push(`ORG:${f.company}`);
      if (f.title)   lines.push(`TITLE:${f.title}`);
      if (f.website) lines.push(`URL:${f.website}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }
  },
  text: {
    label: 'Text',
    fields: [{ id:'text', label:'Text Content', type:'textarea', placeholder:'Enter any text…', required:true }],
    encode: f => f.text || ' '
  },
  social: {
    label: 'Social',
    fields: [
      { id:'platform', label:'Platform', type:'select', options:['Instagram','Twitter/X','LinkedIn','TikTok','YouTube','Facebook','GitHub','Other'] },
      { id:'url',      label:'Profile URL', type:'url', placeholder:'https://instagram.com/username', required:true }
    ],
    encode: f => f.url || 'https://example.com'
  },
  pdf: {
    label: 'PDF',
    fields: [
      { id:'url',   label:'PDF File URL',   type:'url',  placeholder:'https://example.com/doc.pdf', required:true },
      { id:'title', label:'Document Title', type:'text', placeholder:'Company Brochure' }
    ],
    encode: f => f.url || 'https://example.com/doc.pdf',
    hint: 'The QR code links directly to your hosted PDF file.'
  },
  video: {
    label: 'Video',
    fields: [{ id:'url', label:'Video URL', type:'url', placeholder:'https://youtube.com/watch?v=…', required:true }],
    encode: f => f.url || 'https://youtube.com'
  }
};

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  bindTypeCards();
  bindNav();
  bindDesignControls();
  bindExportControls();
  buildContentForm('website');
  renderQR();
  renderContextPreview();
});

// ═══════════════════════════════════════════════════════
// STEP NAVIGATION
// ═══════════════════════════════════════════════════════
function goTo(step) {
  S.step = step;
  document.querySelectorAll('.step-pane').forEach(p => p.classList.remove('active'));
  document.getElementById(`pane-${step}`).classList.add('active');

  // Stepper nodes
  for (let i = 1; i <= 4; i++) {
    const n = document.getElementById(`sn-${i}`);
    n.classList.remove('active','done');
    if (i === step)     n.classList.add('active');
    else if (i < step)  n.classList.add('done');
  }
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`sc-${i}`).classList.toggle('filled', i < step);
  }

  // Update preview column data-step for CSS-driven visibility
  document.getElementById('previewCol').dataset.step = step;

  document.querySelector('.panel-col').scrollTop = 0;
  if (step === 4) buildDlSummary();
}

function bindNav() {
  document.getElementById('s1Next').addEventListener('click', () => { buildContentForm(S.qrType); goTo(2); });
  document.getElementById('s2Back').addEventListener('click', () => goTo(1));
  document.getElementById('s2Next').addEventListener('click', () => { collectContentFields(); goTo(3); });
  document.getElementById('s3Back').addEventListener('click', () => goTo(2));
  document.getElementById('s3Next').addEventListener('click', () => goTo(4));
  document.getElementById('s4Back').addEventListener('click', () => goTo(3));
  document.getElementById('startOver').addEventListener('click', () => {
    S.qrType = 'website';
    document.querySelectorAll('.type-card').forEach(c => c.classList.toggle('active', c.dataset.type === 'website'));
    buildContentForm('website');
    goTo(1);
  });
}

// ═══════════════════════════════════════════════════════
// TYPE CARDS
// ═══════════════════════════════════════════════════════
function bindTypeCards() {
  document.querySelectorAll('.type-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.type-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      S.qrType = card.dataset.type;
      const def = QR_TYPES[S.qrType];
      document.getElementById('previewTypeChip').textContent = def.label;
      document.getElementById('previewTypeTxt').textContent  = def.label;
      buildContentForm(S.qrType);
      renderContextPreview();
    });
  });
}

// ═══════════════════════════════════════════════════════
// CONTENT FORM
// ═══════════════════════════════════════════════════════
function buildContentForm(type) {
  const def  = QR_TYPES[type];
  const form = document.getElementById('contentForm');
  const sub  = document.getElementById('contentPaneSub');
  sub.textContent = def.hint || `Fill in the details for your ${def.label} QR code.`;
  if (!fieldValues[type]) fieldValues[type] = {};

  let html = '';
  def.fields.forEach(field => {
    const val = fieldValues[type][field.id] || '';
    const optLabel = field.required ? '' : ' <span class="cf-opt">(optional)</span>';
    if (field.type === 'textarea') {
      html += `<div class="cf-group"><label class="cf-lbl" for="cf_${field.id}">${field.label}${optLabel}</label>
        <textarea class="cf-input cf-textarea" id="cf_${field.id}" data-field="${field.id}" placeholder="${field.placeholder||''}">${escHtml(val)}</textarea></div>`;
    } else if (field.type === 'select') {
      const opts = field.options.map(o => `<option value="${o}"${val===o?' selected':''}>${o}</option>`).join('');
      html += `<div class="cf-group"><label class="cf-lbl" for="cf_${field.id}">${field.label}${optLabel}</label>
        <select class="cf-select-styled" id="cf_${field.id}" data-field="${field.id}">${opts}</select></div>`;
    } else {
      html += `<div class="cf-group"><label class="cf-lbl" for="cf_${field.id}">${field.label}${optLabel}</label>
        <input type="${field.type}" class="cf-input" id="cf_${field.id}" data-field="${field.id}" placeholder="${field.placeholder||''}" value="${escHtml(val)}" /></div>`;
    }
  });
  form.innerHTML = html;
  form.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('input',  () => { collectContentFields(); renderContextPreview(); });
    el.addEventListener('change', () => { collectContentFields(); renderContextPreview(); });
  });
  collectContentFields();
}

function collectContentFields() {
  const type = S.qrType;
  const def  = QR_TYPES[type];
  if (!fieldValues[type]) fieldValues[type] = {};
  def.fields.forEach(field => {
    const el = document.getElementById(`cf_${field.id}`);
    if (el) fieldValues[type][field.id] = el.value;
  });
  S.qrText = def.encode(fieldValues[type]) || ' ';
  scheduleRender();
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ═══════════════════════════════════════════════════════
// CONTEXT PREVIEW
// ═══════════════════════════════════════════════════════
function renderContextPreview() {
  const container = document.getElementById('ctxPreview');
  const fv = fieldValues[S.qrType] || {};
  let html = '';

  switch (S.qrType) {
    case 'website':
    case 'pdf':
    case 'video': {
      const url = fv.url || 'your-website.com';
      const urlShort = url.replace(/^https?:\/\//,'').substring(0,30);
      html = `
        <span class="ctx-label">Preview — How it opens</span>
        <div class="phone-mock">
          <div class="phone-screen">
            <div class="phone-status">
              <span class="phone-status-time">9:41</span>
              <div class="phone-status-icons">
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none"><rect x="0" y="4" width="2" height="4" rx="0.5" fill="#1d1d1f"/><rect x="3" y="2" width="2" height="6" rx="0.5" fill="#1d1d1f"/><rect x="6" y="0" width="2" height="8" rx="0.5" fill="#1d1d1f"/><rect x="9" y="0" width="3" height="8" rx="0.5" fill="#1d1d1f" opacity="0.3"/></svg>
              </div>
            </div>
            <div class="phone-browser">
              <div class="phone-url-bar">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4a3 3 0 106 0 3 3 0 00-6 0zM6 6l1.5 1.5" stroke="#aeaeb2" stroke-width="1" stroke-linecap="round"/></svg>
                <span class="phone-url-text">${escHtml(urlShort)}</span>
              </div>
              <div class="phone-content">
                <div class="phone-site-hero"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/><path d="M14 4c-3 3-5 7-5 10s2 7 5 10M14 4c3 3 5 7 5 10s-2 7-5 10M4 14h20" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-linecap="round"/></svg></div>
                <div class="phone-site-text-lg"></div>
                <div class="phone-site-text-md"></div>
                <div class="phone-site-text-md" style="width:80%"></div>
                <div class="phone-site-text-sm"></div>
              </div>
            </div>
          </div>
        </div>`;
      break;
    }
    case 'wifi': {
      const ssid = fv.ssid || 'My Network';
      const enc  = fv.encryption || 'WPA';
      const pw   = fv.password ? '••••••••' : 'None';
      html = `
        <span class="ctx-label">Preview — Connection card</span>
        <div class="wifi-card">
          <div class="wifi-icon-row">
            <div class="wifi-icon-bg">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M2 7.5C5.6 4.2 9 3 11 3s5.4 1.2 9 4.5" stroke="#1a3f75" stroke-width="1.6" stroke-linecap="round"/><path d="M5 11c1.7-1.7 3.7-2.5 6-2.5s4.3.8 6 2.5" stroke="#1a3f75" stroke-width="1.6" stroke-linecap="round"/><path d="M8 14.5c.8-.8 1.8-1.3 3-1.3s2.2.5 3 1.3" stroke="#1a3f75" stroke-width="1.6" stroke-linecap="round"/><circle cx="11" cy="18" r="1.2" fill="#1a3f75"/></svg>
            </div>
            <div><div class="wifi-name">${escHtml(ssid)}</div><div class="wifi-sub">${enc} Network</div></div>
          </div>
          <div class="wifi-divider"></div>
          <div class="wifi-password-row"><span class="wifi-pw-label">Password</span><span class="wifi-pw-val">${pw}</span></div>
          <div class="wifi-connect-btn">Join Network</div>
        </div>`;
      break;
    }
    case 'vcard': {
      const first = fv.firstName || 'Jane';
      const last  = fv.lastName  || 'Smith';
      const title = fv.title     || 'Designer';
      const co    = fv.company   || 'Acme Inc.';
      const phone = fv.phone || '';
      const email = fv.email || '';
      const initial = (first[0]||'?').toUpperCase();
      html = `
        <span class="ctx-label">Preview — Contact Card</span>
        <div class="vcard-mock">
          <div class="vcard-header">
            <div class="vcard-avatar">${escHtml(initial)}</div>
            <div>
              <div class="vcard-name">${escHtml(first)} ${escHtml(last)}</div>
              <div class="vcard-title-text">${escHtml(title)}${co ? ` · ${escHtml(co)}` : ''}</div>
            </div>
          </div>
          <div class="vcard-body">
            ${phone ? `<div class="vcard-row"><div class="vcard-row-icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2h3l1 3-1.5 1.5a9 9 0 004 4L11 9l3 1v3a1 1 0 01-1 1C6.5 14 0 7.5 0 1a1 1 0 011-1h3" stroke="#1a3f75" stroke-width="1.2" fill="none"/></svg></div><span class="vcard-row-val">${escHtml(phone)}</span></div>` : ''}
            ${email ? `<div class="vcard-row"><div class="vcard-row-icon"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1" stroke="#1a3f75" stroke-width="1.2"/><path d="M1 5l6 3.5L13 5" stroke="#1a3f75" stroke-width="1.2" stroke-linecap="round"/></svg></div><span class="vcard-row-val">${escHtml(email)}</span></div>` : ''}
            ${!phone && !email ? '<div class="vcard-row" style="color:#aeaeb2;font-size:0.8rem">Fill in contact details to preview</div>' : ''}
          </div>
        </div>`;
      break;
    }
    case 'social': {
      const plat   = fv.platform || 'Instagram';
      const handle = (fv.url||'').replace(/^https?:\/\//,'').split('/').filter(Boolean).pop() || 'username';
      html = `
        <span class="ctx-label">Preview — Profile Link</span>
        <div class="social-mock">
          <div class="social-header">
            <div class="social-avatar-circle"><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="11" r="5" stroke="white" stroke-width="1.5"/><path d="M4 25c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg></div>
            <div class="social-handle">@${escHtml(handle)}</div>
          </div>
          <div class="social-links">
            <div class="social-link-item">${escHtml(plat)} Profile</div>
            <div class="social-link-item" style="opacity:0.5">Link 2</div>
            <div class="social-link-item" style="opacity:0.3">Link 3</div>
          </div>
        </div>`;
      break;
    }
    case 'email': {
      const to      = fv.to      || 'recipient@email.com';
      const subject = fv.subject || '(no subject)';
      html = `
        <span class="ctx-label">Preview — Email Compose</span>
        <div class="msg-card">
          <div class="msg-card-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="2" y="5" width="18" height="13" rx="2" stroke="#1a3f75" stroke-width="1.5"/><path d="M2 8l9 5.5L20 8" stroke="#1a3f75" stroke-width="1.5" stroke-linecap="round"/></svg></div>
          <div class="msg-card-title">New Email</div>
          <div class="msg-card-sub">To: <strong>${escHtml(to)}</strong><br/>Subject: ${escHtml(subject)}</div>
          <div class="msg-card-btn">Open Mail App</div>
        </div>`;
      break;
    }
    case 'phone': {
      const num = fv.phone || '+1 234 567 8900';
      html = `
        <span class="ctx-label">Preview — Phone Dial</span>
        <div class="msg-card">
          <div class="msg-card-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 3h4l2 5-2 2a14 14 0 006 6l2-2 5 2v4a2 2 0 01-2 2C10 22 0 12 0 2a2 2 0 012-2h2" stroke="#1a3f75" stroke-width="1.5" stroke-linecap="round"/></svg></div>
          <div class="msg-card-title">Call</div>
          <div class="msg-card-sub" style="font-size:1.1rem;font-weight:600;color:#1d1d1f;font-family:var(--mono)">${escHtml(num)}</div>
          <div class="msg-card-btn">Dial Number</div>
        </div>`;
      break;
    }
    case 'sms': {
      const phone = fv.phone   || '+1 234 567 8900';
      const msg   = fv.message || '(no message)';
      html = `
        <span class="ctx-label">Preview — SMS Message</span>
        <div class="msg-card">
          <div class="msg-card-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 5a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H7l-4 3V5z" stroke="#1a3f75" stroke-width="1.5" stroke-linejoin="round"/></svg></div>
          <div class="msg-card-title">Text Message</div>
          <div class="msg-card-sub">To: <strong>${escHtml(phone)}</strong><br/>"${escHtml(msg.substring(0,60))}${msg.length>60?'…':''}"</div>
          <div class="msg-card-btn">Open Messages</div>
        </div>`;
      break;
    }
    case 'text': {
      const txt = fv.text || 'Your text will appear here.';
      html = `
        <span class="ctx-label">Preview — Plain Text</span>
        <div class="msg-card">
          <div class="msg-card-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 6h14M4 10h14M4 14h8" stroke="#1a3f75" stroke-width="1.5" stroke-linecap="round"/></svg></div>
          <div class="msg-card-title">Text Content</div>
          <div class="msg-card-sub" style="font-size:0.875rem;line-height:1.55">${escHtml(txt.substring(0,120))}${txt.length>120?'…':''}</div>
        </div>`;
      break;
    }
    default:
      html = `<span class="ctx-label">Live Preview</span>`;
  }

  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// DESIGN CONTROLS — color pickers only, no hex inputs
// ═══════════════════════════════════════════════════════
function bindDesignControls() {

  // Dot style
  document.querySelectorAll('.dot-o').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dot-o').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.dotStyle = btn.dataset.value;
      scheduleRender();
    });
  });

  // Eye style
  document.querySelectorAll('.eye-o').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.eye-o').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.eyeStyle = btn.dataset.value;
      scheduleRender();
    });
  });

  // Gradient toggle
  document.getElementById('useGradient').addEventListener('change', e => {
    S.useGradient = e.target.checked;
    document.getElementById('solidBlock').style.display = S.useGradient ? 'none' : '';
    document.getElementById('gradBlock').style.display  = S.useGradient ? '' : 'none';
    scheduleRender();
  });

  // Solid color pickers — no hex text fields, just update label
  bindColorPicker('dotColor', 'dotColorLabel', v => { S.dotColor = v; });
  bindColorPicker('bgColor',  'bgColorLabel',  v => { S.bgColor  = v; });

  // Gradient color pickers
  bindColorPicker('grad1',  'grad1Label',  v => { S.gradColor1 = v; updateGradBar(); });
  bindColorPicker('grad2',  'grad2Label',  v => { S.gradColor2 = v; updateGradBar(); });
  bindColorPicker('bgGrad', 'bgGradLabel', v => { S.bgGrad = v; });

  document.getElementById('gradDir').addEventListener('change', e => { S.gradDir = e.target.value; scheduleRender(); });
  updateGradBar();

  // Transparent BG
  document.getElementById('transBg').addEventListener('change', e => { S.transBg = e.target.checked; scheduleRender(); });

  // Text labels
  document.getElementById('topText').addEventListener('input', e => { S.topText = e.target.value; scheduleRender(); });
  document.getElementById('bottomText').addEventListener('input', e => { S.bottomText = e.target.value; scheduleRender(); });

  const labelFontRange = document.getElementById('labelFontSize');
  const labelFontDisp  = document.getElementById('labelFontSizeDisplay');
  labelFontRange.addEventListener('input', () => {
    S.labelFontSize = parseInt(labelFontRange.value);
    labelFontDisp.textContent = S.labelFontSize + 'px';
    scheduleRender();
  });
  bindColorPicker('labelColor', 'labelColorLabel', v => { S.labelColor = v; });

  // Frame options
  document.querySelectorAll('.frame-o').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.frame-o').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.frameStyle = btn.dataset.value;
      document.getElementById('framePaddingRow').style.display = S.frameStyle !== 'none' ? '' : 'none';
      scheduleRender();
    });
  });
  const framePadRange = document.getElementById('framePad');
  const framePadDisp  = document.getElementById('framePadDisplay');
  framePadRange.addEventListener('input', () => {
    S.framePad = parseInt(framePadRange.value);
    framePadDisp.textContent = S.framePad + 'px';
    scheduleRender();
  });

  // Canvas size
  const sizeRange = document.getElementById('sizeRange');
  const sizeDisp  = document.getElementById('sizeDisplay');
  sizeRange.addEventListener('input', () => {
    S.canvasSize = parseInt(sizeRange.value);
    sizeDisp.textContent = S.canvasSize;
    scheduleRender();
  });

  // Margin
  const marginRange = document.getElementById('marginRange');
  const marginDisp  = document.getElementById('marginDisplay');
  marginRange.addEventListener('input', () => {
    S.margin = parseInt(marginRange.value);
    marginDisp.textContent = S.margin;
    scheduleRender();
  });

  // Error correction
  document.querySelectorAll('.ec-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ec-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.ecLevel = btn.dataset.val;
      document.getElementById('previewEcTxt').textContent = `EC: ${S.ecLevel}`;
      scheduleRender();
    });
  });

  // Logo
  const logoDrop = document.getElementById('logoDrop');
  const logoFile = document.getElementById('logoFileInput');
  logoDrop.addEventListener('click', () => logoFile.click());
  logoDrop.addEventListener('dragover',  e => { e.preventDefault(); logoDrop.style.borderColor='var(--accent)'; });
  logoDrop.addEventListener('dragleave', () => { logoDrop.style.borderColor=''; });
  logoDrop.addEventListener('drop', e => {
    e.preventDefault(); logoDrop.style.borderColor='';
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) loadLogo(f);
  });
  logoFile.addEventListener('change', e => { if (e.target.files[0]) loadLogo(e.target.files[0]); });

  document.getElementById('logoRemoveBtn').addEventListener('click', e => {
    e.stopPropagation();
    S.logoDataUrl = null;
    document.getElementById('logoDropIdle').style.display   = '';
    document.getElementById('logoDropLoaded').style.display = 'none';
    document.getElementById('logoSizeRow').style.display    = 'none';
    logoDrop.classList.remove('has-logo');
    logoFile.value = '';
    scheduleRender();
  });

  const logoSizeRange = document.getElementById('logoSizeRange');
  const logoSizeDisp  = document.getElementById('logoSizeDisplay');
  logoSizeRange.addEventListener('input', () => {
    S.logoSize = parseInt(logoSizeRange.value);
    logoSizeDisp.textContent = `${S.logoSize}%`;
    scheduleRender();
  });
}

/**
 * Bind a color picker input.
 * Updates a read-only label span (showing the hex value) — no text input field.
 */
function bindColorPicker(pickId, labelId, cb) {
  const p = document.getElementById(pickId);
  const l = document.getElementById(labelId);
  if (!p) return;
  p.addEventListener('input', () => {
    if (l) l.textContent = p.value;
    cb(p.value);
    scheduleRender();
  });
}

function updateGradBar() {
  const b = document.getElementById('gradPreviewBar');
  if (b) b.style.background = `linear-gradient(to right,${S.gradColor1},${S.gradColor2})`;
}

function loadLogo(file) {
  const r = new FileReader();
  r.onload = e => {
    S.logoDataUrl = e.target.result;
    document.getElementById('logoThumb').src             = e.target.result;
    document.getElementById('logoInfoName').textContent  = file.name;
    document.getElementById('logoDropIdle').style.display   = 'none';
    document.getElementById('logoDropLoaded').style.display = '';
    document.getElementById('logoSizeRow').style.display    = '';
    document.getElementById('logoDrop').classList.add('has-logo');
    scheduleRender();
  };
  r.readAsDataURL(file);
}

// ═══════════════════════════════════════════════════════
// RENDER ENGINE
// ═══════════════════════════════════════════════════════
function scheduleRender() {
  const shimmer = document.getElementById('shimmer');
  if (shimmer) shimmer.classList.add('updating');
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderQR();
    if (shimmer) shimmer.classList.remove('updating');
  }, 90);
}

function getMatrix(text, ec) {
  const tmp = document.createElement('div');
  tmp.style.cssText = 'position:absolute;visibility:hidden;top:-9999px;';
  document.body.appendChild(tmp);
  let matrix = null;
  try {
    const ecMap = {L:QRCode.CorrectLevel.L,M:QRCode.CorrectLevel.M,Q:QRCode.CorrectLevel.Q,H:QRCode.CorrectLevel.H};
    const qr = new QRCode(tmp, {text:text||' ',width:256,height:256,correctLevel:ecMap[ec]||QRCode.CorrectLevel.Q});
    if (qr._oQRCode) matrix = qr._oQRCode.modules;
  } catch(e) {}
  document.body.removeChild(tmp);
  return matrix;
}

function renderQR(extCtx, extSize) {
  const canvas = document.getElementById('qrCanvas');
  const matrix = getMatrix(S.qrText, S.ecLevel);
  if (!matrix) return;

  const hasTop    = !!S.topText;
  const hasBot    = !!S.bottomText;
  const labelPad  = S.labelFontSize + 14;
  const framePad  = S.frameStyle !== 'none' ? S.framePad : 0;
  const baseSize  = extSize || S.canvasSize;

  const totalW = baseSize + framePad * 2;
  const totalH = baseSize + framePad * 2 + (hasTop ? labelPad : 0) + (hasBot ? labelPad : 0);

  const ctx = extCtx || canvas.getContext('2d');
  if (!extCtx) {
    canvas.width  = totalW;
    canvas.height = totalH;
    const displayMax = 320;
    const ratio = Math.min(displayMax / totalW, displayMax / totalH, 1);
    canvas.style.width  = Math.round(totalW * ratio) + 'px';
    canvas.style.height = Math.round(totalH * ratio) + 'px';
  }

  ctx.clearRect(0, 0, totalW, totalH);
  const bg = S.transBg ? null : (S.useGradient ? S.bgGrad : S.bgColor);

  // Draw background / frame
  if (bg) {
    if (S.frameStyle === 'rounded') {
      rrect(ctx, 0, 0, totalW, totalH, 20);
      ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1.5;
      rrect(ctx, 0, 0, totalW, totalH, 20); ctx.stroke();
    } else if (S.frameStyle === 'shadow') {
      ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
      ctx.fillStyle = bg;
      rrect(ctx, 2, 2, totalW-4, totalH-4, 12); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    } else if (S.frameStyle === 'plain') {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, totalW, totalH);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(0, 0, totalW, totalH);
    } else {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, totalW, totalH);
    }
  }

  // Top text
  const topOffsetY = hasTop ? labelPad : 0;
  if (hasTop) {
    ctx.font      = `600 ${S.labelFontSize}px Inter, -apple-system, sans-serif`;
    ctx.fillStyle = S.labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(S.topText, totalW / 2, labelPad / 2 + framePad);
  }

  // QR area
  const qrX = framePad;
  const qrY = framePad + topOffsetY;
  const qrW = baseSize;
  const qrH = baseSize;

  const cells    = matrix.length;
  const margin   = S.margin;
  const cellSize = (qrW - margin * 2) / cells;
  const ds       = cellSize * 0.82;
  const dOff     = (cellSize - ds) / 2;

  // Fill style
  let fill;
  if (S.useGradient) {
    const g = ctx.createLinearGradient(
      qrX, qrY,
      S.gradDir === 'vertical'   ? qrX     : qrX + qrW,
      S.gradDir === 'horizontal' ? qrY     : qrY + qrH
    );
    g.addColorStop(0, S.gradColor1);
    g.addColorStop(1, S.gradColor2);
    fill = g;
  } else {
    fill = S.dotColor;
  }

  const eyeZones = [{r:0,c:0},{r:0,c:cells-7},{r:cells-7,c:0}];
  const isEye = (r,c) => eyeZones.some(e => r>=e.r && r<e.r+7 && c>=e.c && c<e.c+7);

  ctx.fillStyle = fill;
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      if (!matrix[r][c] || isEye(r,c)) continue;
      const x = qrX + margin + c * cellSize + dOff;
      const y = qrY + margin + r * cellSize + dOff;
      drawDot(ctx, x, y, ds, S.dotStyle, fill);
    }
  }
  eyeZones.forEach(({r,c}) => {
    drawEye(ctx, qrX + margin + c*cellSize, qrY + margin + r*cellSize, cellSize*7, cellSize, fill, bg);
  });

  // Logo
  if (S.logoDataUrl) {
    const img = new Image();
    img.onload = () => {
      const lsPx = qrW * (S.logoSize / 100);
      const lx   = qrX + (qrW - lsPx) / 2;
      const ly   = qrY + (qrH - lsPx) / 2;
      const pad  = lsPx * 0.14;
      const bgF  = S.transBg ? 'rgba(255,255,255,0.95)' : (S.useGradient ? S.bgGrad : S.bgColor);
      ctx.fillStyle = bgF;
      rrect(ctx, lx-pad, ly-pad, lsPx+pad*2, lsPx+pad*2, pad*1.6);
      ctx.fill();
      ctx.drawImage(img, lx, ly, lsPx, lsPx);
    };
    img.src = S.logoDataUrl;
  }

  // Bottom text
  if (hasBot) {
    ctx.font      = `600 ${S.labelFontSize}px Inter, -apple-system, sans-serif`;
    ctx.fillStyle = S.labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(S.bottomText, totalW / 2, qrY + qrH + labelPad / 2);
  }

  // Update meta labels
  document.getElementById('previewDimsTxt').textContent = `${baseSize} × ${baseSize}`;
  document.getElementById('previewEcTxt').textContent   = `EC: ${S.ecLevel}`;
}

// ── Draw helpers ─────────────────────────────────────────────
function drawDot(ctx, x, y, s, style, fill) {
  ctx.fillStyle = fill;
  if (style === 'circle') {
    ctx.beginPath(); ctx.arc(x+s/2, y+s/2, s/2, 0, Math.PI*2); ctx.fill();
  } else if (style === 'rounded') {
    rrect(ctx, x, y, s, s, s*0.36); ctx.fill();
  } else if (style === 'classy') {
    ctx.beginPath();
    ctx.moveTo(x+s/2,y); ctx.lineTo(x+s,y+s/2); ctx.lineTo(x+s/2,y+s); ctx.lineTo(x,y+s/2);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.fillRect(x, y, s, s);
  }
}

function drawEye(ctx, x, y, totalSize, cellSize, fill, bg) {
  const gap = cellSize, inner = cellSize*3, innerOff = (totalSize-inner)/2;
  const style = S.eyeStyle;

  if (!S.transBg && bg) { ctx.fillStyle=bg; ctx.fillRect(x,y,totalSize,totalSize); }
  else ctx.clearRect(x, y, totalSize, totalSize);

  ctx.fillStyle = fill;

  if (style === 'circle') {
    ctx.beginPath(); ctx.arc(x+totalSize/2, y+totalSize/2, totalSize/2, 0, Math.PI*2); ctx.fill();
    if (S.transBg) ctx.globalCompositeOperation='destination-out';
    ctx.fillStyle = S.transBg ? 'rgba(0,0,0,1)' : bg;
    ctx.beginPath(); ctx.arc(x+totalSize/2, y+totalSize/2, totalSize/2-gap, 0, Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle=fill; ctx.beginPath(); ctx.arc(x+totalSize/2, y+totalSize/2, inner/2, 0, Math.PI*2); ctx.fill();
  } else if (style === 'rounded') {
    const rO=cellSize*1.4;
    ctx.fillStyle=fill; rrect(ctx,x,y,totalSize,totalSize,rO); ctx.fill();
    if (S.transBg){ctx.globalCompositeOperation='destination-out';ctx.fillStyle='rgba(0,0,0,1)';}else ctx.fillStyle=bg;
    rrect(ctx,x+gap,y+gap,totalSize-gap*2,totalSize-gap*2,rO*0.65); ctx.fill();
    ctx.globalCompositeOperation='source-over'; ctx.fillStyle=fill;
    rrect(ctx,x+innerOff,y+innerOff,inner,inner,cellSize*0.6); ctx.fill();
  } else if (style === 'leaf') {
    ctx.fillStyle=fill; rrect(ctx,x,y,totalSize,totalSize,[cellSize*1.4,cellSize*0.3,cellSize*1.4,cellSize*0.3]); ctx.fill();
    if (S.transBg){ctx.globalCompositeOperation='destination-out';ctx.fillStyle='rgba(0,0,0,1)';}else ctx.fillStyle=bg;
    rrect(ctx,x+gap,y+gap,totalSize-gap*2,totalSize-gap*2,[cellSize,cellSize*0.2,cellSize,cellSize*0.2]); ctx.fill();
    ctx.globalCompositeOperation='source-over'; ctx.fillStyle=fill;
    rrect(ctx,x+innerOff,y+innerOff,inner,inner,cellSize*0.5); ctx.fill();
  } else {
    ctx.fillStyle=fill; ctx.fillRect(x,y,totalSize,totalSize);
    if (S.transBg){ctx.globalCompositeOperation='destination-out';ctx.fillStyle='rgba(0,0,0,1)';}else ctx.fillStyle=bg;
    ctx.fillRect(x+gap,y+gap,totalSize-gap*2,totalSize-gap*2);
    ctx.globalCompositeOperation='source-over'; ctx.fillStyle=fill;
    ctx.fillRect(x+innerOff,y+innerOff,inner,inner);
  }
}

function rrect(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = [r,r,r,r];
  const [tl,tr,br,bl] = r;
  ctx.beginPath();
  ctx.moveTo(x+tl,y); ctx.lineTo(x+w-tr,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+tr);
  ctx.lineTo(x+w,y+h-br);
  ctx.quadraticCurveTo(x+w,y+h,x+w-br,y+h);
  ctx.lineTo(x+bl,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-bl);
  ctx.lineTo(x,y+tl);
  ctx.quadraticCurveTo(x,y,x+tl,y);
  ctx.closePath();
}

// ═══════════════════════════════════════════════════════
// SVG EXPORT
// ═══════════════════════════════════════════════════════
function buildSVG() {
  const matrix = getMatrix(S.qrText, S.ecLevel);
  if (!matrix) return '';
  const size  = S.canvasSize, cells = matrix.length;
  const m     = S.margin;
  const cs    = (size - m*2) / cells;
  const ds    = cs * 0.82;
  const dOff  = (cs - ds) / 2;
  const bg    = S.transBg ? null : (S.useGradient ? S.bgGrad : S.bgColor);
  const bgR   = bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : '';
  let fill    = S.dotColor;
  let defs    = '';
  if (S.useGradient) {
    const x2 = S.gradDir==='vertical' ? 0 : 1;
    const y2 = S.gradDir==='horizontal' ? 0 : 1;
    defs = `<defs><linearGradient id="qfg" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0%" stop-color="${S.gradColor1}"/><stop offset="100%" stop-color="${S.gradColor2}"/></linearGradient></defs>`;
    fill = 'url(#qfg)';
  }
  const ez = [{r:0,c:0},{r:0,c:cells-7},{r:cells-7,c:0}];
  const isE = (r,c) => ez.some(e => r>=e.r && r<e.r+7 && c>=e.c && c<e.c+7);
  let d = '';
  for (let r=0;r<cells;r++) for (let c=0;c<cells;c++) {
    if (!matrix[r][c]||isE(r,c)) continue;
    const x=m+c*cs+dOff, y=m+r*cs+dOff;
    if (S.dotStyle==='circle') d+=`<circle cx="${x+ds/2}" cy="${y+ds/2}" r="${ds/2}" fill="${fill}"/>`;
    else if (S.dotStyle==='rounded') d+=`<rect x="${x}" y="${y}" width="${ds}" height="${ds}" rx="${ds*0.36}" fill="${fill}"/>`;
    else if (S.dotStyle==='classy') d+=`<polygon points="${x+ds/2},${y} ${x+ds},${y+ds/2} ${x+ds/2},${y+ds} ${x},${y+ds/2}" fill="${fill}"/>`;
    else d+=`<rect x="${x}" y="${y}" width="${ds}" height="${ds}" fill="${fill}"/>`;
  }
  ez.forEach(({r,c})=>{
    const ex=m+c*cs,ey=m+r*cs,es=cs*7,gap=cs,inn=cs*3,io=(es-inn)/2;
    const eb=bg||'transparent';
    d+=`<rect x="${ex}" y="${ey}" width="${es}" height="${es}" rx="${cs*1.2}" fill="${fill}"/>`;
    d+=`<rect x="${ex+gap}" y="${ey+gap}" width="${es-gap*2}" height="${es-gap*2}" rx="${cs*0.7}" fill="${eb}"/>`;
    d+=`<rect x="${ex+io}" y="${ey+io}" width="${inn}" height="${inn}" rx="${cs*0.5}" fill="${fill}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${defs}${bgR}${d}</svg>`;
}

// ═══════════════════════════════════════════════════════
// EXPORT CONTROLS
// ═══════════════════════════════════════════════════════
function bindExportControls() {
  document.querySelectorAll('.sc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sc-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.exportScale = parseInt(btn.dataset.val);
      buildDlSummary();
    });
  });
  document.getElementById('dlName').addEventListener('input', e => {
    S.filename = e.target.value || 'qrforge-code';
    buildDlSummary();
  });
  document.getElementById('dlPng').addEventListener('click',  downloadPNG);
  document.getElementById('dlSvg').addEventListener('click',  downloadSVG);
  document.getElementById('dlCopy').addEventListener('click', copySVG);
}

function buildDlSummary() {
  const el = document.getElementById('dlSummary');
  if (!el) return;
  const px = S.canvasSize * S.exportScale;
  const rows = [
    ['Type',   QR_TYPES[S.qrType].label],
    ['Size',   `${px} × ${px} px`],
    ['Scale',  `${S.exportScale}×`],
    ['Dots',   S.dotStyle],
    ['EC',     S.ecLevel],
    ['Shape',  'Square'],
  ];
  el.innerHTML = rows.map(([k,v])=>`<div class="dl-sum-row"><span class="dl-sum-key">${k}</span><span class="dl-sum-val">${v}</span></div>`).join('');
}

function showToast(msg) {
  const t = document.getElementById('dlToast');
  document.getElementById('dlToastMsg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

function downloadPNG() {
  const scale  = S.exportScale;
  const size   = S.canvasSize * scale;
  const off    = document.createElement('canvas');
  off.width = off.height = size;
  renderQR(off.getContext('2d'), size);
  setTimeout(() => {
    const a = document.createElement('a');
    a.download = `${S.filename}.png`;
    a.href = off.toDataURL('image/png');
    a.click();
    showToast('PNG downloaded!');
  }, 300);
}

function downloadSVG() {
  const svg  = buildSVG();
  const blob = new Blob([svg], {type:'image/svg+xml'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.download = `${S.filename}.svg`; a.href = url; a.click();
  URL.revokeObjectURL(url);
  showToast('SVG downloaded!');
}

function copySVG() {
  navigator.clipboard.writeText(buildSVG()).then(
    () => showToast('SVG copied to clipboard!'),
    () => showToast('Copy failed — try download.')
  );
}
