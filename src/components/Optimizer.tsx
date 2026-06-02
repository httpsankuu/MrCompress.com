import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, Download, X, Image as ImageIcon, Check, Sliders, Scissors, ArrowRightLeft, RotateCcw, Share2, Sparkles, Code, Eraser, MousePointer2, Undo2, RotateCw } from 'lucide-react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import heic2any from 'heic2any';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { removeBackground } from '@imgly/background-removal';
import { optimize } from 'svgo/browser';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import '../i18n';

// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ImageState {
  file: File;
  preview: string;
  originalSize: number;
  width: number;
  height: number;
  aspectRatio: number;
  type: string;
  id: string;
  isSvg?: boolean;
  svgContent?: string;
  history: string[]; 
}

interface CropArea { x: number; y: number; width: number; height: number; }

type TabType = 'compress' | 'convert' | 'social' | 'remove-bg';

interface OptimizerProps {
  initialTab?: TabType;
  allowedTabs?: TabType[];
  showSocialPresets?: boolean;
  showRemoveBg?: boolean;
}

export default function Optimizer({ 
  initialTab = 'compress',
  allowedTabs = ['compress', 'convert'],
  showSocialPresets = false,
  showRemoveBg = false
}: OptimizerProps) {
  const { t } = useTranslation();
  const [images, setImages] = useState<ImageState[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quality, setQuality] = useState(80);
  const [targetWidth, setTargetWidth] = useState<number>(0);
  const [targetHeight, setTargetHeight] = useState<number>(0);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const eraserCanvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputFormat, setOutputFormat] = useState('original');
  const [isConvertingHeic, setIsConvertingHeic] = useState(false);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  
  // Advanced Eraser state
  const [isEraserMode, setIsEraserMode] = useState(false);
  const [eraserTool, setEraserTool] = useState<'erase' | 'restore'>('erase');
  const [brushSize, setBrushSize] = useState(30);
  const [isDrawing, setIsDrawing] = useState(false);
  const [eraserHistory, setEraserHistory] = useState<string[]>([]);
  const [baseImageForEraser, setBaseImageForEraser] = useState<HTMLImageElement | null>(null);

  const ASPECT_RATIOS = [
    { label: t('optimizer.aspect_custom', 'Custom (Free)'), value: undefined },
    { label: '1:1', value: 1 }, { label: '4:5', value: 0.8 }, { label: '4:3', value: 4/3 },
    { label: '3:4', value: 3/4 }, { label: '3:2', value: 1.5 }, { label: '16:9', value: 16/9 },
    { label: '9:16', value: 9/16 }, { label: '5:4', value: 1.25 }, { label: '2:1', value: 2 },
  ];

  const SOCIAL_PRESETS = [
    { label: t('optimizer.ig_post'), width: 1080, height: 1080, aspect: 1 },
    { label: t('optimizer.ig_story'), width: 1080, height: 1920, aspect: 9/16 },
    { label: t('optimizer.yt_thumb'), width: 1280, height: 720, aspect: 16/9 },
    { label: t('optimizer.fb_cover'), width: 820, height: 312, aspect: 820/312 },
    { label: t('optimizer.li_profile'), width: 400, height: 400, aspect: 1 },
    { label: t('optimizer.tw_post'), width: 1200, height: 675, aspect: 16/9 },
  ];

  const OUTPUT_FORMATS = [
    { label: t('optimizer.original', 'Original'), value: 'original' },
    { label: 'JPEG', value: 'image/jpeg' }, { label: 'PNG', value: 'image/png' },
    { label: 'WebP', value: 'image/webp' }, { label: 'AVIF', value: 'image/avif' },
    { label: 'PDF', value: 'application/pdf' },
  ];

  const currentImage = images[activeIndex];

  const handleFiles = async (files: File[]) => {
    const newImages: ImageState[] = [];
    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) { toast.error(`${file.name}: ${t('optimizer.error_too_large')}`); continue; }
      let procFile = file;

      if (file.type === 'image/svg+xml') {
        try {
            const text = await file.text();
            const blob = new Blob([text], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            newImages.push({ file, preview: url, originalSize: file.size, width: 0, height: 0, aspectRatio: 1, type: 'image/svg+xml', id: Math.random().toString(36).substring(7), isSvg: true, svgContent: text, history: [] });
        } catch(e) { toast.error(`Failed to read SVG: ${file.name}`); }
        continue;
      }

      if (file.type === 'application/pdf') {
        setIsConvertingPdf(true);
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const page = await pdf.getPage(1);
          const vp = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error();
          canvas.height = vp.height; canvas.width = vp.width;
          await page.render({ canvasContext: ctx, viewport: vp }).promise;
          newImages.push({ file, preview: canvas.toDataURL('image/png'), originalSize: file.size, width: canvas.width, height: canvas.height, aspectRatio: canvas.width/canvas.height, type: 'image/png', id: Math.random().toString(36).substring(7), history: [] });
        } catch (e) { toast.error(`${file.name}: ${t('optimizer.error_pdf_fail')}`); } finally { setIsConvertingPdf(false); }
        continue;
      }
      if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
        setIsConvertingHeic(true);
        try {
          const conv = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
          procFile = Array.isArray(conv) ? conv[0] : (conv as File);
        } catch (e) { toast.error(`${file.name}: ${t('optimizer.error_heic_fail')}`); setIsConvertingHeic(false); continue; }
        setIsConvertingHeic(false);
      }
      await new Promise<void>((res) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image(); img.src = reader.result as string;
          img.onload = () => {
            newImages.push({ file: procFile, preview: reader.result as string, originalSize: file.size, width: img.width, height: img.height, aspectRatio: img.width/img.height, type: procFile.type, id: Math.random().toString(36).substring(7), history: [] });
            res();
          };
          img.onerror = () => { toast.error(`Failed to load image: ${file.name}`); res(); };
        };
        reader.onerror = () => { toast.error(`Failed to read file: ${file.name}`); res(); };
        reader.readAsDataURL(procFile);
      });
    }
    if (newImages.length > 0) {
      setImages(prev => [...prev, ...newImages]);
      if (images.length === 0) {
        setTargetWidth(newImages[0].width);
        setTargetHeight(newImages[0].height);
      }
    }
  };

  const saveToHistory = (newPreview: string) => {
      if (!currentImage) return;
      const updated = [...images];
      updated[activeIndex] = { 
          ...currentImage, 
          preview: newPreview, 
          history: [...currentImage.history, currentImage.preview] 
      };
      setImages(updated);
  };

  const handleGlobalUndo = () => {
      if (!currentImage || currentImage.history.length === 0) return;
      const updated = [...images];
      const prevPreview = currentImage.history[currentImage.history.length - 1];
      const newHistory = currentImage.history.slice(0, -1);
      updated[activeIndex] = { ...currentImage, preview: prevPreview, history: newHistory };
      setImages(updated);
      toast.success("Undone");
  };

  const handleRemoveBg = async () => {
    if (!currentImage || currentImage.isSvg) return;
    setIsRemovingBg(true);
    try {
      const resultBlob = await removeBackground(currentImage.preview, { debug: false, model: 'isnet_fp16' });
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        saveToHistory(url);
        setOutputFormat('image/png');
        toast.success(t('optimizer.bg_removed'));
      };
      reader.readAsDataURL(resultBlob);
    } catch (e) { 
        toast.error("AI failed. Switch to Manual Eraser?");
        initEraser(); 
    } finally { setIsRemovingBg(false); }
  };

  // Manual Eraser Logic
  const initEraser = () => {
      if (!currentImage) return;
      setIsEraserMode(true);
      setEraserHistory([]);
      const canvas = eraserCanvasRef.current;
      if (!canvas) { setTimeout(initEraser, 50); return; }
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = currentImage.preview;
      img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          setEraserHistory([canvas.toDataURL('image/png')]);
          
          // Also load the BASE original image for restoration
          const baseImg = new Image();
          baseImg.src = currentImage.history.length > 0 ? currentImage.history[0] : currentImage.preview;
          baseImg.onload = () => setBaseImageForEraser(baseImg);
      };
  };

  const pushEraserHistory = () => {
      if (!eraserCanvasRef.current) return;
      const url = eraserCanvasRef.current.toDataURL('image/png');
      setEraserHistory(prev => [...prev, url]);
  };

  const handleEraserUndo = () => {
      if (eraserHistory.length <= 1) return;
      const prevUrl = eraserHistory[eraserHistory.length - 2];
      const newHistory = eraserHistory.slice(0, -1);
      const canvas = eraserCanvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.src = prevUrl;
          img.onload = () => {
              ctx?.clearRect(0, 0, canvas.width, canvas.height);
              ctx?.drawImage(img, 0, 0);
              setEraserHistory(newHistory);
          };
      }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => { setIsDrawing(true); draw(e); };
  const stopDrawing = () => { if(isDrawing) pushEraserHistory(); setIsDrawing(false); eraserCanvasRef.current?.getContext('2d')?.beginPath(); };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || !eraserCanvasRef.current) return;
      const canvas = eraserCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
      let cx, cy;
      if ('touches' in e) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; } else { cx = e.clientX; cy = e.clientY; }

      const x = (cx - rect.left) * scaleX, y = (cy - rect.top) * scaleY;
      ctx.lineWidth = brushSize * scaleX; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      if (eraserTool === 'erase') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
      } else {
          // RESTORE logic: use original image pixels
          if (baseImageForEraser) {
              ctx.save();
              ctx.beginPath(); ctx.arc(x, y, (brushSize * scaleX) / 2, 0, Math.PI * 2); ctx.clip();
              ctx.globalCompositeOperation = 'source-over';
              ctx.drawImage(baseImageForEraser, 0, 0, canvas.width, canvas.height);
              ctx.restore();
          }
      }
  };

  const applyEraser = () => {
      if (eraserCanvasRef.current) {
          saveToHistory(eraserCanvasRef.current.toDataURL('image/png'));
          setOutputFormat('image/png'); setIsEraserMode(false); toast.success("Applied");
      }
  };

  const processSingleImage = async (imgState: ImageState): Promise<{blob: Blob, name: string}> => {
    const mimeToExt: any = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/avif':'avif', 'application/pdf':'pdf', 'image/svg+xml':'svg' };
    const bName = imgState.file.name.substring(0, imgState.file.name.lastIndexOf('.')) || imgState.file.name;
    if (imgState.isSvg) {
      const optimized = optimize(imgState.svgContent!, { plugins: ['preset-default', 'removeDimensions', { name: 'sortAttrs', params: { xmlnsOrder: 'alphabetical' } }] });
      return { blob: new Blob([optimized.data], { type: 'image/svg+xml' }), name: `optimized-${bName}.svg` };
    }
    const img = new Image(); img.src = imgState.preview;
    await new Promise((res) => { img.onload = res; img.onerror = res; });
    const sCanvas = document.createElement('canvas'); const sCtx = sCanvas.getContext('2d');
    const absRot = Math.abs(rotation) % 360, is90 = absRot === 90 || absRot === 270;
    sCanvas.width = is90 ? imgState.height : imgState.width; sCanvas.height = is90 ? imgState.width : imgState.height;
    sCtx!.translate(sCanvas.width/2, sCanvas.height/2); sCtx!.rotate((rotation * Math.PI)/180); sCtx!.drawImage(img, -imgState.width/2, -imgState.height/2);
    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
    let sX=0, sY=0, sW=sCanvas.width, sH=sCanvas.height;
    canvas.width = targetWidth || imgState.width; canvas.height = targetHeight || imgState.height;
    if (croppedAreaPixels && imgState.id === currentImage.id) { sX=croppedAreaPixels.x; sY=croppedAreaPixels.y; sW=croppedAreaPixels.width; sH=croppedAreaPixels.height; }
    else if (targetWidth > 0 && targetHeight > 0) {
        const ratio = Math.max(canvas.width / sW, canvas.height / sH);
        const actualSW = canvas.width / ratio, actualSH = canvas.height / ratio;
        sX = (sW - actualSW) / 2; sY = (sH - actualSH) / 2; sW = actualSW; sH = actualSH;
    }
    ctx!.drawImage(sCanvas, sX, sY, sW, sH, 0, 0, canvas.width, canvas.height);
    const tType = outputFormat === 'original' ? imgState.type : outputFormat;
    const ext = mimeToExt[tType] || 'bin';
    if (tType === 'application/pdf') {
      const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'l' : 'p', unit:'px', format:[canvas.width, canvas.height] });
      pdf.addImage(canvas.toDataURL('image/jpeg', quality/100), 'JPEG', 0, 0, canvas.width, canvas.height);
      return { blob: pdf.output('blob'), name: `optimized-${bName}.pdf` };
    }
    return new Promise((res) => { canvas.toBlob((b) => res({ blob: b!, name: `optimized-${bName}.${ext}` }), tType, quality/100); });
  };

  const compressActiveImage = useCallback(async () => {
    if (!currentImage || isEraserMode) return;
    setIsProcessing(true);
    try { const { blob } = await processSingleImage(currentImage); setCompressedBlob(blob); setCompressedSize(blob.size); }
    catch (e) {} finally { setIsProcessing(false); }
  }, [currentImage, quality, targetWidth, targetHeight, croppedAreaPixels, outputFormat, rotation, isEraserMode]);

  useEffect(() => { if (!currentImage || isEraserMode) return; const t = setTimeout(() => { compressActiveImage(); }, 300); return () => clearTimeout(t); }, [compressActiveImage, currentImage, isEraserMode]);

  useEffect(() => {
    if (compressedBlob && compressedBlob.type !== 'application/pdf') {
      const url = URL.createObjectURL(compressedBlob); setPreviewUrl(url); return () => URL.revokeObjectURL(url);
    }
  }, [compressedBlob]);

  const handleDownload = async () => {
    if (images.length === 0) return;
    setIsDownloading(true);
    try {
        if (images.length === 1) {
            const { blob, name } = await processSingleImage(images[0]);
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
        } else {
            const zip = new JSZip();
            for (let i=0; i<images.length; i++) {
                setBatchProgress(Math.round(((i+1)/images.length)*100));
                const { blob, name } = await processSingleImage(images[i]); zip.file(name, blob);
            }
            const cont = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(cont); const a = document.createElement('a'); a.href = url; a.download = 'mrcompress-batch.zip'; a.click(); URL.revokeObjectURL(url);
        }
    } catch(e) {} finally { setIsDownloading(false); setBatchProgress(0); }
  };

  const formatSize = (b: number) => {
    if (!b || b <= 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(b)/Math.log(k));
    return parseFloat((b/Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (aspect) {
      const { width, height } = e.currentTarget;
      if (width > 0 && height > 0) setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height), width, height));
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {(isConvertingHeic || isConvertingPdf || isRemovingBg) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-canvas/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-hairline border-t-ink"></div>
            <p className="text-sm font-medium text-ink">
              {isRemovingBg ? t('optimizer.removing_bg') : (isConvertingHeic ? t('optimizer.converting_heic') : t('optimizer.rendering_pdf'))}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="relative overflow-hidden rounded-xl border border-hairline bg-canvas shadow-v-3">
            {allowedTabs.length > 1 && !isEraserMode && (
              <div className="flex border-b border-hairline bg-canvas-soft">
                {allowedTabs.map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={cn("flex-1 py-4 text-xs font-semibold transition-all flex items-center justify-center gap-2 first:border-0 border-l border-hairline", activeTab === tab ? "bg-ink text-canvas" : "text-mute hover:text-ink hover:bg-canvas-soft-2")}>
                    {tab === 'compress' && <Sliders className="h-3.5 w-3.5" />}
                    {tab === 'convert' && <ArrowRightLeft className="h-3.5 w-3.5" />}
                    {tab === 'social' && <Share2 className="h-3.5 w-3.5" />}
                    {tab === 'remove-bg' && <Sparkles className="h-3.5 w-3.5" />}
                    {t(`optimizer.${tab}_tab`)}
                  </button>
                ))}
              </div>
            )}
            
            {(isEraserMode || activeTab === 'remove-bg') && images.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-ink text-canvas z-50 relative">
                <div className="flex items-center gap-4">
                  <div className="flex bg-canvas/10 rounded-lg p-1 gap-1">
                      <button onClick={() => setIsEraserMode(false)} className={cn("px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2", !isEraserMode ? "bg-canvas text-ink" : "text-canvas/60 hover:text-canvas hover:bg-canvas/5")}><MousePointer2 className="h-3 w-3" /> Selector</button>
                      <button onClick={initEraser} className={cn("px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2", isEraserMode ? "bg-canvas text-ink" : "text-canvas/60 hover:text-canvas hover:bg-canvas/5")}><Eraser className="h-3 w-3" /> Manual</button>
                  </div>
                  {isEraserMode && (
                    <div className="flex items-center gap-4 border-l border-canvas/20 pl-4 ml-2">
                        <div className="flex bg-canvas/10 rounded-md p-1">
                            <button onClick={() => setEraserTool('erase')} className={cn("px-2 py-1 rounded text-[10px] font-black uppercase", eraserTool === 'erase' ? "bg-geist-error text-canvas" : "text-canvas/40")}>Erase</button>
                            <button onClick={() => setEraserTool('restore')} className={cn("px-2 py-1 rounded text-[10px] font-black uppercase", eraserTool === 'restore' ? "bg-geist-success text-canvas" : "text-canvas/40")}>Restore</button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase opacity-40 font-black">Size</span>
                            <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-16 h-1 bg-canvas/20 rounded-full appearance-none cursor-pointer" />
                        </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEraserMode ? (
                      <button onClick={handleEraserUndo} disabled={eraserHistory.length <= 1} className="px-3 py-1.5 rounded-geist border border-canvas/20 text-canvas disabled:opacity-30 flex items-center gap-2 text-[10px] font-bold uppercase mr-2"><Undo2 className="h-3.5 w-3.5" /> Undo</button>
                  ) : (
                    currentImage.history.length > 0 && <button onClick={handleGlobalUndo} className="px-3 py-1.5 rounded-geist border border-canvas/20 text-canvas hover:bg-canvas/10 flex items-center gap-2 text-[10px] font-bold uppercase mr-2"><Undo2 className="h-3.5 w-3.5" /> Undo</button>
                  )}
                  {!isEraserMode ? (
                      <button onClick={handleRemoveBg} disabled={isRemovingBg} className="px-4 py-1.5 rounded-geist bg-geist-success text-canvas text-[10px] font-black uppercase hover:opacity-90 flex items-center gap-2 shadow-v-2">
                        <Sparkles className="h-3 w-3" /> {isRemovingBg ? "Running AI..." : "Magic AI Removal"}
                      </button>
                  ) : (
                    <>
                        <button onClick={() => setIsEraserMode(false)} className="px-3 py-1.5 rounded-geist border border-canvas/20 text-[10px] font-bold uppercase hover:bg-canvas/10">Cancel</button>
                        <button onClick={applyEraser} className="px-3 py-1.5 rounded-geist bg-canvas text-ink text-[10px] font-bold uppercase hover:opacity-90">Apply Changes</button>
                    </>
                  )}
                </div>
              </div>
            )}

            {images.length === 0 ? (
              <button type="button" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if(e.dataTransfer.files) handleFiles(Array.from(e.dataTransfer.files)); }} className="group relative flex aspect-[16/9] w-full cursor-pointer flex-col items-center justify-center bg-canvas transition-all hover:bg-canvas-soft-2 p-12" onClick={() => document.getElementById('fileInput')?.click()}>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas-soft shadow-v-1 transition-transform group-hover:scale-110"><Upload className="h-6 w-6 text-mute" /></div>
                <p className="mt-4 text-sm font-medium text-ink">{t('optimizer.upload_text')}</p>
                <p className="mt-1 text-xs text-mute">{t('optimizer.upload_hint')}</p>
                <input id="fileInput" type="file" multiple className="hidden" accept="image/*,.heic,.heif,.pdf,.svg" onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))} />
              </button>
            ) : (
              <>
                <div className="flex h-10 items-center justify-between bg-canvas-soft/50 px-4 border-b border-hairline">
                  <div className="flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5 text-mute" /><span className="text-[10px] font-medium text-ink truncate max-w-[200px]">{currentImage.file.name}</span></div>
                  <div className="flex items-center gap-3"><span className="text-[10px] font-bold text-mute">{t('optimizer.files_selected', { count: images.length })}</span><button onClick={() => { setImages([]); setCroppedAreaPixels(null); setCrop(undefined); setPreviewUrl(null); setCompressedBlob(null); setIsEraserMode(false); }} className="rounded-md p-1 hover:bg-canvas-soft-2 transition-colors"><X className="h-3.5 w-3.5 text-mute" /></button></div>
                </div>
                <div className="relative min-h-[400px] lg:h-[500px] bg-canvas-soft-2 flex items-center justify-center overflow-hidden p-8">
                  {currentImage.isSvg ? (
                    <div className="flex flex-col items-center gap-6">
                      <div className="p-8 bg-canvas rounded-xl shadow-v-2 border border-hairline"><Code className="h-16 w-16 text-geist-link" /></div>
                      <p className="text-sm font-medium text-ink">SVG Code Optimization Mode</p>
                    </div>
                  ) : isEraserMode ? (
                    <div className="relative max-w-full max-h-full cursor-crosshair">
                        <canvas ref={eraserCanvasRef} className="max-h-[450px] max-w-full object-contain shadow-v-4 bg-[url('/img/transparent-grid.png')] bg-repeat" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                    </div>
                  ) : isCropping ? (
                    <div className="relative max-w-full max-h-full">
                      <ReactCrop crop={crop} onChange={setCrop} onComplete={(c) => {
                        if (imgRef.current && c.width > 0 && c.height > 0) {
                          const sX = currentImage.width/imgRef.current.width, sY = currentImage.height/imgRef.current.height;
                          setCroppedAreaPixels({ x: Math.round(c.x*sX), y: Math.round(c.y*sY), width: Math.round(c.width*sX), height: Math.round(c.height*sY) });
                          setTargetWidth(Math.round(c.width*sX)); setTargetHeight(Math.round(c.height*sY));
                        }
                      }} aspect={aspect}>
                        <img ref={imgRef} src={currentImage.preview} alt="Crop" onLoad={onImageLoad} style={{ transform: `rotate(${rotation}deg)`, maxHeight: '450px' }} />
                      </ReactCrop>
                    </div>
                  ) : (
                    <div className="relative max-h-full transition-all duration-300">
                      <img src={isComparing ? currentImage.preview : (previewUrl || currentImage.preview)} alt="Preview" className="max-h-[450px] max-w-full object-contain shadow-v-2 rounded-sm" style={(!previewUrl || isComparing) ? { transform: `rotate(${rotation}deg)` } : {}} />
                      {previewUrl && !isCropping && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                          <button onMouseDown={() => setIsComparing(true)} onMouseUp={() => setIsComparing(false)} onMouseLeave={() => setIsComparing(false)} onTouchStart={() => setIsComparing(true)} onTouchEnd={() => setIsComparing(false)} className="bg-ink/80 backdrop-blur-md text-canvas px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-v-4 select-none touch-none">{t('optimizer.hold_compare')}</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {images.length > 1 && !isEraserMode && (
                  <div className="flex gap-2 overflow-x-auto p-4 bg-canvas-soft border-t border-hairline no-scrollbar">
                    {images.map((img, idx) => (
                      <div key={img.id} className="relative flex-shrink-0 group">
                        <button onClick={() => { setActiveIndex(idx); setCroppedAreaPixels(null); setCrop(undefined); setPreviewUrl(null); }} className={cn("h-16 w-16 rounded-lg border-2 transition-all overflow-hidden bg-canvas", activeIndex === idx ? "border-ink scale-105" : "border-transparent opacity-60 hover:opacity-100")}>
                          {img.isSvg ? <Code className="h-full w-full p-4 text-mute" /> : <img src={img.preview} className="h-full w-full object-cover" alt="Thumb" />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); const n = images.filter((_, i)=>i!==idx); setImages(n); if(activeIndex>=n.length) setActiveIndex(Math.max(0, n.length-1)); }} className="absolute -top-1 -right-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-geist-error text-canvas shadow-v-2"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                    <button onClick={() => document.getElementById('fileInput')?.click()} className="flex-shrink-0 h-16 w-16 rounded-lg border-2 border-dashed border-mute/30 flex items-center justify-center text-mute hover:border-ink hover:text-ink transition-all"><Upload className="h-5 w-5" /></button>
                  </div>
                )}

                {!isEraserMode && (
                <div className="flex flex-col bg-canvas border-t border-hairline">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-4 py-4 gap-6">
                    <div className="flex items-center gap-2">
                      {!currentImage.isSvg && (
                        <>
                          <button onClick={() => setIsCropping(!isCropping)} className={cn("flex items-center gap-2 rounded-geist-marketing px-4 py-2 text-xs font-semibold transition-all", isCropping ? "bg-ink text-canvas shadow-v-3" : "bg-canvas-soft text-ink hover:bg-canvas-soft-2 border border-hairline")}>
                            <Scissors className="h-4 w-4" />{isCropping ? t('optimizer.done_editing') : t('optimizer.crop_rotate')}
                          </button>
                          {(showRemoveBg || activeTab === 'remove-bg') && !isCropping && (
                            <button onClick={() => setActiveTab('remove-bg')} className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-ink text-canvas rounded-geist-marketing shadow-v-2 hover:opacity-90 transition-all"><Sparkles className="h-4 w-4" />{t('optimizer.remove_bg')}</button>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-8 bg-canvas-soft/80 rounded-xl px-6 py-3 border border-hairline">
                      <div className="flex flex-col"><span className="text-[10px] uppercase text-mute font-black opacity-60">{t('optimizer.original')}</span><span className="text-sm font-bold text-ink">{formatSize(currentImage.originalSize)}</span></div>
                      <div className="h-8 w-px bg-hairline-strong/20" /><div className="flex flex-col items-end text-right"><span className="text-[10px] uppercase text-mute font-black opacity-60">{t('optimizer.optimized')}</span><div className="flex items-center gap-3">{compressedSize > 0 && <span className="text-[10px] font-black text-geist-success bg-geist-success/10 px-2 py-0.5 rounded-full">-{Math.round((1 - compressedSize/currentImage.originalSize)*100)}%</span>}<span className={cn("text-sm font-black", compressedSize < currentImage.originalSize ? "text-geist-success" : "text-geist-warning")}>{isProcessing ? "..." : formatSize(compressedSize)}</span></div></div>
                    </div>
                  </div>
                  {isCropping && !currentImage.isSvg && (
                    <div className="flex flex-wrap gap-2 px-4 pb-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center bg-canvas-soft rounded-lg p-0.5 border border-hairline mr-2">
                        <button onClick={() => setRotation((r) => (r - 90)%360)} className="p-1.5 text-mute hover:text-ink"><ArrowRightLeft className="h-4 w-4 -rotate-90" /></button>
                        <button onClick={() => setRotation((r) => (r + 90)%360)} className="p-1.5 text-mute hover:text-ink"><ArrowRightLeft className="h-4 w-4 rotate-90" /></button>
                        <button onClick={() => { setRotation(0); setAspect(undefined); setCrop(undefined); setCroppedAreaPixels(null); if(currentImage){setTargetWidth(currentImage.width); setTargetHeight(currentImage.height);} }} className="p-1.5 text-mute hover:text-ink"><RotateCcw className="h-4 w-4" /></button>
                      </div>
                      {ASPECT_RATIOS.map((ar) => (
                        <button key={ar.label} onClick={() => { setAspect(ar.value); if (ar.value && imgRef.current) setCrop(centerCrop(makeAspectCrop({ unit:'%', width:90 }, ar.value, imgRef.current.width, imgRef.current.height), imgRef.current.width, imgRef.current.height)); else setCrop(undefined); }} className={cn("rounded-md px-3 py-1.5 text-[11px] font-bold transition-all border", aspect === ar.value ? "bg-ink text-canvas border-ink" : "bg-canvas-soft text-ink border-hairline")}>{ar.label}</button>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="sticky top-24 flex flex-col gap-6">
            <div className={cn("rounded-xl border border-hairline bg-canvas p-6 shadow-v-2 transition-opacity", (isEraserMode || activeTab === 'remove-bg') && "opacity-50 pointer-events-none")}>
              <div className="space-y-6">
                {!currentImage?.isSvg && (activeTab === 'compress' || activeTab === 'remove-bg') && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between"><label className="text-xs font-medium text-ink">{t('optimizer.quality')}</label><span className="text-xs font-bold text-ink">{quality}%</span></div>
                    <input type="range" min="1" max="100" value={quality} disabled={images.length === 0} onChange={(e) => setQuality(parseInt(e.target.value))} className="w-full" />
                    <div className="flex justify-between text-[10px] text-mute font-mono"><span>{t('optimizer.small')}</span><span>{t('optimizer.best')}</span></div>
                  </div>
                )}
                {activeTab === 'convert' && (
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-ink">{t('optimizer.output_format')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {OUTPUT_FORMATS.map((f) => (
                        <button key={f.value} disabled={images.length === 0 || currentImage?.isSvg} onClick={() => setOutputFormat(f.value)} className={cn("rounded-geist-marketing px-3 py-2 text-[10px] font-medium border", outputFormat === f.value ? "bg-ink text-canvas border-ink" : "bg-canvas text-ink border-hairline")}>{f.label}</button>
                      ))}
                    </div>
                  </div>
                )}
                {(showSocialPresets || activeTab === 'social') && (
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-ink">{t('optimizer.social_tab')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {SOCIAL_PRESETS.map((p) => (
                        <button key={p.label} disabled={images.length === 0 || currentImage?.isSvg} onClick={() => { 
                            setTargetWidth(p.width); setTargetHeight(p.height); setAspect(p.aspect); setMaintainAspectRatio(true); 
                            setCroppedAreaPixels(null); 
                            if (currentImage && imgRef.current) setCrop(centerCrop(makeAspectCrop({ unit:'%', width: 90 }, p.aspect, imgRef.current.width, imgRef.current.height), imgRef.current.width, imgRef.current.height)); 
                        }} className="rounded-geist-marketing px-3 py-2 text-[10px] font-medium border bg-canvas text-ink border-hairline hover:bg-canvas-soft-2">{p.label}</button>
                      ))}
                    </div>
                  </div>
                )}
                {!currentImage?.isSvg && activeTab !== 'remove-bg' && (
                  <div className="space-y-4 pt-4 border-t border-hairline">
                    <div className="flex items-center justify-between"><p className="text-xs font-medium text-ink">{t('optimizer.dimensions')}</p><div className="flex items-center gap-2"><input type="checkbox" id="aspect" checked={maintainAspectRatio} disabled={images.length === 0} onChange={(e) => setMaintainAspectRatio(e.target.checked)} className="h-3 w-3 rounded-sm border-hairline accent-ink" /><label htmlFor="aspect" className="text-[10px] text-mute cursor-pointer">{t('optimizer.lock_aspect')}</label></div></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5"><label className="text-[10px] uppercase text-mute block font-medium">{t('optimizer.width')}</label><div className="relative"><input type="number" value={targetWidth} disabled={images.length === 0} onChange={(e) => { const v = parseInt(e.target.value) || 0; setTargetWidth(v); if (maintainAspectRatio && currentImage) setTargetHeight(Math.round(v/currentImage.aspectRatio)); }} className="w-full h-9 rounded-geist border border-hairline bg-canvas px-3 text-xs font-medium text-ink" /><span className="absolute right-3 top-2.5 text-[10px] text-mute">PX</span></div></div>
                      <div className="space-y-1.5"><label className="text-[10px] uppercase text-mute block font-medium">{t('optimizer.height')}</label><div className="relative"><input type="number" value={targetHeight} disabled={images.length === 0} onChange={(e) => { const v = parseInt(e.target.value) || 0; setTargetHeight(v); if (maintainAspectRatio && currentImage) setTargetWidth(Math.round(v*currentImage.aspectRatio)); }} className="w-full h-9 rounded-geist border border-hairline bg-canvas px-3 text-xs font-medium text-ink" /><span className="absolute right-3 top-2.5 text-[10px] text-mute">PX</span></div></div>
                    </div>
                  </div>
                )}
                <button onClick={handleDownload} disabled={isProcessing || isDownloading || images.length === 0} className={cn("mt-4 flex w-full items-center justify-center gap-2 rounded-geist-pill py-3 text-sm font-semibold text-canvas shadow-v-4 transition-all hover:opacity-90 disabled:opacity-30", activeTab === 'social' ? "bg-geist-success" : (activeTab === 'compress' ? "bg-ink" : "bg-geist-link"))}>
                  {isDownloading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-canvas/30 border-t-canvas"></div> : <Download className="h-4 w-4" />}
                  {isDownloading ? (batchProgress > 0 ? `${batchProgress}%` : t('optimizer.preparing')) : (images.length > 1 ? t('optimizer.batch_download', { count: images.length }) : (activeTab === 'compress' ? t('optimizer.download_compressed') : t('optimizer.download_converted')))}
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-hairline bg-canvas-soft p-4 shadow-v-1"><div className="flex items-center gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-geist-success/10 text-geist-success"><Check className="h-4 w-4" /></div><div><p className="text-xs font-semibold text-ink">{t('optimizer.privacy_guaranteed')}</p><p className="text-[10px] text-mute leading-relaxed">{t('optimizer.privacy_desc')}</p></div></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
