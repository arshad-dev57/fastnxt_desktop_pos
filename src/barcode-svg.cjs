/**
 * Scanner-compatible barcode SVG generation (main process).
 * Uses bwip-js for EAN/UPC/Code39/ITF; falls back to Code128 via bwip as well.
 */
function normalizeFormat(format) {
  const f = String(format || 'CODE128').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const map = {
    CODE128: 'code128',
    CODE128A: 'code128',
    CODE128B: 'code128',
    CODE128C: 'code128',
    EAN13: 'ean13',
    EAN8: 'ean8',
    UPCA: 'upca',
    UPCE: 'upce',
    CODE39: 'code39',
    ITF: 'interleaved2of5',
    ITF14: 'itf14',
  };
  return map[f] || 'code128';
}

function validateBarcodeValue(format, text) {
  const value = String(text || '').trim();
  if (!value) return { ok: false, message: 'Empty barcode value' };
  const f = String(format || 'CODE128').toUpperCase();
  if (f === 'EAN13') {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 12 && digits.length !== 13) {
      return { ok: false, message: 'EAN-13 requires 12 or 13 digits' };
    }
    return { ok: true, value: digits };
  }
  if (f === 'EAN8') {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 7 && digits.length !== 8) {
      return { ok: false, message: 'EAN-8 requires 7 or 8 digits' };
    }
    return { ok: true, value: digits };
  }
  if (f === 'UPCA') {
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 11 && digits.length !== 12) {
      return { ok: false, message: 'UPC-A requires 11 or 12 digits' };
    }
    return { ok: true, value: digits };
  }
  if (f === 'ITF' || f === 'ITF14') {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 2 || digits.length % 2 !== 0) {
      return { ok: false, message: 'ITF requires an even number of digits' };
    }
    return { ok: true, value: digits };
  }
  if (f === 'CODE39') {
    if (!/^[0-9A-Z\-\.\ \$\/\+\%]+$/i.test(value)) {
      return { ok: false, message: 'Code 39 allows A–Z, 0–9 and - . $ / + % space' };
    }
    return { ok: true, value: value.toUpperCase() };
  }
  // CODE128 — printable ASCII
  const cleaned = value.replace(/[^\x20-\x7E]/g, '');
  if (!cleaned) return { ok: false, message: 'Code 128 needs printable ASCII characters' };
  return { ok: true, value: cleaned };
}

async function barcodeToSvg(options = {}) {
  const bwipjs = require('bwip-js');
  const format = String(options.format || 'CODE128');
  const checked = validateBarcodeValue(format, options.text);
  if (!checked.ok) return { success: false, message: checked.message };

  const bcid = normalizeFormat(format);
  const height = Math.max(8, Math.min(40, Number(options.height) || 12));
  const scale = Math.max(1, Math.min(6, Number(options.scale) || 2));
  const barcolor = String(options.barColor || '#000000').replace('#', '');
  const backgroundcolor = String(options.bgColor || '#ffffff').replace('#', '');
  const includetext = options.showText !== false;

  try {
    const svg = bwipjs.toSVG({
      bcid,
      text: checked.value,
      scale,
      height,
      includetext,
      textxalign: 'center',
      barcolor,
      backgroundcolor,
      paddingwidth: Math.max(0, Number(options.quietZone) || 10),
      paddingheight: 2,
    });
    return { success: true, svg, value: checked.value, format, bcid };
  } catch (err) {
    return { success: false, message: err.message || 'Barcode render failed' };
  }
}

module.exports = {
  normalizeFormat,
  validateBarcodeValue,
  barcodeToSvg,
};
