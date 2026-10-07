import React, { useState, useEffect, useRef } from 'react';
import { ClassType, CharacterCustomization } from '../types/game';
import { CLASS_PRESETS } from '../data/classPresets';
import { getTintedSkinImage, getTintedHairImage } from '../utils/hairColorizer';
import { sounds } from '../audio/soundEffects';
import { Swords, Shield, Sparkles, Target, Zap, Check, X } from 'lucide-react';

interface QuickClassSelectModalProps {
  isOpen: boolean;
  customization: CharacterCustomization;
  onConfirmClass: (selectedClass: ClassType) => void;
  onBackToCustomization?: () => void;
}

interface DissolveParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  maxLife: number;
  life: number;
}

interface GrassTileCoord {
  col: number;
  row: number;
  tx: number;
  ty: number;
  sum: number;
  revealOrder: number;
}

export const QuickClassSelectModal: React.FC<QuickClassSelectModalProps> = ({
  isOpen,
  customization,
  onConfirmClass,
  onBackToCustomization,
}) => {
  const [selectedClass, setSelectedClass] = useState<ClassType>(customization.classType || 'Fighter');
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const transitionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const characterContainerRef = useRef<HTMLDivElement | null>(null);

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

  const grassVariantsRef = useRef<HTMLCanvasElement[]>([]);

  const CLASSES: {
    id: ClassType;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      id: 'Fighter',
      icon: <Swords size={18} className="text-red-400" />,
      color: '#ef4444',
    },
    {
      id: 'Tank',
      icon: <Shield size={18} className="text-blue-400" />,
      color: '#3b82f6',
    },
    {
      id: 'Mage',
      icon: <Sparkles size={18} className="text-amber-400" />,
      color: '#eab308',
    },
    {
      id: 'Assassin',
      icon: <Zap size={18} className="text-purple-400" />,
      color: '#a855f7',
    },
    {
      id: 'Marksman',
      icon: <Target size={18} className="text-emerald-400" />,
      color: '#10b981',
    },
  ];

  // Pre-build original in-game isometric grass tile variants (identical to GameCanvas.tsx)
  useEffect(() => {
    const halfW = 42;
    const halfH = 23;
    const pad = 2;
    const cw = (halfW + pad) * 2; // 88
    const ch = (halfH + pad) * 2; // 50
    const cx = cw / 2;
    const cy = ch / 2;

    const hash2D = (x: number, y: number, seed: number) => {
      let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    };

    const palette = {
      base1: '#86a849',
      base2: '#81a345',
      speckDark: '#75963c',
      speckLight: '#94b854',
      bladeLight: '#a6c964',
      bladeTip: '#bde07b',
      bladeShadow: '#6b8b36',
    };

    const variants: HTMLCanvasElement[] = [];
    for (let v = 0; v < 8; v++) {
      const oc = document.createElement('canvas');
      oc.width = cw;
      oc.height = ch;
      const octx = oc.getContext('2d');
      if (!octx) continue;
      octx.imageSmoothingEnabled = false;

      octx.save();
      octx.beginPath();
      octx.moveTo(cx, cy - halfH - 0.8);
      octx.lineTo(cx + halfW + 0.8, cy);
      octx.lineTo(cx, cy + halfH + 0.8);
      octx.lineTo(cx - halfW - 0.8, cy);
      octx.closePath();
      octx.clip();

      octx.fillStyle = v % 2 === 0 ? palette.base1 : palette.base2;
      octx.fillRect(0, 0, cw, ch);

      for (let py = 2; py < ch - 2; py += 2) {
        for (let px = 2; px < cw - 2; px += 2) {
          const r = hash2D(px, py, v + 11);
          if (r > 0.86) {
            octx.fillStyle = palette.speckLight;
            octx.fillRect(px, py, 2, 1);
          } else if (r < 0.12) {
            octx.fillStyle = palette.speckDark;
            octx.fillRect(px, py, 2, 1);
          }
        }
      }

      const tuftCount = 5 + (v % 3);
      for (let t = 0; t < tuftCount; t++) {
        const rx = (hash2D(t, v, 301) - 0.5) * (halfW * 1.1);
        const ry = (hash2D(t, v, 709) - 0.5) * (halfH * 1.1);
        if (Math.abs(rx) / halfW + Math.abs(ry) / halfH > 0.78) continue;

        const tx = Math.round(cx + rx);
        const ty = Math.round(cy + ry);
        const style = (t + v) % 3;

        octx.fillStyle = palette.bladeShadow;
        octx.fillRect(tx - 1, ty + 1, 3, 1);

        if (style === 0) {
          octx.fillStyle = palette.bladeLight;
          octx.fillRect(tx - 1, ty - 1, 1, 2);
          octx.fillRect(tx + 1, ty - 2, 1, 3);
          octx.fillStyle = palette.bladeTip;
          octx.fillRect(tx + 1, ty - 2, 1, 1);
        } else if (style === 1) {
          octx.fillStyle = palette.bladeLight;
          octx.fillRect(tx - 2, ty - 1, 1, 2);
          octx.fillRect(tx, ty - 2, 1, 3);
          octx.fillRect(tx + 2, ty - 1, 1, 2);
          octx.fillStyle = palette.bladeTip;
          octx.fillRect(tx, ty - 2, 1, 1);
        } else {
          octx.fillStyle = palette.bladeLight;
          octx.fillRect(tx, ty - 1, 1, 2);
          octx.fillStyle = palette.bladeTip;
          octx.fillRect(tx, ty - 2, 1, 1);
        }
      }

      octx.restore();
      variants.push(oc);
    }
    grassVariantsRef.current = variants;
  }, []);

  // Load character body parts
  useEffect(() => {
    if (!isOpen) return;
    const loadImg = (
      url: string,
      fallbacks: string[],
      onLoaded: (img: HTMLImageElement) => void,
      darkenLegs = false
    ) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const urls = [url, ...fallbacks];
      let idx = 0;
      const tryNext = () => {
        if (idx < urls.length) img.src = urls[idx++];
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
              let minL = 255,
                maxL = 0;
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

    loadImg('https://i.ibb.co/hJRS0pz4/pixil-frame-0-6-1-3-5.png', ['/character/than.png'], (im) => (bodyPartsRef.current.than = im));
    loadImg('/character/chanPhai.png', ['/character/chanPhai_xamden.png'], (im) => (bodyPartsRef.current.chanPhai = im), true);
    loadImg('/character/chanTrai.png', ['/character/chanTrai_xamden.png'], (im) => (bodyPartsRef.current.chanTrai = im), true);
    loadImg('https://i.ibb.co/8g74cTgC/Gemini-Generated-Image-qe6eetqe6eetqe6e-1.png', [], (im) => (bodyPartsRef.current.tay = im));
    loadImg('https://i.ibb.co/6cPZJ2LF/Gemini-Generated-Image-dy7pbcdy7pbcdy7p-1.png', [], (im) => (bodyPartsRef.current.dau = im));

    const hairUrls: Record<string, { primary: string; fallback: string }> = {
      hair_black: {
        primary: 'https://i.ibb.co/W4pyr1FT/Gemini-Generated-Image-rt9fhart9fhart9f-1.png',
        fallback: 'https://i.ibb.co/7dNW3FV9/Gemini-Generated-Image-rt9fhart9fhart9f-1.png',
      },
      hair_silver: {
        primary: 'https://i.ibb.co/qFmnn4Dg/Gemini-Generated-Image-fof09fof09fof09f-1.png',
        fallback: 'https://i.ibb.co/NnW33kFN/Gemini-Generated-Image-fof09fof09fof09f-1.png',
      },
      hair_red: {
        primary: 'https://i.ibb.co/JWTcGkjf/Gemini-Generated-Image-7ctsig7ctsig7cts-1-1.png',
        fallback: 'https://i.ibb.co/6cSyTs03/Gemini-Generated-Image-7ctsig7ctsig7cts-1-1.png',
      },
      hair_violet: {
        primary: 'https://i.ibb.co/JWjZGFQZ/Gemini-Generated-Image-oc46rxoc46rxoc46-1.png',
        fallback: 'https://i.ibb.co/5XhZSxFZ/Gemini-Generated-Image-oc46rxoc46rxoc46-1.png',
      },
      hair_green: {
        primary: 'https://i.ibb.co/5xcRbBPy/image.png',
        fallback: 'https://i.ibb.co/bRB5ZRJy/6df263fe25e673bb3e64256773f490fb-1.png',
      },
    };

    if (customization.hairStyle && hairUrls[customization.hairStyle]) {
      const hEntry = hairUrls[customization.hairStyle];
      loadImg(hEntry.primary, [hEntry.fallback], (im) => {
        bodyPartsRef.current.hairs[customization.hairStyle] = im;
      });
    }
  }, [isOpen, customization]);

  // Helper to draw the character rig on any canvas context
  const drawCharacterRig = (ctx: CanvasRenderingContext2D, now: number, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

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
    const safeSkin =
      customization.skinColor && customization.skinColor !== 'original'
        ? (customization.skinColor as any)
        : 'default';
    const safeHairColor =
      customization.hairColor && customization.hairColor !== 'original'
        ? (customization.hairColor as any)
        : 'black';

    const tintedTay = parts.tay ? getTintedSkinImage(parts.tay, 'tay', safeSkin) : null;
    const tintedThan = parts.than ? getTintedSkinImage(parts.than, 'than', safeSkin) : null;
    const tintedDau = parts.dau ? getTintedSkinImage(parts.dau, 'dau', safeSkin) : null;

    // 1. Leg L
    ctx.save();
    ctx.translate(hipL_X, groundY);
    if (parts.chanTrai) ctx.drawImage(parts.chanTrai, -4.53, -1.5, 9.06, 12.87);
    ctx.restore();

    // 2. Arm L
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

    // 3.1. Leg R
    ctx.save();
    ctx.translate(hipR_X, groundY);
    if (parts.chanPhai) ctx.drawImage(parts.chanPhai, -4.53, -1.5, 9.06, 14.67);
    ctx.restore();

    // 4. Head & Hair (100% synced aspect ratio & offsets with GameCanvas)
    ctx.save();
    ctx.translate(-4, torsoY - 17.5);
    const curHair = customization.hairStyle;
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
      const hairImg = parts.hairs[curHair];
      const activeHairImg = hairImg ? getTintedHairImage(hairImg, curHair, safeHairColor) : null;
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

    // 5. Arm R
    ctx.save();
    ctx.translate(-15, torsoY - 2 + idleBob * 0.25);
    ctx.rotate(armBreathRot);
    if (tintedTay) ctx.drawImage(tintedTay, -24.6, -34.8, 64.8, 64.8);
    ctx.restore();

    ctx.restore();
  };

  // Render normal character preview when not transitioning
  useEffect(() => {
    if (!isOpen || isTransitioning) return;
    let animId: number;

    const renderPreview = (now: number) => {
      const canvas = previewCanvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = Math.round(96 * dpr);
        const targetH = Math.round(108 * dpr);
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
          const scale = 1.12 * dpr;
          ctx.scale(scale, scale);
          drawCharacterRig(ctx, now, 1);
          ctx.restore();
        }
      }
      animId = requestAnimationFrame(renderPreview);
    };

    animId = requestAnimationFrame(renderPreview);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, isTransitioning, customization]);

  // Handle transition sequence when Check (✓) is clicked:
  // 1. Radiating white light & thin blue energy streaks outward from character center across full screen.
  // 2. Smooth white flash filling screen, then gracefully fading out into the game.
  useEffect(() => {
    if (!isOpen || !isTransitioning) return;

    let animId: number;
    const startTime = performance.now();
    let lastTime = startTime;

    const rect = characterContainerRef.current?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    // Dịch tâm hiệu ứng tỏa sáng xuống 1 - 1.5 cm (~48px) để đúng tâm hình tròn là tâm của màn hình
    const offsetDownPx = 48; // ~1.25 cm
    const cy = (rect ? rect.top + rect.height / 2 : window.innerHeight * 0.5) + offsetDownPx;

    const energyStreaks: { angle: number; speed: number; dist: number; length: number; color: string; width: number }[] = [];
    for (let i = 0; i < 64; i++) {
      energyStreaks.push({
        angle: (i / 64) * Math.PI * 2 + (Math.random() - 0.5) * 0.15,
        speed: 700 + Math.random() * 900,
        dist: Math.random() * 30,
        length: 50 + Math.random() * 110,
        color: i % 2 === 0 ? '#38bdf8' : '#7dd3fc',
        width: 1.0 + Math.random() * 1.5,
      });
    }

    const TRANSITION_DURATION = 1.45;

    const renderTransition = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(1, elapsed / TRANSITION_DURATION);

      const canvas = transitionCanvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, w, h);

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          
          const maxDim = Math.hypot(w, h);
          const glowRadius = progress * maxDim * 1.5;
          const radialGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, glowRadius));
          radialGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
          radialGrad.addColorStop(0.3, 'rgba(224, 242, 254, 0.95)');
          radialGrad.addColorStop(0.65, 'rgba(56, 189, 248, 0.6)');
          radialGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.fillStyle = radialGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(0, glowRadius), 0, Math.PI * 2);
          ctx.fill();

          for (let i = 0; i < energyStreaks.length; i++) {
            const st = energyStreaks[i];
            st.dist += st.speed * dt;
            const startX = cx + Math.cos(st.angle) * st.dist;
            const startY = cy + Math.sin(st.angle) * st.dist;
            const endX = startX + Math.cos(st.angle) * st.length;
            const endY = startY + Math.sin(st.angle) * st.length;

            ctx.strokeStyle = st.color;
            ctx.lineWidth = st.width;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
          }
          ctx.restore();

          // Smoothly ramp white flash to solid pure white at the end of the transition
          const whiteAlpha = Math.min(1.0, Math.max(0, Math.pow(progress, 1.6) * 1.2));

          if (whiteAlpha > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${whiteAlpha})`;
            ctx.fillRect(0, 0, w, h);
          }
        }
      }

      if (progress >= 1.0) {
        onConfirmClass(selectedClass);
        return;
      }

      animId = requestAnimationFrame(renderTransition);
    };

    animId = requestAnimationFrame(renderTransition);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, isTransitioning, selectedClass, onConfirmClass]);

  if (!isOpen) return null;

  const currentPreset = CLASS_PRESETS[selectedClass];

  const handleConfirmAction = () => {
    if (isTransitioning) return;
    sounds.playClick();
    setIsTransitioning(true);
  };

  const handleCancelAction = () => {
    if (isTransitioning) return;
    sounds.playClick();
    if (onBackToCustomization) {
      onBackToCustomization();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between py-2 sm:py-3 px-2 select-none overflow-hidden"
      style={{
        backgroundColor: '#0b1120',
        backgroundImage:
          'repeating-linear-gradient(28.7deg, rgba(56, 189, 248, 0.14) 0px, rgba(56, 189, 248, 0.14) 1px, transparent 1px, transparent 41px), repeating-linear-gradient(-28.7deg, rgba(56, 189, 248, 0.14) 0px, rgba(56, 189, 248, 0.14) 1px, transparent 1px, transparent 41px)',
      }}
    >
      {/* Full-screen Transition Canvas (Player Particle Dissolve + Accelerating Grass Tile Fill) */}
      {isTransitioning && (
        <canvas
          ref={transitionCanvasRef}
          className="fixed inset-0 w-full h-full z-40 pointer-events-none block"
        />
      )}

      {/* 1. CENTER AREA: Character precisely in middle of screen, with class icons in a horizontal row ~2cm above head */}
      <div
        className={`relative w-full max-w-sm h-[220px] sm:h-[250px] flex items-center justify-center shrink-0 my-auto transition-opacity duration-150 ${
          isTransitioning ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Center Player Character */}
        <div
          ref={characterContainerRef}
          onClick={handleConfirmAction}
          className="absolute z-10 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          style={{ top: '60%', left: '50%', transform: 'translate(-50%, -50%)' }}
          title="Nhấn để vào trận"
        >
          <canvas ref={previewCanvasRef} className="w-[84px] h-[96px] object-contain pixelated" />
        </div>

        {/* 5 Class Icons Arranged in a Horizontal Row Above Head */}
        <div
          className="absolute z-20 flex items-center justify-center gap-3 sm:gap-4"
          style={{ top: '15%', left: '50%', transform: 'translateX(-50%)' }}
        >
          {CLASSES.map((cls) => {
            const isSelected = selectedClass === cls.id;
            return (
              <button
                key={cls.id}
                onClick={() => {
                  sounds.playClick();
                  setSelectedClass(cls.id);
                }}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 border-white shadow-[0_0_16px_rgba(56,189,248,0.9)] ring-2 ring-blue-400/50'
                    : 'bg-slate-900/90 border-blue-700/80 hover:border-blue-400 hover:bg-blue-950/60'
                }`}
              >
                {cls.icon}
              </button>
            );
          })}
        </div>
      </div>

      {/* EQUAL SPACER 1 (Ensures Stats Box is equidistant from Class Ring and Bottom X / Check Buttons) */}
      <div className="flex-1" />

      {/* 2. MIDDLE SECTION: Compact 6 Stats Box Popup (Nâng cao lên ~0.75cm) */}
      <div
        className={`w-full max-w-[270px] sm:max-w-xs bg-slate-950/90 border border-blue-600/70 chamfer-md p-1 shadow-xl shrink-0 -translate-y-7 transition-all duration-150 ${
          isTransitioning ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
        }`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[8.5px] sm:text-[9.5px] font-mono">
          <div className="bg-slate-900 px-1 py-0.5 chamfer-sm border border-slate-800 flex justify-between items-center gap-1">
            <span className="text-slate-400 truncate">Sát thương:</span>
            <span className="font-extrabold text-red-400 shrink-0">{currentPreset.baseDamage} ATK</span>
          </div>
          <div className="bg-slate-900 px-1 py-0.5 chamfer-sm border border-slate-800 flex justify-between items-center gap-1">
            <span className="text-slate-400 truncate">Máu:</span>
            <span className="font-extrabold text-emerald-400 shrink-0">{currentPreset.maxHp} HP</span>
          </div>
          <div className="bg-slate-900 px-1 py-0.5 chamfer-sm border border-slate-800 flex justify-between items-center gap-1">
            <span className="text-slate-400 truncate">Tốc chạy:</span>
            <span className="font-extrabold text-sky-400 shrink-0">{currentPreset.moveSpeed}</span>
          </div>
          <div className="bg-slate-900 px-1 py-0.5 chamfer-sm border border-slate-800 flex justify-between items-center gap-1">
            <span className="text-slate-400 truncate">Tốc đánh:</span>
            <span className="font-extrabold text-amber-300 shrink-0">{currentPreset.attackSpeed}s</span>
          </div>
          <div className="bg-slate-900 px-1 py-0.5 chamfer-sm border border-slate-800 flex justify-between items-center gap-1">
            <span className="text-slate-400 truncate">ST Chí mạng:</span>
            <span className="font-extrabold text-purple-400 shrink-0">{Math.round(currentPreset.critMultiplier * 100)}%</span>
          </div>
          <div className="bg-slate-900 px-1 py-0.5 chamfer-sm border border-slate-800 flex justify-between items-center gap-1">
            <span className="text-slate-400 truncate">Tỉ lệ chí mạng:</span>
            <span className="font-extrabold text-yellow-300 shrink-0">{Math.round(currentPreset.critChance * 100)}%</span>
          </div>
        </div>
      </div>

      {/* EQUAL SPACER 2 (Matches Spacer 1 so Stats Box is evenly centered between Class Ring & Bottom Buttons) */}
      <div className="flex-1" />

      {/* 3. BOTTOM SECTION: Navigation Buttons [ X ] & [ ✓ ] at Bottom of Screen */}
      <div
        className={`flex items-center justify-center gap-[260px] sm:gap-[300px] shrink-0 z-50 transition-all duration-150 ${
          isTransitioning ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'
        }`}
      >
        {onBackToCustomization && (
          <button
            onClick={handleCancelAction}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/90 border-2 border-slate-600 hover:border-rose-400 text-slate-300 hover:text-rose-400 shadow-[0_0_20px_rgba(0,0,0,0.8)] active:scale-90 transition flex items-center justify-center cursor-pointer"
            title="Hủy / Quay lại"
          >
            <X size={22} strokeWidth={2.5} />
          </button>
        )}

        <button
          onClick={handleConfirmAction}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-500 text-white border-2 border-blue-300 shadow-[0_0_25px_rgba(37,99,235,0.8)] active:scale-90 transition flex items-center justify-center cursor-pointer"
          title="Xác nhận / Vào trận"
        >
          <Check size={24} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};
