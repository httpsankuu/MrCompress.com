import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, Download, X, Image as ImageIcon, Check, Sliders, Scissors, ArrowRightLeft, RotateCcw } from 'lucide-react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import heic2any from 'heic2any';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import '../i18n';

// Use local worker from node_modules via Vite ?url
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
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function Optimizer({ initialTab = 'compress' }: { initialTab?: 'compress' | 'convert' }) {
  const { t } = useTranslation();
  const [image, setImage] = useState<ImageState | null>(null);
  const [quality, setQuality] = useState(80);
  const [targetWidth, setTargetWidth] = useState<number>(0);
  const [targetHeight, setTargetHeight] = useState<number>(0);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  
  // react-image-crop state
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputFormat, setOutputFormat] = useState('original');
  const [isConvertingHeic, setIsConvertingHeic] = useState(false);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<'compress' | 'convert'>(initialTab);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const ASPECT_RATIOS = [
    { label: t('optimizer.aspect_custom', 'Custom (Free)'), value: undefined },
    { label: '1:1', value: 1 },
    { label: '4:5', value: 0.8, description: 'IG Post' },
    { label: '4:3', value: 4 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '3:2', value: 3 / 2 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16, description: 'Story/TikTok' },
    { label: '5:4', value: 5 / 4 },
    { label: '2:1', value: 2 },
  ];

  const OUTPUT_FORMATS = [
    { label: t('optimizer.original', 'Original'), value: 'original' },
    { label: 'JPEG', value: 'image/jpeg' },
    { label: 'PNG', value: 'image/png' },
    { label: 'WebP', value: 'image/webp' },
    { label: 'AVIF', value: 'image/avif' },
    { label: 'PDF', value: 'application/pdf' },
  ];

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFile(file);
    }
  };

  const handleFile = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      toast.error(t('optimizer.error_too_large'));
      return;
    }

    let processingFile = file;

    // Handle PDF
    if (file.type === 'application/pdf') {
      setIsConvertingPdf(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error("Could not get context");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/png');
        
        setImage({
          file,
          preview: dataUrl,
          originalSize: file.size,
          width: canvas.width,
          height: canvas.height,
          aspectRatio: canvas.width / canvas.height,
          type: 'image/png'
        });
        setTargetWidth(canvas.width);
        setTargetHeight(canvas.height);
        setRotation(0);
      } catch (err) {
        console.error("PDF processing failed", err);
        toast.error(t('optimizer.error_pdf_fail'));
      } finally {
        setIsConvertingPdf(false);
      }
      return;
    }

    // Handle HEIC
    if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
      setIsConvertingHeic(true);
      try {
        const converted = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.8
        });
        processingFile = Array.isArray(converted) ? converted[0] : (converted as File);
      } catch (err) {
        console.error("HEIC conversion failed", err);
        toast.error(t('optimizer.error_heic_fail'));
        setIsConvertingHeic(false);
        return;
      }
      setIsConvertingHeic(false);
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        setImage({
          file: processingFile,
          preview: reader.result as string,
          originalSize: file.size, // Still show original size
          width: img.width,
          height: img.height,
          aspectRatio: img.width / img.height,
          type: processingFile.type
        });
        setTargetWidth(img.width);
        setTargetHeight(img.height);
        setRotation(0);
        setCrop(undefined); // Reset crop for new image
        setCompletedCrop(undefined);
      };
    });
    reader.readAsDataURL(processingFile);
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (aspect) {
      const { width, height } = e.currentTarget;
      setCrop(centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 90,
          },
          aspect,
          width,
          height
        ),
        width,
        height
      ));
    }
  };

  const handleReset = () => {
    setRotation(0);
    setAspect(undefined);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setCroppedAreaPixels(null);
    if (image) {
      setTargetWidth(image.width);
      setTargetHeight(image.height);
    }
  };

  const compressImage = useCallback(async () => {
    if (!image) return;
    setIsProcessing(true);

    const img = new Image();
    img.src = image.preview;
    
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    // 1. Create a source canvas that handles rotation
    const sourceCanvas = document.createElement('canvas');
    const sCtx = sourceCanvas.getContext('2d');
    if (!sCtx) return;

    const absRotation = Math.abs(rotation) % 360;
    const is90 = absRotation === 90 || absRotation === 270;
    
    sourceCanvas.width = is90 ? image.height : image.width;
    sourceCanvas.height = is90 ? image.width : image.height;

    sCtx.translate(sourceCanvas.width / 2, sourceCanvas.height / 2);
    sCtx.rotate((rotation * Math.PI) / 180);
    sCtx.drawImage(img, -image.width / 2, -image.height / 2);

    // 2. Final canvas for crop & resize
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = sourceCanvas.width;
    let sourceHeight = sourceCanvas.height;

    if (croppedAreaPixels) {
      sourceX = croppedAreaPixels.x;
      sourceY = croppedAreaPixels.y;
      sourceWidth = croppedAreaPixels.width;
      sourceHeight = croppedAreaPixels.height;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.drawImage(
      sourceCanvas,
      sourceX, sourceY, sourceWidth, sourceHeight,
      0, 0, targetWidth, targetHeight
    );

    const targetType = outputFormat === 'original' ? image.type : outputFormat;

    if (targetType === 'application/pdf') {
      const pdf = new jsPDF({
        orientation: targetWidth > targetHeight ? 'l' : 'p',
        unit: 'px',
        format: [targetWidth, targetHeight]
      });
      const imgData = canvas.toDataURL('image/jpeg', quality / 100);
      pdf.addImage(imgData, 'JPEG', 0, 0, targetWidth, targetHeight);
      const pdfBlob = pdf.output('blob');
      setCompressedBlob(pdfBlob);
      setCompressedSize(pdfBlob.size);
      setIsProcessing(false);
      return;
    }

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCompressedBlob(blob);
          setCompressedSize(blob.size);
          setIsProcessing(false);
        }
      },
      targetType,
      quality / 100
    );
  }, [image, quality, targetWidth, targetHeight, croppedAreaPixels, outputFormat, rotation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      compressImage();
    }, 300);
    return () => clearTimeout(timer);
  }, [compressImage]);

  useEffect(() => {
    if (compressedBlob && compressedBlob.type !== 'application/pdf') {
      const url = URL.createObjectURL(compressedBlob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [compressedBlob]);

  const handleDownload = async () => {
    if (!compressedBlob || !image) return;
    setIsDownloading(true);
    
    // Brief delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 500));

    const baseName = image.file.name.substring(0, image.file.name.lastIndexOf('.')) || image.file.name;
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'application/pdf': 'pdf'
    };
    const ext = mimeToExt[compressedBlob.type] || 'bin';
    
    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimized-${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsDownloading(false);
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    if (i < 0) return '0 Bytes';
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {isConvertingHeic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-hairline border-t-ink"></div>
            <p className="text-sm font-medium text-ink">{t('optimizer.converting_heic')}</p>
          </div>
        </div>
      )}

      {isConvertingPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-hairline border-t-ink"></div>
            <p className="text-sm font-medium text-ink">{t('optimizer.rendering_pdf')}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="relative overflow-hidden rounded-xl border border-hairline bg-canvas shadow-v-3">
            <div className="flex border-b border-hairline bg-canvas-soft">
              <button 
                onClick={() => setActiveTab('compress')}
                className={cn(
                  "flex-1 py-4 text-xs font-semibold transition-all flex items-center justify-center gap-2",
                  activeTab === 'compress' ? "bg-ink text-canvas" : "text-mute hover:text-ink hover:bg-canvas-soft-2"
                )}
              >
                <Sliders className="h-3.5 w-3.5" />
                {t('optimizer.compress_tab')}
              </button>
              <button 
                onClick={() => setActiveTab('convert')}
                className={cn(
                  "flex-1 py-4 text-xs font-semibold border-l border-hairline transition-all flex items-center justify-center gap-2",
                  activeTab === 'convert' ? "bg-ink text-canvas" : "text-mute hover:text-ink hover:bg-canvas-soft-2"
                )}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                {t('optimizer.convert_tab')}
              </button>
            </div>

            {!image ? (
              <button 
                type="button"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
                className="group relative flex aspect-[16/9] w-full cursor-pointer flex-col items-center justify-center bg-canvas transition-all hover:bg-canvas-soft-2 p-12 touch-manipulation"
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas-soft shadow-v-1 transition-transform group-hover:scale-110">
                  <Upload className="h-6 w-6 text-mute" />
                </div>
                <p className="mt-4 text-sm font-medium text-ink">{t('optimizer.upload_text')}</p>
                <p className="mt-1 text-xs text-mute">{t('optimizer.upload_hint')}</p>
                <label htmlFor="fileInput" className="sr-only">{t('optimizer.upload_sr')}</label>
                <input 
                  id="fileInput" 
                  type="file" 
                  className="hidden" 
                  accept="image/*,.heic,.heif,.pdf,application/pdf" 
                  onChange={onSelectFile} 
                />
              </button>
            ) : (
              <>
                <div className="flex h-10 items-center justify-between bg-canvas-soft/50 px-4 border-b border-hairline">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5 text-mute" aria-hidden="true" />
                    <span className="text-[10px] font-medium text-ink truncate max-w-[200px]">{image.file.name}</span>
                  </div>
                  <button 
                    onClick={() => setImage(null)}
                    className="rounded-md p-1 hover:bg-canvas-soft-2 transition-colors"
                    aria-label="Remove image"
                  >
                    <X className="h-3.5 w-3.5 text-mute" aria-hidden="true" />
                  </button>
                </div>
                
                <div className="relative min-h-[400px] lg:h-[500px] bg-canvas-soft-2 flex items-center justify-center overflow-hidden p-8">
                  {isCropping ? (
                    <div className="relative max-w-full max-h-full">
                      <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => {
                          setCompletedCrop(c);
                          if (imgRef.current && c.width > 0 && c.height > 0) {
                            const scaleX = image.width / imgRef.current.width;
                            const scaleY = image.height / imgRef.current.height;
                            const actualCrop = {
                              x: Math.round(c.x * scaleX),
                              y: Math.round(c.y * scaleY),
                              width: Math.round(c.width * scaleX),
                              height: Math.round(c.height * scaleY)
                            };
                            setCroppedAreaPixels(actualCrop);
                            setTargetWidth(actualCrop.width);
                            setTargetHeight(actualCrop.height);
                          } else if (c.width === 0 || c.height === 0) {
                            setCroppedAreaPixels(null);
                            if (image) {
                              setTargetWidth(image.width);
                              setTargetHeight(image.height);
                            }
                          }
                        }}
                        aspect={aspect}
                      >
                        <img
                          ref={imgRef}
                          src={image.preview}
                          alt="Crop preview"
                          onLoad={onImageLoad}
                          style={{ transform: `rotate(${rotation}deg)`, maxHeight: '450px' }}
                        />
                      </ReactCrop>
                    </div>
                  ) : (
                    <div className="relative max-h-full transition-all duration-300">
                      <img 
                        src={isComparing ? image.preview : (previewUrl || image.preview)} 
                        alt="Preview" 
                        className="max-h-[450px] max-w-full object-contain shadow-v-2 rounded-sm"
                        style={(!previewUrl || isComparing) ? { transform: `rotate(${rotation}deg)` } : {}}
                      />
                      {previewUrl && !isCropping && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                          <button
                            onMouseDown={() => setIsComparing(true)}
                            onMouseUp={() => setIsComparing(false)}
                            onMouseLeave={() => setIsComparing(false)}
                            onTouchStart={() => setIsComparing(true)}
                            onTouchEnd={() => setIsComparing(false)}
                            className="bg-ink/80 backdrop-blur-md text-canvas px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-v-4 select-none touch-none active:scale-95 transition-transform"
                          >
                            {t('optimizer.hold_compare', 'Hold to Compare')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col bg-canvas border-t border-hairline">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-4 py-4 gap-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <button 
                        onClick={() => setIsCropping(!isCropping)}
                        className={cn(
                          "flex items-center gap-2 rounded-geist-marketing px-4 py-2 text-xs font-semibold transition-all",
                          isCropping ? "bg-ink text-canvas shadow-v-3" : "bg-canvas-soft text-ink hover:bg-canvas-soft-2 shadow-v-1 border border-hairline"
                        )}
                      >
                        <Scissors className="h-4 w-4" />
                        {isCropping ? t('optimizer.done_editing') : t('optimizer.crop_rotate')}
                      </button>
                      
                      {isCropping && (
                        <div className="flex items-center gap-2 border-l border-hairline ml-2 pl-2">
                          <div className="flex items-center bg-canvas-soft rounded-lg p-0.5 border border-hairline">
                            <button
                              onClick={() => setRotation((r) => (r - 90) % 360)}
                              className="rounded-md p-1.5 text-mute hover:text-ink hover:bg-canvas transition-all"
                              title="Rotate Left"
                            >
                              <ArrowRightLeft className="h-4 w-4 -rotate-90" />
                            </button>
                            <button
                              onClick={() => setRotation((r) => (r + 90) % 360)}
                              className="rounded-md p-1.5 text-mute hover:text-ink hover:bg-canvas transition-all"
                              title="Rotate Right"
                            >
                              <ArrowRightLeft className="h-4 w-4 rotate-90" />
                            </button>
                          </div>
                          <button
                            onClick={handleReset}
                            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[10px] font-bold text-mute hover:text-ink hover:bg-canvas-soft transition-all"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {t('optimizer.reset')}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-8 bg-canvas-soft/80 rounded-xl px-6 py-3 border border-hairline">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-mute font-black opacity-60">{t('optimizer.original')}</span>
                        <span className="text-sm font-bold text-ink">{formatSize(image.originalSize)}</span>
                      </div>
                      <div className="h-8 w-px bg-hairline-strong/20" />
                      <div className="flex flex-col items-end text-right">
                        <span className="text-[10px] uppercase tracking-widest text-mute font-black opacity-60">{t('optimizer.optimized')}</span>
                        <div className="flex items-center gap-3">
                          {compressedSize > 0 && (
                            <span className="text-[10px] font-black text-geist-success bg-geist-success/10 px-2 py-0.5 rounded-full border border-geist-success/20">
                              -{Math.round((1 - compressedSize / image.originalSize) * 100)}%
                            </span>
                          )}
                          <span className={cn(
                            "text-sm font-black transition-colors",
                            compressedSize < image.originalSize ? "text-geist-success" : "text-geist-warning"
                          )}>
                            {isProcessing ? "..." : formatSize(compressedSize)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isCropping && (
                    <div className="flex flex-wrap gap-2 px-4 pb-4 animate-in fade-in slide-in-from-top-2">
                      {ASPECT_RATIOS.map((ar) => (
                        <button
                          key={ar.label}
                          onClick={() => {
                            setAspect(ar.value);
                            if (ar.value && imgRef.current) {
                              const { width, height } = imgRef.current;
                              setCrop(centerCrop(
                                makeAspectCrop(
                                  { unit: '%', width: 90 },
                                  ar.value,
                                  width,
                                  height
                                ),
                                width,
                                height
                              ));
                            } else {
                              setCrop(undefined);
                            }
                          }}
                          className={cn(
                            "whitespace-nowrap rounded-md px-4 py-2 text-[11px] font-bold transition-all border",
                            aspect === ar.value
                              ? "bg-ink text-canvas border-ink shadow-v-2" 
                              : "bg-canvas-soft text-ink border-hairline hover:bg-canvas-soft-2 hover:shadow-v-1"
                          )}
                        >
                          {ar.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="sticky top-24 flex flex-col gap-6">
            <div className="rounded-xl border border-hairline bg-canvas p-6 shadow-v-2">
              <div className="space-y-6">
                {activeTab === 'compress' ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <label htmlFor="quality-slider" className="text-xs font-medium text-ink cursor-pointer">{t('optimizer.quality')}</label>
                      <span className="text-xs font-bold text-ink">{quality}%</span>
                    </div>
                    <input 
                      id="quality-slider"
                      type="range" 
                      min="1" 
                      max="100" 
                      value={quality} 
                      disabled={!image}
                      onChange={(e) => setQuality(parseInt(e.target.value))}
                      className="w-full disabled:opacity-30 touch-manipulation"
                    />
                    <div className="flex justify-between text-[10px] text-mute font-mono">
                      <span>{t('optimizer.small')}</span>
                      <span>{t('optimizer.best')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="text-xs font-medium text-ink">{t('optimizer.output_format')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {OUTPUT_FORMATS.map((format) => (
                        <button
                          key={format.value}
                          disabled={!image}
                          onClick={() => setOutputFormat(format.value)}
                          className={cn(
                            "rounded-geist-marketing px-3 py-2 text-[10px] font-medium transition-all shadow-v-1 border",
                            outputFormat === format.value 
                              ? "bg-ink text-canvas border-ink" 
                              : "bg-canvas text-ink border-hairline hover:bg-canvas-soft-2 disabled:opacity-30"
                          )}
                        >
                          {format.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4 pt-4 border-t border-hairline">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-ink">{t('optimizer.dimensions')}</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="aspect"
                        checked={maintainAspectRatio}
                        disabled={!image}
                        onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                        className="h-3 w-3 rounded-sm border-hairline accent-ink"
                      />
                      <label htmlFor="aspect" className="text-[10px] text-mute cursor-pointer">{t('optimizer.lock_aspect')}</label>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="width-input" className="text-[10px] uppercase text-mute block font-medium">{t('optimizer.width')}</label>
                      <div className="relative">
                        <input 
                          id="width-input"
                          type="number" 
                          value={targetWidth}
                          disabled={!image}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setTargetWidth(val);
                            if (maintainAspectRatio && image) {
                              setTargetHeight(Math.round(val / image.aspectRatio));
                            }
                          }}
                          className="w-full h-9 rounded-geist border border-hairline bg-canvas px-3 text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-ink transition-all disabled:opacity-30"
                        />
                        <span className="absolute right-3 top-2.5 text-[10px] text-mute">PX</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="height-input" className="text-[10px] uppercase text-mute block font-medium">{t('optimizer.height')}</label>
                      <div className="relative">
                        <input 
                          id="height-input"
                          type="number" 
                          value={targetHeight}
                          disabled={!image}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setTargetHeight(val);
                            if (maintainAspectRatio && image) {
                              setTargetWidth(Math.round(val * image.aspectRatio));
                            }
                          }}
                          className="w-full h-9 rounded-geist border border-hairline bg-canvas px-3 text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-ink transition-all disabled:opacity-30"
                        />
                        <span className="absolute right-3 top-2.5 text-[10px] text-mute">PX</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleDownload}
                  disabled={isProcessing || isDownloading || !compressedBlob || !image}
                  className={cn(
                    "mt-4 flex w-full items-center justify-center gap-2 rounded-geist-pill py-3 text-sm font-semibold text-canvas shadow-v-4 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30",
                    activeTab === 'compress' ? "bg-ink" : "bg-geist-link"
                  )}
                >
                  {isDownloading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-canvas/30 border-t-canvas"></div>
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {isDownloading 
                    ? t('optimizer.preparing', 'Preparing...') 
                    : (activeTab === 'compress' ? t('optimizer.download_compressed') : t('optimizer.download_converted'))
                  }
                </button>
              </div>
            </div>
            
            <div className="rounded-xl border border-hairline bg-canvas-soft p-4 shadow-v-1">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-geist-success/10 text-geist-success">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink">{t('optimizer.privacy_guaranteed')}</p>
                  <p className="text-[10px] text-mute leading-relaxed">{t('optimizer.privacy_desc')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
