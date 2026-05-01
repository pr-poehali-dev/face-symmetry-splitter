import { useState, useRef, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";

// ---- Утилита: повернуть + выровнять изображение в canvas → dataURL ----
const applyTransform = (
  img: HTMLImageElement,
  angleDeg: number,
  brightness: number // 1.0 = норма, 1.5 = светлее
): HTMLCanvasElement => {
  const rad = (angleDeg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const w = Math.round(img.width * cos + img.height * sin);
  const h = Math.round(img.width * sin + img.height * cos);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.filter = brightness !== 1 ? `brightness(${brightness})` : "none";
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";

  return canvas;
};

// ---- Утилита: построить зеркальную половину ----
const buildHalfCanvas = (
  src: HTMLCanvasElement,
  side: "left" | "right",
  splitPercent: number
): string => {
  const canvas = document.createElement("canvas");
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext("2d")!;
  const splitX = Math.round((splitPercent / 100) * src.width);

  if (side === "left") {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, src.height);
    ctx.clip();
    ctx.drawImage(src, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, src.width - splitX, src.height);
    ctx.clip();
    ctx.translate(splitX * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, src.width - splitX, src.height);
    ctx.clip();
    ctx.drawImage(src, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, src.height);
    ctx.clip();
    ctx.translate(splitX * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    ctx.restore();
  }

  return canvas.toDataURL("image/jpeg", 0.95);
};

// ---- Компонент: зона загрузки ----
const UploadZone = ({ onUpload }: { onUpload: (data: string) => void }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const process = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) onUpload(e.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className={`relative rounded-2xl border-2 border-dashed p-14 text-center cursor-pointer transition-all duration-300 ${
        dragging
          ? "border-indigo-400/60 bg-indigo-50"
          : "border-slate-200 hover:border-indigo-300 bg-white hover:bg-slate-50/50"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files[0]) process(e.dataTransfer.files[0]);
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) process(e.target.files[0]); }}
      />
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <Icon name="ImageUp" size={26} className="text-indigo-400" />
        </div>
        <div>
          <p className="font-display text-xl text-slate-700 font-semibold">Загрузите фото лица</p>
          <p className="text-sm text-slate-400 mt-1 font-mono">Перетащите или нажмите · JPG, PNG, WEBP</p>
        </div>
        <div className="flex gap-4 text-xs text-slate-300 font-mono">
          <span>· Лицо по центру</span>
          <span>· Нейтральное выражение</span>
          <span>· Хорошее освещение</span>
        </div>
      </div>
      {dragging && (
        <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-indigo-50/80 backdrop-blur-sm">
          <span className="text-indigo-500 font-mono text-lg">Отпустите для загрузки</span>
        </div>
      )}
    </div>
  );
};

// ---- Компонент: редактор (поворот + яркость + линия раздела) ----
const SplitEditor = ({
  imageData,
  onConfirm,
  onBack,
}: {
  imageData: string;
  onConfirm: (transformedCanvas: HTMLCanvasElement, splitPercent: number) => void;
  onBack: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const [angle, setAngle] = useState(0);          // градусы, -45..+45
  const [brightness, setBrightness] = useState(1); // 1.0 = норма
  const [splitPercent, setSplitPercent] = useState(50);
  const [draggingLine, setDraggingLine] = useState(false);

  // Загружаем исходное изображение
  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
    img.src = imageData;
  }, [imageData]);

  // Перерисовываем canvas при любом изменении
  useEffect(() => {
    if (!imgLoaded || !imgRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Трансформированное изображение
    const transformed = applyTransform(imgRef.current, angle, brightness);
    canvas.width = transformed.width;
    canvas.height = transformed.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(transformed, 0, 0);

    const splitX = Math.round((splitPercent / 100) * canvas.width);

    // Лёгкое затемнение справа — только как подсказка
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(splitX, 0, canvas.width - splitX, canvas.height);

    // Линия раздела
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = Math.max(2, canvas.width * 0.003);
    ctx.shadowColor = "rgba(99,102,241,0.9)";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, canvas.height);
    ctx.stroke();
    ctx.restore();

    // Ручка по центру линии
    const handleY = canvas.height / 2;
    const r = Math.max(18, canvas.width * 0.025);
    ctx.save();
    ctx.beginPath();
    ctx.arc(splitX, handleY, r, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.shadowColor = "rgba(99,102,241,0.5)";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "#6366f1";
    ctx.font = `bold ${Math.max(14, r * 0.8)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("↔", splitX, handleY);
    ctx.restore();

    // Метки
    const labelSize = Math.max(11, canvas.width * 0.016);
    ctx.font = `600 ${labelSize}px monospace`;
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.textAlign = "left";
    ctx.fillText("ЛЕВО", 10, 10);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "right";
    ctx.fillText("ПРАВО", canvas.width - 10, 10);
  }, [imgLoaded, angle, brightness, splitPercent]);

  const getPercentFromEvent = (clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 50;
    const rect = canvas.getBoundingClientRect();
    return Math.min(85, Math.max(15, ((clientX - rect.left) / rect.width) * 100));
  };

  const onMouseDown = (e: React.MouseEvent) => { setDraggingLine(true); setSplitPercent(getPercentFromEvent(e.clientX)); };
  const onMouseMove = (e: React.MouseEvent) => { if (draggingLine) setSplitPercent(getPercentFromEvent(e.clientX)); };
  const onMouseUp = () => setDraggingLine(false);
  const onTouchStart = (e: React.TouchEvent) => { setDraggingLine(true); setSplitPercent(getPercentFromEvent(e.touches[0].clientX)); };
  const onTouchMove = (e: React.TouchEvent) => { if (draggingLine) setSplitPercent(getPercentFromEvent(e.touches[0].clientX)); };

  const handleConfirm = () => {
    if (!imgRef.current) return;
    const transformed = applyTransform(imgRef.current, angle, brightness);
    onConfirm(transformed, splitPercent);
  };

  const brightnessLabel = brightness < 1
    ? `−${Math.round((1 - brightness) * 100)}%`
    : brightness > 1
    ? `+${Math.round((brightness - 1) * 100)}%`
    : "0%";

  return (
    <div className="animate-fade-in">
      {/* Заголовок */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors">
            <Icon name="ArrowLeft" size={16} />
          </button>
          <h2 className="font-display text-2xl font-bold text-slate-800">Выровняйте фото</h2>
        </div>
        <p className="text-slate-400 font-mono text-xs ml-6">
          Поверните, выровняйте яркость, затем установите линию раздела
        </p>
      </div>

      {/* Панель инструментов */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {/* Поворот */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Icon name="RotateCw" size={14} className="text-indigo-400" />
              <span className="text-xs font-mono font-semibold text-slate-500">ПОВОРОТ</span>
            </div>
            <span className="text-xs font-mono text-indigo-500 tabular-nums">
              {angle > 0 ? `+${angle}°` : angle < 0 ? `${angle}°` : "0°"}
            </span>
          </div>
          <input
            type="range"
            min={-45}
            max={45}
            step={0.5}
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
            className="w-full accent-indigo-500 h-1.5"
          />
          <div className="flex justify-between text-xs font-mono text-slate-300 mt-1">
            <span>−45°</span>
            <button
              onClick={() => setAngle(0)}
              className="text-slate-400 hover:text-indigo-500 transition-colors text-xs"
            >
              сброс
            </button>
            <span>+45°</span>
          </div>
        </div>

        {/* Яркость */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Icon name="Sun" size={14} className="text-amber-400" />
              <span className="text-xs font-mono font-semibold text-slate-500">ЯРКОСТЬ</span>
            </div>
            <span className="text-xs font-mono text-amber-500 tabular-nums">{brightnessLabel}</span>
          </div>
          <input
            type="range"
            min={0.4}
            max={2.0}
            step={0.05}
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full accent-amber-400 h-1.5"
          />
          <div className="flex justify-between text-xs font-mono text-slate-300 mt-1">
            <span>темнее</span>
            <button
              onClick={() => setBrightness(1)}
              className="text-slate-400 hover:text-amber-500 transition-colors text-xs"
            >
              сброс
            </button>
            <span>светлее</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div
        className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 select-none ${draggingLine ? "cursor-grabbing" : "cursor-col-resize"}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => setDraggingLine(false)}
      >
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
            <Icon name="Loader2" size={28} className="text-slate-300 animate-spin" />
          </div>
        )}
        <canvas ref={canvasRef} className="w-full h-auto block" />
      </div>

      {/* Слайдер линии раздела */}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs font-mono text-slate-400 w-6 text-right">←</span>
        <input
          type="range"
          min={15}
          max={85}
          value={Math.round(splitPercent)}
          onChange={(e) => setSplitPercent(Number(e.target.value))}
          className="flex-1 accent-indigo-500 h-1.5 cursor-pointer"
        />
        <span className="text-xs font-mono text-slate-400 w-6">→</span>
        <span className="text-xs font-mono text-indigo-500 w-10 text-right">{Math.round(splitPercent)}%</span>
      </div>

      {/* Кнопка */}
      <button
        onClick={handleConfirm}
        className="mt-5 w-full py-3.5 rounded-2xl font-display text-base font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.99] shadow-md flex items-center justify-center gap-2"
        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
      >
        <Icon name="Rocket" size={18} />
        Поехали
      </button>
    </div>
  );
};

// ---- Компонент: результирующее фото ----
const ResultImage = ({
  src,
  label,
  sublabel,
  accent,
}: {
  src: string;
  label: string;
  sublabel: string;
  accent: "left" | "right";
}) => {
  const [loaded, setLoaded] = useState(false);
  const aBorder = accent === "left" ? "border-sky-200" : "border-violet-200";
  const aBg = accent === "left" ? "bg-sky-50" : "bg-violet-50";
  const aDot = accent === "left" ? "bg-sky-400" : "bg-violet-400";
  const aColor = accent === "left" ? "text-sky-500" : "text-violet-500";

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `symmetra-${accent}.jpg`;
    a.click();
  };

  return (
    <div className={`rounded-2xl border ${aBorder} ${aBg} overflow-hidden`}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${aDot}`} />
          <span className={`font-mono text-xs font-semibold tracking-wider ${aColor}`}>{label}</span>
        </div>
        <button
          onClick={handleDownload}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${aBorder} ${aColor} hover:bg-white`}
        >
          <Icon name="Download" size={11} />
          Скачать
        </button>
      </div>
      <div className="relative bg-white mx-3 mb-3 rounded-xl overflow-hidden border border-slate-100">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
            <Icon name="Loader2" size={24} className="text-slate-300 animate-spin" />
          </div>
        )}
        <img
          src={src}
          alt={label}
          className={`w-full h-auto transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
        />
      </div>
      <p className="px-4 pb-4 text-xs text-slate-400 font-mono">{sublabel}</p>
    </div>
  );
};

// ---- Главный компонент ----
export default function Index() {
  const [step, setStep] = useState<"upload" | "split" | "result">("upload");
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [leftImg, setLeftImg] = useState<string | null>(null);
  const [rightImg, setRightImg] = useState<string | null>(null);

  const handleUpload = useCallback((imageData: string) => {
    setOriginalImage(imageData);
    setStep("split");
  }, []);

  const handleConfirm = useCallback((transformedCanvas: HTMLCanvasElement, splitPercent: number) => {
    setLeftImg(buildHalfCanvas(transformedCanvas, "left", splitPercent));
    setRightImg(buildHalfCanvas(transformedCanvas, "right", splitPercent));
    setStep("result");
  }, []);

  const reset = () => {
    setStep("upload");
    setOriginalImage(null);
    setLeftImg(null);
    setRightImg(null);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-800 overflow-x-hidden">

      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Icon name="Aperture" size={14} className="text-white" />
            </div>
            <span className="font-display text-base font-bold text-slate-800 tracking-tight">SYMMETRA</span>
          </div>
          {step !== "upload" && (
            <button onClick={reset} className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-slate-600 transition-colors">
              <Icon name="RotateCcw" size={13} />
              Новое фото
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">

        {/* Шаг 1: Загрузка */}
        {step === "upload" && (
          <div className="animate-fade-in">
            <div className="text-center mb-10">
              <h1 className="font-display text-5xl md:text-6xl font-bold mb-3 text-slate-800 leading-tight">
                Симметрия<br />
                <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #6366f1, #8b5cf6)" }}>
                  лица
                </span>
              </h1>
              <p className="text-slate-400 text-sm font-mono max-w-sm mx-auto leading-relaxed">
                Загрузите фото — выровняйте наклон головы,<br />
                поставьте линию раздела и получите два зеркальных снимка
              </p>
            </div>
            <UploadZone onUpload={handleUpload} />
            <div className="mt-8 grid grid-cols-4 gap-3">
              {[
                { icon: "RotateCw", label: "Поворот", sub: "Выровнять наклон" },
                { icon: "Sun", label: "Яркость", sub: "Убрать тени" },
                { icon: "SplitSquareHorizontal", label: "Линия", sub: "Задать центр" },
                { icon: "FlipHorizontal2", label: "Зеркало", sub: "Два снимка" },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-xl border border-slate-100 bg-white text-center shadow-sm">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-2">
                    <Icon name={item.icon} size={15} className="text-slate-400" />
                  </div>
                  <p className="font-display text-xs font-semibold text-slate-600">{item.label}</p>
                  <p className="text-xs font-mono text-slate-300 mt-0.5 leading-tight">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Шаг 2: Редактор */}
        {step === "split" && originalImage && (
          <SplitEditor
            imageData={originalImage}
            onConfirm={handleConfirm}
            onBack={() => setStep("upload")}
          />
        )}

        {/* Шаг 3: Результат */}
        {step === "result" && leftImg && rightImg && originalImage && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-3xl font-bold text-slate-800">Результат</h2>
                <p className="text-slate-400 font-mono text-xs mt-1">Два симметричных снимка из одного фото</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep("split")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all shadow-sm"
                >
                  <Icon name="SlidersHorizontal" size={14} />
                  Изменить
                </button>
                <button
                  onClick={reset}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all shadow-sm"
                >
                  <Icon name="RotateCcw" size={14} />
                  Новое фото
                </button>
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <span className="font-mono text-xs font-semibold text-slate-400 tracking-wider">ОРИГИНАЛ</span>
              </div>
              <div className="px-3 pb-3">
                <img
                  src={originalImage}
                  alt="Оригинал"
                  className="w-full h-auto max-h-64 object-contain rounded-xl border border-slate-50 bg-slate-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResultImage src={leftImg} label="ЛЕВАЯ СТОРОНА × 2" sublabel="Левая половина отражена зеркально" accent="left" />
              <ResultImage src={rightImg} label="ПРАВАЯ СТОРОНА × 2" sublabel="Правая половина отражена зеркально" accent="right" />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
