/* =========================================================
   DevTemple Tools — Shared Script
   Pages: /convert-images  /color-picker  /image-compressor
   ========================================================= */

/* ---------- Page-load overlay ---------- */
(function () {
  const overlay = document.createElement('div');
  overlay.id = 'dt-loading-overlay';
  overlay.innerHTML = `
    <div class="dt-loader-box">
      <img src="/assets/images/logo.png" alt="DevTemple" class="dt-loader-logo">
      <div class="dt-spinner"></div>
      <p class="dt-loader-text">Preparing engine…</p>
    </div>`;
  document.body.appendChild(overlay);

  function hideOverlay() {
    overlay.classList.add('dt-fade-out');
    setTimeout(() => overlay.remove(), 500);
  }

  if (document.readyState === 'complete') {
    setTimeout(hideOverlay, 600);
  } else {
    window.addEventListener('load', () => setTimeout(hideOverlay, 600));
  }
})();

/* ---------- Ripple helper ---------- */
function attachRipple(el) {
  el.addEventListener('click', function (e) {
    const r = document.createElement('span');
    r.className = 'dt-ripple';
    const rect = el.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
    el.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('button, .convert-btn, #download-btn').forEach(attachRipple);
});

/* ========================================================= */
/*   IMAGE CONVERTER  (/convert-images)                      */
/* ========================================================= */
if (window.location.href.includes('convert-images') || window.location.pathname === '/convert-images' || window.location.pathname === '/convert-images/') {

  const sidebar      = document.getElementById('sidebar');
  const sidebarToggle= document.getElementById('sidebarToggle');
  const overlay      = document.getElementById('overlay');

  function toggleSidebar() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    sidebarToggle.classList.toggle('active');
  }
  sidebarToggle.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', toggleSidebar);

  const fileInput       = document.getElementById('file-input');
  const uploadSection   = document.getElementById('upload-section');
  const converterSection= document.getElementById('converter-section');
  const previewImage    = document.getElementById('preview-image');
  const fileNameEl      = document.getElementById('file-name');
  const resetBtn        = document.getElementById('reset-btn');
  const formatButtons   = document.querySelectorAll('.format-buttons button');
  const convertBtn      = document.getElementById('convert-btn');
  const qualityBox      = document.getElementById('quality-box');
  const qualityRange    = document.getElementById('quality-range');
  const qualityValue    = document.getElementById('quality-value');
  const downloadSection = document.getElementById('download-section');
  const downloadBtn     = document.getElementById('download-btn');

  // Disable upload until engine ready
  const topUploadBtn = document.querySelector('.top-btn');
  if (topUploadBtn) topUploadBtn.disabled = true;
  window.addEventListener('load', () => {
    setTimeout(() => { if (topUploadBtn) topUploadBtn.disabled = false; }, 650);
  });

  let selectedFile = null;
  let outputFormat = 'png';
  let convertedUrl = null;

  // Drag & drop
  const uploadArea = document.getElementById('upload-area');
  if (uploadArea) {
    uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', e => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) handleFile(file);
    });
  }

  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    handleFile(file);
  });

  function handleFile(file) {
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = ev => { previewImage.src = ev.target.result; };
    reader.readAsDataURL(file);
    fileNameEl.textContent = file.name;
    uploadSection.classList.add('hidden');
    converterSection.classList.remove('hidden');
    converterSection.classList.add('dt-slide-in');
    downloadSection.classList.add('hidden');
  }

  resetBtn.addEventListener('click', () => {
    fileInput.value = '';
    selectedFile = null;
    convertedUrl = null;
    converterSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    downloadSection.classList.add('hidden');
  });

  formatButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      formatButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      outputFormat = btn.dataset.format;
      qualityBox.classList.toggle('hidden', outputFormat === 'png');
      downloadSection.classList.add('hidden');
    });
  });

  qualityRange.addEventListener('input', () => { qualityValue.textContent = qualityRange.value; });

  convertBtn.addEventListener('click', () => {
    if (!selectedFile) return;
    convertBtn.innerHTML = `<span class="btn-spinner"></span> Converting…`;
    convertBtn.disabled = true;

    const img = new Image();
    img.src = previewImage.src;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);

      const mimeType = `image/${outputFormat}`;
      const quality  = outputFormat === 'png' ? 1 : qualityRange.value / 100;

      canvas.toBlob(blob => {
        convertedUrl = URL.createObjectURL(blob);
        downloadSection.classList.remove('hidden');
        downloadSection.classList.add('dt-slide-in');
        convertBtn.innerHTML = `<svg class="svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Convert Image`;
        convertBtn.disabled = false;
      }, mimeType, quality);
    };
  });

  downloadBtn.addEventListener('click', () => {
    if (!convertedUrl) return;
    const a = document.createElement('a');
    a.href = convertedUrl;
    const baseName = selectedFile.name.split('.').slice(0, -1).join('.') || 'converted';
    a.download = `${baseName}.${outputFormat}`;
    a.click();
  });
}

