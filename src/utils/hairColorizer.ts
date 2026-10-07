import { HairColor, SkinColor } from '../types/game';

export interface HairColorOption {
  id: HairColor;
  name: string;
  swatchHex: string;
  borderHex: string;
  // Color ramp [shadow, mid, highlight] in RGB (0..255)
  shadowRgb: [number, number, number];
  midRgb: [number, number, number];
  highlightRgb: [number, number, number];
}

export const HAIR_COLOR_OPTIONS: HairColorOption[] = [
  {
    id: 'black',
    name: 'Đen',
    swatchHex: '#18181b',
    borderHex: '#52525b',
    shadowRgb: [12, 14, 20],
    midRgb: [28, 32, 42],
    highlightRgb: [52, 58, 72],
  },
  {
    id: 'white',
    name: 'Trắng',
    swatchHex: '#f8fafc',
    borderHex: '#cbd5e1',
    shadowRgb: [165, 175, 190],
    midRgb: [228, 234, 242],
    highlightRgb: [252, 254, 255],
  },
  {
    id: 'crimson_dark',
    name: 'Đỏ Đô',
    swatchHex: '#7f1d1d',
    borderHex: '#b91c1c',
    shadowRgb: [48, 10, 10],
    midRgb: [115, 22, 22],
    highlightRgb: [152, 36, 36],
  },
  {
    id: 'wine_red',
    name: 'Đỏ Rượu',
    swatchHex: '#6b112c',
    borderHex: '#9f1239',
    shadowRgb: [42, 6, 18],
    midRgb: [102, 16, 44],
    highlightRgb: [142, 30, 64],
  },
  {
    id: 'orange',
    name: 'Cam',
    swatchHex: '#f97316',
    borderHex: '#fdba74',
    shadowRgb: [135, 42, 8],
    midRgb: [228, 92, 18],
    highlightRgb: [248, 138, 42],
  },
  {
    id: 'lotus_pink',
    name: 'Hồng Sen',
    swatchHex: '#ec4899',
    borderHex: '#f9a8d4',
    shadowRgb: [122, 20, 72],
    midRgb: [222, 58, 140],
    highlightRgb: [244, 114, 182],
  },
  {
    id: 'blue',
    name: 'Xanh',
    swatchHex: '#2563eb',
    borderHex: '#60a5fa',
    shadowRgb: [18, 42, 118],
    midRgb: [38, 102, 228],
    highlightRgb: [82, 148, 248],
  },
  {
    id: 'platinum',
    name: 'Bạch Kim',
    swatchHex: '#fef9c3',
    borderHex: '#fde047',
    shadowRgb: [186, 174, 132],
    midRgb: [242, 232, 184],
    highlightRgb: [254, 249, 216],
  },
];

export interface SkinColorOption {
  id: SkinColor;
  name: string;
  swatchHex: string;
  borderHex: string;
  shadowRgb: [number, number, number];
  midRgb: [number, number, number];
  highlightRgb: [number, number, number];
}

export const SKIN_COLOR_OPTIONS: SkinColorOption[] = [
  {
    id: 'default',
    name: 'Da Tự Nhiên',
    swatchHex: '#eca882',
    borderHex: '#f6cba8',
    shadowRgb: [182, 112, 88],
    midRgb: [226, 156, 124],
    highlightRgb: [244, 184, 152],
  },
  {
    id: 'porcelain',
    name: 'Trắng Sứ',
    swatchHex: '#fbe5d8',
    borderHex: '#ffffff',
    shadowRgb: [212, 176, 162],
    midRgb: [246, 220, 206],
    highlightRgb: [255, 242, 234],
  },
  {
    id: 'peach',
    name: 'Hồng Đào',
    swatchHex: '#f7bfa8',
    borderHex: '#fed7aa',
    shadowRgb: [198, 132, 112],
    midRgb: [242, 184, 162],
    highlightRgb: [254, 214, 198],
  },
  {
    id: 'honey',
    name: 'Mật Ong',
    swatchHex: '#dca06e',
    borderHex: '#f3c69f',
    shadowRgb: [168, 106, 66],
    midRgb: [218, 156, 106],
    highlightRgb: [238, 186, 140],
  },
  {
    id: 'tan',
    name: 'Bánh Mật',
    swatchHex: '#c68652',
    borderHex: '#e0ab7c',
    shadowRgb: [142, 84, 46],
    midRgb: [196, 132, 82],
    highlightRgb: [218, 162, 112],
  },
  {
    id: 'bronze',
    name: 'Đồng Cổ',
    swatchHex: '#9c6137',
    borderHex: '#c28558',
    shadowRgb: [108, 58, 30],
    midRgb: [154, 96, 56],
    highlightRgb: [182, 122, 78],
  },
  {
    id: 'dark',
    name: 'Nâu Trầm',
    swatchHex: '#63391f',
    borderHex: '#8c5838',
    shadowRgb: [64, 34, 16],
    midRgb: [102, 60, 34],
    highlightRgb: [132, 82, 52],
  },
  {
    id: 'ash',
    name: 'Xám Tro',
    swatchHex: '#94a3b8',
    borderHex: '#cbd5e1',
    shadowRgb: [96, 108, 126],
    midRgb: [148, 163, 184],
    highlightRgb: [186, 198, 214],
  },
];

