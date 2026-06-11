'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ───── Types ───── */
interface NodeStyle { id: string; fill: string; stroke: string; strokeWidth: string; color: string; fontSize: string; opacity: string; }
interface LinkStyle { index: number; stroke: string; strokeWidth: string; }
interface StylePreset { name: string; nodeStyles: NodeStyle[]; linkStyles: LinkStyle[]; }

/* ───── Constants ───── */
const DEFAULT_CODE = `graph TD
    A[شروع فرآیند] --> B{شرط بررسی}
    B -->|بله| C[انجام عملیات]
    B -->|خیر| D[اتمام]
    C --> E[بررسی نتیجه]
    E --> F[ذخیره خروجی]
    F --> D`;

const BUILTIN_PRESETS: StylePreset[] = [
  { name: 'آبی', nodeStyles: [{ id: '', fill: '#e3f2fd', stroke: '#1976d2', strokeWidth: '1.5', color: '#000', fontSize: '14', opacity: '1' }], linkStyles: [] },
  { name: 'نارنجی', nodeStyles: [{ id: '', fill: '#fff3e0', stroke: '#f57c00', strokeWidth: '1.5', color: '#000', fontSize: '14', opacity: '1' }], linkStyles: [] },
  { name: 'بنفش', nodeStyles: [{ id: '', fill: '#f3e5f5', stroke: '#9c27b0', strokeWidth: '1.5', color: '#000', fontSize: '14', opacity: '1' }], linkStyles: [] },
  { name: 'سبز', nodeStyles: [{ id: '', fill: '#e8f5e9', stroke: '#2e7d32', strokeWidth: '2.5', color: '#000', fontSize: '14', opacity: '1' }], linkStyles: [] },
  { name: 'سبزآبی', nodeStyles: [{ id: '', fill: '#e0f2f1', stroke: '#009688', strokeWidth: '1.5', color: '#000', fontSize: '14', opacity: '1' }], linkStyles: [] },
  { name: 'نیلی', nodeStyles: [{ id: '', fill: '#e8eaf6', stroke: '#3f51b5', strokeWidth: '1.5', color: '#000', fontSize: '14', opacity: '1' }], linkStyles: [] },
];

const TEMPLATES = [
  { n: 'فلوچارت', c: 'graph TD\n    A[شروع] --> B{تصمیم}\n    B -->|بله| C[عملیات]\n    B -->|خیر| D[پایان]' },
  { n: 'توالی', c: 'sequenceDiagram\n    participant کاربر\n    participant سرور\n    کاربر->>سرور: درخواست\n    سرور-->>کاربر: پاسخ' },
  { n: 'کلاس', c: 'classDiagram\n    class Animal { +name +makeSound() }\n    class Dog { +bark() }\n    Animal <|-- Dog' },
  { n: 'وضعیت', c: 'stateDiagram-v2\n    [*] --> فعال\n    فعال --> غیرفعال\n    غیرفعال --> فعال\n    فعال --> [*]' },
  { n: 'ER', c: 'erDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ ITEM : contains' },
  { n: 'گانت', c: 'gantt\n    title پروژه\n    dateFormat YYYY-MM-DD\n    section طراحی\n    طراحی :a1, 2024-01-01, 30d' },
  { n: 'دایره‌ای', c: 'pie title توزیع\n    "توسعه" : 40\n    "طراحی" : 25\n    "تست" : 20' },
  { n: 'سفر', c: 'journey\n    title سفارش\n    section خرید\n      پرداخت: 4: کاربر' },
  { n: 'Git', c: 'gitGraph\n    commit\n    branch develop\n    commit\n    checkout main\n    merge develop' },
  { n: 'ذهنی', c: 'mindmap\n  root((موضوع))\n    شاخه ۱\n    شاخه ۲' },
  { n: 'تایم‌لاین', c: 'timeline\n    title تاریخچه\n    section ۲۰۲۳\n      نسخه ۱ : Q1' },
  { n: 'سانکی', c: 'sankey-beta\n    انرژی,برق,۵۰\n    برق,صنعت,۳۰' },
  { n: 'چارچربخش', c: 'quadrantChart\n    title تحلیل\n    x-axis پایین --> بالا\n    y-axis پایین --> بالا\n    پروژه: [0.7, 0.8]' },
  { n: 'افقی', c: 'flowchart LR\n    A[شروع] --> B\n    B --> C[پایان]' },
];

