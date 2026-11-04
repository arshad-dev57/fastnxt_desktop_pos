/**
 * Company-scoped barcode/QR label templates.
 * Stored under {userData}/companies/{companyId}/label_templates.json
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let localDb = null;

function bind(db) {
  localDb = db;
}

function companyPath() {
  if (!localDb || typeof localDb.getCompanyDataPath !== 'function') {
    throw new Error('Label templates store not initialized');
  }
  const dir = localDb.getCompanyDataPath();
  if (!dir) throw new Error('No active company scope for label templates');
  return path.join(dir, 'label_templates.json');
}

function activeCompanyId() {
  return localDb && typeof localDb.getActiveCompanyId === 'function'
    ? String(localDb.getActiveCompanyId() || '')
    : '';
}

function uid() {
  return crypto.randomBytes(8).toString('hex');
}

function defaultElements(kind) {
  const common = [
    { id: 'el-logo', type: 'companyLogo', visible: true, x: 8, y: 6, width: 36, height: 36, fontSize: 12, fontWeight: 600, color: '#111111', align: 'center', text: '', label: '' },
    { id: 'el-company', type: 'companyName', visible: true, x: 48, y: 10, width: 140, height: 18, fontSize: 11, fontWeight: 700, color: '#111111', align: 'left', text: '', label: '' },
    { id: 'el-name', type: 'productName', visible: true, x: 8, y: 48, width: 184, height: 20, fontSize: 12, fontWeight: 700, color: '#111111', align: 'center', text: '', label: '' },
    { id: 'el-sku', type: 'sku', visible: true, x: 8, y: 68, width: 184, height: 14, fontSize: 9, fontWeight: 500, color: '#374151', align: 'center', text: '', label: 'SKU' },
    { id: 'el-price', type: 'price', visible: true, x: 8, y: 84, width: 90, height: 16, fontSize: 11, fontWeight: 700, color: '#111111', align: 'left', text: '', label: 'Price' },
    { id: 'el-sale', type: 'salePrice', visible: false, x: 100, y: 84, width: 92, height: 16, fontSize: 11, fontWeight: 700, color: '#b91c1c', align: 'right', text: '', label: 'Sale' },
    { id: 'el-cat', type: 'category', visible: false, x: 8, y: 100, width: 184, height: 12, fontSize: 8, fontWeight: 500, color: '#6b7280', align: 'center', text: '', label: '' },
    { id: 'el-unit', type: 'unit', visible: false, x: 8, y: 112, width: 90, height: 12, fontSize: 8, fontWeight: 500, color: '#6b7280', align: 'left', text: '', label: 'Unit' },
    { id: 'el-batch', type: 'batch', visible: false, x: 100, y: 112, width: 92, height: 12, fontSize: 8, fontWeight: 500, color: '#6b7280', align: 'right', text: '', label: 'Batch' },
    { id: 'el-exp', type: 'expiry', visible: false, x: 8, y: 124, width: 90, height: 12, fontSize: 8, fontWeight: 500, color: '#6b7280', align: 'left', text: '', label: 'Exp' },
    { id: 'el-mfg', type: 'mfgDate', visible: false, x: 100, y: 124, width: 92, height: 12, fontSize: 8, fontWeight: 500, color: '#6b7280', align: 'right', text: '', label: 'Mfg' },
    { id: 'el-custom', type: 'customText', visible: false, x: 8, y: 136, width: 184, height: 12, fontSize: 8, fontWeight: 500, color: '#111111', align: 'center', text: '', label: '' },
  ];
  if (kind === 'qr') {
    return common.concat([
      { id: 'el-qr', type: 'qr', visible: true, x: 58, y: 150, width: 84, height: 84, fontSize: 9, fontWeight: 600, color: '#111111', align: 'center', text: '', label: '' },
    ]);
  }
  return common.concat([
    { id: 'el-barcode', type: 'barcode', visible: true, x: 8, y: 150, width: 184, height: 56, fontSize: 9, fontWeight: 600, color: '#111111', align: 'center', text: '', label: '' },
  ]);
}

function createDefaultTemplate(kind, companyId) {
  const id = uid();
  const now = new Date().toISOString();
  return {
    id,
    companyId: String(companyId || ''),
    name: kind === 'qr' ? 'Default QR Label' : 'Default Barcode Label',
    kind: kind === 'qr' ? 'qr' : 'barcode',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    label: {
      widthMm: 50,
      heightMm: 30,
      orientation: 'portrait',
      padding: 2,
      bgColor: '#ffffff',
      borderColor: '#d1d5db',
      borderWidth: 1,
      borderRadius: 2,
      gap: 2,
    },
    barcode: {
      format: 'CODE128',
      height: 40,
      moduleWidth: 1.5,
      barColor: '#000000',
      showText: true,
      quietZone: 8,
      encodeField: 'barcode',
    },
    qr: {
      size: 84,
      fgColor: '#000000',
      bgColor: '#ffffff',
      errorCorrection: 'M',
      logoEnabled: false,
      logoDataUrl: '',
      encodeField: 'qrCode',
    },
    branding: {
      companyName: '',
      logoDataUrl: '',
    },
    elements: defaultElements(kind),
  };
}

function emptyStore(companyId) {
  const barcode = createDefaultTemplate('barcode', companyId);
  const qr = createDefaultTemplate('qr', companyId);
  qr.isDefault = true;
  barcode.isDefault = true;
  return {
    companyId: String(companyId || ''),
    defaultBarcodeId: barcode.id,
    defaultQrId: qr.id,
    templates: [barcode, qr],
  };
}

function readStore() {
  const companyId = activeCompanyId();
  const file = companyPath();
  if (!fs.existsSync(file)) {
    const store = emptyStore(companyId);
    writeStore(store);
    return store;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || !Array.isArray(raw.templates)) {
      const store = emptyStore(companyId);
      writeStore(store);
      return store;
    }
    // Hard company isolation — never return another company's templates
    if (raw.companyId && companyId && String(raw.companyId) !== String(companyId)) {
      const store = emptyStore(companyId);
      writeStore(store);
      return store;
    }
    raw.companyId = companyId;
    return raw;
  } catch {
    const store = emptyStore(companyId);
    writeStore(store);
    return store;
  }
}

function writeStore(store) {
  const file = companyPath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const payload = {
    ...store,
    companyId: activeCompanyId(),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function listTemplates() {
  const store = readStore();
  return {
    success: true,
    data: {
      companyId: store.companyId,
      defaultBarcodeId: store.defaultBarcodeId,
      defaultQrId: store.defaultQrId,
      templates: store.templates,
    },
  };
}

function getTemplate(id) {
  const store = readStore();
  const tpl = store.templates.find((t) => String(t.id) === String(id));
  if (!tpl) return { success: false, message: 'Template not found' };
  return { success: true, data: tpl };
}

function getDefaultTemplate(kind) {
  const store = readStore();
  const k = kind === 'qr' ? 'qr' : 'barcode';
  const defaultId = k === 'qr' ? store.defaultQrId : store.defaultBarcodeId;
  let tpl = store.templates.find((t) => String(t.id) === String(defaultId) && t.kind === k);
  if (!tpl) tpl = store.templates.find((t) => t.kind === k);
  if (!tpl) {
    tpl = createDefaultTemplate(k, store.companyId);
    store.templates.push(tpl);
    if (k === 'qr') store.defaultQrId = tpl.id;
    else store.defaultBarcodeId = tpl.id;
    writeStore(store);
  }
  return { success: true, data: tpl };
}

function saveTemplate(input) {
  if (!input || typeof input !== 'object') {
    return { success: false, message: 'Invalid template payload' };
  }
  const store = readStore();
  const companyId = activeCompanyId();
  const now = new Date().toISOString();
  let tpl = { ...input, companyId, updatedAt: now };

  if (!tpl.id) {
    tpl.id = uid();
    tpl.createdAt = now;
    if (!tpl.name) tpl.name = 'Untitled Label';
    if (!tpl.kind) tpl.kind = 'barcode';
    if (!Array.isArray(tpl.elements)) tpl.elements = defaultElements(tpl.kind);
    store.templates.push(tpl);
  } else {
    const idx = store.templates.findIndex((t) => String(t.id) === String(tpl.id));
    if (idx < 0) return { success: false, message: 'Template not found' };
    const prev = store.templates[idx];
    if (prev.companyId && String(prev.companyId) !== String(companyId)) {
      return { success: false, message: 'Company mismatch' };
    }
    tpl = { ...prev, ...tpl, id: prev.id, companyId, createdAt: prev.createdAt || now, updatedAt: now };
    store.templates[idx] = tpl;
  }

  if (tpl.isDefault) {
    if (tpl.kind === 'qr') {
      store.defaultQrId = tpl.id;
      store.templates.forEach((t) => {
        if (t.kind === 'qr') t.isDefault = String(t.id) === String(tpl.id);
      });
    } else {
      store.defaultBarcodeId = tpl.id;
      store.templates.forEach((t) => {
        if (t.kind === 'barcode') t.isDefault = String(t.id) === String(tpl.id);
      });
    }
  }

  writeStore(store);
  return { success: true, data: tpl };
}

function duplicateTemplate(id) {
  const store = readStore();
  const src = store.templates.find((t) => String(t.id) === String(id));
  if (!src) return { success: false, message: 'Template not found' };
  const now = new Date().toISOString();
  const copy = {
    ...JSON.parse(JSON.stringify(src)),
    id: uid(),
    name: `${src.name || 'Template'} (Copy)`,
    isDefault: false,
    companyId: activeCompanyId(),
    createdAt: now,
    updatedAt: now,
  };
  store.templates.push(copy);
  writeStore(store);
  return { success: true, data: copy };
}

function deleteTemplate(id) {
  const store = readStore();
  const idx = store.templates.findIndex((t) => String(t.id) === String(id));
  if (idx < 0) return { success: false, message: 'Template not found' };
  const removed = store.templates[idx];
  const sameKind = store.templates.filter((t) => t.kind === removed.kind);
  if (sameKind.length <= 1) {
    return { success: false, message: 'Cannot delete the last template of this type' };
  }
  store.templates.splice(idx, 1);
  if (removed.kind === 'qr' && String(store.defaultQrId) === String(id)) {
    const next = store.templates.find((t) => t.kind === 'qr');
    store.defaultQrId = next ? next.id : '';
    if (next) next.isDefault = true;
  }
  if (removed.kind === 'barcode' && String(store.defaultBarcodeId) === String(id)) {
    const next = store.templates.find((t) => t.kind === 'barcode');
    store.defaultBarcodeId = next ? next.id : '';
    if (next) next.isDefault = true;
  }
  writeStore(store);
  return { success: true, data: { id } };
}

function setDefault(id) {
  const store = readStore();
  const tpl = store.templates.find((t) => String(t.id) === String(id));
  if (!tpl) return { success: false, message: 'Template not found' };
  tpl.isDefault = true;
  if (tpl.kind === 'qr') {
    store.defaultQrId = tpl.id;
    store.templates.forEach((t) => {
      if (t.kind === 'qr') t.isDefault = String(t.id) === String(tpl.id);
    });
  } else {
    store.defaultBarcodeId = tpl.id;
    store.templates.forEach((t) => {
      if (t.kind === 'barcode') t.isDefault = String(t.id) === String(tpl.id);
    });
  }
  writeStore(store);
  return { success: true, data: tpl };
}

function resetDefaults() {
  const companyId = activeCompanyId();
  const store = emptyStore(companyId);
  writeStore(store);
  return { success: true, data: store };
}

module.exports = {
  bind,
  listTemplates,
  getTemplate,
  getDefaultTemplate,
  saveTemplate,
  duplicateTemplate,
  deleteTemplate,
  setDefault,
  resetDefaults,
  createDefaultTemplate,
};
