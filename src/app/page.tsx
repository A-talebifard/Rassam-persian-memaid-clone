'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FilePlus, FolderOpen, Save, LayoutTemplate, Palette, Download,
  ZoomIn, ZoomOut, RotateCcw, X, Trash2, Plus,
  AlignRight, AlignLeft, FileImage, FileText, FileDown,
  Pencil, Check, Upload, Github, PackageOpen, Type, Settings,
  Sun, Moon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
// html2canvas removed - using SVG→Image→Canvas pipeline for export

/* ───── Types ───── */
interface NS { id: string; fill: string; stroke: string; sw: string; color: string; fs: string; op: string; }
interface LS { idx: number; stroke: string; sw: string; }
interface SP { name: string; ns: NS[]; ls: LS[]; }
interface CustomFont { name: string; base64: string; format: string; }

/* ───── Constants ───── */
const DEFAULT_CODE = `graph TD
    %% تعریف استایل‌ها (مطابق با پالت رنگی شما)
    classDef input fill:#d4e6f1,stroke:#2874a6,stroke-width:2px;
    classDef process fill:#fdebd0,stroke:#ca6f1e,stroke-width:2px;
    classDef core fill:#d5f5e3,stroke:#1e8449,stroke-width:3px;
    classDef decision fill:#fadbd8,stroke:#c0392b,stroke-width:2px;
    classDef output fill:#e8daef,stroke:#7d3c98,stroke-width:2px;

    A[وضعیت فعلی]:::input --> B{اقدام لازم؟}:::decision
    B -->|بله| C[قدم بعدی]:::process
    B -->|خیر| D[توقف موقت]:::process
    C --> E[نتیجه]:::process
    E --> F{نزدیک‌تر شدی؟}:::decision
    F -->|بله| G[ادامه]:::core
    F -->|خیر| H[تغییر روش]:::decision
    H --> C
    G --> I{هدف رسید؟}:::decision
    I -->|خیر| C
    I -->|بله| J[پایان]:::output`;

const BUILT_IN_PRESETS: SP[] = [
  { name: 'آبی', ns: [{ id: '', fill: '#e3f2fd', stroke: '#1976d2', sw: '1.5', color: '#000', fs: '14', op: '1' }], ls: [] },
  { name: 'نارنجی', ns: [{ id: '', fill: '#fff3e0', stroke: '#f57c00', sw: '1.5', color: '#000', fs: '14', op: '1' }], ls: [] },
  { name: 'بنفش', ns: [{ id: '', fill: '#f3e5f5', stroke: '#9c27b0', sw: '1.5', color: '#000', fs: '14', op: '1' }], ls: [] },
  { name: 'سبز', ns: [{ id: '', fill: '#e8f5e9', stroke: '#2e7d32', sw: '2.5', color: '#000', fs: '14', op: '1' }], ls: [] },
  { name: 'سبزآبی', ns: [{ id: '', fill: '#e0f2f1', stroke: '#009688', sw: '1.5', color: '#000', fs: '14', op: '1' }], ls: [] },
  { name: 'نیلی', ns: [{ id: '', fill: '#e8eaf6', stroke: '#3f51b5', sw: '1.5', color: '#000', fs: '14', op: '1' }], ls: [] },
];

const BUILTIN_TEMPLATES = [
  // ──── جریان (Flow) ────
  { n: 'فلوچارت', c: 'graph TD\n    A[شروع] --> B{تصمیم}\n    B -->|بله| C[عملیات]\n    B -->|خیر| D[پایان]', cat: 'جریان' },
  { n: 'فلوچارت افقی', c: 'flowchart LR\n    A[شروع] --> B[بررسی]\n    B --> C[عملیات]\n    C --> D[پایان]', cat: 'جریان' },
  { n: 'توالی', c: 'sequenceDiagram\n    کاربر->>سرور: درخواست\n    سرور-->>کاربر: پاسخ\n    کاربر->>سرور: تایید\n    سرور-->>کاربر: نتیجه', cat: 'جریان' },
  // ──── ساختاری (Structural) ────
  { n: 'کلاس', c: 'classDiagram\n    class Animal {\n        +String name\n        +makeSound()\n    }\n    class Dog {\n        +bark()\n    }\n    Animal <|-- Dog', cat: 'ساختاری' },
  { n: 'وضعیت', c: 'stateDiagram-v2\n    [*] --> فعال\n    فعال --> غیرفعال : توقف\n    غیرفعال --> فعال : شروع\n    فعال --> [*] : پایان', cat: 'ساختاری' },
  { n: 'ER', c: 'erDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ ITEM : includes\n    PRODUCT ||--o{ ITEM : has', cat: 'ساختاری' },
  // ───ـ زمانی (Temporal) ────
  { n: 'گانت', c: 'gantt\n    title Project Plan\n    dateFormat YYYY-MM-DD\n    section Design\n    UI Design :a1, 2024-01-01, 20d\n    section Dev\n    Coding :a2, after a1, 30d', cat: 'زمانی' },
  { n: 'تایم‌لاین', c: 'timeline\n    title Project History\n    section 2023\n      Design : Q1\n      Dev : Q2\n    section 2024\n      Test : Q1\n      Release : Q2', cat: 'زمانی' },
  { n: 'سفر کاربر', c: 'journey\n    title Online Shopping\n    section Search\n      Find product: 5: User\n    section Purchase\n      Add to cart: 4: User\n      Payment: 3: User', cat: 'زمانی' },
  // ──── داده‌ای (Data) ────
  { n: 'دایره‌ای', c: 'pie title Time Distribution\n    "Dev" : 40\n    "Design" : 25\n    "Test" : 20\n    "Deploy" : 15', cat: 'داده‌ای' },
  { n: 'سانکی', c: 'sankey-beta\n    Energy,Electricity,50\n    Energy,Gas,30\n    Electricity,Industry,30\n    Electricity,Home,20\n    Gas,Industry,20\n    Gas,Home,10', cat: 'داده‌ای' },
  { n: 'چارچربخش', c: 'quadrantChart\n    title Priority Analysis\n    x-axis Low Effort --> High Effort\n    y-axis Low Impact --> High Impact\n    Project A: [0.3, 0.8]\n    Project B: [0.7, 0.6]\n    Project C: [0.8, 0.2]', cat: 'داده‌ای' },
  { n: 'رادار', c: 'radar-beta\n    title Team Assessment\n    axis quality["Quality"], speed["Speed"], security["Security"], docs["Docs"], tests["Tests"]\n    curve{TeamA}: [8, 6, 7, 5, 9]\n    curve{TeamB}: [5, 8, 6, 8, 4]', cat: 'داده‌ای' },
  { n: 'نمودار XY', c: 'xychart-beta\n    title "Monthly Sales"\n    x-axis ["Jan","Feb","Mar"]\n    y-axis "Count" 0 --> 100\n    bar [45, 60, 75]\n    line [30, 50, 65]', cat: 'داده‌ای' },
  { n: 'درختی', c: 'treemap\n    title Resource Allocation\n    "Dept/TeamA/Dev": 40\n    "Dept/TeamA/Design": 20\n    "Dept/TeamB/Test": 25\n    "Dept/TeamB/Deploy": 15', cat: 'داده‌ای' },
  // ──── ذهنی و طراحی (Mind & Design) ────
  { n: 'ذهنی', c: 'mindmap\n  root((Project))\n    Design\n      UI\n      UX\n    Dev\n      Frontend\n      Backend\n    Test\n      Unit\n      Integration', cat: 'ذهنی' },
  { n: 'ون', c: 'venn-beta\n    title Skill Overlap\n    SET Frontend ["HTML","CSS","JS"]\n    SET Backend ["Node","Python","DB"]\n    SET DevOps ["Docker","CI","K8s"]\n    OVERLAP Frontend Backend "API"\n    OVERLAP Backend DevOps "CI/CD"\n    OVERLAP Frontend Backend DevOps "Fullstack"', cat: 'ذهنی' },
  // ───ـ مهندسی (Engineering) ────
  { n: 'Git', c: 'gitGraph\n    commit\n    commit\n    branch develop\n    checkout develop\n    commit\n    commit\n    checkout main\n    merge develop\n    commit', cat: 'مهندسی' },
  { n: 'معماری', c: 'architecture-beta\n    group api[API Layer]\n    service db[Database]\n    service server[Server]\n    service web[Web App]\n    service cache[Cache]\n    web:R --> L:server\n    server:T --> B:cache\n    server:R --> L:db', cat: 'مهندسی' },
  { n: 'C4', c: 'C4Context\n    title System Diagram\n    Person(user, "User")\n    System(app, "Application")\n    System_Ext(db, "Database")\n    Rel(user, app, "uses")\n    Rel(app, db, "read/write")', cat: 'مهندسی' },
  { n: 'نیازمندی', c: 'requirementDiagram\n\n    requirement test_req {\n    id: 1\n    text: The test software shall run\n    risk: high\n    verifymethod: test\n    }\n\n    functionalRequirement test_func {\n    id: 1.1\n    text: The system shall test\n    }\n\n    test_req -traces -> test_func', cat: 'مهندسی' },
  // ───ـ تخصصی (Specialized) ────
  { n: 'زیرگراف', c: 'flowchart TB\n    subgraph frontend[Frontend]\n        A[UI] --> B[State]\n    end\n    subgraph backend[Backend]\n        C[API] --> D[DB]\n    end\n    B --> C', cat: 'تخصصی' },
  { n: 'کانبان', c: 'kanban\n    todo[Todo]\n        task1[Design Page]\n        task2[Write API]\n    doing[In Progress]\n        task3[Unit Test]\n    done[Done]\n        task4[Deploy Server]', cat: 'تخصصی' },
  { n: 'زیربرنامه', c: 'flowchart LR\n    subgraph A[Module A]\n        a1[Input] --> a2[Process]\n    end\n    subgraph B[Module B]\n        b1[Validate] --> b2[Store]\n    end\n    a2 --> b1', cat: 'تخصصی' },
  { n: 'ایشیکاوا', c: 'ishikawa\n    title Bug Causes\n    section Code\n      Wrong logic: 3\n      Uninitialized var: 2\n    section Test\n      Low coverage: 4\n      Missing scenario: 2', cat: 'تخصصی' },
  { n: 'واردلی', c: 'wardley-beta\n    title Strategy Map\n    anchor User [0.95, 0.95]\n    component Website [0.8, 0.6]\n    component API [0.6, 0.4]\n    component Database [0.3, 0.3]\n    User --> Website\n    Website --> API\n    API --> Database', cat: 'تخصصی' },
];

