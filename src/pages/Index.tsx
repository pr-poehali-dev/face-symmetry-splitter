import { useState, useRef, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface ZoneMetric {
  name: string;
  left: number;
  right: number;
  score: number;
  description: string;
}

interface AnalysisReport {
  overallScore: number;
  zones: ZoneMetric[];
  originalImage: string;
}

const ANALYZE_URL = "https://functions.poehali.dev/91735823-dbef-4581-9b80-915cef599582";

const analyzeWithAPI = async (imageData: string): Promise<AnalysisReport> => {
  const res = await fetch(ANALYZE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageData }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || "Ошибка анализа");
  }
  return { ...data, originalImage: imageData };
};

const ScoreRing = ({ score, size = 120 }: { score: number; size?: number }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      let start = 0;
      const step = score / 60;
      const interval = setInterval(() => {
        start += step;
        if (start >= score) { setAnimatedScore(score); clearInterval(interval); }
        else setAnimatedScore(Math.round(start));
      }, 16);
      return () => clearInterval(interval);
    }, 300);
    return () => clearTimeout(timer);
  }, [score]);

  const color = score >= 80 ? "#00FFB2" : score >= 65 ? "#FFD166" : "#FF6B6B";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.05s linear", filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-3xl font-bold" style={{ color }}>{animatedScore}</span>
        <span className="text-xs text-white/40 font-mono tracking-widest">/ 100</span>
      </div>
    </div>
  );
};