const tintedHairCache = new Map<string, HTMLCanvasElement>();
const tintedSkinCache = new Map<string, HTMLCanvasElement>();

/**
 * Thêm đường viền mỏng (Outline) nhẹ xung quanh bộ phận nhân vật, chân tóc và quần áo
 * giúp nhân vật tách biệt rõ ràng và nổi bật trên nền cỏ.
 */
function applySubtlePixelOutline(
  imgData: ImageData,
  w: number,
  h: number,
  outlineRgb: [number, number, number],
  outlineAlpha: number
) {
  const d = imgData.data;
  const origAlpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    origAlpha[i] = d[i * 4 + 3];
  }

  // Bán kính quét lân cận tự động tỉ lệ theo độ phân giải ảnh gốc (ảnh HD ~1200px dùng bước nhảy để tạo viền mỏng ~0.7px khi thu nhỏ)
  const step = Math.max(1, Math.round(Math.min(w, h) / 72));
  const [or, og, ob] = outlineRgb;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (origAlpha[idx] > 45) continue;

      let touchingOpaque = false;
      if (x >= step && origAlpha[idx - step] > 140) touchingOpaque = true;
      else if (x + step < w && origAlpha[idx + step] > 140) touchingOpaque = true;
      else if (y >= step && origAlpha[(y - step) * w + x] > 140) touchingOpaque = true;
      else if (y + step < h && origAlpha[(y + step) * w + x] > 140) touchingOpaque = true;

      if (touchingOpaque) {
        const pIdx = idx * 4;
        d[pIdx] = or;
        d[pIdx + 1] = og;
        d[pIdx + 2] = ob;
        d[pIdx + 3] = Math.max(d[pIdx + 3], outlineAlpha);
      }
    }
  }
}

/**
 * Nhuộm màu tóc từ ảnh tóc gốc (pixel luminance mapping)
 * Trả về HTMLCanvasElement trực tiếp để ctx.drawImage vẽ ngay lập tức không bị trễ frame hay vệt trắng
 */
export function getTintedHairImage(
  baseImg: HTMLImageElement | null | undefined,
  hairStyleKey: string,
  colorId: HairColor
): HTMLCanvasElement | HTMLImageElement | null {
  if (!baseImg) return null;
  const w = baseImg.naturalWidth || baseImg.width;
  const h = baseImg.naturalHeight || baseImg.height;
  if (!w || !h) return null;

  const cacheKey = `${hairStyleKey}_${colorId}_${w}x${h}_v4_outline`;
  const cached = tintedHairCache.get(cacheKey);
  if (cached) return cached;

  const colorOpt = HAIR_COLOR_OPTIONS.find((c) => c.id === colorId) || HAIR_COLOR_OPTIONS[0];

  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return baseImg;

    ctx.drawImage(baseImg, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    let minLum = 255;
    let maxLum = 0;

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 20) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (lum > 18) {
          if (lum < minLum) minLum = lum;
          if (lum > maxLum) maxLum = lum;
        }
      }
    }

    if (maxLum <= minLum) {
      minLum = 18;
      maxLum = 255;
    }

    const [sr, sg, sb] = colorOpt.shadowRgb;
    const [mr, mg, mb] = colorOpt.midRgb;
    const [hr, hg, hb] = colorOpt.highlightRgb;

    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a <= 15) continue;

      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum <= 16) {
        d[i] = Math.round(sr * 0.45);
        d[i + 1] = Math.round(sg * 0.45);
        d[i + 2] = Math.round(sb * 0.45);
        continue;
      }

      const rawT = Math.max(0, Math.min(1, (lum - minLum) / (maxLum - minLum || 1)));
      const t = Math.pow(rawT, 1.35) * 0.72;

      let outR: number;
      let outG: number;
      let outB: number;

      if (t < 0.55) {
        const k = t / 0.55;
        outR = sr + (mr - sr) * k;
        outG = sg + (mg - sg) * k;
        outB = sb + (mb - sb) * k;
      } else {
        const k = (t - 0.55) / 0.45;
        outR = mr + (hr - mr) * k;
        outG = mg + (hg - mg) * k;
        outB = mb + (hb - mb) * k;
      }

      d[i] = Math.max(0, Math.min(255, Math.round(outR)));
      d[i + 1] = Math.max(0, Math.min(255, Math.round(outG)));
      d[i + 2] = Math.max(0, Math.min(255, Math.round(outB)));
    }

    // Thêm đường viền mỏng nhẹ ở chân tóc và bao quanh mái tóc
    applySubtlePixelOutline(
      imgData,
      w,
      h,
      [Math.max(8, Math.round(sr * 0.32)), Math.max(10, Math.round(sg * 0.32)), Math.max(14, Math.round(sb * 0.36))],
      195
    );

    ctx.putImageData(imgData, 0, 0);
    tintedHairCache.set(cacheKey, canvas);
    return canvas;
  } catch {
    return baseImg;
  }
}

