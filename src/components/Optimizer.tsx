import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Download, X, Image as ImageIcon, Check, Sliders, Scissors, ArrowRightLeft } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import heic2any from 'heic2any';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';

// Use local worker from node_modules via Vite ?url
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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

const ASPECT_RATIOS = [
  { label: 'Free', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
];

const OUTPUT_FORMATS = [
  { label: 'Original', value: 'original' },
  { label: 'JPEG', value: 'image/jpeg' },
  { label: 'PNG', value: 'image/png' },
  { label: 'WebP', value: 'image/webp' },
  { label: 'AVIF', value: 'image/avif' },
  { label: 'PDF', value: 'application/pdf' },
];

export default function Optimizer({ initialTab = 'compress' }: { initialTab?: 'compress' | 'convert' }) {
  const [image, setImage] = useState<ImageState | null>(null);
  const [quality, setQuality] = useState(80);
  const [targetWidth, setTargetWidth] = useState<number>(0);
  const [targetHeight, setTargetHeight] = useState<number>(0);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputFormat, setOutputFormat] = useState('original');
  const [isConvertingHeic, setIsConvertingHeic] = useState(false);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<'compress' | 'convert'>(initialTab);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFile(file);
    }
  };

  const handleFile = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) {
      alert("Image is too large. Max size is 25MB.");
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
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context!, viewport }).promise;
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
      } catch (err) {
        console.error("PDF processing failed", err);
        alert("Failed to process PDF file.");
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
        processingFile = Array.isArray(converted) ? converted[0] : converted;
      } catch (err) {
        console.error("HEIC conversion failed", err);
        alert("Failed to process HEIC file.");
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
      };
    });
    reader.readAsDataURL(processingFile);
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: CropArea) => {
    setCroppedAreaPixels(croppedAreaPixels);
    // Real-time dimension sync
    setTargetWidth(Math.round(croppedAreaPixels.width));
    setTargetHeight(Math.round(croppedAreaPixels.height));
  }, []);

  const compressImage = useCallback(async () => {
    if (!image) return;
    setIsProcessing(true);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = image.preview;
    
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.width;
    let sourceHeight = image.height;

    if (croppedAreaPixels) {
      sourceX = croppedAreaPixels.x;
      sourceY = croppedAreaPixels.y;
      sourceWidth = croppedAreaPixels.width;
      sourceHeight = croppedAreaPixels.height;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.drawImage(
      img,
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
  }, [image, quality, targetWidth, targetHeight, croppedAreaPixels, outputFormat]);

  useEffect(() => {
    const timer = setTimeout(() => {
      compressImage();
    }, 300);
    return () => clearTimeout(timer);
  }, [compressImage]);

  const handleDownload = () => {
    if (!compressedBlob || !image) return;
    
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
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {isConvertingHeic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-hairline border-t-ink"></div>
            <p className="text-sm font-medium text-ink">Converting HEIC to JPEG...</p>
          </div>
        </div>
      )}

      {isConvertingPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-hairline border-t-ink"></div>
            <p className="text-sm font-medium text-ink">Rendering PDF page...</p>
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
                Compress Image
              </button>
              <button 
                onClick={() => setActiveTab('convert')}
                className={cn(
                  "flex-1 py-4 text-xs font-semibold border-l border-hairline transition-all flex items-center justify-center gap-2",
                  activeTab === 'convert' ? "bg-ink text-canvas" : "text-mute hover:text-ink hover:bg-canvas-soft-2"
                )}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Convert Format
              </button>
            </div>

            {!image ? (
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
                className="group relative flex aspect-[16/9] cursor-pointer flex-col items-center justify-center bg-canvas transition-all hover:bg-canvas-soft-2 p-12"
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas-soft shadow-v-1 transition-transform group-hover:scale-110">
                  <Upload className="h-6 w-6 text-mute" />
                </div>
                <p className="mt-4 text-sm font-medium text-ink">Click to upload or drag and drop</p>
                <p className="mt-1 text-xs text-mute">PNG, JPG, WebP, HEIC or PDF (max. 25MB)</p>
                <input 
                  id="fileInput" 
                  type="file" 
                  className="hidden" 
                  accept="image/*,.heic,.heif,.pdf,application/pdf" 
                  onChange={onSelectFile} 
                />
              </div>
            ) : (
              <>
                <div className="flex h-10 items-center justify-between bg-canvas-soft/50 px-4 border-b border-hairline">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5 text-mute" />
                    <span className="text-[10px] font-medium text-ink truncate max-w-[200px]">{image.file.name}</span>
                  </div>
                  <button 
                    onClick={() => setImage(null)}
                    className="rounded-md p-1 hover:bg-canvas-soft-2 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 text-mute" />
                  </button>
                </div>
                
                <div className="relative aspect-video bg-canvas-soft-2 flex items-center justify-center overflow-hidden p-8">
                  {isCropping ? (
                    <div className="absolute inset-0 z-10">
                      <Cropper
                        image={image.preview}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                      />
                    </div>
                  ) : (
                    <img 
                      src={image.preview} 
                      alt="Preview" 
                      className="max-h-full max-w-full object-contain shadow-v-2"
                    />
                  )}
                </div>

                <div className="flex h-14 items-center justify-between px-4 bg-canvas border-t border-hairline">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsCropping(!isCropping)}
                      className={cn(
                        "flex items-center gap-2 rounded-geist-marketing px-3 py-1.5 text-xs font-medium transition-all",
                        isCropping ? "bg-ink text-canvas" : "bg-canvas-soft text-ink hover:bg-canvas-soft-2 shadow-v-1"
                      )}
                    >
                      <Scissors className="h-3.5 w-3.5" />
                      {isCropping ? "Done" : "Crop"}
                    </button>
                    {isCropping && (
                      <div className="flex gap-1 border-l border-hairline ml-2 pl-2">
                        {ASPECT_RATIOS.map((ar) => (
                          <button
                            key={ar.label}
                            onClick={() => setAspect(ar.value)}
                            className={cn(
                              "rounded-geist-marketing px-2 py-1 text-[10px] font-medium transition-all",
                              aspect === ar.value ? "bg-ink/10 text-ink" : "text-mute hover:text-ink hover:bg-canvas-soft"
                            )}
                          >
                            {ar.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-mute">Original</p>
                      <p className="text-xs font-semibold text-ink">{formatSize(image.originalSize)}</p>
                    </div>
                    <div className="h-8 w-px bg-hairline" />
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-mute">Optimized</p>
                      <p className={cn(
                        "text-xs font-bold transition-colors",
                        compressedSize < image.originalSize ? "text-geist-success" : "text-geist-warning"
                      )}>
                        {isProcessing ? "..." : formatSize(compressedSize)}
                      </p>
                    </div>
                  </div>
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
                      <label className="text-xs font-medium text-ink">Image Quality</label>
                      <span className="text-xs font-bold text-ink">{quality}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={quality} 
                      disabled={!image}
                      onChange={(e) => setQuality(parseInt(e.target.value))}
                      className="w-full disabled:opacity-30"
                    />
                    <div className="flex justify-between text-[10px] text-mute font-mono">
                      <span>SMALL</span>
                      <span>BEST</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <label className="text-xs font-medium text-ink">Output Format</label>
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
                    <label className="text-xs font-medium text-ink">Dimensions</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="aspect"
                        checked={maintainAspectRatio}
                        disabled={!image}
                        onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                        className="h-3 w-3 rounded-sm border-hairline accent-ink"
                      />
                      <label htmlFor="aspect" className="text-[10px] text-mute cursor-pointer">Lock Aspect</label>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase text-mute">Width</span>
                      <div className="relative">
                        <input 
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
                      <span className="text-[10px] uppercase text-mute">Height</span>
                      <div className="relative">
                        <input 
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
                  disabled={isProcessing || !compressedBlob || !image}
                  className={cn(
                    "mt-4 flex w-full items-center justify-center gap-2 rounded-geist-pill py-3 text-sm font-semibold text-canvas shadow-v-4 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30",
                    activeTab === 'compress' ? "bg-ink" : "bg-geist-link"
                  )}
                >
                  <Download className="h-4 w-4" />
                  {activeTab === 'compress' ? "Download Compressed" : "Download Converted"}
                </button>
              </div>
            </div>
            
            <div className="rounded-xl border border-hairline bg-canvas-soft p-4 shadow-v-1">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-geist-success/10 text-geist-success">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink">Privacy Guaranteed</p>
                  <p className="text-[10px] text-mute leading-relaxed">Images are processed locally. No data ever leaves your device.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