const BarComparison = ({ zone, index }: { zone: ZoneMetric; index: number }) => {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100 + index * 120);
    return () => clearTimeout(t);
  }, [index]);

  const diff = Math.abs(zone.left - zone.right);
  const color = zone.score >= 80 ? "#00FFB2" : zone.score >= 65 ? "#FFD166" : "#FF6B6B";

  return (
    <div className="p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-white/90 font-display text-base font-medium">{zone.name}</span>
          <p className="text-white/30 text-xs mt-0.5 font-mono">{zone.description}</p>
        </div>
        <div className="text-right">
          <span className="font-mono text-lg font-bold" style={{ color }}>{Math.round(zone.score)}%</span>
          <p className="text-white/25 text-xs font-mono">Δ {diff.toFixed(1)}%</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-white/30 font-mono tracking-wider">ЛЕВО</span>
            <span className="text-xs text-cyan-400/70 font-mono">{zone.left.toFixed(1)}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: animated ? `${zone.left}%` : "0%", background: "linear-gradient(90deg, #00B4D8, #00FFB2)", boxShadow: "0 0 6px #00FFB260" }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-xs text-white/30 font-mono tracking-wider">ПРАВО</span>
            <span className="text-xs text-violet-400/70 font-mono">{zone.right.toFixed(1)}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: animated ? `${zone.right}%` : "0%", background: "linear-gradient(90deg, #7C3AED, #C084FC)", boxShadow: "0 0 6px #7C3AED60" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const FaceSplitView = ({ image }: { image: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"split" | "left" | "right" | "overlay">("split");
  const [lineX, setLineX] = useState(50);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const cx = img.width / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (mode === "split") {
        const splitX = Math.round((lineX / 100) * canvas.width);
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, splitX, canvas.height); ctx.clip();
        ctx.drawImage(img, 0, 0); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(splitX, 0, canvas.width - splitX, canvas.height); ctx.clip();
        ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
        ctx.save();
        ctx.strokeStyle = "rgba(0,255,178,0.8)"; ctx.lineWidth = 2; ctx.setLineDash([8, 4]);
        ctx.shadowColor = "#00FFB2"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(splitX, 0); ctx.lineTo(splitX, canvas.height); ctx.stroke();
        ctx.restore();
        ctx.font = "bold 13px monospace";
        ctx.fillStyle = "rgba(0,180,216,0.9)"; ctx.fillText("← ЛЕВО", 12, 24);
        ctx.fillStyle = "rgba(192,132,252,0.9)"; ctx.fillText("ПРАВО →", canvas.width - 80, 24);
      } else if (mode === "left") {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, cx, canvas.height); ctx.clip(); ctx.drawImage(img, 0, 0); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(cx, 0, cx, canvas.height); ctx.clip(); ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
      } else if (mode === "right") {
        ctx.save(); ctx.beginPath(); ctx.rect(cx, 0, cx, canvas.height); ctx.clip(); ctx.drawImage(img, 0, 0); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, cx, canvas.height); ctx.clip(); ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
      } else {
        ctx.drawImage(img, 0, 0);
        ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = "difference";
        ctx.save(); ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      }
    };
    img.src = image;
  }, [image, mode, lineX]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: "split", label: "Сравнение", icon: "Columns2" },
          { key: "left", label: "Левая × 2", icon: "FlipHorizontal" },
          { key: "right", label: "Правая × 2", icon: "FlipHorizontal2" },
          { key: "overlay", label: "Наложение", icon: "Layers" },
        ].map(btn => (
          <button
            key={btn.key}
            onClick={() => setMode(btn.key as "split" | "left" | "right" | "overlay")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-all duration-200 ${
              mode === btn.key
                ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/40"
                : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60"
            }`}
          >
            <Icon name={btn.icon} size={12} />
            {btn.label}
          </button>
        ))}
      </div>
      {mode === "split" && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-white/30">Линия раздела</span>
          <input type="range" min={20} max={80} value={lineX} onChange={e => setLineX(Number(e.target.value))} className="flex-1 accent-cyan-400 h-1" />
          <span className="text-xs font-mono text-cyan-400/60">{lineX}%</span>
        </div>
      )}
      <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black">
        <canvas ref={canvasRef} className="w-full h-auto max-h-80 object-contain" />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent 80%, rgba(0,0,0,0.6))" }} />
      </div>
    </div>
  );
};

const UploadZone = ({ onUpload }: { onUpload: (data: string) => void }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const process = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => e.target?.result && onUpload(e.target.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div
      className={`relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300 ${
        dragging ? "border-cyan-400/60 bg-cyan-400/5" : "border-white/10 hover:border-white/20 bg-white/[0.01] hover:bg-white/[0.03]"
      }`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) { process(e.dataTransfer.files[0]); } }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && process(e.target.files[0])} />
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center bg-white/5 transition-all">
          <Icon name="ScanFace" size={28} className="text-white/40" />
        </div>
        <div>
          <p className="font-display text-xl text-white/70">Загрузите фото лица</p>
          <p className="text-sm text-white/30 mt-1 font-mono">Перетащите или нажмите · JPG, PNG, WEBP</p>
        </div>
        <div className="flex gap-3 text-xs text-white/20 font-mono">
          <span>· Лицо в фокусе</span>
          <span>· Нейтральное выражение</span>
          <span>· Хорошее освещение</span>
        </div>
      </div>
      {dragging && (
        <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-cyan-400/10 backdrop-blur-sm">
          <span className="text-cyan-300 font-mono text-lg">Отпустите для загрузки</span>
        </div>
      )}
    </div>
  );
};

export default function Index() {
  const [step, setStep] = useState<"upload" | "analyzing" | "result">("upload");
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<"visual" | "zones" | "summary">("visual");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpload = useCallback(async (imageData: string) => {
    setStep("analyzing");
    setProgress(0);
    setErrorMsg(null);

    // Анимация прогресса пока идёт запрос
    const fakeProgress = [12, 28, 45, 62, 78];
    let pi = 0;
    const progressInterval = setInterval(() => {
      if (pi < fakeProgress.length) { setProgress(fakeProgress[pi++]); }
    }, 700);

    try {
      const result = await analyzeWithAPI(imageData);
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => { setReport(result); setStep("result"); }, 400);
    } catch (err: unknown) {
      clearInterval(progressInterval);
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setErrorMsg(msg);
      setStep("upload");
    }
  }, []);

  const reset = () => { setStep("upload"); setReport(null); setProgress(0); setErrorMsg(null); };

  const getScoreLabel = (s: number) => s >= 85 ? "Высокая симметрия" : s >= 70 ? "Умеренная симметрия" : "Выраженная асимметрия";
  const getScoreColor = (s: number) => s >= 85 ? "#00FFB2" : s >= 70 ? "#FFD166" : "#FF6B6B";

  return (
    <div className="min-h-screen bg-[#060608] text-white overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none scanlines" />
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,255,178,0.04) 0%, transparent 60%)" }} />

      <header className="relative z-10 border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded border border-cyan-400/30 flex items-center justify-center bg-cyan-400/5">
              <Icon name="Aperture" size={16} className="text-cyan-400" />
            </div>
            <div>
              <span className="font-display text-lg font-bold tracking-tight text-white">SYMMETRA</span>
              <span className="text-white/20 font-mono text-xs ml-2">v2.1</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-white/25">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            СИСТЕМА АКТИВНА
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 relative z-10">

        {step === "upload" && (
          <div className="animate-fade-in">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-mono text-white/40 mb-6">
                <Icon name="Cpu" size={12} />
                НЕЙРОСЕТЕВОЙ АНАЛИЗ ЛИЦЕВОЙ СИММЕТРИИ
              </div>
              <h1 className="font-display text-5xl md:text-6xl font-bold mb-4 leading-none">
                <span className="text-white">Анализ</span>
                <br />
                <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #00FFB2, #00B4D8)" }}>
                  симметрии
                </span>
              </h1>
              <p className="text-white/40 font-mono text-sm max-w-md mx-auto leading-relaxed">
                Точный анализ 68 ключевых точек лица. Детальный отчёт по левой и правой половинам.
              </p>
            </div>
            <UploadZone onUpload={handleUpload} />
            {errorMsg && (
              <div className="mt-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-start gap-3">
                <Icon name="AlertCircle" size={16} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-mono text-red-400">{errorMsg === "face_not_found" ? "Лицо не обнаружено — загрузите чёткое фото с лицом" : errorMsg}</p>
                </div>
              </div>
            )}
            <div className="mt-10 grid grid-cols-3 gap-4">
              {[
                { icon: "ScanLine", label: "68 точек", sub: "Прецизионная сетка" },
                { icon: "BarChart3", label: "5 зон", sub: "Детальные метрики" },
                { icon: "FileText", label: "Отчёт", sub: "Подробная сводка" },
              ].map(item => (
                <div key={item.label} className="p-4 rounded-xl border border-white/5 bg-white/[0.01] text-center">
                  <Icon name={item.icon} size={20} className="text-white/30 mx-auto mb-2" />
                  <p className="font-display text-sm font-medium text-white/60">{item.label}</p>
                  <p className="text-xs font-mono text-white/25 mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="relative mb-8">
              <div className="w-32 h-32 rounded-full border border-white/5 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border border-cyan-400/20 flex items-center justify-center animate-spin" style={{ animationDuration: "3s" }}>
                  <div className="w-16 h-16 rounded-full border border-violet-400/20 animate-spin" style={{ animationDuration: "2s", animationDirection: "reverse" }} />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon name="ScanFace" size={28} className="text-cyan-400/60" />
                </div>
              </div>
              <div className="absolute -inset-4 rounded-full" style={{ background: "radial-gradient(circle, rgba(0,255,178,0.05) 0%, transparent 70%)" }} />
            </div>
            <div className="w-64 mb-3">
              <div className="h-px bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #00B4D8, #00FFB2)", boxShadow: "0 0 10px #00FFB260" }} />
              </div>
            </div>
            <p className="font-mono text-sm text-white/40">
              {progress < 20 ? "Обнаружение лица..." : progress < 45 ? "Построение сетки точек..." : progress < 70 ? "Анализ зон симметрии..." : progress < 90 ? "Вычисление метрик..." : "Генерация отчёта..."}
            </p>
            <p className="font-mono text-xs text-white/20 mt-1">{progress}%</p>
          </div>
        )}

        {step === "result" && report && (
          <div className="animate-fade-in">
            <div className="flex items-start justify-between mb-8 flex-wrap gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-mono text-white/30 tracking-widest">АНАЛИЗ ЗАВЕРШЁН</span>
                </div>
                <h2 className="font-display text-4xl font-bold text-white mb-1">Отчёт о симметрии</h2>
                <p className="text-white/30 font-mono text-sm">{new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <ScoreRing score={report.overallScore} size={110} />
                  <p className="text-xs font-mono mt-2" style={{ color: getScoreColor(report.overallScore) }}>
                    {getScoreLabel(report.overallScore)}
                  </p>
                </div>
                <button onClick={reset} className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all" title="Новый анализ">
                  <Icon name="RotateCcw" size={18} />
                </button>
              </div>
            </div>

            <div className="flex gap-1 mb-6 border-b border-white/5">
              {[
                { key: "visual", label: "Визуализация", icon: "Eye" },
                { key: "zones", label: "Зоны лица", icon: "Grid3x3" },
                { key: "summary", label: "Сводка", icon: "FileBarChart" },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as "visual" | "zones" | "summary")}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-mono transition-all border-b-2 -mb-px ${
                    activeTab === tab.key ? "border-cyan-400 text-cyan-300" : "border-transparent text-white/30 hover:text-white/50"
                  }`}
                >
                  <Icon name={tab.icon} size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "visual" && (
              <div className="animate-fade-in">
                <FaceSplitView image={report.originalImage} />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.02]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400/60" />
                      <span className="text-xs font-mono text-cyan-400/60 tracking-wider">ЛЕВАЯ ПОЛОВИНА</span>
                    </div>
                    <div className="space-y-1">
                      {report.zones.slice(0, 4).map(z => (
                        <div key={z.name} className="flex justify-between text-xs font-mono">
                          <span className="text-white/40">{z.name}</span>
                          <span className="text-cyan-300/70">{z.left.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-violet-400/10 bg-violet-400/[0.02]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-violet-400/60" />
                      <span className="text-xs font-mono text-violet-400/60 tracking-wider">ПРАВАЯ ПОЛОВИНА</span>
                    </div>
                    <div className="space-y-1">
                      {report.zones.slice(0, 4).map(z => (
                        <div key={z.name} className="flex justify-between text-xs font-mono">
                          <span className="text-white/40">{z.name}</span>
                          <span className="text-violet-300/70">{z.right.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "zones" && (
              <div className="animate-fade-in space-y-3">
                {report.zones.map((zone, i) => <BarComparison key={zone.name} zone={zone} index={i} />)}
              </div>
            )}

            {activeTab === "summary" && (
              <div className="animate-fade-in space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Общий балл", value: `${report.overallScore}%`, color: getScoreColor(report.overallScore) },
                    { label: "Лучшая зона", value: [...report.zones].sort((a, b) => b.score - a.score)[0].name, color: "#00FFB2" },
                    { label: "Слабая зона", value: [...report.zones].sort((a, b) => a.score - b.score)[0].name, color: "#FF6B6B" },
                    { label: "Зон изучено", value: `${report.zones.length} / 5`, color: "#FFD166" },
                  ].map(stat => (
                    <div key={stat.label} className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                      <p className="text-xs font-mono text-white/30 mb-1">{stat.label}</p>
                      <p className="font-display text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                    </div>
                  ))}
                </div>
                <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
                  <h3 className="font-display text-base font-medium text-white/80 mb-3 flex items-center gap-2">
                    <Icon name="Lightbulb" size={16} className="text-yellow-400/60" />
                    Интерпретация результатов
                  </h3>
                  <div className="space-y-2 text-sm font-mono text-white/40 leading-relaxed">
                    <p>
                      Общий индекс симметрии{" "}
                      <span style={{ color: getScoreColor(report.overallScore) }}>{report.overallScore}%</span>
                      {" — "}{report.overallScore >= 80 ? "высокий показатель. Структура лица хорошо сбалансирована." : report.overallScore >= 65 ? "средний показатель. Присутствует умеренная асимметрия, характерная для большинства людей." : "асимметрия выражена. Рекомендуется обратить внимание на отдельные зоны."}
                    </p>
                    <p>
                      Наиболее симметричная зона:{" "}
                      <span className="text-cyan-300/70">{[...report.zones].sort((a, b) => b.score - a.score)[0].name}</span>
                    </p>
                    <p>
                      Зона с наибольшим отклонением:{" "}
                      <span className="text-red-400/70">{[...report.zones].sort((a, b) => a.score - b.score)[0].name}</span>
                      {" — это нормально. Человеческое лицо никогда не бывает идеально симметричным."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={reset}
                  className="w-full py-3 rounded-xl border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 font-mono text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Icon name="ScanFace" size={15} />
                  Проанализировать новое фото
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}