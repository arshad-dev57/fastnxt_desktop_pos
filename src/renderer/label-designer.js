/**
 * Simple Barcode & QR label settings (no drag editor).
 * Company-scoped defaults used when printing product labels.
 */
(function (global) {
  'use strict';

  var SAMPLE = {
    name: 'Sample Product',
    sku: 'SKU-1001',
    barcode: '8901234567890',
    barcodeNumber: '8901234567890',
    qrCode: 'SKU-1001',
    price: 499,
    salePrice: 399,
    categoryName: 'Grocery',
    unitName: 'Pcs',
    batchNumber: 'B-01',
    expiryDate: '2027-12-31',
    manufacturingDate: '2026-01-15',
  };

  var SHOW_FIELDS = [
    { type: 'companyLogo', label: 'Company logo' },
    { type: 'companyName', label: 'Company name' },
    { type: 'productName', label: 'Product name' },
    { type: 'sku', label: 'SKU' },
    { type: 'price', label: 'Price' },
    { type: 'salePrice', label: 'Sale price' },
    { type: 'category', label: 'Category' },
    { type: 'unit', label: 'Unit' },
    { type: 'batch', label: 'Batch no.' },
    { type: 'expiry', label: 'Expiry' },
    { type: 'mfgDate', label: 'Mfg date' },
  ];

  var SIZE_PRESETS = [
    { id: '40x25', label: '40 × 25 mm', w: 40, h: 25 },
    { id: '50x30', label: '50 × 30 mm (standard)', w: 50, h: 30 },
    { id: '60x40', label: '60 × 40 mm', w: 60, h: 40 },
    { id: '80x50', label: '80 × 50 mm', w: 80, h: 50 },
  ];

  function api() { return global.bisonDesktop; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function LabelSettings(root) {
    this.root = typeof root === 'string' ? document.querySelector(root) : root;
    this.kind = 'barcode';
    this.barcodeTpl = null;
    this.qrTpl = null;
    this.company = { name: 'Company', logo: '' };
    this._bound = false;
  }

  LabelSettings.prototype.tpl = function () {
    return this.kind === 'qr' ? this.qrTpl : this.barcodeTpl;
  };

  LabelSettings.prototype.setStatus = function (msg, kind) {
    var el = this.root.querySelector('.ld-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'ld-status' + (kind ? ' ' + kind : '');
  };

  LabelSettings.prototype.mount = async function () {
    if (!this.root) return;
    this.root.innerHTML =
      '<div class="ld-root">' +
      '  <p class="ld-hint">Choose what appears on product labels. Settings are saved for this company and used when you print barcodes / QR from Products.</p>' +
      '  <div class="ld-tabs">' +
      '    <button type="button" class="active" data-kind="barcode">Barcode label</button>' +
      '    <button type="button" data-kind="qr">QR label</button>' +
      '  </div>' +
      '  <div class="ld-grid">' +
      '    <div class="ld-card" id="ld-form"></div>' +
      '    <div class="ld-card">' +
      '      <h3>Preview</h3>' +
      '      <div class="ld-preview-wrap" id="ld-preview"></div>' +
      '      <div class="ld-status"></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var self = this;
    this.root.querySelectorAll('.ld-tabs button').forEach(function (btn) {
      btn.onclick = function () {
        self.root.querySelectorAll('.ld-tabs button').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        self.kind = btn.getAttribute('data-kind');
        self.renderForm();
        self.renderPreview();
      };
    });

    await this.loadCompany();
    await this.loadTemplates();
    this.renderForm();
    this.renderPreview();
  };

  LabelSettings.prototype.loadCompany = async function () {
    try {
      var res = await api().pos.getProfile();
      var p = (res && res.data) || {};
      var c = p.company || p.businessDetails || p;
      this.company = {
        name: c.name || c.companyName || c.businessName || p.organizationName || 'Company',
        logo: c.logo || p.logo || '',
      };
    } catch (e) { /* ignore */ }
  };

  LabelSettings.prototype.loadTemplates = async function () {
    var res = await api().labels.list();
    if (!res || !res.success) {
      this.setStatus((res && res.message) || 'Could not load settings', 'err');
      return;
    }
    var list = res.data.templates || [];
    this.barcodeTpl = clone(list.find(function (t) { return t.kind === 'barcode' && t.isDefault; })
      || list.find(function (t) { return t.kind === 'barcode'; }) || null);
    this.qrTpl = clone(list.find(function (t) { return t.kind === 'qr' && t.isDefault; })
      || list.find(function (t) { return t.kind === 'qr'; }) || null);
    if (!this.barcodeTpl || !this.qrTpl) {
      await api().labels.resetDefaults();
      return this.loadTemplates();
    }
  };

  LabelSettings.prototype.ensureEl = function (tpl, type) {
    tpl.elements = tpl.elements || [];
    var el = tpl.elements.find(function (e) { return e.type === type; });
    if (!el) {
      el = { id: 'el-' + type, type: type, visible: false, x: 0, y: 0, width: 100, height: 16, fontSize: 10, fontWeight: 600, color: '#111', align: 'center', text: '', label: '' };
      tpl.elements.push(el);
    }
    return el;
  };

  LabelSettings.prototype.renderForm = function () {
    var tpl = this.tpl();
    if (!tpl) return;
    var L = tpl.label || {};
    var bc = tpl.barcode || {};
    var qr = tpl.qr || {};
    var kind = this.kind;
    var preset = SIZE_PRESETS.find(function (p) { return p.w === Number(L.widthMm) && p.h === Number(L.heightMm); });
    var presetId = preset ? preset.id : 'custom';

    var sizeOpts = SIZE_PRESETS.map(function (p) {
      return '<option value="' + p.id + '"' + (presetId === p.id ? ' selected' : '') + '>' + p.label + '</option>';
    }).join('') + '<option value="custom"' + (presetId === 'custom' ? ' selected' : '') + '>Custom size</option>';

    var toggles = SHOW_FIELDS.map(function (f) {
      var el = (tpl.elements || []).find(function (e) { return e.type === f.type; });
      var on = el ? el.visible !== false : false;
      return '<label class="ld-toggle"><span>' + f.label + '</span><input type="checkbox" data-show="' + f.type + '"' + (on ? ' checked' : '') + '/></label>';
    }).join('');

    // Always show code element for current kind
    this.ensureEl(tpl, kind === 'qr' ? 'qr' : 'barcode').visible = true;

    var codeBlock = kind === 'barcode'
      ? (
        '<h4>Barcode</h4>' +
        '<div class="ld-field"><label>Format (scanner standard)</label>' +
        '<select id="ld-format">' +
        ['CODE128', 'EAN13', 'EAN8', 'UPCA', 'CODE39', 'ITF'].map(function (f) {
          return '<option value="' + f + '"' + ((bc.format || 'CODE128') === f ? ' selected' : '') + '>' + f + '</option>';
        }).join('') + '</select></div>' +
        '<div class="ld-field"><label>Encode value from</label>' +
        '<select id="ld-encode"><option value="barcode"' + (bc.encodeField !== 'sku' ? ' selected' : '') + '>Product barcode</option>' +
        '<option value="sku"' + (bc.encodeField === 'sku' ? ' selected' : '') + '>SKU</option></select></div>' +
        '<div class="ld-row2"><div class="ld-field"><label>Bar color</label><input id="ld-bar-color" type="color" value="' + (bc.barColor || '#000000') + '"/></div>' +
        '<div class="ld-field"><label>Show code text</label><select id="ld-show-text"><option value="1"' + (bc.showText !== false ? ' selected' : '') + '>Yes</option><option value="0"' + (bc.showText === false ? ' selected' : '') + '>No</option></select></div></div>'
      )
      : (
        '<h4>QR Code</h4>' +
        '<div class="ld-field"><label>Encode value from</label>' +
        '<select id="ld-encode">' +
        '<option value="qrCode"' + ((qr.encodeField || 'qrCode') === 'qrCode' ? ' selected' : '') + '>QR / barcode value</option>' +
        '<option value="sku"' + (qr.encodeField === 'sku' ? ' selected' : '') + '>SKU</option>' +
        '<option value="barcode"' + (qr.encodeField === 'barcode' ? ' selected' : '') + '>Barcode</option></select></div>' +
        '<div class="ld-row2"><div class="ld-field"><label>QR color</label><input id="ld-qr-fg" type="color" value="' + (qr.fgColor || '#000000') + '"/></div>' +
        '<div class="ld-field"><label>Error correction</label><select id="ld-qr-ecc">' +
        ['L', 'M', 'Q', 'H'].map(function (x) {
          return '<option value="' + x + '"' + ((qr.errorCorrection || 'M') === x ? ' selected' : '') + '>' + x + '</option>';
        }).join('') + '</select></div></div>'
      );

    var box = this.root.querySelector('#ld-form');
    box.innerHTML =
      '<h3>' + (kind === 'qr' ? 'QR label settings' : 'Barcode label settings') + '</h3>' +
      '<div class="ld-field"><label>Label size</label><select id="ld-size">' + sizeOpts + '</select></div>' +
      '<div class="ld-row2" id="ld-custom-size" style="' + (presetId === 'custom' ? '' : 'display:none;') + '">' +
      '<div class="ld-field"><label>Width (mm)</label><input id="ld-w" type="number" min="25" max="120" value="' + (L.widthMm || 50) + '"/></div>' +
      '<div class="ld-field"><label>Height (mm)</label><input id="ld-h" type="number" min="18" max="120" value="' + (L.heightMm || 30) + '"/></div></div>' +
      '<div class="ld-row2"><div class="ld-field"><label>Background</label><input id="ld-bg" type="color" value="' + (L.bgColor || '#ffffff') + '"/></div>' +
      '<div class="ld-field"><label>Text color</label><input id="ld-text" type="color" value="' + (L.textColor || '#111111') + '"/></div></div>' +
      codeBlock +
      '<h4>Show on label</h4><div class="ld-toggles">' + toggles + '</div>' +
      '<h4>Branding</h4>' +
      '<div class="ld-field"><label>Company name (optional override)</label><input id="ld-co-name" type="text" value="' + String((tpl.branding && tpl.branding.companyName) || '').replace(/"/g, '&quot;') + '" placeholder="Leave blank to use company profile"/></div>' +
      '<div class="ld-field"><label>Footer / custom text</label><input id="ld-custom" type="text" value="' + String((tpl.branding && tpl.branding.customText) || '').replace(/"/g, '&quot;') + '" placeholder="Optional"/></div>' +
      '<div class="ld-field"><label>Company logo</label><input id="ld-logo" type="file" accept="image/*"/></div>' +
      '<div class="ld-actions">' +
      '<button type="button" class="ld-btn-primary" id="ld-save">Save</button>' +
      '<button type="button" class="ld-btn-print" id="ld-print">Print sample</button>' +
      '<button type="button" class="ld-btn-gray" id="ld-reset">Reset defaults</button>' +
      '</div>';

    this.bindForm();
  };

  LabelSettings.prototype.bindForm = function () {
    var self = this;
    var box = this.root.querySelector('#ld-form');
    function refresh() {
      self.applyForm();
      self.renderPreview();
    }
    box.querySelector('#ld-size').onchange = function () {
      var id = box.querySelector('#ld-size').value;
      var custom = box.querySelector('#ld-custom-size');
      if (id === 'custom') custom.style.display = '';
      else {
        custom.style.display = 'none';
        var p = SIZE_PRESETS.find(function (x) { return x.id === id; });
        if (p) {
          box.querySelector('#ld-w').value = p.w;
          box.querySelector('#ld-h').value = p.h;
        }
      }
      refresh();
    };
    ['ld-w', 'ld-h', 'ld-bg', 'ld-text', 'ld-format', 'ld-encode', 'ld-bar-color', 'ld-show-text',
      'ld-qr-fg', 'ld-qr-ecc', 'ld-co-name', 'ld-custom'].forEach(function (id) {
      var n = box.querySelector('#' + id);
      if (n) n.addEventListener(n.type === 'text' || n.type === 'color' ? 'input' : 'change', refresh);
    });
    box.querySelectorAll('[data-show]').forEach(function (chk) {
      chk.addEventListener('change', refresh);
    });
    box.querySelector('#ld-logo').onchange = function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var tpl = self.tpl();
        tpl.branding = tpl.branding || {};
        tpl.branding.logoDataUrl = reader.result;
        self.ensureEl(tpl, 'companyLogo').visible = true;
        self.renderForm();
        self.renderPreview();
      };
      reader.readAsDataURL(file);
    };
    box.querySelector('#ld-save').onclick = function () { self.save(); };
    box.querySelector('#ld-print').onclick = function () { self.printSample(); };
    box.querySelector('#ld-reset').onclick = function () { self.reset(); };
  };

  LabelSettings.prototype.applyForm = function () {
    var box = this.root.querySelector('#ld-form');
    var tpl = this.tpl();
    if (!tpl || !box) return;
    tpl.label = tpl.label || {};
    tpl.branding = tpl.branding || {};
    tpl.label.widthMm = Number(box.querySelector('#ld-w').value) || 50;
    tpl.label.heightMm = Number(box.querySelector('#ld-h').value) || 30;
    tpl.label.bgColor = box.querySelector('#ld-bg').value || '#ffffff';
    tpl.label.textColor = box.querySelector('#ld-text').value || '#111111';
    tpl.label.padding = 6;
    tpl.label.borderWidth = 1;
    tpl.label.borderColor = '#d1d5db';

    if (this.kind === 'barcode') {
      tpl.barcode = tpl.barcode || {};
      if (box.querySelector('#ld-format')) tpl.barcode.format = box.querySelector('#ld-format').value;
      if (box.querySelector('#ld-encode')) tpl.barcode.encodeField = box.querySelector('#ld-encode').value;
      if (box.querySelector('#ld-bar-color')) tpl.barcode.barColor = box.querySelector('#ld-bar-color').value;
      if (box.querySelector('#ld-show-text')) tpl.barcode.showText = box.querySelector('#ld-show-text').value === '1';
      this.ensureEl(tpl, 'barcode').visible = true;
      var qrEl = (tpl.elements || []).find(function (e) { return e.type === 'qr'; });
      if (qrEl) qrEl.visible = false;
    } else {
      tpl.qr = tpl.qr || {};
      if (box.querySelector('#ld-encode')) tpl.qr.encodeField = box.querySelector('#ld-encode').value;
      if (box.querySelector('#ld-qr-fg')) tpl.qr.fgColor = box.querySelector('#ld-qr-fg').value;
      if (box.querySelector('#ld-qr-ecc')) tpl.qr.errorCorrection = box.querySelector('#ld-qr-ecc').value;
      this.ensureEl(tpl, 'qr').visible = true;
      var bcEl = (tpl.elements || []).find(function (e) { return e.type === 'barcode'; });
      if (bcEl) bcEl.visible = false;
    }

    tpl.branding.companyName = box.querySelector('#ld-co-name').value || '';
    tpl.branding.customText = box.querySelector('#ld-custom').value || '';
    this.ensureEl(tpl, 'customText').visible = !!tpl.branding.customText;

    box.querySelectorAll('[data-show]').forEach(function (chk) {
      var type = chk.getAttribute('data-show');
      selfEnsure(type).visible = chk.checked;
    });

    function selfEnsure(type) {
      tpl.elements = tpl.elements || [];
      var el = tpl.elements.find(function (e) { return e.type === type; });
      if (!el) {
        el = { id: 'el-' + type, type: type, visible: false, x: 0, y: 0, width: 100, height: 16, fontSize: 10, fontWeight: 600, color: '#111', align: 'center', text: '', label: '' };
        tpl.elements.push(el);
      }
      return el;
    }

    tpl.isDefault = true;
  };

  LabelSettings.prototype.renderPreview = async function () {
    var wrap = this.root.querySelector('#ld-preview');
    if (!wrap || !global.PosLabelRender) return;
    this.applyForm();
    var tpl = this.tpl();
    var company = {
      name: (tpl.branding && tpl.branding.companyName) || this.company.name,
      logo: (tpl.branding && tpl.branding.logoDataUrl) || this.company.logo,
      logoDataUrl: (tpl.branding && tpl.branding.logoDataUrl) || this.company.logo,
      companyName: (tpl.branding && tpl.branding.companyName) || this.company.name,
    };
    wrap.innerHTML = await global.PosLabelRender.renderLabelHtml(tpl, SAMPLE, company, {});
  };

  LabelSettings.prototype.save = async function () {
    this.applyForm();
    var tpl = this.tpl();
    tpl.isDefault = true;
    var res = await api().labels.save(tpl);
    if (!res || !res.success) {
      this.setStatus((res && res.message) || 'Save failed', 'err');
      return;
    }
    if (this.kind === 'qr') this.qrTpl = clone(res.data);
    else this.barcodeTpl = clone(res.data);
    if (global.PosProductCodes && typeof global.PosProductCodes.invalidateLabelCache === 'function') {
      global.PosProductCodes.invalidateLabelCache();
    }
    // Keep receipt barcode toggle on so Labels design shows on sale receipts
    try {
      if (global.PosReceipt && typeof global.PosReceipt.loadReceiptTemplate === 'function') {
        var rt = global.PosReceipt.loadReceiptTemplate();
        if (rt && rt.showBarcode === false) {
          global.PosReceipt.saveReceiptTemplate(Object.assign({}, rt, { showBarcode: true }));
        }
      }
    } catch (_) { /* ignore */ }
    this.setStatus('Saved — used on product labels and sale receipts', 'ok');
  };

  LabelSettings.prototype.printSample = async function () {
    this.applyForm();
    var tpl = this.tpl();
    var company = {
      name: (tpl.branding && tpl.branding.companyName) || this.company.name,
      logo: (tpl.branding && tpl.branding.logoDataUrl) || this.company.logo,
    };
    await global.PosLabelRender.printLabels(tpl, SAMPLE, company, 1);
  };

  LabelSettings.prototype.reset = async function () {
    if (!confirm('Reset barcode & QR label settings for this company?')) return;
    var res = await api().labels.resetDefaults();
    if (!res || !res.success) {
      this.setStatus((res && res.message) || 'Reset failed', 'err');
      return;
    }
    await this.loadTemplates();
    if (global.PosProductCodes && typeof global.PosProductCodes.invalidateLabelCache === 'function') {
      global.PosProductCodes.invalidateLabelCache();
    }
    this.renderForm();
    this.renderPreview();
    this.setStatus('Defaults restored', 'ok');
  };

  // Keep old mount API name so sell.js / management.js keep working
  global.PosLabelDesigner = LabelSettings;
  global.mountLabelDesigner = async function (selector) {
    var d = new LabelSettings(selector);
    await d.mount();
    return d;
  };
})(window);