/* ========================================================= */
/*   COLOR PICKER  (/color-picker)                           */
/* ========================================================= */
else if (window.location.href.includes('color-picker') || window.location.pathname.startsWith('/color-picker')) {

  // ------- Utilities -------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }
  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  const svCanvas   = document.getElementById('svCanvas');
  const hueCanvas  = document.getElementById('hueCanvas');
  const svCtx      = svCanvas.getContext('2d');
  const hueCtx     = hueCanvas.getContext('2d');
  const colorInput = document.getElementById('colorInput');
  const hexInput   = document.getElementById('hexInput');
  const rgbInput   = document.getElementById('rgbInput');
  const hslInput   = document.getElementById('hslInput');
  const rgbaInput  = document.getElementById('rgbaInput');
  const previewBox = document.getElementById('previewBox');
  const historyWrap       = document.getElementById('history');
  const extractedPalette  = document.getElementById('extractedPalette');
  const extractedCount    = document.getElementById('extractedCount');
  const imageFile         = document.getElementById('imageFile');
  const uploadCard        = document.getElementById('uploadCard');
  const generatedWrap     = document.getElementById('generated');

  let hue = 217, sat = 80, val = 60, alpha = 1;

  function drawHue() {
    const g = hueCtx.createLinearGradient(0, 0, 0, hueCanvas.height);
    for (let i = 0; i <= 360; i += 10) g.addColorStop(i / 360, `hsl(${i},100%,50%)`);
    hueCtx.fillStyle = g;
    hueCtx.fillRect(0, 0, hueCanvas.width, hueCanvas.height);
  }
  function drawSV(h) {
    const w = svCanvas.width, ht = svCanvas.height;
    svCtx.fillStyle = `hsl(${h},100%,50%)`;
    svCtx.fillRect(0, 0, w, ht);
    const sg = svCtx.createLinearGradient(0, 0, w, 0);
    sg.addColorStop(0, '#fff'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    svCtx.fillStyle = sg; svCtx.fillRect(0, 0, w, ht);
    const vg = svCtx.createLinearGradient(0, 0, 0, ht);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, '#000');
    svCtx.fillStyle = vg; svCtx.fillRect(0, 0, w, ht);
  }
  function updateFromHSV() {
    const h = hue/360, s = sat/100, v = val/100;
    const i = Math.floor(h*6), f = h*6-i;
    const p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
    let r, g, b;
    switch(i%6){case 0:r=v;g=t;b=p;break;case 1:r=q;g=v;b=p;break;case 2:r=p;g=v;b=t;break;case 3:r=p;g=q;b=v;break;case 4:r=t;g=p;b=v;break;case 5:r=v;g=p;b=q;break;}
    r=Math.round(r*255);g=Math.round(g*255);b=Math.round(b*255);
    const hex = rgbToHex(r,g,b);
    colorInput.value = hex;
    hexInput.value   = hex;
    rgbInput.value   = `rgb(${r}, ${g}, ${b})`;
    const [hh,ss,ll] = rgbToHsl(r,g,b);
    hslInput.value   = `hsl(${hh}, ${ss}%, ${ll}%)`;
    rgbaInput.value  = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    previewBox.style.background = hex;
    previewBox.textContent = hex.toUpperCase();
  }

  drawHue(); drawSV(hue); updateFromHSV();

  function handleHueEvent(evt) {
    const rect = hueCanvas.getBoundingClientRect();
    const y = clamp((evt.touches?evt.touches[0].clientY:evt.clientY)-rect.top, 0, rect.height);
    hue = Math.round((y/rect.height)*360);
    drawSV(hue); updateFromHSV();
  }
  hueCanvas.addEventListener('mousedown', e => {
    handleHueEvent(e);
    const mv = e1 => handleHueEvent(e1);
    const up = () => { window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); };
    window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up);
  });
  hueCanvas.addEventListener('touchstart', e => {
    handleHueEvent(e);
    const mv = e1 => handleHueEvent(e1);
    const en = () => { window.removeEventListener('touchmove',mv); window.removeEventListener('touchend',en); };
    window.addEventListener('touchmove',mv); window.addEventListener('touchend',en);
  });

  function handleSvEvent(evt) {
    const rect = svCanvas.getBoundingClientRect();
    const x = clamp((evt.touches?evt.touches[0].clientX:evt.clientX)-rect.left, 0, rect.width);
    const y = clamp((evt.touches?evt.touches[0].clientY:evt.clientY)-rect.top, 0, rect.height);
    sat = Math.round((x/rect.width)*100);
    val = Math.round((1-(y/rect.height))*100);
    updateFromHSV();
  }
  svCanvas.addEventListener('mousedown', e => {
    handleSvEvent(e);
    const mv = e1 => handleSvEvent(e1);
    const up = () => { window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up); };
    window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up);
  });
  svCanvas.addEventListener('touchstart', e => {
    handleSvEvent(e);
    const mv = e1 => handleSvEvent(e1);
    const en = () => { window.removeEventListener('touchmove',mv); window.removeEventListener('touchend',en); };
    window.addEventListener('touchmove',mv); window.addEventListener('touchend',en);
  });

  colorInput.addEventListener('input', e => {
    const [r,g,b] = hexToRgb(e.target.value);
    const [h,s,l] = rgbToHsl(r,g,b);
    hue=h; sat=s; val=l; drawSV(hue); updateFromHSV();
  });
  hexInput.addEventListener('change', e => {
    let v = e.target.value.trim();
    if (!v.startsWith('#')) v='#'+v;
    try {
      const [r,g,b] = hexToRgb(v);
      const [h,s,l] = rgbToHsl(r,g,b);
      hue=h; sat=s; val=l; drawSV(hue); updateFromHSV();
    } catch(err){ console.error('Invalid hex'); }
  });

  document.querySelectorAll('.copy-btn').forEach(b => b.addEventListener('click', async () => {
    const map = {hex:hexInput.value, rgb:rgbInput.value, hsl:hslInput.value, rgba:rgbaInput.value};
    try {
      await navigator.clipboard.writeText(map[b.dataset.copy]);
      b.textContent='Copied!';
      setTimeout(()=>b.textContent='Copy',900);
    } catch(e){ alert('Copy failed'); }
  }));

  document.getElementById('copyHexLarge').addEventListener('click', () => navigator.clipboard.writeText(hexInput.value).then(()=>alert('HEX copied')));
  document.getElementById('copyRgbLarge').addEventListener('click', () => navigator.clipboard.writeText(rgbInput.value).then(()=>alert('RGB copied')));

  function loadHistory(){ try{ return JSON.parse(localStorage.getItem('devtem_colors'))||[]; }catch(e){return[];} }
  function saveHistory(a){ localStorage.setItem('devtem_colors',JSON.stringify(a)); }
  function renderHistory(){
    historyWrap.innerHTML='';
    loadHistory().forEach(hex=>{
      const d=document.createElement('div');
      d.className='item'; d.style.background=hex; d.title=hex;
      d.addEventListener('click',()=>setColorFromHex(hex));
      historyWrap.appendChild(d);
    });
  }
  function pushHistory(hex){
    let a=loadHistory().filter(h=>h.toLowerCase()!==hex.toLowerCase());
    a.unshift(hex); if(a.length>12)a=a.slice(0,12);
    saveHistory(a); renderHistory();
  }
  document.getElementById('clearHistory').addEventListener('click',()=>{ localStorage.removeItem('devtem_colors'); renderHistory(); });
  renderHistory();

  document.getElementById('addToPalette').addEventListener('click',()=>pushHistory(hexInput.value));

  function setColorFromHex(hex){
    const [r,g,b]=hexToRgb(hex); const [h,s,l]=rgbToHsl(r,g,b);
    hue=h; sat=s; val=l; drawSV(hue); updateFromHSV();
  }

  function generateTriadic(hex){
    const [r,g,b]=hexToRgb(hex); const hsl=rgbToHsl(r,g,b);
    return [hex,...[1,2].map(i=>{ const h=(hsl[0]+i*120)%360; const [rr,gg,bb]=hslToRgb(h,hsl[1],hsl[2]); return rgbToHex(rr,gg,bb); })];
  }
  function generateAnalogous(hex){
    const [r,g,b]=hexToRgb(hex); const hsl=rgbToHsl(r,g,b);
    return [-2,-1,0,1,2].map(i=>{ const h=(hsl[0]+i*20+360)%360; const [rr,gg,bb]=hslToRgb(h,hsl[1],clamp(hsl[2]+i*4,0,100)); return rgbToHex(rr,gg,bb); });
  }
  function generateComplementary(hex){
    const [r,g,b]=hexToRgb(hex); const hsl=rgbToHsl(r,g,b);
    const [r2,g2,b2]=hslToRgb((hsl[0]+180)%360,hsl[1],hsl[2]);
    return [hex,rgbToHex(r2,g2,b2)];
  }

  document.getElementById('generateTriadic').addEventListener('click',()=>renderGenerated(generateTriadic(hexInput.value)));
  document.getElementById('generateAnalogous').addEventListener('click',()=>renderGenerated(generateAnalogous(hexInput.value)));
  document.getElementById('generateComplementary').addEventListener('click',()=>renderGenerated(generateComplementary(hexInput.value)));

  function renderGenerated(list){
    generatedWrap.innerHTML='';
    list.forEach(h=>{
      const s=document.createElement('div');
      s.className='swatch'; s.style.background=h; s.textContent=h.replace('#','').toUpperCase();
      s.title=h; s.addEventListener('click',()=>setColorFromHex(h));
      generatedWrap.appendChild(s);
    });
  }

  function extractColorsFromImage(img, maxColors=8){
    const canvas=document.createElement('canvas');
    const ctx=canvas.getContext('2d');
    let w=img.naturalWidth,h=img.naturalHeight;
    const max=200;
    if(Math.max(w,h)>max){ const r=max/Math.max(w,h); w=Math.round(w*r); h=Math.round(h*r); }
    canvas.width=w; canvas.height=h;
    ctx.drawImage(img,0,0,w,h);
    const data=ctx.getImageData(0,0,w,h).data;
    const counts={};
    for(let i=0;i<data.length;i+=4){
      if(data[i+3]<125) continue;
      const key=((data[i]>>4)&0xF)<<8|((data[i+1]>>4)&0xF)<<4|((data[i+2]>>4)&0xF);
      counts[key]=(counts[key]||0)+1;
    }
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,maxColors).map(([k])=>{
      const v=parseInt(k);
      return rgbToHex(((v>>8)&0xF)<<4,((v>>4)&0xF)<<4,(v&0xF)<<4);
    });
  }

  imageFile.addEventListener('change', e=>{
    const f=e.target.files[0]; if(!f) return;
    const url=URL.createObjectURL(f);
    const img=new Image(); img.crossOrigin='Anonymous';
    img.onload=function(){
      const cols=extractColorsFromImage(img,8);
      extractedPalette.innerHTML='';
      cols.forEach(c=>{
        const d=document.createElement('div');
        d.className='swatch'; d.style.background=c; d.title=c;
        d.addEventListener('click',()=>{ setColorFromHex(c); pushHistory(c); });
        extractedPalette.appendChild(d);
      });
      extractedCount.textContent=cols.length+' colors';
      URL.revokeObjectURL(url);
    };
    img.src=url;
  });
  uploadCard.addEventListener('click',()=>imageFile.click());
  renderGenerated([hexInput.value]);

  const sidebarToggle=document.getElementById('sidebarToggle');
  const sidebar=document.getElementById('sidebar');
  const overlayEl=document.getElementById('overlay');
  sidebarToggle.addEventListener('click',()=>{ sidebar.classList.toggle('active'); overlayEl.classList.toggle('active'); });
  overlayEl.addEventListener('click',()=>{ sidebar.classList.remove('active'); overlayEl.classList.remove('active'); });

  renderHistory(); updateFromHSV();

  // Enable top-btn after engine ready
  const topBtnColor = document.querySelector('.top-btn');
  if (topBtnColor) topBtnColor.disabled = true;
  window.addEventListener('load', () => {
    setTimeout(() => { if (topBtnColor) topBtnColor.disabled = false; }, 650);
  });
}