/* ───── CDN Loaders ───── */
let _m: unknown = null;
function loadMermaid(): Promise<unknown> {
  if (_m) return Promise.resolve(_m);
  if ((window as Record<string, unknown>).mermaid) { _m = (window as Record<string, unknown>).mermaid; return Promise.resolve(_m); }
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    s.onload = () => { _m = (window as Record<string, unknown>).mermaid; res(_m); };
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

let _h2c: unknown = null;
function loadHtml2Canvas(): Promise<unknown> {
  if (_h2c) return Promise.resolve(_h2c);
  if ((window as Record<string, unknown>).html2canvas) { _h2c = (window as Record<string, unknown>).html2canvas; return Promise.resolve(_h2c); }
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2canvas-pro@1.5.1/dist/html2canvas-pro.min.js';
    s.onload = () => { _h2c = (window as Record<string, unknown>).html2canvas; res(_h2c); };
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

let _jspdf: unknown = null;
function loadJsPDF(): Promise<unknown> {
  if (_jspdf) return Promise.resolve(_jspdf);
  if ((window as Record<string, unknown>).jspdf) { _jspdf = (window as Record<string, unknown>).jspdf; return Promise.resolve(_jspdf); }
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
    s.onload = () => { _jspdf = ((window as Record<string, unknown>).jspdf as Record<string, unknown>).jsPDF; res(_jspdf); };
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

/* ───── Component ───── */
export default function MermaidEditor() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [projectName, setProjectName] = useState('پروژه جدید');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [nodeStyles, setNodeStyles] = useState<NodeStyle[]>([]);
  const [linkStyles, setLinkStyles] = useState<LinkStyle[]>([]);
  const [stylePresets, setStylePresets] = useState<StylePreset[]>([...BUILTIN_PRESETS]);
  const [themeName, setThemeName] = useState('default');
  const [fontFamily, setFontFamily] = useState('Vazirmatn');
  const [fontSize, setFontSize] = useState(16);
  const [textDir, setTextDir] = useState<'rtl'|'ltr'>('rtl');
  const [zoom, setZoom] = useState(100);
  const [ready, setReady] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [panel, setPanel] = useState<'none'|'styler'|'templates'|'projects'|'export'>('none');
  const [isSaving, setIsSaving] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const cntRef = useRef(0);
  const { toast: _toast } = { toast: (_m: string) => { /* no-op for now */ } };

  useEffect(() => { loadMermaid().then(() => setReady(true)).catch(e => setErrMsg(String(e))); }, []);

  const getFullCode = useCallback(() => {
    let c = code;
    nodeStyles.filter(s => s.id.trim()).forEach(s => {
      const p: string[] = [];
      if (s.fill) p.push(`fill:${s.fill}`); if (s.stroke) p.push(`stroke:${s.stroke}`);
      if (s.strokeWidth) p.push(`stroke-width:${s.strokeWidth}px`); if (s.color) p.push(`color:${s.color}`);
      if (s.opacity && s.opacity !== '1') p.push(`opacity:${s.opacity}`);
      if (p.length) c += `\nstyle ${s.id} ${p.join(',')}`;
    });
    linkStyles.filter(s => s.index >= 0).forEach(s => {
      const p: string[] = [];
      if (s.stroke) p.push(`stroke:${s.stroke}`); if (s.strokeWidth) p.push(`stroke-width:${s.strokeWidth}px`);
      if (p.length) c += `\nlinkStyle ${s.index} ${p.join(',')}`;
    });
    return c;
  }, [code, nodeStyles, linkStyles]);

  const render = useCallback(async () => {
    const fc = getFullCode(); if (!fc.trim() || !ready) return;
    try {
      const m = _m as { initialize: (c: Record<string, unknown>) => void; render: (id: string, c: string) => Promise<{ svg: string }> };
      m.initialize({ startOnLoad: false, theme: themeName, themeVariables: { fontFamily, fontSize: `${fontSize}px` }, securityLevel: 'loose' });
      cntRef.current++;
      const { svg } = await m.render(`m${cntRef.current}`, fc);
      if (previewRef.current) { previewRef.current.innerHTML = svg; previewRef.current.style.transform = `scale(${zoom / 100})`; previewRef.current.style.transformOrigin = 'center'; }
      setErrMsg('');
    } catch (e) { setErrMsg(e instanceof Error ? e.message : 'خطا'); }
  }, [getFullCode, ready, themeName, fontFamily, fontSize, zoom]);

  useEffect(() => { if (!ready) return; const t = setTimeout(render, 400); return () => clearTimeout(t); }, [render, ready]);

  const ids = useCallback(() => { const s = new Set<string>(); let m; const r1 = /([A-Za-z_]\w*)\s*(?:\[|\{|\(|-->|---|->|==>|:::)/g; while ((m = r1.exec(code)) !== null) s.add(m[1]); const r2 = /(?:-->|---|->|==>)\s*([A-Za-z_]\w*)/g; while ((m = r2.exec(code)) !== null) s.add(m[1]); return Array.from(s).sort(); }, [code])();
  const linkCnt = (code.match(/-->/g) || []).length;

  const saveProject = async () => {
    setIsSaving(true);
    try {
      const customPresets = stylePresets.filter(p => !BUILTIN_PRESETS.some(bp => bp.name === p.name));
      const payload = { name: projectName, code, direction: textDir, fontFamily, fontSize, textDirection: textDir, stylePresets: JSON.stringify({ nodeStyles, linkStyles, customPresets, themeSettings: { mermaidTheme: themeName } }) };
      const res = projectId
        ? await fetch(`/api/projects/${projectId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { const d = await res.json(); if (!projectId) setProjectId(d.id); }
    } catch {}
    setIsSaving(false);
  };

  const loadProject = async (p: Record<string, unknown>) => {
    setProjectId(String(p.id)); setProjectName(String(p.name)); setCode(String(p.code));
    setTextDir((p.textDirection as 'rtl'|'ltr') || 'rtl'); setFontFamily(String(p.fontFamily || 'Vazirmatn')); setFontSize(Number(p.fontSize) || 16);
    setNodeStyles([]); setLinkStyles([]); setStylePresets([...BUILTIN_PRESETS]);
    const raw = p.stylePresets;
    if (raw && typeof raw === 'string' && raw !== '{}') {
      try { const d = JSON.parse(raw); if (Array.isArray(d.nodeStyles)) setNodeStyles(d.nodeStyles); if (Array.isArray(d.linkStyles)) setLinkStyles(d.linkStyles); if (Array.isArray(d.customPresets)) setStylePresets([...BUILTIN_PRESETS, ...d.customPresets]); if (d.themeSettings?.mermaidTheme) setThemeName(d.themeSettings.mermaidTheme); } catch {}
    }
    setPanel('none');
  };

  const [projects, setProjects] = useState<Record<string, unknown>[]>([]);
  const loadProjects = async () => { try { const r = await fetch('/api/projects'); if (r.ok) setProjects(await r.json()); } catch {} };

  const addNodeStyle = (id: string, p?: NodeStyle) => setNodeStyles([...nodeStyles, p ? { ...p, id } : { id, fill: '#ECECFF', stroke: '#9370DB', strokeWidth: '1.5', color: '#1B1B1B', fontSize: '14', opacity: '1' }]);

  return (
    <div className="h-screen flex flex-col" dir="rtl" style={{ fontFamily: "'Vazirmatn', sans-serif", background: '#f8fafc' }}>
      {/* Header */}
      <header style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #c9d065, #2a9d8f)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 'bold' }}>ر</div>
          <span style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b' }}>رسام</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input value={projectName} onChange={e => setProjectName(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 8px', fontSize: 11, width: 120 }} />
          <span style={{ fontSize: 9, background: projectId ? '#2a9d8f' : '#f1f5f9', color: projectId ? 'white' : '#64748b', padding: '1px 6px', borderRadius: 4 }}>{projectId ? 'ذخیره' : 'جدید'}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => { setProjectId(null); setProjectName('پروژه جدید'); setCode(DEFAULT_CODE); }} style={btnStyle} title="جدید">➕</button>
          <button onClick={() => { loadProjects(); setPanel('projects'); }} style={btnStyle} title="پروژه‌ها">📂</button>
          <button onClick={saveProject} disabled={isSaving} style={{ ...btnStyle, opacity: isSaving ? 0.5 : 1 }} title="ذخیره">💾</button>
          <span style={{ borderLeft: '1px solid #e2e8f0', margin: '0 2px' }} />
          <button onClick={() => setPanel('templates')} style={btnStyle} title="قالب‌ها">📋</button>
          <button onClick={() => setPanel('styler')} style={btnStyle} title="استایل">🎨</button>
          <span style={{ borderLeft: '1px solid #e2e8f0', margin: '0 2px' }} />
          <button onClick={() => setPanel('export')} style={{ ...btnStyle, background: '#2a9d8f', color: 'white', borderRadius: 6 }} title="خروجی">📥 خروجی</button>
        </div>
      </header>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Editor */}
        <div style={{ width: '35%', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', background: 'white' }}>
          <div style={{ padding: '4px 8px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#64748b' }}>ویرایشگر</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setTextDir('rtl')} style={{ fontSize: 9, padding: '1px 4px', background: textDir === 'rtl' ? '#2a9d8f' : '#f1f5f9', color: textDir === 'rtl' ? 'white' : '#64748b', border: 'none', borderRadius: 3, cursor: 'pointer' }}>راست</button>
              <button onClick={() => setTextDir('ltr')} style={{ fontSize: 9, padding: '1px 4px', background: textDir === 'ltr' ? '#2a9d8f' : '#f1f5f9', color: textDir === 'ltr' ? 'white' : '#64748b', border: 'none', borderRadius: 3, cursor: 'pointer' }}>چپ</button>
            </div>
          </div>
          <textarea value={code} onChange={e => setCode(e.target.value)} style={{ flex: 1, padding: 8, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6, border: 'none', outline: 'none', resize: 'none', direction: 'ltr' }} spellCheck={false} />
          <div style={{ padding: '4px 8px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: '#64748b' }}>
            <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} style={{ fontSize: 9, border: '1px solid #e2e8f0', borderRadius: 3, padding: '1px 4px' }}>
              <option value="Vazirmatn">وزیرمتن</option><option value="Tahoma">تاهوما</option><option value="Arial">اریال</option><option value="sans-serif">بدون سریف</option>
            </select>
            <span>{fontSize}px</span>
            <input type="range" min={10} max={32} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} style={{ width: 50 }} />
            <select value={themeName} onChange={e => setThemeName(e.target.value)} style={{ fontSize: 9, border: '1px solid #e2e8f0', borderRadius: 3, padding: '1px 4px' }}>
              <option value="default">پیش‌فرض</option><option value="dark">تیره</option><option value="forest">جنگلی</option><option value="neutral">خنثی</option><option value="base">پایه</option>
            </select>
          </div>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white' }}>
          <div style={{ padding: '4px 8px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#64748b' }}>پیش‌نمایش</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={() => setZoom(Math.max(25, zoom - 25))} style={btnStyle}>➖</button>
              <span style={{ fontSize: 9, color: '#64748b' }}>{zoom}%</span>
              <button onClick={() => setZoom(Math.min(400, zoom + 25))} style={btnStyle}>➕</button>
              <button onClick={() => setZoom(100)} style={btnStyle}>🔄</button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {errMsg ? <pre style={{ color: '#dc2626', fontSize: 11, direction: 'ltr' }}>{errMsg}</pre> :
              !ready ? <span style={{ color: '#94a3b8', fontSize: 11 }}>در حال بارگذاری مری‌مید...</span> :
              <div ref={previewRef} style={{ direction: textDir as 'rtl' | 'ltr', fontFamily: `'${fontFamily}', sans-serif` }} />
            }
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ background: 'white', borderTop: '1px solid #e2e8f0', padding: '3px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#94a3b8' }}>
        <span>رسام</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span>تم: {themeName}</span><span>متن: {textDir === 'rtl' ? 'راست‌چین' : 'چپ‌چین'}</span><span>{fontFamily} {fontSize}px</span>
        </div>
      </footer>

      {/* ─── Side Panels ─── */}
      {panel !== 'none' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setPanel('none')}>
          <div style={{ width: 360, background: 'white', height: '100%', overflow: 'auto', padding: 16, direction: 'rtl' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 'bold' }}>{panel === 'styler' ? '🎨 استایل‌دهی' : panel === 'templates' ? '📋 قالب‌ها' : panel === 'projects' ? '📂 پروژه‌ها' : '📥 خروجی'}</h3>
              <button onClick={() => setPanel('none')} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            {panel === 'styler' && (
              <div>
                <h4 style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 6 }}>گره‌ها ({nodeStyles.length})</h4>
                <div style={{ marginBottom: 8 }}>
                  <select onChange={e => { if (e.target.value) addNodeStyle(e.target.value); e.target.value = ''; }} style={{ fontSize: 10, width: '100%', padding: 4, border: '1px solid #e2e8f0', borderRadius: 4 }}>
                    <option value="">افزودن گره...</option>
                    {ids.filter(id => !nodeStyles.some(s => s.id === id)).map(id => <option key={id} value={id}>{id}</option>)}
                  </select>
                </div>
                {nodeStyles.map((s, i) => (
                  <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 8, marginBottom: 4, background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 'bold' }}>{s.id}</span>
                      <button onClick={() => setNodeStyles(nodeStyles.filter((_, x) => x !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9 }}>
                      <div>پرکردن: <input type="color" value={s.fill} onChange={e => { const u = [...nodeStyles]; u[i] = { ...u[i], fill: e.target.value }; setNodeStyles(u); }} /></div>
                      <div>حاشیه: <input type="color" value={s.stroke} onChange={e => { const u = [...nodeStyles]; u[i] = { ...u[i], stroke: e.target.value }; setNodeStyles(u); }} /></div>
                      <div>متن: <input type="color" value={s.color} onChange={e => { const u = [...nodeStyles]; u[i] = { ...u[i], color: e.target.value }; setNodeStyles(u); }} /></div>
                    </div>
                  </div>
                ))}

                <h4 style={{ fontSize: 11, fontWeight: 'bold', margin: '12px 0 6px' }}>اتصالات ({linkStyles.length})</h4>
                <button onClick={() => setLinkStyles([...linkStyles, { index: linkStyles.length, stroke: '#9370DB', strokeWidth: '2' }])} style={{ fontSize: 10, padding: '4px 8px', background: '#2a9d8f', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', marginBottom: 4 }}>+ افزودن اتصال</button>
                <span style={{ fontSize: 9, color: '#94a3b8', marginRight: 8 }}>تعداد: {linkCnt}</span>
                {linkStyles.map((s, i) => (
                  <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 8, marginBottom: 4, background: '#f8fafc', display: 'flex', gap: 8, alignItems: 'center', fontSize: 9 }}>
                    <span>شماره: <input type="number" value={s.index} onChange={e => { const u = [...linkStyles]; u[i] = { ...u[i], index: parseInt(e.target.value) || 0 }; setLinkStyles(u); }} style={{ width: 30, fontSize: 9 }} min={0} /></span>
                    <span>رنگ: <input type="color" value={s.stroke} onChange={e => { const u = [...linkStyles]; u[i] = { ...u[i], stroke: e.target.value }; setLinkStyles(u); }} /></span>
                    <span>ضخامت: <input value={s.strokeWidth} onChange={e => { const u = [...linkStyles]; u[i] = { ...u[i], strokeWidth: e.target.value }; setLinkStyles(u); }} style={{ width: 30, fontSize: 9 }} /></span>
                    <button onClick={() => setLinkStyles(linkStyles.filter((_, x) => x !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}

                <h4 style={{ fontSize: 11, fontWeight: 'bold', margin: '12px 0 6px' }}>پریست‌ها</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {stylePresets.map((p, pi) => (
                    <button key={pi} onClick={() => { ids.forEach(id => addNodeStyle(id, p.nodeStyles[0])); }} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 6, background: '#f8fafc', cursor: 'pointer', textAlign: 'right' }}>
                      <div style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 2 }}>{p.name}</div>
                      <div style={{ display: 'flex', gap: 2 }}>{p.nodeStyles.slice(0, 3).map((ns, j) => <div key={j} style={{ width: 20, height: 12, borderRadius: 2, background: ns.fill, border: `1px solid ${ns.stroke}`, fontSize: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ن</div>)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {panel === 'templates' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => { setCode(t.c); setPanel('none'); }} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 8, background: '#f8fafc', cursor: 'pointer', textAlign: 'right' }}>
                    <div style={{ fontSize: 10, fontWeight: 'bold' }}>{t.n}</div>
                    <div style={{ fontSize: 7, color: '#94a3b8', direction: 'ltr', textAlign: 'left', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.c.split('\n')[0]}</div>
                  </button>
                ))}
              </div>
            )}

            {panel === 'projects' && (
              <div>
                {projects.length === 0 ? <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 11 }}>پروژه‌ای نیست</div> :
                projects.map(p => (
                  <div key={String(p.id)} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: 8, marginBottom: 4, cursor: 'pointer', background: projectId === p.id ? '#f3e8ff' : 'white' }} onClick={() => loadProject(p)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, fontWeight: 'bold' }}>{String(p.name)}</span>
                      <button onClick={e => { e.stopPropagation(); fetch(`/api/projects/${p.id}`, { method: 'DELETE' }); loadProjects(); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10 }}>🗑️</button>
                    </div>
                    <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>{String(p.code || '').length} کاراکتر · {String(p.fontFamily || 'Vazirmatn')}</div>
                  </div>
                ))}
              </div>
            )}

            {panel === 'export' && <ExportPanel fontFamily={fontFamily} textDir={textDir} projectName={projectName} previewRef={previewRef} onClose={() => setPanel('none')} />}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── Export Panel ───── */
function ExportPanel({ fontFamily, textDir, projectName, previewRef, onClose }: { fontFamily: string; textDir: string; projectName: string; previewRef: React.RefObject<HTMLDivElement | null>; onClose: () => void }) {
  const [fmt, setFmt] = useState<'png'|'jpg'|'svg'|'pdf'|'tiff'>('png');
  const [w, setW] = useState(1920); const [h, setH] = useState(1080);
  const [dpi, setDpi] = useState(150); const [quality, setQuality] = useState(92);
  const [bg, setBg] = useState('#FFFFFF');
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    const svgEl = previewRef.current?.querySelector('svg');
    if (!svgEl) { setBusy(false); return; }

    if (fmt === 'svg') {
      const clone = svgEl.cloneNode(true) as SVGElement;
      const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      st.textContent = `text { font-family: '${fontFamily}', sans-serif !important; }`;
      clone.insertBefore(st, clone.firstChild);
      const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${projectName}.svg`; a.click();
      setBusy(false); onClose(); return;
    }

    try {
      const h2c = await loadHtml2Canvas();
      const scale = dpi / 96;
      const wrapper = document.createElement('div');
      Object.assign(wrapper.style, { position: 'absolute', left: '-9999px', top: '0', width: `${w}px`, height: `${h}px`, backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', fontFamily: `'${fontFamily}', sans-serif`, direction: textDir });
      const svgClone = svgEl.cloneNode(true) as SVGElement;
      const bbox = svgEl.getBoundingClientRect();
      const sx = (w - 80) / bbox.width; const sy = (h - 80) / bbox.height; const fs = Math.min(sx, sy, 3);
      Object.assign(svgClone.style, { width: `${bbox.width}px`, height: `${bbox.height}px`, transform: `scale(${fs})`, transformOrigin: 'center center', maxWidth: 'none', maxHeight: 'none' });
      wrapper.appendChild(svgClone); document.body.appendChild(wrapper);
      await document.fonts.ready; await new Promise(r => setTimeout(r, 200));
      const canvas = await h2c(wrapper, { scale, backgroundColor: bg, useCORS: true, allowTaint: true, width: w, height: h });
      document.body.removeChild(wrapper);

      if (fmt === 'pdf') {
        const JsPDF = await loadJsPDF();
        const img = canvas.toDataURL('image/png', quality / 100);
        const pw = w * 72 / dpi; const ph = h * 72 / dpi;
        const doc = new JsPDF({ orientation: pw > ph ? 'landscape' : 'portrait', unit: 'px', format: [pw, ph] });
        doc.addImage(img, 'PNG', 0, 0, pw, ph); doc.save(`${projectName}.pdf`);
      } else if (fmt === 'tiff') {
        const pngBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png', 1));
        if (pngBlob) { const fd = new FormData(); fd.append('image', pngBlob, 'i.png'); fd.append('format', 'tiff'); const res = await fetch('/api/export', { method: 'POST', body: fd }); if (res.ok) { const b = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${projectName}.tiff`; a.click(); } }
      } else {
        canvas.toBlob(blob => { if (blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${projectName}.${fmt}`; a.click(); } }, fmt === 'jpg' ? 'image/jpeg' : 'image/png', quality / 100);
      }
    } catch {}
    setBusy(false); onClose();
  };

  return (
    <div style={{ fontSize: 10 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {(['png','jpg','svg','pdf','tiff'] as const).map(f => (
          <button key={f} onClick={() => setFmt(f)} style={{ flex: 1, padding: '4px 0', background: fmt === f ? '#2a9d8f' : '#f1f5f9', color: fmt === f ? 'white' : '#64748b', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 9 }}>{f.toUpperCase()}</button>
        ))}
      </div>
      {fmt !== 'svg' && <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
          <div>عرض: <input type="number" value={w} onChange={e => setW(parseInt(e.target.value) || 1920)} style={{ width: 60, fontSize: 9 }} /></div>
          <div>ارتفاع: <input type="number" value={h} onChange={e => setH(parseInt(e.target.value) || 1080)} style={{ width: 60, fontSize: 9 }} /></div>
        </div>
        <div style={{ marginBottom: 8 }}>DPI: <input type="range" min={72} max={600} value={dpi} onChange={e => setDpi(Number(e.target.value))} style={{ width: 100 }} /> <span>{dpi}</span></div>
        <div style={{ marginBottom: 8 }}>پس‌زمینه: <input type="color" value={bg} onChange={e => setBg(e.target.value)} /></div>
      </div>}
      <button onClick={doExport} disabled={busy} style={{ width: '100%', padding: 8, background: '#2a9d8f', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>{busy ? 'در حال تولید...' : '📥 دانلود'}</button>
    </div>
  );
}

const btnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px', borderRadius: 4 };