const BASE_FONT_OPTIONS = [
  { value: 'Vazirmatn', label: 'وزیرمتن' },
  { value: 'Tahoma', label: 'تاهوما' },
  { value: 'Arial', label: 'اریال' },
  { value: 'sans-serif', label: 'بدون سریف' },
  { value: 'serif', label: 'سریف' },
  { value: 'monospace', label: 'تک‌عرض' },
];

/* ───── Local Library Loaders (offline-ready) ───── */
let _m: any = null;
async function loadMermaid(): Promise<any> {
  if (_m) return Promise.resolve(_m);
  try {
    const mod = await import('mermaid');
    _m = mod.default || mod;
    return _m;
  } catch (e) {
    console.error('Failed to load mermaid locally:', e);
    throw e;
  }
}

let _jpdf: any = null;
async function loadJPDF(): Promise<any> {
  if (_jpdf) return Promise.resolve(_jpdf);
  try {
    const mod = await import('jspdf');
    _jpdf = mod.jsPDF;
    return _jpdf;
  } catch (e) {
    console.error('Failed to load jsPDF locally:', e);
    throw e;
  }
}

/* ───── Main Component ───── */
export default function Page() {
  const [showSplash, setShowSplash] = useState(true);
  const [splashFade, setSplashFade] = useState(false);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [projectName, setProjectName] = useState('پروژه جدید');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [nodeStyles, setNodeStyles] = useState<NS[]>([]);
  const [linkStyles, setLinkStyles] = useState<LS[]>([]);
  const [stylePresets, setStylePresets] = useState<SP[]>([...BUILT_IN_PRESETS]);
  const [mermaidTheme, setMermaidTheme] = useState('default');
  const [fontFamily, setFontFamily] = useState('Vazirmatn');
  const [fontSize, setFontSize] = useState(16);
  const [textDirection, setTextDirection] = useState<'rtl' | 'ltr'>('rtl');
  const [zoom, setZoom] = useState(100);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState('');
  // saving state removed — localStorage is synchronous
  const [projects, setProjects] = useState<any[]>([]);
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);
  const [presetName, setPresetName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState('');
  const [editingTemplateCode, setEditingTemplateCode] = useState('');
  // Custom fonts - initialized empty to avoid hydration mismatch
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Register a @font-face in the document (defined before useEffect so it can be used)
  const registerFontFace = (font: CustomFont) => {
    const fontFace = new FontFace(font.name, `url(data:font/${font.format};base64,${font.base64})`, {
      style: 'normal', weight: 'normal',
    });
    fontFace.load().then(loaded => { document.fonts.add(loaded); }).catch(() => {});
  };

  // Dynamic font options including custom fonts
  const fontOptions = [...BASE_FONT_OPTIONS, ...customFonts.map(f => ({ value: f.name, label: f.name }))];
  const renderCount = useRef(0);

  // Splash screen timer
  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFade(true), 2200);
    const removeTimer = setTimeout(() => setShowSplash(false), 2800);
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
  }, []);

  useEffect(() => {
    loadMermaid().then(() => setReady(true)).catch(e => setError(String(e)));
  }, []);

  // Load custom fonts from localStorage after mount (client-only, prevents hydration mismatch)
  useEffect(() => {
    const loadFonts = () => {
      try {
        const saved = localStorage.getItem('mermaid-custom-fonts');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setCustomFonts(parsed);
            parsed.forEach((f: CustomFont) => registerFontFace(f));
          }
        }
      } catch {}
    };
    // Use queueMicrotask to avoid synchronous setState in effect
    queueMicrotask(loadFonts);
  }, []);

  // Load dark mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('rassam-dark-mode');
    if (saved === 'true') setDarkMode(true);
  }, []);

  // Apply dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('rassam-dark-mode', String(darkMode));
  }, [darkMode]);

  // Build full code with style directives
  const getFullCode = useCallback(() => {
    let c = code;
    nodeStyles.filter(s => s.id.trim()).forEach(s => {
      const props: string[] = [];
      if (s.fill) props.push(`fill:${s.fill}`);
      if (s.stroke) props.push(`stroke:${s.stroke}`);
      if (s.sw) props.push(`stroke-width:${s.sw}px`);
      if (s.color) props.push(`color:${s.color}`);
      if (s.op && s.op !== '1') props.push(`opacity:${s.op}`);
      if (props.length) c += `\nstyle ${s.id} ${props.join(',')}`;
    });
    linkStyles.filter(s => s.idx >= 0).forEach(s => {
      const props: string[] = [];
      if (s.stroke) props.push(`stroke:${s.stroke}`);
      if (s.sw) props.push(`stroke-width:${s.sw}px`);
      if (props.length) c += `\nlinkStyle ${s.idx} ${props.join(',')}`;
    });
    return c;
  }, [code, nodeStyles, linkStyles]);

  // Render diagram
  const render = useCallback(async () => {
    const fc = getFullCode();
    if (!fc.trim() || !ready) return;
    try {
      // Auto-apply dark mermaid theme when app is in dark mode
      const effectiveTheme = darkMode ? 'dark' : mermaidTheme;
      _m.initialize({
        startOnLoad: false,
        theme: effectiveTheme,
        themeVariables: { fontFamily, fontSize: `${fontSize}px` },
        securityLevel: 'loose',
      });
      // Validate code first -- if parse fails, show error overlay without rendering
      try {
        await _m.parse(fc);
      } catch (parseErr: any) {
        setError(parseErr?.message || parseErr?.str || 'خطا در پارس نمودار');
        return;
      }
      renderCount.current++;
      const { svg } = await _m.render(`m${renderCount.current}`, fc);
      if (previewRef.current) {
        previewRef.current.innerHTML = svg;
        previewRef.current.style.transform = `scale(${zoom / 100})`;
        previewRef.current.style.transformOrigin = 'center';
        previewRef.current.style.direction = textDirection;
        previewRef.current.style.fontFamily = `'${fontFamily}', sans-serif`;
        // Make SVG background transparent so dark preview container shows through
        const svgEl = previewRef.current.querySelector('svg');
        if (svgEl) {
          svgEl.style.background = 'transparent';
        }
      }
      setError('');
    } catch (e: any) {
      setError(e?.message || 'خطا در رندر');
    }
  }, [getFullCode, ready, mermaidTheme, fontFamily, fontSize, zoom, textDirection, darkMode]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(render, 400);
    return () => clearTimeout(t);
  }, [render, ready]);

  // Extract node IDs from code
  const nodeIds = useCallback(() => {
    const ids = new Set<string>();
    let m;
    const r1 = /([A-Za-z_]\w*)\s*(?:\[|\{|\(|-->|---|->|==>|:::)/g;
    while ((m = r1.exec(code)) !== null) ids.add(m[1]);
    const r2 = /(?:-->|---|->|==>)\s*([A-Za-z_]\w*)/g;
    while ((m = r2.exec(code)) !== null) ids.add(m[1]);
    return Array.from(ids).sort();
  }, [code])();

  const linkCount = (code.match(/-->/g) || []).length;

  // ──── Project Save/Load (localStorage) ────
  const saveProject = () => {
    try {
      const customPresets = stylePresets.filter(p => !BUILT_IN_PRESETS.some(b => b.name === p.name));
      const payload = {
        id: projectId || crypto.randomUUID(),
        name: projectName,
        code,
        direction: textDirection,
        fontFamily,
        fontSize,
        textDirection,
        stylePresets: JSON.stringify({
          nodeStyles,
          linkStyles,
          customPresets,
          themeSettings: { mermaidTheme },
        }),
      };
      const stored = JSON.parse(localStorage.getItem('rassam-projects') || '[]');
      const idx = stored.findIndex((p: any) => p.id === payload.id);
      if (idx >= 0) {
        stored[idx] = payload;
      } else {
        stored.push(payload);
      }
      localStorage.setItem('rassam-projects', JSON.stringify(stored));
      if (!projectId) setProjectId(payload.id);
      toast.success('پروژه ذخیره شد');
    } catch {
      toast.error('خطا در ذخیره');
    }
  };

  const loadProjects = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('rassam-projects') || '[]');
      setProjects(stored);
    } catch { setProjects([]); }
  };

  const openProject = (p: any) => {
    setProjectId(p.id);
    setProjectName(p.name);
    setCode(p.code || DEFAULT_CODE);
    setTextDirection(p.textDirection || 'rtl');
    setFontFamily(p.fontFamily || 'Vazirmatn');
    setFontSize(p.fontSize || 16);
    setNodeStyles([]);
    setLinkStyles([]);
    setStylePresets([...BUILT_IN_PRESETS]);
    try {
      const d = JSON.parse(p.stylePresets || '{}');
      if (Array.isArray(d.nodeStyles)) setNodeStyles(d.nodeStyles);
      if (Array.isArray(d.linkStyles)) setLinkStyles(d.linkStyles);
      if (Array.isArray(d.customPresets)) setStylePresets([...BUILT_IN_PRESETS, ...d.customPresets]);
      if (d.themeSettings?.mermaidTheme) setMermaidTheme(d.themeSettings.mermaidTheme);
    } catch {}
    setPanel('');
    toast.success('پروژه بارگذاری شد');
  };

  const deleteProject = (id: string) => {
    try {
      const stored = JSON.parse(localStorage.getItem('rassam-projects') || '[]');
      const filtered = stored.filter((p: any) => p.id !== id);
      localStorage.setItem('rassam-projects', JSON.stringify(filtered));
    } catch {}
    if (projectId === id) { setProjectId(null); setProjectName('پروژه جدید'); }
    loadProjects();
    toast.success('پروژه حذف شد');
  };

  // Save project as file
  const exportProjectFile = () => {
    const data = {
      name: projectName,
      code,
      textDirection,
      fontFamily,
      fontSize,
      mermaidTheme,
      nodeStyles,
      linkStyles,
      stylePresets: stylePresets.filter(p => !BUILT_IN_PRESETS.some(b => b.name === p.name)),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${projectName}.mermaid-project.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('فایل پروژه ذخیره شد');
  };

  const importProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target?.result as string);
        if (d.code) {
          setProjectId(null);
          setProjectName(d.name || 'پروژه وارد شده');
          setCode(d.code);
          setTextDirection(d.textDirection || 'rtl');
          setFontFamily(d.fontFamily || 'Vazirmatn');
          setFontSize(d.fontSize || 16);
          if (d.mermaidTheme) setMermaidTheme(d.mermaidTheme);
          setNodeStyles(Array.isArray(d.nodeStyles) ? d.nodeStyles : []);
          setLinkStyles(Array.isArray(d.linkStyles) ? d.linkStyles : []);
          if (Array.isArray(d.stylePresets)) setStylePresets([...BUILT_IN_PRESETS, ...d.stylePresets]);
          setPanel('');
          toast.success('پروژه بارگذاری شد');
        }
      } catch { toast.error('خطا در خواندن فایل پروژه'); }
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  // ──── Template Save/Load/Edit (localStorage) ────
  const loadTemplates = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('rassam-templates') || '[]');
      setCustomTemplates(stored);
    } catch { setCustomTemplates([]); }
  };

  const saveTemplate = () => {
    if (!templateName.trim()) return;
    try {
      const newTemplate = { id: crypto.randomUUID(), name: templateName, code };
      const stored = JSON.parse(localStorage.getItem('rassam-templates') || '[]');
      stored.push(newTemplate);
      localStorage.setItem('rassam-templates', JSON.stringify(stored));
      setTemplateName('');
      loadTemplates();
      toast.success('قالب ذخیره شد');
    } catch {
      toast.error('خطا در ذخیره قالب');
    }
  };

  const updateTemplate = (id: string, name: string, code: string) => {
    try {
      const stored = JSON.parse(localStorage.getItem('rassam-templates') || '[]');
      const idx = stored.findIndex((t: any) => t.id === id);
      if (idx >= 0) {
        stored[idx] = { ...stored[idx], name, code };
        localStorage.setItem('rassam-templates', JSON.stringify(stored));
      }
      setEditingTemplateId(null);
      loadTemplates();
      toast.success('قالب بروزرسانی شد');
    } catch {
      toast.error('خطا در بروزرسانی قالب');
    }
  };

  const deleteTemplate = (id: string) => {
    try {
      const stored = JSON.parse(localStorage.getItem('rassam-templates') || '[]');
      const filtered = stored.filter((t: any) => t.id !== id);
      localStorage.setItem('rassam-templates', JSON.stringify(filtered));
    } catch {}
    loadTemplates();
    toast.success('قالب حذف شد');
  };

  // ──── Node/Link Style Helpers ────
  const addNodeStyle = (id: string, preset?: NS) => {
    setNodeStyles([...nodeStyles, preset ? { ...preset, id } : {
      id, fill: '#ECECFF', stroke: '#9370DB', sw: '1.5', color: '#1B1B1B', fs: '14', op: '1',
    }]);
  };

  const savePreset = () => {
    if (!presetName.trim()) return;
    setStylePresets([...stylePresets, {
      name: presetName,
      ns: nodeStyles.length > 0 ? [{ ...nodeStyles[0], id: '' }] : [{ id: '', fill: '#ECECFF', stroke: '#9370DB', sw: '1.5', color: '#1B1B1B', fs: '14', op: '1' }],
      ls: linkStyles.length > 0 ? [{ ...linkStyles[0], idx: 0 }] : [],
    }]);
    setPresetName('');
  };

  const exportAllTemplates = async () => {
    const allTemplates = [...BUILTIN_TEMPLATES.map(t => ({ name: t.n, code: t.c })), ...customTemplates.map((t: any) => ({ name: t.name, code: t.code }))];
    const blob = new Blob([JSON.stringify(allTemplates, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mermaid-templates.json';
    a.click();
  };

  const importTemplates = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target?.result as string);
        if (Array.isArray(d)) {
          const stored = JSON.parse(localStorage.getItem('rassam-templates') || '[]');
          for (const t of d) {
            if (t.name && t.code) {
              stored.push({ id: crypto.randomUUID(), name: t.name, code: t.code });
            }
          }
          localStorage.setItem('rassam-templates', JSON.stringify(stored));
          loadTemplates();
          toast.success(`${d.length} قالب وارد شد`);
        }
      } catch { toast.error('خطا در وارد کردن قالب'); }
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  const exportPresets = () => {
    const blob = new Blob([JSON.stringify(stylePresets, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mermaid-presets.json';
    a.click();
  };

  const importPresets = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target?.result as string);
        if (Array.isArray(d)) {
          const existing = new Set(stylePresets.map(p => p.name));
          setStylePresets([...stylePresets, ...d.filter((p: SP) => !existing.has(p.name))]);
        }
      } catch {}
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  const addCustomFont = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    const formatMap: Record<string, string> = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' };
    const fontFormat = formatMap[ext] || 'truetype';
    const fontName = f.name.replace(/\.[^.]+$/, '');
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = (ev.target?.result as string).split(',')[1];
      if (base64) {
        const newFont: CustomFont = { name: fontName, base64, format: fontFormat };
        const updated = [...customFonts, newFont];
        setCustomFonts(updated);
        localStorage.setItem('mermaid-custom-fonts', JSON.stringify(updated));
        registerFontFace(newFont);
        toast.success(`فونت «${fontName}» اضافه شد`);
      }
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  const removeCustomFont = (fontName: string) => {
    const updated = customFonts.filter(f => f.name !== fontName);
    setCustomFonts(updated);
    localStorage.setItem('mermaid-custom-fonts', JSON.stringify(updated));
    if (fontFamily === fontName) setFontFamily('Vazirmatn');
    toast.success('فونت حذف شد');
  };

  const newProject = () => {
    setProjectId(null);
    setProjectName('پروژه جدید');
    setCode(DEFAULT_CODE);
    setNodeStyles([]);
    setLinkStyles([]);
    setStylePresets([...BUILT_IN_PRESETS]);
    setMermaidTheme('default');
    setFontFamily('Vazirmatn');
    setFontSize(16);
    setTextDirection('rtl');
    setZoom(100);
    setError('');
    toast.success('پروژه جدید ایجاد شد');
  };

  return (
    <>
      {/* ──── Splash Screen ──── */}
      {showSplash && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#f8ffb5] via-[#a8d8c8] to-[#2a9d8f]"
          style={{
            animation: splashFade ? 'splash-fade-out 0.6s ease-out forwards' : undefined,
          }}
        >
          {/* Spinning ring behind icon */}
          <div className="absolute" style={{ animation: 'splash-ring-spin 3s linear infinite' }}>
            <div className="w-36 h-36 rounded-full border-2 border-dashed border-white/20" />
          </div>

          {/* App icon with appear + glow animation */}
          <div
            className="relative w-28 h-28 rounded-3xl overflow-hidden shadow-2xl"
            style={{
              animation: 'splash-icon-appear 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both, splash-icon-glow 1.5s ease-out 1s both',
            }}
          >
            <img
              src="/icon.png"
              alt="رسام"
              className="w-full h-full object-cover"
            />
          </div>

          {/* App name */}
          <h1
            className="mt-6 text-2xl font-extrabold text-[#1a5c52] tracking-wide"
            style={{
              fontFamily: "'Vazirmatn', sans-serif",
              animation: 'splash-title-appear 0.6s ease-out 0.6s both',
            }}
          >
            رسام
          </h1>

          {/* Subtitle */}
          <p
            className="mt-2 text-sm text-[#3d7a6e]"
            style={{
              fontFamily: "'Vazirmatn', sans-serif",
              animation: 'splash-subtitle-appear 0.5s ease-out 0.9s both',
            }}
          >
            ویرایشگر نمودارهای علمی
          </p>

          {/* Powered by */}
          <p
            className="mt-1 text-[10px] text-[#7a8030]/60"
            style={{
              fontFamily: "'Vazirmatn', sans-serif",
              animation: 'splash-subtitle-appear 0.5s ease-out 1.1s both',
            }}
          >
            Powered by Mermaid
          </p>

          {/* Loading dots */}
          <div
            className="mt-8 flex gap-2"
            style={{ animation: 'splash-subtitle-appear 0.5s ease-out 1.2s both' }}
          >
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-[#3d7a6e]/40"
                style={{
                  animation: `splash-pulse-dot 1s ease-in-out ${0.3 * i}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ──── Main App ──── */}
      <div className="h-screen flex flex-col font-[Vazirmatn,sans-serif] bg-[#f8fafc] dark:bg-[#0b0b14]" style={{ direction: 'rtl' }}>
      {/* ──── Header ──── */}
      <header className="bg-white dark:bg-[#101018] border-b border-gray-200 dark:border-[#1e1e2e] px-3 py-1.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="رسام" className="w-7 h-7 rounded-lg object-cover" />
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100">رسام</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Input value={projectName} onChange={e => setProjectName(e.target.value)} className="h-7 text-xs w-32 border-gray-200" />
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${projectId ? 'bg-[#2a9d8f] text-white' : 'bg-gray-100 text-gray-500'}`}>
            {projectId ? 'ذخیره شده' : 'جدید'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={newProject} title="پروژه جدید">
            <FilePlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { loadProjects(); setPanel('projects'); }} title="پروژه‌ها">
            <FolderOpen className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveProject} title="ذخیره">
            <Save className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exportProjectFile} title="ذخیره به فایل">
            <FileDown className="h-4 w-4" />
          </Button>
          <label className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer" title="بارگذاری از فایل">
            <Upload className="h-4 w-4" />
            <input type="file" accept=".json" onChange={importProjectFile} className="hidden" />
          </label>
          <Separator orientation="vertical" className="h-5 mx-0.5" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { loadTemplates(); setPanel('templates'); }} title="قالب‌ها">
            <LayoutTemplate className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanel('styler')} title="استایل">
            <Palette className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanel('settings')} title="تنظیمات">
            <Settings className="h-4 w-4" />
          </Button>
          <Button size="sm" className="h-7 bg-[#2a9d8f] hover:bg-[#21867a] text-white gap-1" onClick={() => setPanel('export')}>
            <Download className="h-3.5 w-3.5" />
            <span className="text-xs">خروجی</span>
          </Button>
        </div>
      </header>

      {/* ──── Main Content ──── */}
      <main className="flex-1 flex overflow-hidden">
        {/* Editor Panel */}
        <div className="w-[35%] border-l border-gray-200 dark:border-[#1e1e2e] flex flex-col bg-white dark:bg-[#101018]">
          <div className="px-2 py-1 border-b border-gray-200 dark:border-[#1e1e2e] bg-gray-50 dark:bg-[#0e0e18] flex justify-between items-center">
            <span className="text-[10px] text-gray-500 dark:text-gray-500">ویرایشگر</span>
          </div>
          <textarea value={code} onChange={e => setCode(e.target.value)}
            className="flex-1 p-2 font-mono text-xs leading-relaxed border-none outline-none resize-none bg-white dark:bg-[#101018] text-gray-900 dark:text-gray-200"
            style={{ direction: 'ltr' }} spellCheck={false} />
          <div className="px-2 py-1 border-t border-gray-200 dark:border-[#1e1e2e] bg-gray-50 dark:bg-[#0e0e18] flex items-center gap-2 text-[9px] text-gray-500 dark:text-gray-500">
            <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="text-[9px] border border-gray-200 rounded px-1 py-0.5">
              {fontOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <span>{fontSize}px</span>
            <input type="range" min={10} max={32} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-12" />
            <select value={mermaidTheme} onChange={e => setMermaidTheme(e.target.value)} className="text-[9px] border border-gray-200 rounded px-1 py-0.5">
              <option value="default">پیش‌فرض</option><option value="dark">تیره</option>
              <option value="forest">جنگلی</option><option value="neutral">خنثی</option><option value="base">پایه</option>
            </select>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#08080f]">
          <div className="px-2 py-1 border-b border-gray-200 dark:border-[#1e1e2e] bg-gray-50 dark:bg-[#0e0e18] flex justify-between items-center">
            <span className="text-[10px] text-gray-500 dark:text-gray-500">پیش‌نمایش</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom(Math.max(25, zoom - 25))}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[9px] text-gray-500 w-8 text-center">{zoom}%</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom(Math.min(400, zoom + 25))}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom(100)}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-white dark:bg-[#08080f] relative" id="preview-container">
            {!ready ? (
              <span className="text-gray-400 text-xs">در حال بارگذاری...</span>
            ) : (
              <div ref={previewRef} style={{ direction: textDirection, fontFamily: `'${fontFamily}', sans-serif` }} />
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-[#08080f]/80 backdrop-blur-sm p-4">
                <div className="max-w-md w-full bg-red-50 dark:bg-[#1a1018] border border-red-200 dark:border-red-900/50 rounded-xl p-4 shadow-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                      <span className="text-red-500 text-xs font-bold">!</span>
                    </div>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">خطا در رندر نمودار</span>
                  </div>
                  <pre className="text-[10px] text-red-700/80 dark:text-red-300/70 leading-relaxed whitespace-pre-wrap break-words" style={{ direction: 'ltr', textAlign: 'left' }}>{error}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ──── Footer ──── */}
      <footer className="bg-white dark:bg-[#101018] border-t border-gray-200 dark:border-[#1e1e2e] px-4 py-2 flex items-center justify-between shrink-0">
        <div className="text-[9px] text-gray-400 dark:text-gray-500 flex gap-2">
          <span>تم: {mermaidTheme}</span>
          <span>متن: {textDirection === 'rtl' ? 'راست‌چین' : 'چپ‌چین'}</span>
          <span>{fontFamily} {fontSize}px</span>
          {(nodeStyles.length > 0 || linkStyles.length > 0) && <span className="text-[#2a9d8f]">{nodeStyles.length + linkStyles.length} استایل</span>}
        </div>
        <a href="https://github.com/A-talebifard" target="_blank" rel="noopener noreferrer" onClick={async (e) => { e.preventDefault(); try { const { open } = await import('@tauri-apps/plugin-shell'); await open('https://github.com/A-talebifard'); } catch { window.open('https://github.com/A-talebifard', '_blank'); } }} className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:text-[#2a9d8f] transition-colors cursor-pointer">
          <Github className="h-4 w-4" />
          <span>A-talebifard</span>
        </a>
        <span className="text-[9px] text-gray-400 dark:text-gray-500" dir="ltr">Powered by mermaid.ai</span>
      </footer>

      {/* ──── Side Panels ──── */}
      {panel && (
        <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={() => setPanel('')}>
          <div className="w-[380px] bg-white dark:bg-[#101018] h-full overflow-auto p-4" style={{ direction: 'rtl' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                {panel === 'styler' && <><Palette className="h-4 w-4 text-[#2a9d8f]" /> استایل‌دهی</>}
                {panel === 'templates' && <><LayoutTemplate className="h-4 w-4 text-[#2a9d8f]" /> قالب‌ها</>}
                {panel === 'projects' && <><FolderOpen className="h-4 w-4 text-[#2a9d8f]" /> پروژه‌ها</>}
                {panel === 'export' && <><Download className="h-4 w-4 text-[#2a9d8f]" /> خروجی</>}
                {panel === 'settings' && <><Settings className="h-4 w-4 text-[#2a9d8f]" /> تنظیمات</>}
              </h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPanel('')}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* ── Styler Panel ── */}
            {panel === 'styler' && (
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-bold mb-2">گره‌ها ({nodeStyles.length})</h4>
                  <select onChange={e => { if (e.target.value) addNodeStyle(e.target.value); e.target.value = ''; }}
                    className="text-[10px] w-full p-1.5 border border-gray-200 dark:border-[#2a2a3a] rounded mb-2">
                    <option value="">افزودن گره...</option>
                    {nodeIds.filter(id => !nodeStyles.some(s => s.id === id)).map(id => <option key={id} value={id}>{id}</option>)}
                  </select>
                  {nodeStyles.map((s, i) => (
                    <div key={i} className="border border-gray-200 dark:border-[#2a2a3a] rounded-lg p-2 mb-2 bg-gray-50 dark:bg-[#14141f]">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-5 rounded text-[6px] flex items-center justify-center"
                            style={{ background: s.fill, border: `2px solid ${s.stroke}`, color: s.color }}>{s.id || '?'}</div>
                          <span className="text-[11px] font-bold dark:text-gray-200">{s.id || `گره ${i + 1}`}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={() => setNodeStyles(nodeStyles.filter((_, x) => x !== i))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[9px]">
                        <div><span className="text-gray-500">پرکردن</span><input type="color" value={s.fill} onChange={e => { const u = [...nodeStyles]; u[i] = { ...u[i], fill: e.target.value }; setNodeStyles(u); }} className="w-full h-6 cursor-pointer" /></div>
                        <div><span className="text-gray-500">حاشیه</span><input type="color" value={s.stroke} onChange={e => { const u = [...nodeStyles]; u[i] = { ...u[i], stroke: e.target.value }; setNodeStyles(u); }} className="w-full h-6 cursor-pointer" /></div>
                        <div><span className="text-gray-500">متن</span><input type="color" value={s.color} onChange={e => { const u = [...nodeStyles]; u[i] = { ...u[i], color: e.target.value }; setNodeStyles(u); }} className="w-full h-6 cursor-pointer" /></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="text-xs font-bold mb-2">اتصالات ({linkStyles.length})</h4>
                  <div className="flex items-center gap-2 mb-2">
                    <Button size="sm" className="h-6 text-[10px] bg-[#2a9d8f] hover:bg-[#21867a] text-white gap-1"
                      onClick={() => setLinkStyles([...linkStyles, { idx: linkStyles.length, stroke: '#9370DB', sw: '2' }])}>
                      <Plus className="h-3 w-3" /> افزودن اتصال
                    </Button>
                    <span className="text-[9px] text-gray-400">تعداد در کد: {linkCount}</span>
                  </div>
                  {linkStyles.map((s, i) => (
                    <div key={i} className="border border-gray-200 dark:border-[#2a2a3a] rounded-lg p-2 mb-2 bg-gray-50 dark:bg-[#14141f] flex items-center gap-2 text-[9px]">
                      <span>شماره:</span>
                      <input type="number" value={s.idx} onChange={e => { const u = [...linkStyles]; u[i] = { ...u[i], idx: parseInt(e.target.value) || 0 }; setLinkStyles(u); }} className="w-7 text-[9px] border border-gray-200 rounded px-0.5" min={0} />
                      <span>رنگ:</span>
                      <input type="color" value={s.stroke} onChange={e => { const u = [...linkStyles]; u[i] = { ...u[i], stroke: e.target.value }; setLinkStyles(u); }} className="h-5 w-5 cursor-pointer" />
                      <span>ضخامت:</span>
                      <input value={s.sw} onChange={e => { const u = [...linkStyles]; u[i] = { ...u[i], sw: e.target.value }; setLinkStyles(u); }} className="w-7 text-[9px] border border-gray-200 rounded px-0.5" />
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={() => setLinkStyles(linkStyles.filter((_, x) => x !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="text-xs font-bold mb-2">پریست‌ها</h4>
                  <div className="flex gap-1.5 mb-2">
                    <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="نام پریست" className="h-6 text-[9px] flex-1" onKeyDown={e => e.key === 'Enter' && savePreset()} />
                    <Button size="sm" className="h-6 text-[9px] bg-[#2a9d8f] hover:bg-[#21867a] text-white" onClick={savePreset}>ذخیره</Button>
                  </div>
                  <div className="flex gap-1.5 mb-2">
                    <Button variant="outline" size="sm" className="h-6 text-[9px] gap-1" onClick={exportPresets}>
                      <FileDown className="h-3 w-3" /> خروجی
                    </Button>
                    <label className="inline-flex items-center gap-1 h-6 text-[9px] px-2 border border-gray-200 dark:border-[#2a2a3a] rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a1a28]">
                      <Upload className="h-3 w-3" /> بارگذاری
                      <input type="file" accept=".json" onChange={importPresets} className="hidden" />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {stylePresets.map((p, pi) => (
                      <button key={pi} onClick={() => { nodeIds.forEach(id => addNodeStyle(id, p.ns[0])); }}
                        className="border border-gray-200 dark:border-[#2a2a3a] rounded-lg p-2 bg-gray-50 dark:bg-[#14141f] cursor-pointer text-right hover:border-[#5bb8ac] transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold">{p.name}</span>
                          {pi >= BUILT_IN_PRESETS.length && (
                            <span onClick={e => { e.stopPropagation(); setStylePresets(stylePresets.filter((_, x) => x !== pi)); }} className="text-red-500 cursor-pointer"><X className="h-3 w-3" /></span>
                          )}
                        </div>
                        <div className="flex gap-1 mt-1">{p.ns.slice(0, 3).map((n, j) => (
                          <div key={j} className="w-5 h-3 rounded-sm text-[4px] flex items-center justify-center"
                            style={{ background: n.fill, border: `1px solid ${n.stroke}`, color: n.color }}>ن</div>
                        ))}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Templates Panel ── */}
            {panel === 'templates' && (
              <div className="space-y-3">
                {/* Save as Template */}
                <div className="border border-dashed border-[#5bb8ac] rounded-lg p-3 bg-[#e6f5f3]">
                  <h4 className="text-xs font-bold mb-2 text-[#2a9d8f]">ذخیره قالب فعلی</h4>
                  <div className="flex gap-1.5">
                    <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="نام قالب"
                      className="h-7 text-[10px] flex-1" onKeyDown={e => e.key === 'Enter' && saveTemplate()} />
                    <Button size="sm" className="h-7 text-[10px] bg-[#2a9d8f] hover:bg-[#21867a] text-white gap-1" onClick={saveTemplate}>
                      <Plus className="h-3 w-3" /> افزودن
                    </Button>
                  </div>
                </div>

                {/* Import/Export Templates */}
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="h-6 text-[9px] gap-1 flex-1" onClick={exportAllTemplates}>
                    <FileDown className="h-3 w-3" /> خروجی همه قالب‌ها
                  </Button>
                  <label className="inline-flex items-center gap-1 h-6 text-[9px] px-2 border border-gray-200 dark:border-[#2a2a3a] rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a1a28] flex-1 justify-center">
                    <PackageOpen className="h-3 w-3" /> وارد کردن قالب
                    <input type="file" accept=".json" onChange={importTemplates} className="hidden" />
                  </label>
                </div>

                {/* Built-in Templates - Grouped by Category */}
                <div>
                  <h4 className="text-xs font-bold mb-2 text-gray-600">قالب‌های پیش‌فرض ({BUILTIN_TEMPLATES.length} نمودار)</h4>
                  {(() => {
                    const cats = Array.from(new Set(BUILTIN_TEMPLATES.map(t => t.cat)));
                    const catIcons: Record<string, string> = { 'جریان': '🔄', 'ساختاری': '🏗️', 'زمانی': '⏱️', 'داده‌ای': '📊', 'ذهنی': '🧠', 'مهندسی': '⚙️', 'تخصصی': '🔬' };
                    return cats.map(cat => (
                      <div key={cat} className="mb-3">
                        <div className="text-[10px] font-bold text-[#2a9d8f] mb-1.5 flex items-center gap-1">
                          <span>{catIcons[cat] || '📌'}</span> {cat}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {BUILTIN_TEMPLATES.filter(t => t.cat === cat).map((t, i) => (
                            <button key={i} onClick={() => { setCode(t.c); setPanel(''); toast.success(`قالب «${t.n}» بارگذاری شد`); }}
                              className="border border-gray-200 dark:border-[#2a2a3a] rounded-lg p-2 bg-gray-50 dark:bg-[#14141f] cursor-pointer text-right hover:border-[#2a9d8f] hover:bg-[#e6f5f3] dark:hover:bg-[#1a1a28] transition-all">
                              <div className="text-[10px] font-bold">{t.n}</div>
                              <div className="text-[7px] text-gray-400 mt-1 truncate" style={{ direction: 'ltr', textAlign: 'left' }}>{t.c.split('\n')[0]}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* Custom Templates */}
                {customTemplates.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold mb-2 text-[#2a9d8f]">قالب‌های ذخیره شده ({customTemplates.length})</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {customTemplates.map((t: any) => (
                        <div key={t.id} className="border border-gray-200 dark:border-[#2a2a3a] rounded-lg bg-gray-50 dark:bg-[#14141f] overflow-hidden">
                          {editingTemplateId === t.id ? (
                            <div className="p-2 space-y-2">
                              <Input value={editingTemplateName} onChange={e => setEditingTemplateName(e.target.value)}
                                className="h-6 text-[10px]" placeholder="نام قالب" />
                              <textarea value={editingTemplateCode} onChange={e => setEditingTemplateCode(e.target.value)}
                                className="w-full h-24 text-[9px] font-mono border border-gray-200 dark:border-[#2a2a3a] dark:bg-[#0e0e18] dark:text-gray-300 rounded p-1.5 resize-none"
                                style={{ direction: 'ltr' }} spellCheck={false} />
                              <div className="flex gap-1.5">
                                <Button size="sm" className="h-6 text-[9px] bg-green-600 hover:bg-green-700 text-white gap-1"
                                  onClick={() => updateTemplate(t.id, editingTemplateName, editingTemplateCode)}>
                                  <Check className="h-3 w-3" /> ذخیره
                                </Button>
                                <Button variant="outline" size="sm" className="h-6 text-[9px]" onClick={() => setEditingTemplateId(null)}>انصراف</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold">{t.name}</span>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-5 w-5 text-[#2a9d8f]"
                                    onClick={() => { setCode(t.code); setPanel(''); toast.success('قالب بارگذاری شد'); }}
                                    title="بارگذاری">
                                    <Upload className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 text-blue-600"
                                    onClick={() => { setEditingTemplateId(t.id); setEditingTemplateName(t.name); setEditingTemplateCode(t.code); }}
                                    title="ویرایش">
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500"
                                    onClick={() => deleteTemplate(t.id)} title="حذف">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <div className="text-[7px] text-gray-400 mt-1" style={{ direction: 'ltr', textAlign: 'left' }}>
                                {t.code?.split('\n')[0]}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Projects Panel ── */}
            {panel === 'projects' && (
              <div>
                {projects.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">پروژه‌ای وجود ندارد</div>
                ) : projects.map(p => (
                  <div key={p.id}
                    className={`border rounded-lg p-2 mb-2 cursor-pointer transition-colors ${projectId === p.id ? 'border-[#2a9d8f] bg-[#e6f5f3] dark:bg-[#1a2a28]' : 'border-gray-200 dark:border-[#2a2a3a] bg-white dark:bg-[#14141f] hover:border-[#5bb8ac]'}`}
                    onClick={() => openProject(p)}>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold">{p.name}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={e => { e.stopPropagation(); deleteProject(p.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-[8px] text-gray-400 mt-1">{p.code?.length || 0} کاراکتر · {p.fontFamily || 'Vazirmatn'}</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Settings Panel ── */}
            {panel === 'settings' && (
              <div className="space-y-4">
                {/* Dark/Light Mode */}
                <div>
                  <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5">
                    {darkMode ? <Moon className="h-3.5 w-3.5 text-[#2a9d8f]" /> : <Sun className="h-3.5 w-3.5 text-[#2a9d8f]" />} حالت نمایش
                  </h4>
                  <p className="text-[9px] text-gray-500 mb-2">ظاهر برنامه بین روشن و تاریک تغییر دهید.</p>
                  <div className="flex gap-2">
                    <Button variant={!darkMode ? 'default' : 'ghost'} size="sm"
                      className={`h-7 text-[10px] px-3 ${!darkMode ? 'bg-[#2a9d8f] text-white' : ''}`}
                      onClick={() => setDarkMode(false)}>
                      <Sun className="h-3 w-3 ml-1" /> روشن
                    </Button>
                    <Button variant={darkMode ? 'default' : 'ghost'} size="sm"
                      className={`h-7 text-[10px] px-3 ${darkMode ? 'bg-[#2a9d8f] text-white' : ''}`}
                      onClick={() => setDarkMode(true)}>
                      <Moon className="h-3 w-3 ml-1" /> تاریک
                    </Button>
                  </div>
                </div>

                {/* Text Direction */}
                <div>
                  <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5">
                    <AlignRight className="h-3.5 w-3.5 text-[#2a9d8f]" /> جهت متن نمودار
                  </h4>
                  <p className="text-[9px] text-gray-500 mb-2">جهت چینش متن در نمودار پیش‌نمایش را تعیین کنید.</p>
                  <div className="flex gap-2">
                    <Button variant={textDirection === 'rtl' ? 'default' : 'ghost'} size="sm"
                      className={`h-7 text-[10px] px-3 ${textDirection === 'rtl' ? 'bg-[#2a9d8f] text-white' : ''}`}
                      onClick={() => setTextDirection('rtl')}>
                      <AlignRight className="h-3 w-3 ml-1" /> راست‌چین
                    </Button>
                    <Button variant={textDirection === 'ltr' ? 'default' : 'ghost'} size="sm"
                      className={`h-7 text-[10px] px-3 ${textDirection === 'ltr' ? 'bg-[#2a9d8f] text-white' : ''}`}
                      onClick={() => setTextDirection('ltr')}>
                      <AlignLeft className="h-3 w-3 ml-1" /> چپ‌چین
                    </Button>
                  </div>
                </div>

                {/* Font Management */}
                <div>
                  <h4 className="text-xs font-bold mb-2 flex items-center gap-1.5">
                    <Type className="h-3.5 w-3.5 text-[#2a9d8f]" /> مدیریت فونت‌ها
                  </h4>
                  <p className="text-[9px] text-gray-500 mb-2">فونت‌های محلی (ttf, woff, woff2) را اضافه کنید تا در نمودار استفاده شوند.</p>
                  <label className="flex items-center gap-1.5 h-8 text-[10px] px-3 border border-dashed border-[#5bb8ac] rounded-lg cursor-pointer hover:bg-[#e6f5f3] bg-[#e6f5f3]/50 text-[#2a9d8f] justify-center mb-3">
                    <Plus className="h-3.5 w-3.5" /> افزودن فونت جدید
                    <input type="file" accept=".ttf,.woff,.woff2,.otf" onChange={addCustomFont} className="hidden" />
                  </label>
                  {customFonts.length > 0 && (
                    <div className="space-y-1.5">
                      {customFonts.map((f, i) => (
                        <div key={i} className="flex items-center justify-between border border-gray-200 dark:border-[#2a2a3a] rounded-lg px-2.5 py-1.5 bg-gray-50 dark:bg-[#14141f]">
                          <div className="flex items-center gap-2">
                            <Type className="h-3 w-3 text-gray-400" />
                            <span className="text-[10px] font-medium">{f.name}</span>
                            <span className="text-[8px] text-gray-400">.{f.format}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={() => removeCustomFont(f.name)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {customFonts.length === 0 && (
                    <div className="text-[9px] text-gray-400 text-center py-3">هنوز فونت سفارشی اضافه نشده</div>
                  )}
                </div>
              </div>
            )}

            {panel === 'export' && (
              <ExportPanel
                fontFamily={fontFamily}
                textDirection={textDirection}
                projectName={projectName}
                fontSize={fontSize}
                zoom={zoom}
                fullCode={getFullCode()}
                previewRef={previewRef}
                onClose={() => setPanel('')}
                customFonts={customFonts}
                mermaidTheme={mermaidTheme}
              />
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}

/* ───── Export Panel Component ───── */

function ExportPanel({
  fontFamily, textDirection, projectName, fontSize, zoom, fullCode,
  previewRef, onClose, customFonts, mermaidTheme,
}: {
  fontFamily: string; textDirection: string; projectName: string;
  fontSize: number; zoom: number; fullCode: string;
  previewRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  customFonts: CustomFont[];
  mermaidTheme: string;
}) {
  const [format, setFormat] = useState<'png' | 'jpg' | 'svg' | 'pdf' | 'tiff'>('png');
  const [dpi, setDpi] = useState(300);
  const [busy, setBusy] = useState(false);
  const [bgColor, setBgColor] = useState('#ffffff');
  const DPI_OPTIONS = [72, 96, 150, 200, 300, 600];

  // Cache for Vazirmatn font base64
  const vazirmatnCache = useRef<string | null>(null);

  const fetchVazirmatnBase64 = async (): Promise<string | null> => {
    if (vazirmatnCache.current) return vazirmatnCache.current;
    try {
      // Load from local public folder (offline-ready)
      const r = await fetch('/fonts/vazirmatn-arabic-400-normal.woff2');
      if (!r.ok) throw new Error('Font not found');
      const blob = await r.blob();
      const b64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });
      vazirmatnCache.current = b64;
      return b64;
    } catch { return null; }
  };

  // Get SVG dimensions from the preview (for display only)
  const getSVGDims = () => {
    const svgEl = previewRef.current?.querySelector('svg');
    if (!svgEl) return { w: 800, h: 600 };
    const vb = svgEl.getAttribute('viewBox')?.split(/\s+/).map(Number);
    if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { w: vb[2], h: vb[3] };
    const w = parseFloat(svgEl.getAttribute('width') || '0') || 800;
    const h = parseFloat(svgEl.getAttribute('height') || '0') || 600;
    return { w, h };
  };

  const doExport = async () => {
    setBusy(true);
    try {
      if (!fullCode.trim()) { toast.error('کد نمودار خالی است'); setBusy(false); return; }

      // Wait for all fonts to be loaded
      await document.fonts.ready;

      // Re-render mermaid with htmlLabels: false for clean SVG (no foreignObject)
      // This produces pure SVG text elements that work perfectly with SVG→Image→Canvas pipeline
      _m.initialize({
        startOnLoad: false,
        theme: mermaidTheme,
        themeVariables: { fontFamily, fontSize: `${fontSize}px` },
        securityLevel: 'loose',
        htmlLabels: false,
      });

      const renderId = `export-${Date.now()}`;
      let svgString: string;
      try {
        const result = await _m.render(renderId, fullCode);
        svgString = result.svg;
      } catch (e: any) {
        toast.error('خطا در رندر نمودار: ' + (e?.message || ''));
        setBusy(false);
        return;
      } finally {
        // Clean up temporary elements created by mermaid
        document.getElementById(renderId)?.remove();
        document.getElementById(`d${renderId}`)?.remove();
      }

      // Restore original config so web preview renders correctly
      _m.initialize({
        startOnLoad: false,
        theme: mermaidTheme,
        themeVariables: { fontFamily, fontSize: `${fontSize}px` },
        securityLevel: 'loose',
      });

      // Parse the SVG string
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgEl = svgDoc.documentElement;

      // Get content bounds from viewBox
      const vb = svgEl.getAttribute('viewBox')?.split(/\s+/).map(Number);
      let cX = 0, cY = 0, cW: number, cH: number;
      if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
        [cX, cY, cW, cH] = vb;
      } else {
        cW = parseFloat(svgEl.getAttribute('width') || '800');
        cH = parseFloat(svgEl.getAttribute('height') || '600');
      }

      // Set proper viewBox and dimensions (tight crop)
      svgEl.setAttribute('viewBox', `${cX} ${cY} ${cW} ${cH}`);
      svgEl.setAttribute('width', String(cW));
      svgEl.setAttribute('height', String(cH));
      svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // Apply font-family to all text elements
      svgEl.querySelectorAll('text, tspan').forEach((el: Element) => {
        el.setAttribute('font-family', `'${fontFamily}', sans-serif`);
      });

      // Build @font-face CSS for embedding fonts in SVG
      let fontCSS = '';
      for (const f of customFonts) {
        fontCSS += `@font-face { font-family: '${f.name}'; src: url(data:font/${f.format};base64,${f.base64}) format('${f.format}'); }\n`;
      }
      // Embed Vazirmatn font as base64
      const vB64 = await fetchVazirmatnBase64();
      if (vB64) {
        fontCSS += `@font-face { font-family: 'Vazirmatn'; src: url(data:font/woff2;base64,${vB64}) format('woff2'); }\n`;
      }

      if (fontCSS) {
        let defs = svgEl.querySelector('defs');
        if (!defs) {
          defs = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'defs');
          svgEl.insertBefore(defs, svgEl.firstChild);
        }
        const styleEl = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleEl.textContent = fontCSS;
        defs.appendChild(styleEl);
      }

      // ─── SVG Export ───
      if (format === 'svg') {
        const output = new XMLSerializer().serializeToString(svgEl);
        const blob = new Blob([output], { type: 'image/svg+xml' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${projectName}.svg`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success('خروجی SVG تولید شد');
        setBusy(false);
        return;
      }

      // ─── Raster Export (PNG/JPG/PDF/TIFF) ───
      // Use SVG→Image→Canvas pipeline for true high-DPI output
      const scaleFactor = dpi / 96;
      const renderW = Math.round(cW * scaleFactor);
      const renderH = Math.round(cH * scaleFactor);

      // Set SVG to render at the target DPI resolution
      svgEl.setAttribute('width', String(renderW));
      svgEl.setAttribute('height', String(renderH));

      const output = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([output], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      // Load SVG as Image
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('SVG بارگذاری نشد'));
        img.src = svgUrl;
      });

      // Draw onto canvas at target resolution
      const canvas = document.createElement('canvas');
      canvas.width = renderW;
      canvas.height = renderH;
      const ctx = canvas.getContext('2d')!;

      // Fill background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, renderW, renderH);

      // Draw SVG at full resolution
      ctx.drawImage(img, 0, 0, renderW, renderH);
      URL.revokeObjectURL(svgUrl);

      // Export canvas based on format
      if (format === 'pdf') {
        const JPDF = await loadJPDF();
        const pdfW = cW * 72 / 96;
        const pdfH = cH * 72 / 96;
        const pdfDoc = new JPDF({
          orientation: pdfW > pdfH ? 'landscape' : 'portrait',
          unit: 'px', format: [pdfW, pdfH],
        });
        const imgData = canvas.toDataURL('image/png');
        pdfDoc.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
        pdfDoc.save(`${projectName}.pdf`);
      } else if (format === 'tiff') {
        // Client-side TIFF: save as PNG (browsers don't natively support TIFF canvas export)
        // For true TIFF, users can convert the PNG externally
        const pngBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
        if (pngBlob) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(pngBlob);
          a.download = `${projectName}.png`;
          a.click();
          URL.revokeObjectURL(a.href);
          toast.success('خروجی PNG تولید شد (TIFF در مرورگر پشتیبانی نمی‌شود)');
        }
      } else {
        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const quality = format === 'jpg' ? 0.95 : undefined;
        canvas.toBlob((blob: Blob | null) => {
          if (blob) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${projectName}.${format}`;
            a.click();
            URL.revokeObjectURL(a.href);
          } else { toast.error('خطا در تولید فایل'); }
        }, mimeType, quality);
      }

      toast.success('خروجی با موفقیت تولید شد');
    } catch (e) {
      console.error('Export error:', e);
      toast.error('خطا در تولید خروجی: ' + (e instanceof Error ? e.message : String(e)));
    }
    setBusy(false);
  };

  const dims = getSVGDims();
  const scaleFactor = dpi / 96;
  const outputW = Math.round(dims.w * scaleFactor);
  const outputH = Math.round(dims.h * scaleFactor);

  const formatIcons: Record<string, React.ReactNode> = {
    png: <FileImage className="h-3.5 w-3.5" />,
    jpg: <FileImage className="h-3.5 w-3.5" />,
    svg: <FileText className="h-3.5 w-3.5" />,
    pdf: <FileDown className="h-3.5 w-3.5" />,
    tiff: <FileImage className="h-3.5 w-3.5" />,
  };

  return (
    <div className="text-[10px] space-y-4">
      {/* Format Selection */}
      <div>
        <label className="text-[9px] text-gray-500 mb-1.5 block">فرمت خروجی</label>
        <div className="flex gap-1.5">
          {(['png', 'jpg', 'svg', 'pdf', 'tiff'] as const).map(f => (
            <button key={f} onClick={() => setFormat(f)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[9px] font-medium transition-colors ${format === f ? 'bg-[#2a9d8f] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {formatIcons[f]} {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* DPI Setting */}
      {format !== 'svg' && (
        <>
          <div>
            <label className="text-[9px] text-gray-500 mb-1.5 block">DPI (رزولوشن)</label>
            <div className="flex gap-1.5">
              {DPI_OPTIONS.map(d => (
                <button key={d} onClick={() => setDpi(d)}
                  className={`flex-1 py-1.5 rounded-lg text-[9px] font-medium transition-colors ${dpi === d ? 'bg-[#2a9d8f] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {d}
                </button>
              ))}
            </div>
            <div className="mt-1.5 text-[8px] text-gray-400">
              ابعاد خروجی: {outputW} × {outputH} پیکسل @ {dpi} DPI
            </div>
          </div>

          {/* Background Color */}
          <div className="flex items-center justify-between">
            <label className="text-[9px] text-gray-500">رنگ پس‌زمینه</label>
            <div className="flex items-center gap-2">
              <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-7 h-5 cursor-pointer rounded border border-gray-200 dark:border-[#2a2a3a]" />
              <span className="text-[8px] text-gray-400">{bgColor}</span>
            </div>
          </div>
        </>
      )}

      {/* Export Button */}
      <Button className="w-full bg-[#2a9d8f] hover:bg-[#21867a] text-white gap-2 h-9" onClick={doExport} disabled={busy}>
        <Download className="h-4 w-4" />
        {busy ? 'در حال تولید...' : 'دریافت خروجی'}
      </Button>

      {/* Info */}
      {format !== 'svg' && (
        <div className="text-[8px] text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-[#14141f] rounded-lg p-2 leading-relaxed">
          خروجی با حفظ فونت و استایل نمودار و نسبت واقعی آن تولید می‌شود.
          DPI بالاتر = کیفیت بهتر برای چاپ. برای چاپ مقاله‌ای، ۳۰۰ DPI توصیه می‌شود.
        </div>
      )}
    </div>
  );
}