/* ========================================================= */
/*   IMAGE COMPRESSOR  (/image-compressor)                   */
/* ========================================================= */
else if (window.location.href.includes('image-compressor') || window.location.pathname.startsWith('/image-compressor')) {

  const sidebar      = document.getElementById('sidebar');
  const sidebarToggle= document.getElementById('sidebarToggle');
  const overlay      = document.getElementById('overlay');

  function toggleSidebar() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    sidebarToggle.classList.toggle('active');
  }
  sidebarToggle.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', toggleSidebar);

  const fileInput       = document.getElementById('file-input');
  const uploadSection   = document.getElementById('upload-section');
  const converterSection= document.getElementById('converter-section');
  const fileNameEl      = document.getElementById('file-name');
  const downloadSection = document.getElementById('download-section');
  const downloadLink    = document.getElementById('download-btn');
  const compressBtn     = document.getElementById('convert-btn');
  const qualityRange    = document.getElementById('quality-range');
  const qualityValue    = document.getElementById('quality-value');
  const resetBtn        = document.getElementById('reset-btn');
  const sizeComparison  = document.getElementById('size-comparison');

  // Quality slider live update
  if (qualityRange) {
    qualityRange.addEventListener('input', () => {
      qualityValue.textContent = qualityRange.value;
    });
  }

  // Disable upload until engine ready
  const topUploadBtn = document.querySelector('.top-btn');
  if (topUploadBtn) topUploadBtn.disabled = true;
  window.addEventListener('load', () => {
    setTimeout(() => { if (topUploadBtn) topUploadBtn.disabled = false; }, 650);
  });

  let currentFile = null;

  // Drag & drop
  const uploadArea = document.getElementById('upload-area');
  if (uploadArea) {
    uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', e => {
      e.preventDefault(); uploadArea.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) handleFile(file);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      handleFile(file);
    });
  }

  function handleFile(file) {
    currentFile = file;
    fileNameEl.textContent = file.name;
    uploadSection.classList.add('hidden');
    converterSection.classList.remove('hidden');
    converterSection.classList.add('dt-slide-in');
    downloadSection.classList.add('hidden');
    if (sizeComparison) sizeComparison.innerHTML = '';
  }

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      currentFile = null;
      if (fileInput) fileInput.value = '';
      converterSection.classList.add('hidden');
      uploadSection.classList.remove('hidden');
      downloadSection.classList.add('hidden');
      if (sizeComparison) sizeComparison.innerHTML = '';
    });
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // Global function called by onclick="compressImage()"
  window.compressImage = function () {
    const file = currentFile;
    if (!file) { alert('Please upload an image first.'); return; }

    if (compressBtn) {
      compressBtn.innerHTML = `<span class="btn-spinner"></span> Compressing…`;
      compressBtn.disabled = true;
    }

    const originalExt  = file.name.split('.').pop().toLowerCase();
    const originalMime = file.type || 'image/jpeg';

    // Preserve original format; GIF/BMP fall back to PNG (canvas limitation)
    const mimeMap = {
      'image/png':  { mime: 'image/png',  ext: 'png'  },
      'image/gif':  { mime: 'image/png',  ext: 'png'  },
      'image/webp': { mime: 'image/webp', ext: 'webp' },
      'image/bmp':  { mime: 'image/jpeg', ext: 'jpg'  },
    };
    const outputCfg = mimeMap[originalMime] || {
      mime: 'image/jpeg',
      ext: originalExt === 'jpg' ? 'jpg' : 'jpeg'
    };

    // Quality: PNG ignores quality (lossless), others use slider
    const sliderQ  = qualityRange ? parseInt(qualityRange.value) / 100 : 0.85;
    const quality  = outputCfg.mime === 'image/png' ? undefined : sliderQ;

    const reader = new FileReader();
    reader.onload = function (ev) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.getElementById('canvas');
        const ctx    = canvas.getContext('2d');
        canvas.width  = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(blob => {
          const url      = URL.createObjectURL(blob);
          const baseName = file.name.split('.').slice(0, -1).join('.') || 'compressed';

          downloadLink.href     = url;
          downloadLink.download = `compressed_${baseName}.${outputCfg.ext}`;
          downloadLink.style.display = 'inline-flex';

          // Size comparison
          if (sizeComparison) {
            const saved   = file.size - blob.size;
            const pct     = ((saved / file.size) * 100).toFixed(1);
            const color   = saved > 0 ? '#10b981' : '#f59e0b';
            const label   = saved > 0
              ? `Saved ${formatBytes(saved)} (${pct}% smaller)`
              : `Size unchanged — image was already optimized`;
            sizeComparison.innerHTML = `
              <div class="size-info">
                <span>Original: <strong>${formatBytes(file.size)}</strong></span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${color}"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                <span>Compressed: <strong>${formatBytes(blob.size)}</strong></span>
                <span class="size-saving" style="color:${color}">${label}</span>
              </div>`;
          }

          downloadSection.classList.remove('hidden');
          downloadSection.classList.add('dt-slide-in');

          if (compressBtn) {
            compressBtn.innerHTML = `<svg class="svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Compress Again`;
            compressBtn.disabled = false;
          }
        }, outputCfg.mime, quality);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
}

/* ========================================================= */
/*   SHARED: dynamic footer year                             */
/* ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const footerP = document.querySelector('footer .footer-bottom p:first-child');
  if (footerP) footerP.innerHTML = `&copy; ${new Date().getFullYear()} DevTemple. All Rights Reserved.`;
});