/**
 * Nhuộm màu da cho phần Đầu (dau), Tay (tay), và Thân người (than).
 * Riêng phần Thân (than): chỉ đổi màu da phần cổ đã được hóa thành màu trắng/xám, giữ nguyên màu áo!
 */
export function getTintedSkinImage(
  baseImg: HTMLImageElement | null | undefined,
  partKey: 'dau' | 'tay' | 'than',
  skinId: SkinColor
): HTMLCanvasElement | HTMLImageElement | null {
  if (!baseImg) return null;
  const w = baseImg.naturalWidth || baseImg.width;
  const h = baseImg.naturalHeight || baseImg.height;
  if (!w || !h) return null;

  const cacheKey = `skin_${partKey}_${skinId}_${w}x${h}_v2_outline`;
  const cached = tintedSkinCache.get(cacheKey);
  if (cached) return cached;

  const skinOpt = SKIN_COLOR_OPTIONS.find((s) => s.id === skinId) || SKIN_COLOR_OPTIONS[0];

  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return baseImg;

    ctx.drawImage(baseImg, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;

    let minLum = 255;
    let maxLum = 0;

    // 1. Quét dải sáng của vùng da trắng/xám cần nhuộm
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] <= 20) continue;
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];

      if (partKey === 'than') {
        // Trên thân người: chỉ vùng cổ màu trắng/xám trung tính (|R-G|<18, |G-B|<18, lum > 130) mới là da cổ
        if (Math.abs(r - g) > 18 || Math.abs(g - b) > 18 || r < 130) {
          continue;
        }
      }

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 35) {
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;
      }
    }

    if (maxLum <= minLum) {
      minLum = 140;
      maxLum = 250;
    }

    const [sr, sg, sb] = skinOpt.shadowRgb;
    const [mr, mg, mb] = skinOpt.midRgb;
    const [hr, hg, hb] = skinOpt.highlightRgb;

    // 2. Nhuộm màu da cho từng pixel thuộc vùng da
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3];
      if (a <= 15) continue;

      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];

      if (partKey === 'than') {
        // Giữ nguyên 100% phần áo và viền đai đen trên thân, chỉ đổi màu phần cổ đã hóa trắng
        if (Math.abs(r - g) > 18 || Math.abs(g - b) > 18 || r < 130) {
          continue;
        }
      }

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum <= 30) {
        // Giữ nguyên mắt/viền tối nếu có
        continue;
      }

      let t: number;
      if (maxLum - minLum < 4) {
        // Trường hợp phần cổ trắng đồng nhất 1 màu (như RGB 219,219,219 trên thân mới): dùng trực tiếp màu da chủ đạo (midRgb)
        t = 0.5;
      } else {
        t = Math.max(0, Math.min(1, (lum - minLum) / (maxLum - minLum || 1)));
      }

      let outR: number;
      let outG: number;
      let outB: number;

      if (t < 0.5) {
        const k = t / 0.5;
        outR = sr + (mr - sr) * k;
        outG = sg + (mg - sg) * k;
        outB = sb + (mb - sb) * k;
      } else {
        const k = (t - 0.5) / 0.5;
        outR = mr + (hr - mr) * k;
        outG = mg + (hg - mg) * k;
        outB = mb + (hb - mb) * k;
      }

      d[i] = Math.max(0, Math.min(255, Math.round(outR)));
      d[i + 1] = Math.max(0, Math.min(255, Math.round(outG)));
      d[i + 2] = Math.max(0, Math.min(255, Math.round(outB)));
    }

    // Thêm đường viền mỏng (Outline) nhẹ xung quanh đầu, tay và quần áo thân người để nổi bật trên nền cỏ
    const outlineColor: [number, number, number] =
      partKey === 'than'
        ? [15, 23, 38] // Viền quần áo sẫm nét
        : [Math.max(24, Math.round(sr * 0.42)), Math.max(18, Math.round(sg * 0.38)), Math.max(16, Math.round(sb * 0.38))];
    applySubtlePixelOutline(imgData, w, h, outlineColor, partKey === 'than' ? 210 : 185);

    ctx.putImageData(imgData, 0, 0);
    tintedSkinCache.set(cacheKey, canvas);
    return canvas;
  } catch {
    return baseImg;
  }
}
