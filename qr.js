/*
 * qr.js — UI controller for michaelteter.com/qr.html
 */
(function () {
  'use strict';

  const DEFAULT_URL = 'https://michaelteter.com';
  const DEFAULT_FG = '#000000';
  const DEFAULT_BG = '#ffffff';

  const form = document.getElementById('qr-form');
  const urlInput = document.getElementById('qr-url');
  const clearBtn = document.getElementById('qr-clear');
  const urlHint = document.getElementById('qr-url-hint');
  const fgInput = document.getElementById('qr-fg');
  const bgInput = document.getElementById('qr-bg');
  const fgHexLabel = document.getElementById('qr-fg-hex');
  const bgHexLabel = document.getElementById('qr-bg-hex');
  const resetColorsBtn = document.getElementById('qr-reset-colors');
  const contrastWarning = document.getElementById('qr-contrast-warning');
  const canvas = document.getElementById('qr-canvas');
  const metaEl = document.getElementById('qr-meta');
  const errorEl = document.getElementById('qr-error');
  const copyBtn = document.getElementById('qr-copy-png');
  const copyTip = document.getElementById('qr-copy-status');
  const svgBtn = document.getElementById('qr-download-svg');

  let currentQr = null;
  let currentEncodedUrl = DEFAULT_URL;
  let copyTimer = null;
  let lastStatusMessage = '';

  function getSelectedRadio(name, fallback) {
    const checked = form.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : fallback;
  }

  function getOptions() {
    return {
      style: getSelectedRadio('qr-style', 'rounded'),
      ecl: getSelectedRadio('qr-ecl', 'M'),
      size: parseInt(getSelectedRadio('qr-size', '1024'), 10) || 1024,
      fg: fgInput.value || DEFAULT_FG,
      bg: bgInput.value || DEFAULT_BG,
    };
  }

  function updateContrastFeedback(fg, bg) {
    fgHexLabel.textContent = fg.toUpperCase();
    bgHexLabel.textContent = bg.toUpperCase();

    const isDefault =
      fg.toLowerCase() === DEFAULT_FG && bg.toLowerCase() === DEFAULT_BG;
    resetColorsBtn.hidden = isDefault;

    const { isInverted, isLowContrast } = window.QRCore.checkContrast(fg, bg);
    if (isInverted && isLowContrast) {
      contrastWarning.textContent =
        'Low contrast and light-on-dark colors may not scan reliably on all phones.';
      contrastWarning.hidden = false;
    } else if (isInverted) {
      contrastWarning.textContent =
        'Light foreground on a dark background can fail on some older QR scanners.';
      contrastWarning.hidden = false;
    } else if (isLowContrast) {
      contrastWarning.textContent =
        'Low color contrast may make this QR code harder for phone cameras to scan.';
      contrastWarning.hidden = false;
    } else {
      contrastWarning.textContent = '';
      contrastWarning.hidden = true;
    }
  }

  function render() {
    const opts = getOptions();
    const raw = urlInput.value;
    const isEmpty = raw.trim() === '';
    clearBtn.hidden = isEmpty;

    const normalized = isEmpty
      ? { value: DEFAULT_URL, prepended: false }
      : window.QRCore.normalizeUrl(raw);

    currentEncodedUrl = normalized.value;

    if (isEmpty) {
      urlHint.textContent = `Previewing ${DEFAULT_URL} — paste any URL above.`;
    } else if (normalized.prepended) {
      urlHint.textContent = `Encoding: ${normalized.value}`;
    } else {
      urlHint.textContent = '';
    }

    updateContrastFeedback(opts.fg, opts.bg);

    try {
      const qr = window.QRCore.encodeText(normalized.value, opts.ecl);
      currentQr = qr;
      window.QRCore.renderToCanvas(canvas, qr, opts);
      canvas.setAttribute(
        'aria-label',
        `QR code for ${normalized.value}`
      );
      errorEl.textContent = '';
      errorEl.hidden = true;
      urlInput.removeAttribute('aria-invalid');
      metaEl.textContent = `${opts.size} × ${opts.size} px PNG · v${qr.version} · EC ${qr.ecl}`;
    } catch (err) {
      currentQr = null;
      urlInput.setAttribute('aria-invalid', 'true');
      errorEl.textContent =
        err && err.message
          ? err.message
          : 'Could not generate a QR code for this input.';
      errorEl.hidden = false;
    }
  }

  function triggerDownload(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function downloadPng() {
    if (!currentQr) return;
    const filename = window.QRCore.buildFilename(currentEncodedUrl, 'png');
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, filename);
    }, 'image/png');
  }

  function downloadSvg() {
    if (!currentQr) return;
    const opts = getOptions();
    const svgText = window.QRCore.renderToSvg(currentQr, opts);
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const filename = window.QRCore.buildFilename(currentEncodedUrl, 'svg');
    triggerDownload(blob, filename);
  }

  function reportCopyStatus(button, ok, label) {
    clearTimeout(copyTimer);
    button.removeAttribute('data-copied');
    button.removeAttribute('data-failed');

    let message = label || (ok ? 'Copied PNG' : 'Copy failed');
    // Append a non-breaking space when repeating an identical message so VoiceOver re-announces it
    if (message === lastStatusMessage) {
      message += '\u00A0';
    }
    lastStatusMessage = message;

    copyTip.textContent = '';
    void button.offsetWidth;
    button.setAttribute(ok ? 'data-copied' : 'data-failed', '');
    requestAnimationFrame(() => {
      copyTip.textContent = message;
    });

    copyTimer = setTimeout(() => {
      button.removeAttribute('data-copied');
      button.removeAttribute('data-failed');
      copyTip.textContent = '';
    }, 2400);
  }

  async function copyPng(button, targetCanvas) {
    if (!currentQr || !targetCanvas) return;
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      reportCopyStatus(button, false, 'Copy unsupported in this browser');
      return;
    }
    try {
      // Passing a Promise<Blob> directly to ClipboardItem preserves the Safari user-activation gesture
      const blobPromise = new Promise((resolve, reject) => {
        targetCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to encode PNG'));
        }, 'image/png');
      });
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blobPromise }),
      ]);
      reportCopyStatus(button, true, 'Copied PNG');
    } catch {
      reportCopyStatus(button, false, 'Copy failed');
    }
  }

  // Invoker Commands (Baseline Newly Available) with single-path click fallback
  if ('CommandEvent' in window) {
    document.addEventListener(
      'command',
      (event) => {
        if (event.command === '--copy-png') {
          copyPng(event.source, event.target);
        }
      },
      true
    );
  } else {
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      const button = event.target.closest('button[command="--copy-png"]');
      if (!button) return;
      const target = document.getElementById(button.getAttribute('commandfor'));
      if (target) copyPng(button, target);
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    downloadPng();
  });

  form.addEventListener('input', render);
  form.addEventListener('change', render);

  urlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.isComposing) {
      event.preventDefault();
    }
  });

  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    render();
    urlInput.focus();
  });

  resetColorsBtn.addEventListener('click', () => {
    fgInput.value = DEFAULT_FG;
    bgInput.value = DEFAULT_BG;
    render();
  });

  svgBtn.addEventListener('click', downloadSvg);

  render();
})();
