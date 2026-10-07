import React, { useState, useEffect, useRef } from 'react';
import { ClassType, EyeStyle, HairStyle, HairColor, SkinColor } from '../types/game';
import { CLASS_PRESETS } from '../data/classPresets';
import {
  HAIR_COLOR_OPTIONS,
  SKIN_COLOR_OPTIONS,
  getTintedHairImage,
  getTintedSkinImage,
} from '../utils/hairColorizer';
import { Scissors, Palette, User, Check, X } from 'lucide-react';
import { sounds } from '../audio/soundEffects';

interface CharacterCreationModalProps {
  isOpen: boolean;
  initialClass: ClassType;
  initialEyeStyle: EyeStyle;
  initialHairStyle?: HairStyle;
  initialHairColor?: HairColor;
  initialSkinColor?: SkinColor;
  initialName: string;
  onConfirm: (
    name: string,
    selectedClass: ClassType,
    eyeStyle: EyeStyle,
    hairStyle: HairStyle,
    hairColor: HairColor,
    skinColor: SkinColor
  ) => void;
  onClose?: () => void;
  canClose?: boolean;
}

export const CharacterCreationModal: React.FC<CharacterCreationModalProps> = ({
  isOpen,
  initialClass,
  initialEyeStyle,
  initialHairStyle = 'hair_black',
  initialHairColor = 'black',
  initialSkinColor = 'default',
  initialName,
  onConfirm,
  onClose,
  canClose = false,
}) => {
  const [selectedHairStyle, setSelectedHairStyle] = useState<HairStyle>(initialHairStyle || 'hair_black');
  const [selectedHairColor, setSelectedHairColor] = useState<HairColor>(
    initialHairColor && initialHairColor !== ('original' as any) ? initialHairColor : 'black'
  );
  const [selectedSkinColor, setSelectedSkinColor] = useState<SkinColor>(
    initialSkinColor && initialSkinColor !== ('original' as any) ? initialSkinColor : 'default'
  );
  const [tintedPreviewUrls, setTintedPreviewUrls] = useState<Record<string, string>>({});

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bodyPartsRef = useRef<{
    tay: HTMLImageElement | null;
    chanPhai: HTMLImageElement | null;
    chanTrai: HTMLImageElement | null;
    dau: HTMLImageElement | null;
    than: HTMLImageElement | null;
    hairs: Record<string, HTMLImageElement | null>;
  }>({
    tay: null,
    chanPhai: null,
    chanTrai: null,
    dau: null,
    than: null,
    hairs: {},
  });

  const hairOptions: { id: HairStyle; title: string; imgUrl: string; fallbackUrl?: string }[] = [
    {
      id: 'hair_black',
      title: 'Hiệp Khách',
      imgUrl: 'https://i.ibb.co/W4pyr1FT/Gemini-Generated-Image-rt9fhart9fhart9f-1.png',
      fallbackUrl: 'https://i.ibb.co/7dNW3FV9/Gemini-Generated-Image-rt9fhart9fhart9f-1.png',
    },
    {
      id: 'hair_silver',
      title: 'Bạch Kim',
      imgUrl: 'https://i.ibb.co/qFmnn4Dg/Gemini-Generated-Image-fof09fof09fof09f-1.png',
      fallbackUrl: 'https://i.ibb.co/NnW33kFN/Gemini-Generated-Image-fof09fof09fof09f-1.png',
    },
    {
      id: 'hair_red',
      title: 'Hỏa Long',
      imgUrl: 'https://i.ibb.co/JWTcGkjf/Gemini-Generated-Image-7ctsig7ctsig7cts-1-1.png',
      fallbackUrl: 'https://i.ibb.co/6cSyTs03/Gemini-Generated-Image-7ctsig7ctsig7cts-1-1.png',
    },
    {
      id: 'hair_violet',
      title: 'Tử Điện',
      imgUrl: 'https://i.ibb.co/JWjZGFQZ/Gemini-Generated-Image-oc46rxoc46rxoc46-1.png',
      fallbackUrl: 'https://i.ibb.co/5XhZSxFZ/Gemini-Generated-Image-oc46rxoc46rxoc46-1.png',
    },
    {
      id: 'hair_green',
      title: 'Bích Lục',
      imgUrl: 'https://i.ibb.co/5xcRbBPy/image.png',
      fallbackUrl: 'https://i.ibb.co/bRB5ZRJy/6df263fe25e673bb3e64256773f490fb-1.png',
    },
    {
      id: 'none',
      title: 'Trống',
      imgUrl: '',
    },
  ];

  useEffect(() => {
    const loadImg = (
      primary: string,
      fallbacks: string[],
      onLoaded: (img: HTMLImageElement) => void,
      darkenLegs = false
    ) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const urls = [primary, ...fallbacks];
      let idx = 0;
      const tryNext = () => {
        if (idx < urls.length) {
          img.src = urls[idx++];
        }
      };
      img.onload = () => {
        if (darkenLegs) {
          try {
            const oc = document.createElement('canvas');
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            oc.width = w;
            oc.height = h;
            const octx = oc.getContext('2d');
            if (octx) {
              octx.drawImage(img, 0, 0);
              const imgData = octx.getImageData(0, 0, w, h);
              const d = imgData.data;
              let minL = 255, maxL = 0;
              for (let i = 0; i < d.length; i += 4) {
                if (d[i + 3] > 20) {
                  const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                  if (lum < minL) minL = lum;
                  if (lum > maxL) maxL = lum;
                }
              }
              for (let i = 0; i < d.length; i += 4) {
                if (d[i + 3] < 140) {
                  d[i + 3] = 0;
                } else {
                  d[i + 3] = 255;
                  const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                  const norm = Math.max(0, Math.min(1, (lum - minL) / (maxL - minL || 1)));
                  const baseGrey = 36 + norm * 28;
                  d[i] = Math.round(baseGrey * 0.95);
                  d[i + 1] = Math.round(baseGrey * 0.98);
                  d[i + 2] = Math.round(baseGrey * 1.05);
                }
              }
              octx.putImageData(imgData, 0, 0);
              const darkImg = new Image();
              darkImg.src = oc.toDataURL();
              onLoaded(darkImg);
              return;
            }
          } catch {
            // Ignore
          }
        }
        onLoaded(img);
      };
      img.onerror = tryNext;
      tryNext();
    };

    loadImg(
      'https://i.ibb.co/hJRS0pz4/pixil-frame-0-6-1-3-5.png',
      ['/character/than.png'],
      (im) => (bodyPartsRef.current.than = im)
    );
    loadImg(
      '/character/chanPhai.png',
      ['/character/chanPhai_xamden.png'],
      (im) => (bodyPartsRef.current.chanPhai = im),
      true
    );
    loadImg(
      '/character/chanTrai.png',
      ['/character/chanTrai_xamden.png'],
      (im) => (bodyPartsRef.current.chanTrai = im),
      true
    );
    loadImg(
      'https://i.ibb.co/8g74cTgC/Gemini-Generated-Image-qe6eetqe6eetqe6e-1.png',
      [],
      (im) => (bodyPartsRef.current.tay = im)
    );
    loadImg(
      'https://i.ibb.co/6cPZJ2LF/Gemini-Generated-Image-dy7pbcdy7pbcdy7p-1.png',
      [],
      (im) => (bodyPartsRef.current.dau = im)
    );

    hairOptions.forEach((opt) => {
      if (!opt.imgUrl) return;
      loadImg(opt.imgUrl, opt.fallbackUrl ? [opt.fallbackUrl] : [], (im) => {
        bodyPartsRef.current.hairs[opt.id] = im;
      });
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    hairOptions.forEach((opt) => {
      if (!opt.imgUrl) return;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (!isMounted) return;
        bodyPartsRef.current.hairs[opt.id] = img;
        const tinted = getTintedHairImage(img, opt.id, selectedHairColor);
        if (tinted) {
          const dataUrl =
            tinted instanceof HTMLCanvasElement
              ? tinted.toDataURL()
              : (tinted as HTMLImageElement).src;
          if (dataUrl) {
            setTintedPreviewUrls((prev) => ({
              ...prev,
              [`${opt.id}_${selectedHairColor}`]: dataUrl,
            }));
          }
        }
      };
      img.src = opt.imgUrl;
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedHairColor]);

  useEffect(() => {
    if (!isOpen) return;
    let animId: number;

    const renderPreview = (now: number) => {
      const canvas = previewCanvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = Math.round(150 * dpr);
        const targetH = Math.round(170 * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height * 0.78);
          const scale = 1.75 * dpr;
          ctx.scale(scale, scale);

          // Shadow
          ctx.save();
          ctx.translate(0, 11.5);
          ctx.scale(1, 0.35);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          const idleBob = Math.sin(now * 0.003) * 0.6;
          const armBreathRot = Math.sin(now * 0.003) * 0.035;
          const torsoY = -4 + idleBob;
          const groundY = 1.5;
          const hipL_X = 5.2;
          const hipR_X = -4.5;

          const parts = bodyPartsRef.current;
          const tintedTay = parts.tay ? getTintedSkinImage(parts.tay, 'tay', selectedSkinColor) : null;
          const tintedThan = parts.than ? getTintedSkinImage(parts.than, 'than', selectedSkinColor) : null;
          const tintedDau = parts.dau ? getTintedSkinImage(parts.dau, 'dau', selectedSkinColor) : null;

          // 1. Leg L (back leg)
          ctx.save();
          ctx.translate(hipL_X, groundY);
          if (parts.chanTrai) ctx.drawImage(parts.chanTrai, -4.53, -1.5, 9.06, 12.87);
          ctx.restore();

          // 2. Arm L (back arm)
          ctx.save();
          ctx.translate(14, torsoY - 1 + idleBob * 0.25);
          ctx.rotate(-armBreathRot);
          if (tintedTay) ctx.drawImage(tintedTay, -24.6, -34.8, 64.8, 64.8);
          ctx.restore();

          // 3. Torso
          ctx.save();
          ctx.translate(0, torsoY);
          if (tintedThan) ctx.drawImage(tintedThan, -13, -6.5, 26, 14.4);
          ctx.restore();

          // 3.1. Leg R (front leg)
          ctx.save();
          ctx.translate(hipR_X, groundY);
          if (parts.chanPhai) ctx.drawImage(parts.chanPhai, -4.53, -1.5, 9.06, 14.67);
          ctx.restore();

          // 4. Head & Hair (100% synced aspect ratio & offsets with GameCanvas)
          ctx.save();
          ctx.translate(-4, torsoY - 17.5);
          const curHair = selectedHairStyle;
          const isWearingHair = curHair && curHair !== 'none';
          const baseBox = 66;

          if (tintedDau) {
            const dW = (tintedDau as HTMLImageElement).naturalWidth || tintedDau.width || 1280;
            const dH = (tintedDau as HTMLImageElement).naturalHeight || tintedDau.height || 1472;
            let rawHeadW = baseBox;
            let rawHeadH = baseBox;
            if (dW > dH) {
              rawHeadH = baseBox * (dH / dW);
            } else {
              rawHeadW = baseBox * (dW / dH);
            }
            const headScale = 1.02;
            const headW = rawHeadW * headScale;
            const headH = rawHeadH * headScale;
            const headYOffset = isWearingHair ? baseBox * (0.5 / 112) : 0;
            ctx.drawImage(tintedDau, -headW / 2, -headH / 2 + headYOffset, headW, headH);
          }

          if (isWearingHair) {
            const baseHairImg = parts.hairs[curHair];
            const activeHairImg = baseHairImg
              ? getTintedHairImage(baseHairImg, curHair, selectedHairColor)
              : null;
            if (activeHairImg) {
              const hW = (activeHairImg as HTMLImageElement).naturalWidth || activeHairImg.width || 1;
              const hH = (activeHairImg as HTMLImageElement).naturalHeight || activeHairImg.height || 1;
              const isSilver = curHair === 'hair_silver';
              const isGreen = curHair === 'hair_green';
              const hairScaleMultiplier = isSilver ? 0.99 : isGreen ? 0.98 : 1.02;
              const hairBox = baseBox * hairScaleMultiplier;
              let hairDrawW = hairBox;
              let hairDrawH = hairBox;
              if (hW > hH) {
                hairDrawH = hairBox * (hH / hW);
              } else if (hW < hH) {
                hairDrawW = hairBox * (hW / hH);
              }
              if (isGreen) {
                hairDrawW = baseBox * 1.0;
                hairDrawH = baseBox * 0.97;
              }
              const hairOffsetX = baseBox * (2.6 / 112);
              const hairOffsetY = isSilver
                ? baseBox * (2.2 / 112)
                : isGreen
                ? baseBox * (2.0 / 112)
                : baseBox * (-0.5 / 112);
              ctx.drawImage(
                activeHairImg,
                -hairDrawW / 2 + hairOffsetX,
                -hairDrawH / 2 + hairOffsetY,
                hairDrawW,
                hairDrawH
              );
            }
          }
          ctx.restore();

          // 5. Arm R (front arm)
          ctx.save();
          ctx.translate(-15, torsoY - 2 + idleBob * 0.25);
          ctx.rotate(armBreathRot);
          if (tintedTay) ctx.drawImage(tintedTay, -24.6, -34.8, 64.8, 64.8);
          ctx.restore();

          ctx.restore();
        }
      }
      animId = requestAnimationFrame(renderPreview);
    };

    animId = requestAnimationFrame(renderPreview);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, selectedHairStyle, selectedHairColor, selectedSkinColor]);

  if (!isOpen) return null;

  const preset = CLASS_PRESETS[initialClass];

  const handleConfirmAction = () => {
    sounds.playClick();
    onConfirm(
      initialName || 'Dũng Sĩ',
      initialClass,
      initialEyeStyle,
      selectedHairStyle,
      selectedHairColor,
      selectedSkinColor
    );
  };

  const handleCancelAction = () => {
    sounds.playClick();
    if (canClose && onClose) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 backdrop-blur-md select-none overflow-hidden"
      style={{
        backgroundColor: 'rgba(11, 17, 32, 0.88)',
        backgroundImage:
          'repeating-linear-gradient(28.7deg, rgba(56, 189, 248, 0.14) 0px, rgba(56, 189, 248, 0.14) 1px, transparent 1px, transparent 41px), repeating-linear-gradient(-28.7deg, rgba(56, 189, 248, 0.14) 0px, rgba(56, 189, 248, 0.14) 1px, transparent 1px, transparent 41px)',
      }}
    >
      {/* Scaled-down Compact Content Box */}
      <div className="relative w-full max-w-xl max-h-[80vh] mb-12 sm:mb-14 bg-slate-900/95 border-2 border-blue-500/80 chamfer-lg shadow-2xl flex flex-col overflow-hidden text-slate-100 p-2 sm:p-3">
        {/* Compact Grid: Left 1/3 Preview | Right 2/3 Options */}
        <div className="grid grid-cols-12 gap-2 sm:gap-3 items-center">
          {/* Character Preview */}
          <div className="col-span-4 flex flex-col items-center justify-center border border-blue-900/40 chamfer-md p-1 bg-slate-950/80 min-h-[160px] relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{ background: `radial-gradient(circle, ${preset.color} 0%, transparent 70%)` }}
            />
            <canvas
              ref={previewCanvasRef}
              className="w-[150px] h-[170px] object-contain pixelated relative z-10"
            />
          </div>

          {/* Options Column */}
          <div className="col-span-8 flex flex-col gap-2 bg-slate-950/60 border border-blue-900/40 chamfer-md p-2 sm:p-3">
            {/* Kiểu Tóc */}
            <div>
              <div className="text-[11px] font-bold text-blue-300 mb-1 flex items-center gap-1">
                <Scissors className="w-3 h-3 text-blue-400" /> KIỂU TÓC
              </div>
              <div className="grid grid-cols-6 gap-1">
                {hairOptions.map((option) => {
                  const isSelected = selectedHairStyle === option.id;
                  const thumbSrc = tintedPreviewUrls[`${option.id}_${selectedHairColor}`] || option.imgUrl;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setSelectedHairStyle(option.id)}
                      title={option.title}
                      className={`p-1 chamfer-sm border flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-950/90 border-blue-400 shadow-[0_0_10px_rgba(56,189,248,0.5)] scale-105'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-8 h-8 chamfer-sm bg-slate-950 flex items-center justify-center relative overflow-hidden">
                        {thumbSrc ? (
                          <img src={thumbSrc} alt={option.title} className="w-full h-full object-contain pixelated" />
                        ) : (
                          <span className="text-xs text-slate-500 font-bold">✕</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Màu Tóc */}
            <div>
              <div className="text-[11px] font-bold text-blue-300 mb-1 flex items-center gap-1">
                <Palette className="w-3 h-3 text-blue-400" /> MÀU TÓC
              </div>
              <div className="grid grid-cols-8 gap-1">
                {HAIR_COLOR_OPTIONS.map((colorOpt) => {
                  const isSelected = selectedHairColor === colorOpt.id;
                  return (
                    <button
                      key={colorOpt.id}
                      onClick={() => setSelectedHairColor(colorOpt.id)}
                      aria-label={colorOpt.name}
                      className={`p-1 chamfer-sm border flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-950/90 border-blue-400 shadow-[0_0_10px_rgba(56,189,248,0.5)] scale-105'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full shadow-inner border"
                        style={{
                          backgroundColor: colorOpt.swatchHex,
                          borderColor: isSelected ? '#ffffff' : colorOpt.borderHex,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Màu Da */}
            <div>
              <div className="text-[11px] font-bold text-blue-300 mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-blue-400" /> MÀU DA
              </div>
              <div className="grid grid-cols-8 gap-1">
                {SKIN_COLOR_OPTIONS.map((skinOpt) => {
                  const isSelected = selectedSkinColor === skinOpt.id;
                  return (
                    <button
                      key={skinOpt.id}
                      onClick={() => setSelectedSkinColor(skinOpt.id)}
                      aria-label={skinOpt.name}
                      className={`p-1 chamfer-sm border flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-950/90 border-blue-400 shadow-[0_0_10px_rgba(56,189,248,0.5)] scale-105'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full shadow-inner border"
                        style={{
                          backgroundColor: skinOpt.swatchHex,
                          borderColor: isSelected ? '#ffffff' : skinOpt.borderHex,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Buttons [ X ] & [ ✓ ] at Bottom of Screen */}
      <div className="fixed bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center gap-[260px] sm:gap-[300px]">
        {canClose && onClose && (
          <button
            onClick={handleCancelAction}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/90 border-2 border-slate-600 hover:border-rose-400 text-slate-300 hover:text-rose-400 shadow-[0_0_20px_rgba(0,0,0,0.8)] active:scale-90 transition flex items-center justify-center cursor-pointer"
            title="Hủy"
          >
            <X size={22} strokeWidth={2.5} />
          </button>
        )}

        <button
          onClick={handleConfirmAction}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-500 text-white border-2 border-blue-300 shadow-[0_0_25px_rgba(37,99,235,0.8)] active:scale-90 transition flex items-center justify-center cursor-pointer"
          title="Xác nhận"
        >
          <Check size={24} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};
