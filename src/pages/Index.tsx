import { useState, useRef, useCallback, useEffect } from "react";
import Icon from "@/components/ui/icon";

const buildHalfCanvas = (
  img: HTMLImageElement,
  side: "left" | "right"
): string => {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  const cx = img.width / 2;

  if (side === "left") {
    // Левая половина оригинала → зеркалим на правую
    ctx.drawImage(img, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, 0, cx, img.height);
    ctx.clip();
    ctx.translate(img.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  } else {
    // Правая половина оригинала → зеркалим на левую
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, 0, cx, img.height);
    ctx.clip();
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cx, img.height);
    ctx.clip();
    ctx.translate(img.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  return canvas.toDataURL("image/jpeg", 0.95);
};

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
          : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50"
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
  const aColor = accent === "left" ? "text-sky-500" : "text-violet-500";
  const aBorder = accent === "left" ? "border-sky-200" : "border-violet-200";
  const aBg = accent === "left" ? "bg-sky-50" : "bg-violet-50";
  const aDot = accent === "left" ? "bg-sky-400" : "bg-violet-400";

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `symmetra-${accent}.jpg`;
    a.click();
  };

  return (
    <div className={`rounded-2xl border ${aBorder} ${aBg} overflow-hidden`}>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
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

export default function Index() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [leftImg, setLeftImg] = useState<string | null>(null);
  const [rightImg, setRightImg] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleUpload = useCallback((imageData: string) => {
    setProcessing(true);
    setLeftImg(null);
    setRightImg(null);
    setOriginalImage(imageData);

    const img = new Image();
    img.onload = () => {
      const left = buildHalfCanvas(img, "left");
      const right = buildHalfCanvas(img, "right");
      setLeftImg(left);
      setRightImg(right);
      setProcessing(false);
    };
    img.src = imageData;
  }, []);

  const reset = () => {
    setOriginalImage(null);
    setLeftImg(null);
    setRightImg(null);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-800 overflow-x-hidden">

      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Icon name="Aperture" size={14} className="text-white" />
            </div>
            <span className="font-display text-base font-bold text-slate-800 tracking-tight">SYMMETRA</span>
          </div>
          {originalImage && (
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

        {/* Upload state */}
        {!originalImage && (
          <div className="animate-fade-in">
            <div className="text-center mb-10">
              <h1 className="font-display text-5xl md:text-6xl font-bold mb-3 text-slate-800 leading-tight">
                Симметрия<br />
                <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #6366f1, #8b5cf6)" }}>
                  лица
                </span>
              </h1>
              <p className="text-slate-400 text-sm font-mono max-w-sm mx-auto leading-relaxed">
                Загрузите фото — получите два снимка:<br />
                лицо из левой и правой половин
              </p>
            </div>
            <UploadZone onUpload={handleUpload} />

            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { icon: "SplitSquareHorizontal", label: "Разделение", sub: "Лево и право отдельно" },
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

        {/* Processing */}
        {processing && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center">
              <Icon name="Loader2" size={24} className="text-indigo-400 animate-spin" />
            </div>
            <p className="font-mono text-sm text-slate-400">Строю зеркальные снимки...</p>
          </div>
        )}

        {/* Result */}
        {!processing && leftImg && rightImg && (
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

            {/* Оригинал */}
            <div className="mb-6 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <span className="font-mono text-xs font-semibold text-slate-400 tracking-wider">ОРИГИНАЛ</span>
              </div>
              <div className="px-3 pb-3">
                <img src={originalImage} alt="Оригинал" className="w-full h-auto max-h-64 object-contain rounded-xl border border-slate-50 bg-slate-50" />
              </div>
            </div>

            {/* Два результата */}
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
