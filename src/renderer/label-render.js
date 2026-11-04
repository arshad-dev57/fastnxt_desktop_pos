/**
 * Standard stacked barcode/QR product labels from company templates.
 * Encodes real product identifiers only.
 */
(function (global) {
  'use strict';

  var MM_TO_PX = 3.78;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) return '';
    return 'PKR ' + v.toFixed(2);
  }

  function isVisible(template, type) {
    var els = (template && template.elements) || [];
    var el = els.find(function (e) { return e.type === type; });
    return !!(el && el.visible !== false);
  }

  function encodeFromTemplate(product, template, kind) {
    var p = product || {};
    var field = kind === 'qr'
      ? ((template && template.qr && template.qr.encodeField) || 'qrCode')
      : ((template && template.barcode && template.barcode.encodeField) || 'barcode');
    if (field === 'sku') return String(p.sku || '').trim();
    if (field === 'qrCode') return String(p.qrCode || p.qr_code || p.sku || '').trim();
    return String(p.barcode || p.barcodeNumber || p.sku || '').trim();
  }

  async function barcodeSvg(value, opts) {
    opts = opts || {};
    var api = global.bisonDesktop;
    if (api && api.codes && typeof api.codes.barcodeSvg === 'function') {
      var res = await api.codes.barcodeSvg({
        text: value,
        format: opts.format || 'CODE128',
        height: opts.height || 12,
        scale: opts.scale || 2,
        barColor: opts.barColor || '#000000',
        bgColor: opts.bgColor || '#ffffff',
        showText: opts.showText !== false,
        quietZone: opts.quietZone || 8,
      });
      if (res && res.success && res.svg) return res.svg;
      if (res && res.message) {
        return '<div style="color:#b91c1c;font-size:10px;text-align:center;">' + esc(res.message) + '</div>';
      }
    }
    if (global.PosProductCodes && global.PosProductCodes.productBarcodeSvg) {
      return global.PosProductCodes.productBarcodeSvg(value, opts.maxWidth || 280);
    }
    return '<div style="font-family:monospace;font-weight:700;text-align:center;">' + esc(value) + '</div>';
  }

  async function qrSvg(value, opts) {
    opts = opts || {};
    var api = global.bisonDesktop;
    var size = Math.max(64, Number(opts.size) || 96);
    if (api && api.codes && typeof api.codes.qrSvg === 'function') {
      var res = await api.codes.qrSvg(value, size, {
        fgColor: opts.fgColor || '#000000',
        bgColor: opts.bgColor || '#ffffff',
        errorCorrection: opts.errorCorrection || 'M',
      });
      if (res && res.success && res.svg) return res.svg;
    }
    if (global.PosProductCodes && global.PosProductCodes.productQrSvg) {
      return global.PosProductCodes.productQrSvg(value, size);
    }
    return '<div style="font-family:monospace;font-weight:700;text-align:center;">' + esc(value) + '</div>';
  }

  function labelCssSize(template) {
    var L = (template && template.label) || {};
    var wMm = Math.max(25, Number(L.widthMm) || 50);
    var hMm = Math.max(18, Number(L.heightMm) || 30);
    return {
      widthMm: wMm,
      heightMm: hMm,
      widthPx: Math.round(wMm * MM_TO_PX),
      heightPx: Math.round(hMm * MM_TO_PX),
    };
  }

  function line(text, style) {
    if (!text) return '';
    return '<div style="width:100%;box-sizing:border-box;' + (style || '') + '">' + text + '</div>';
  }

  async function renderLabelHtml(template, product, company, options) {
    options = options || {};
    var size = labelCssSize(template);
    var L = (template && template.label) || {};
    var branding = Object.assign({}, (template && template.branding) || {}, company || {});
    var p = product || {};
    var textColor = L.textColor || '#111111';
    var muted = L.mutedColor || '#6b7280';
    var parts = [];

    if (isVisible(template, 'companyLogo') && (branding.logo || branding.logoDataUrl)) {
      var logo = branding.logo || branding.logoDataUrl;
      parts.push(line('<img src="' + esc(logo) + '" alt="" style="max-height:28px;max-width:70%;object-fit:contain;"/>', 'text-align:center;margin-bottom:4px;'));
    }
    if (isVisible(template, 'companyName')) {
      var cname = branding.companyName || branding.name || branding.companyName || '';
      if (cname) parts.push(line(esc(cname), 'text-align:center;font-size:10px;font-weight:700;color:' + textColor + ';margin-bottom:2px;'));
    }
    if (isVisible(template, 'productName') && (p.name || p.productName)) {
      parts.push(line(esc(p.name || p.productName), 'text-align:center;font-size:12px;font-weight:800;color:' + textColor + ';line-height:1.2;margin:2px 0;'));
    }
    if (isVisible(template, 'sku') && p.sku) {
      parts.push(line('<span style="color:' + muted + ';">SKU:</span> ' + esc(p.sku), 'text-align:center;font-size:9px;font-weight:600;color:' + textColor + ';'));
    }

    var priceBits = [];
    if (isVisible(template, 'price') && (p.price != null || p.sellingPrice != null)) {
      priceBits.push('<span style="font-weight:800;">' + esc(money(p.price != null ? p.price : p.sellingPrice)) + '</span>');
    }
    if (isVisible(template, 'salePrice') && (p.salePrice != null || p.discountedPrice != null)) {
      var sp = p.salePrice != null ? p.salePrice : p.discountedPrice;
      if (sp !== '' && sp != null) priceBits.push('<span style="color:#b91c1c;font-weight:800;">' + esc(money(sp)) + '</span>');
    }
    if (priceBits.length) {
      parts.push(line(priceBits.join(' &nbsp; '), 'text-align:center;font-size:11px;margin:3px 0;'));
    }

    var meta = [];
    if (isVisible(template, 'category') && (p.categoryName || p.category)) meta.push(esc(p.categoryName || p.category));
    if (isVisible(template, 'unit') && (p.unitName || p.stockUnitName || p.unit)) meta.push(esc(p.unitName || p.stockUnitName || p.unit));
    if (meta.length) parts.push(line(meta.join(' · '), 'text-align:center;font-size:8px;color:' + muted + ';'));

    if (isVisible(template, 'batch') && (p.batchNumber || p.batch)) {
      parts.push(line('Batch: ' + esc(p.batchNumber || p.batch), 'text-align:center;font-size:8px;color:' + muted + ';'));
    }
    var dates = [];
    if (isVisible(template, 'mfgDate') && (p.manufacturingDate || p.mfgDate)) dates.push('Mfg ' + esc(p.manufacturingDate || p.mfgDate));
    if (isVisible(template, 'expiry') && (p.expiryDate || p.expiry)) dates.push('Exp ' + esc(p.expiryDate || p.expiry));
    if (dates.length) parts.push(line(dates.join(' · '), 'text-align:center;font-size:8px;color:' + muted + ';'));

    if (isVisible(template, 'customText') && template.branding && template.branding.customText) {
      parts.push(line(esc(template.branding.customText), 'text-align:center;font-size:8px;color:' + textColor + ';margin-top:2px;'));
    }

    var kind = (template && template.kind) === 'qr' ? 'qr' : 'barcode';
    if (kind === 'barcode' && isVisible(template, 'barcode')) {
      var code = encodeFromTemplate(p, template, 'barcode');
      if (code) {
        var bc = template.barcode || {};
        var svg = await barcodeSvg(code, {
          format: bc.format || 'CODE128',
          height: 10,
          scale: Number(bc.moduleWidth) || 2,
          barColor: bc.barColor || '#000000',
          bgColor: L.bgColor || '#ffffff',
          showText: bc.showText !== false,
        });
        parts.push(line(svg, 'text-align:center;margin-top:6px;line-height:0;'));
      }
    }
    if (kind === 'qr' && isVisible(template, 'qr')) {
      var qv = encodeFromTemplate(p, template, 'qr');
      if (qv) {
        var qr = template.qr || {};
        var qsvg = await qrSvg(qv, {
          size: Number(qr.size) || 96,
          fgColor: qr.fgColor || '#000000',
          bgColor: qr.bgColor || '#ffffff',
          errorCorrection: qr.errorCorrection || 'M',
        });
        parts.push(line(qsvg, 'text-align:center;margin-top:6px;line-height:0;'));
      }
    }

    var border = (Number(L.borderWidth) || 0) + 'px solid ' + (L.borderColor || '#d1d5db');
    var pad = Math.max(4, Number(L.padding) || 6);
    return (
      '<div class="pos-label-paper" style="width:' + size.widthPx + 'px;min-height:' + size.heightPx + 'px;' +
      'background:' + (L.bgColor || '#fff') + ';border:' + border + ';border-radius:' + (Number(L.borderRadius) || 2) + 'px;' +
      'box-sizing:border-box;padding:' + pad + 'px;margin:0 auto;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;">' +
      parts.join('') + '</div>'
    );
  }

  async function printLabels(template, products, company, copies) {
    var list = Array.isArray(products) ? products : [products];
    var n = Math.max(1, Number(copies) || 1);
    var size = labelCssSize(template);
    var pages = [];
    for (var i = 0; i < list.length; i++) {
      for (var c = 0; c < n; c++) {
        pages.push(await renderLabelHtml(template, list[i], company, {}));
      }
    }
    var html =
      '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Print Labels</title>' +
      '<style>@page{size:' + size.widthMm + 'mm ' + size.heightMm + 'mm;margin:0;}' +
      'html,body{margin:0;padding:0;background:#fff;}' +
      '.pos-label-paper{page-break-after:always;page-break-inside:avoid;}' +
      '.pos-label-paper:last-child{page-break-after:auto;}</style></head><body>' +
      pages.join('') +
      '<script>setTimeout(function(){window.focus();window.print();},400);<\/script></body></html>';
    var win = window.open('', '_blank');
    if (!win) throw new Error('Popup blocked — allow popups to print labels');
    win.document.write(html);
    win.document.close();
    return { success: true, count: pages.length };
  }

  global.PosLabelRender = {
    MM_TO_PX: MM_TO_PX,
    encodeFromTemplate: encodeFromTemplate,
    labelCssSize: labelCssSize,
    renderLabelHtml: renderLabelHtml,
    printLabels: printLabels,
    isVisible: isVisible,
  };
})(window);
