import { useState, useRef, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";

const buildHalfCanvas = (
  img: HTMLImageElement,
  side: "left" | "right",
  splitPercent: number
): string => {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  const splitX = Math.round((splitPercent / 100) * img.width);

  if (side === "left") {
    // Левая часть оригинала слева
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, img.height);
    ctx.clip();
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    // Зеркало левой части справа
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, img.width - splitX, img.height);
    ctx.clip();
    ctx.translate(splitX * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  } else {
    // Правая часть оригинала справа
    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, 0, img.width - splitX, img.height);
    ctx.clip();
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    // Зеркало правой части слева
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, img.height);
    ctx.clip();
    ctx.translate(splitX * 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
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

// ---- Компонент: редактор линии раздела ----
const SplitEditor = ({
  imageData,
  onConfirm,
  onBack,
}: {
  imageData: string;
  onConfirm: (splitPercent: number) => void;
  onBack: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [splitPercent, setSplitPercent] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Загружаем изображение
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = imageData;
  }, [imageData]);

  // Перерисовываем canvas при изменении линии
  useEffect(() => {
    if (!imgLoaded || !imgRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const img = imgRef.current;

    canvas.width = img.width;
    canvas.height = img.height;

    ctx.drawImage(img, 0, 0);

    const splitX = Math.round((splitPercent / 100) * img.width);

    // Затемнение правой части
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(splitX, 0, img.width - splitX, img.height);

    // Сама линия
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = Math.max(2, img.width * 0.003);
    ctx.setLineDash([]);
    ctx.shadowColor = "rgba(99,102,241,0.8)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, img.height);
    ctx.stroke();
    ctx.restore();

    // Иконка-ручка по центру линии
    const handleY = img.height / 2;
    const r = Math.max(18, img.width * 0.025);
    ctx.save();
    ctx.beginPath();
    ctx.arc(splitX, handleY, r, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.shadowColor = "rgba(99,102,241,0.5)";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();

    // Стрелки влево/вправо
    ctx.save();
    ctx.fillStyle = "#6366f1";
    ctx.font = `bold ${Math.max(14, r * 0.8)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("↔", splitX, handleY);
    ctx.restore();

    // Метки ЛЕВО / ПРАВО
    const labelSize = Math.max(12, img.width * 0.018);
    ctx.font = `600 ${labelSize}px monospace`;
    ctx.textBaseline = "top";

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = "left";
    ctx.fillText("ЛЕВО", 12, 12);

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.textAlign = "right";
    ctx.fillText("ПРАВО", img.width - 12, 12);
  }, [imgLoaded, splitPercent]);

  const getPercentFromEvent = (clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 50;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.min(85, Math.max(15, (x / rect.width) * 100));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setSplitPercent(getPercentFromEvent(e.clientX));
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setSplitPercent(getPercentFromEvent(e.clientX));
  };
  const onMouseUp = () => setDragging(false);

  const onTouchStart = (e: React.TouchEvent) => {
    setDragging(true);
    setSplitPercent(getPercentFromEvent(e.touches[0].clientX));
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    setSplitPercent(getPercentFromEvent(e.touches[0].clientX));
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors">
            <Icon name="ArrowLeft" size={16} />
          </button>
          <h2 className="font-display text-2xl font-bold text-slate-800">Установите линию раздела</h2>
        </div>
        <p className="text-slate-400 font-mono text-xs ml-6">
          Перетащите линию по центру лица, затем нажмите «Поехали»
        </p>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 ${dragging ? "cursor-grabbing" : "cursor-col-resize"}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => setDragging(false)}
      >
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
            <Icon name="Loader2" size={28} className="text-slate-300 animate-spin" />
          </div>
        )}
        <canvas ref={canvasRef} className="w-full h-auto block select-none" />
      </div>

      {/* Слайдер */}
      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs font-mono text-slate-400 w-8 text-right">←</span>
        <input
          type="range"
          min={15}
          max={85}
          value={Math.round(splitPercent)}
          onChange={(e) => setSplitPercent(Number(e.target.value))}
          className="flex-1 accent-indigo-500 h-1.5 cursor-pointer"
        />
        <span className="text-xs font-mono text-slate-400 w-8">→</span>
        <span className="text-xs font-mono text-indigo-500 w-10 text-right">{Math.round(splitPercent)}%</span>
      </div>

      {/* Кнопка */}
      <button
        onClick={() => onConfirm(splitPercent)}
        className="mt-5 w-full py-3.5 rounded-2xl font-display text-base font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.99] shadow-md"
        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
      >
        Поехали →
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

  const handleConfirm = useCallback((splitPercent: number) => {
    if (!originalImage) return;
    const img = new Image();
    img.onload = () => {
      setLeftImg(buildHalfCanvas(img, "left", splitPercent));
      setRightImg(buildHalfCanvas(img, "right", splitPercent));
      setStep("result");
    };
    img.src = originalImage;
  }, [originalImage]);

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
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-slate-600 transition-colors"
            >
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
                Загрузите фото — поставьте линию раздела<br />
                и получите два зеркальных снимка
              </p>
            </div>
            <UploadZone onUpload={handleUpload} />
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { icon: "SplitSquareHorizontal", label: "Линия раздела", sub: "Вы сами задаёте центр" },
                { icon: "FlipHorizontal2", label: "Зеркало", sub: "Каждая сторона × 2" },
                { icon: "Download", label: "Скачать", sub: "Оба снимка в JPEG" },
              ].map((item) => (
                <div key={item.label} className="p-4 rounded-xl border border-slate-100 bg-white text-center shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-2.5">
                    <Icon name={item.icon} size={17} className="text-slate-400" />
                  </div>
                  <p className="font-display text-sm font-semibold text-slate-600">{item.label}</p>
                  <p className="text-xs font-mono text-slate-300 mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Шаг 2: Редактор линии */}
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
              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all shadow-sm"
              >
                <Icon name="RotateCcw" size={14} />
                Новое фото
              </button>
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
              <ResultImage
                src={leftImg}
                label="ЛЕВАЯ СТОРОНА × 2"
                sublabel="Левая половина отражена зеркально"
                accent="left"
              />
              <ResultImage
                src={rightImg}
                label="ПРАВАЯ СТОРОНА × 2"
                sublabel="Правая половина отражена зеркально"
                accent="right"
              />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
