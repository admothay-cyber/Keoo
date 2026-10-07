/**
 * Hệ thống tạo và vẽ chi tiết bản đồ Pixel Art (Đá rêu, Khúc gỗ mục, Khóm cỏ dại kèm đá, Tường đá bẻ góc Isometric & Sàn gạch đá cổ)
 * Tự động vẽ trên Offscreen Canvas trong suốt (đã khử/cắt phông nền 100%) để đạt hiệu năng cao nhất.
 */

export type MapPropType =
  | 'mossy_rock_cluster'
  | 'mossy_spire_rock'
  | 'mossy_tilted_slab'
  | 'mossy_split_monolith'
  | 'hollow_log'
  | 'hollow_mossy_log'
  | 'splintered_log'
  | 'mossy_splintered_log'
  | 'fern_pebble_tuft'
  | 'chiseled_stone_block'
  | 'round_boulder'
  | 'layered_rock_pile'
  | 'sharp_spire_pair';

export interface MapPropItem {
  id: string;
  type: MapPropType;
  x: number;
  y: number;
  scale: number;
  flipX: boolean;
  collisionRadius: number; // > 0 nếu là tảng đá/gỗ lớn có cản nhẹ, 0 nếu là bụi cỏ/đá nhỏ đi xuyên qua
}

export interface AngledStoneWallSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  height: number;
  thickness: number;
  hasCornerPostStart?: boolean;
  hasCornerPostEnd?: boolean;
}

const propCanvasCache = new Map<string, HTMLCanvasElement>();
let stoneBrickPatternCanvas: HTMLCanvasElement | null = null;

/**
 * Tạo texture gạch đá 64x64 seamless theo đúng mẫu "SEAMLESS TEXTURE STONE FLOOR 64x64"
 */
export function getStoneFloorTileCanvas(): HTMLCanvasElement {
  if (stoneBrickPatternCanvas) return stoneBrickPatternCanvas;

  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Nền mạch vữa đá sẫm
  ctx.fillStyle = '#73706d';
  ctx.fillRect(0, 0, size, size);

  // Danh sách các viên gạch đá chữ nhật/vuông đan xen như mẫu 64x64
  const bricks: [number, number, number, number, number][] = [
    // [x, y, w, h, shadeVariant]
    [1, 1, 18, 14, 0],
    [20, 1, 13, 14, 1],
    [34, 1, 19, 10, 2],
    [54, 1, 9, 14, 0],

    [34, 12, 9, 9, 3],
    [44, 12, 9, 9, 1],

    [1, 16, 12, 15, 2],
    [14, 16, 19, 15, 0],
    [34, 22, 19, 13, 1],
    [54, 16, 9, 19, 2],

    [1, 32, 19, 14, 1],
    [21, 32, 12, 10, 3],
    [21, 43, 12, 8, 0],
    [34, 36, 13, 15, 2],
    [48, 36, 15, 15, 0],

    [1, 47, 11, 16, 2],
    [13, 47, 7, 16, 3],
    [21, 52, 18, 11, 1],
    [40, 52, 13, 11, 0],
    [54, 52, 9, 11, 2],
  ];

  const baseColors = ['#d6d3d1', '#c7c4c1', '#bdb9b5', '#b0aca8'];
  const highlightColors = ['#f5f5f4', '#e7e5e4', '#dedbd8', '#d1cecb'];
  const shadowColors = ['#96928e', '#8c8884', '#827e7a', '#787470'];

  for (const [bx, by, bw, bh, shade] of bricks) {
    // Khối chính viên đá
    ctx.fillStyle = baseColors[shade % baseColors.length];
    ctx.fillRect(bx, by, bw, bh);

    // Bo góc pixel 1px bằng màu khe vữa
    ctx.fillStyle = '#686562';
    ctx.fillRect(bx, by, 1, 1);
    ctx.fillRect(bx + bw - 1, by, 1, 1);
    ctx.fillRect(bx, by + bh - 1, 1, 1);
    ctx.fillRect(bx + bw - 1, by + bh - 1, 1, 1);

    // Viền sáng cạnh trên & trái
    ctx.fillStyle = highlightColors[shade % highlightColors.length];
    ctx.fillRect(bx + 1, by, bw - 2, 1);
    ctx.fillRect(bx, by + 1, 1, bh - 2);
    if (bw > 8 && bh > 8) {
      ctx.fillRect(bx + 2, by + 1, Math.max(2, bw - 5), 1);
    }

    // Viền bóng cạnh dưới & phải
    ctx.fillStyle = shadowColors[shade % shadowColors.length];
    ctx.fillRect(bx + 1, by + bh - 1, bw - 2, 1);
    ctx.fillRect(bx + bw - 1, by + 1, 1, bh - 2);

    // Hạt vân đá lấm tấm bên trong
    ctx.fillStyle = shadowColors[(shade + 1) % shadowColors.length];
    if (bw > 10 && bh > 10) {
      ctx.fillRect(bx + 4, by + 4, 2, 1);
      ctx.fillRect(bx + bw - 5, by + bh - 4, 2, 1);
    }
  }

  stoneBrickPatternCanvas = c;
  return c;
}

/**
 * Tiện ích vẽ chấm pixel theo lưới để tạo sprite Pixel Art sắc nét, tự cắt sạch phông nền (trong suốt 100%)
 */
function createPixelCanvas(pw: number, ph: number, pixelSize = 2): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dot: (x: number, y: number, color: string, w?: number, h?: number) => void;
  poly: (pts: [number, number][], color: string) => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = pw * pixelSize;
  canvas.height = ph * pixelSize;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const dot = (x: number, y: number, color: string, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x) * pixelSize, Math.round(y) * pixelSize, Math.round(w) * pixelSize, Math.round(h) * pixelSize);
  };

  const poly = (pts: [number, number][], color: string) => {
    if (pts.length < 3) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * pixelSize, pts[0][1] * pixelSize);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0] * pixelSize, pts[i][1] * pixelSize);
    }
    ctx.closePath();
    ctx.fill();
  };

  return { canvas, ctx, dot, poly };
}

/**
 * Tạo và lưu cache các sprite đá rêu, khúc gỗ mục, bụi cỏ dại kèm đá cuội (đã tách nền trong suốt)
 */
export function getMapPropSprite(type: MapPropType): HTMLCanvasElement {
  const cached = propCanvasCache.get(type);
  if (cached) return cached;

  let resultCanvas: HTMLCanvasElement;

  switch (type) {
    case 'mossy_rock_cluster': {
      // Mẫu 1 (ảnh 1 trên cùng): Tảng đá phẳng elip kèm 2 viên đá nhỏ và cỏ rêu xanh mọc chân đá + bóng đổ sắc nét
      const { canvas, dot, poly } = createPixelCanvas(44, 30, 2);
      // Bóng đổ đen xanh đậm dưới chân
      poly([[4, 23], [38, 23], [40, 26], [2, 26]], '#1e242b');
      // Khối đá chính
      poly([[9, 11], [24, 8], [33, 10], [35, 19], [28, 23], [8, 22]], '#4b5563');
      poly([[10, 10], [24, 8], [32, 10], [33, 15], [22, 17], [10, 15]], '#86929e');
      poly([[12, 9], [25, 8], [30, 10], [26, 13], [13, 13]], '#9ca6b0');
      // Viên đá phụ bên trái
      poly([[7, 18], [13, 17], [15, 22], [11, 24], [6, 22]], '#64707d');
      poly([[8, 18], [13, 17], [14, 20], [8, 20]], '#9ca6b0');
      // Viên đá phụ bên phải
      poly([[26, 15], [36, 14], [39, 19], [35, 23], [26, 22]], '#596573');
      poly([[28, 15], [35, 14], [37, 17], [28, 18]], '#9ca6b0');
      // Rêu và ngọn cỏ xanh mọc quanh chân đá
      const mossPts: [number, number, number, number][] = [
        [9, 15, 1, 6], [10, 17, 1, 5], [15, 19, 2, 4], [19, 16, 1, 6],
        [21, 14, 1, 8], [23, 16, 2, 6], [25, 18, 2, 5], [34, 11, 1, 4],
      ];
      for (const [mx, my, mw, mh] of mossPts) {
        dot(mx, my, '#4d7c0f', mw, mh);
        dot(mx, my, '#65a30d', 1, Math.max(1, mh - 2));
      }
      resultCanvas = canvas;
      break;
    }

    case 'mossy_spire_rock': {
      // Mẫu 2 (ảnh 1 góc phải trên): Đá tảng nhô cao 2 tầng có rêu bám khe đá
      const { canvas, dot, poly } = createPixelCanvas(44, 38, 2);
      poly([[4, 31], [37, 31], [39, 34], [2, 34]], '#1e242b');
      // Khối cao bên trái
      poly([[11, 29], [14, 13], [23, 6], [29, 8], [32, 29]], '#596573');
      poly([[15, 13], [23, 6], [28, 8], [25, 16], [16, 17]], '#9ca6b0');
      // Khối thấp bên phải
      poly([[22, 29], [23, 18], [32, 16], [36, 20], [36, 30], [25, 31]], '#4b5563');
      poly([[24, 18], [32, 16], [35, 19], [26, 21]], '#86929e');
      // Rêu bám dọc khe và chân đá
      dot(21, 16, '#4d7c0f', 2, 9);
      dot(22, 17, '#65a30d', 1, 6);
      dot(8, 26, '#4d7c0f', 1, 5);
      dot(10, 27, '#65a30d', 2, 4);
      dot(13, 29, '#4d7c0f', 22, 2);
      dot(16, 30, '#65a30d', 16, 1);
      resultCanvas = canvas;
      break;
    }

    case 'mossy_tilted_slab': {
      // Mẫu 3 (ảnh 1 giữa): Phiến đá bàn nghiêng lớn có viền rêu xanh trên gờ và 2 hòn đá nhỏ dưới chân
      const { canvas, dot, poly } = createPixelCanvas(50, 34, 2);
      poly([[3, 27], [44, 27], [46, 30], [2, 30]], '#1e242b');
      // Thân dưới phiến đá nghiêng
      poly([[10, 12], [43, 16], [38, 27], [15, 27]], '#4b5563');
      poly([[14, 15], [37, 18], [34, 26], [18, 26]], '#596573');
      // Mặt phẳng nghiêng phía trên
      poly([[9, 10], [22, 9], [43, 14], [41, 18], [22, 16], [10, 13]], '#9ca6b0');
      poly([[12, 11], [24, 10], [39, 14], [36, 16], [15, 14]], '#b0bac4');
      // 2 hòn đá cuội dưới chân
      poly([[7, 21], [14, 20], [17, 25], [15, 28], [6, 27]], '#64707d');
      poly([[8, 21], [14, 20], [15, 23], [8, 23]], '#86929e');
      poly([[29, 23], [36, 22], [38, 26], [36, 28], [28, 28]], '#64707d');
      poly([[30, 23], [35, 22], [36, 25], [30, 25]], '#9ca6b0');
      // Rêu xanh rủ trên mép phiến đá và chân đá
      dot(12, 9, '#65a30d', 7, 2);
      dot(28, 16, '#65a30d', 13, 2);
      dot(41, 15, '#4d7c0f', 2, 5);
      dot(17, 22, '#65a30d', 2, 6);
      dot(22, 23, '#4d7c0f', 3, 5);
      dot(26, 24, '#65a30d', 2, 4);
      resultCanvas = canvas;
      break;
    }

    case 'mossy_split_monolith': {
      // Mẫu 4 & 5 (ảnh 1 dưới): Cặp đá tảng dựng đứng nứt đôi phủ dây rêu xanh
      const { canvas, dot, poly } = createPixelCanvas(46, 42, 2);
      poly([[3, 35], [39, 35], [41, 38], [2, 38]], '#1e242b');
      // Tảng cao bên trái
      poly([[12, 35], [11, 14], [15, 8], [22, 10], [25, 35]], '#64707d');
      poly([[13, 13], [16, 8], [21, 10], [22, 26], [15, 28]], '#9ca6b0');
      // Tảng nghiêng bên phải
      poly([[21, 36], [20, 16], [25, 13], [32, 17], [37, 30], [35, 36]], '#596573');
      poly([[22, 16], [26, 13], [31, 18], [34, 30], [25, 32]], '#86929e');
      // Khe rêu xanh chạy dọc giữa 2 phiến đá
      dot(19, 13, '#4d7c0f', 2, 22);
      dot(20, 14, '#65a30d', 1, 18);
      dot(11, 12, '#65a30d', 1, 9);
      dot(27, 24, '#65a30d', 4, 2);
      dot(12, 34, '#4d7c0f', 23, 3);
      dot(14, 35, '#65a30d', 19, 2);
      resultCanvas = canvas;
      break;
    }

    case 'hollow_log':
    case 'hollow_mossy_log': {
      // Mẫu ảnh 2 (hàng trên): Khúc gỗ mục rỗng ruột có viền đậm pixel art, bản thường và bản phủ rêu
      const isMossy = type === 'hollow_mossy_log';
      const { canvas, dot, poly } = createPixelCanvas(48, 26, 2);
      // Bóng đổ nhẹ dưới khúc gỗ
      poly([[5, 19], [43, 18], [45, 22], [4, 22]], 'rgba(15, 23, 42, 0.42)');
      // Viền ngoài nâu đen đậm (#23151c)
      poly([[6, 11], [15, 11], [19, 8], [25, 8], [27, 4], [29, 4], [29, 7], [36, 7], [42, 6], [42, 18], [12, 21], [6, 19]], '#23151c');
      // Thân gỗ nâu ấm & vân vỏ cây
      poly([[15, 12], [20, 9], [39, 8], [40, 17], [14, 19]], '#5c3a33');
      poly([[16, 11], [23, 9], [33, 9], [28, 14], [16, 15]], '#8c624c');
      dot(18, 10, '#ad8166', 8, 2);
      dot(26, 5, '#8c624c', 2, 4);
      // Lỗ rỗng tối ở đầu khúc gỗ bên trái
      poly([[7, 12], [14, 12], [14, 19], [8, 19]], '#1c1117');
      dot(14, 11, '#ad8166', 1, 8); // Vành miệng khúc gỗ sáng
      // Các thớ gỗ gãy nhọn bên phải
      dot(35, 8, '#734b3d', 6, 2);
      dot(34, 12, '#472b26', 7, 2);
      dot(36, 15, '#5c3a33', 5, 2);

      if (isMossy) {
        // Mảng rêu rừng xanh đậm bám lưng khúc gỗ
        poly([[18, 9], [35, 8], [37, 15], [22, 18], [16, 16]], '#264027');
        dot(20, 9, '#3e6b36', 11, 3);
        dot(23, 12, '#4e8240', 8, 2);
        dot(18, 14, '#3e6b36', 6, 2);
      }
      resultCanvas = canvas;
      break;
    }

    case 'splintered_log':
    case 'mossy_splintered_log': {
      // Mẫu ảnh 2 (hàng dưới): Khúc gỗ mục gãy gai góc nằm ngang
      const isMossy = type === 'mossy_splintered_log';
      const { canvas, dot, poly } = createPixelCanvas(50, 22, 2);
      poly([[3, 15], [46, 15], [47, 18], [2, 18]], 'rgba(15, 23, 42, 0.42)');
      // Khung viền ngoài tối
      poly([[4, 12], [12, 8], [28, 6], [44, 6], [41, 10], [47, 11], [44, 15], [15, 16], [5, 17]], '#23151c');
      // Thớ gỗ nâu
      poly([[7, 12], [15, 9], [39, 7], [42, 13], [12, 15]], '#5c3a33');
      dot(14, 9, '#8c624c', 14, 2);
      dot(34, 7, '#ad8166', 6, 2);
      dot(24, 12, '#8c624c', 10, 2);
      dot(8, 11, '#ad8166', 4, 2);

      if (isMossy) {
        poly([[14, 8], [38, 7], [35, 14], [16, 15]], '#264027');
        dot(17, 8, '#3e6b36', 16, 3);
        dot(21, 9, '#558b3e', 10, 2);
        dot(15, 12, '#3e6b36', 8, 2);
      }
      resultCanvas = canvas;
      break;
    }

    case 'fern_pebble_tuft': {
      // Mẫu ảnh 3: Khóm cỏ dương xỉ xanh tươi ôm quanh 2 viên đá cuội sáng màu
      const { canvas, dot, poly } = createPixelCanvas(48, 36, 2);
      // Thảm cỏ lót dưới chân
      poly([[7, 26], [40, 26], [42, 31], [10, 32], [6, 29]], '#5c8d1e');
      poly([[9, 27], [38, 27], [39, 30], [11, 30]], '#74ab27');
      // Lá cỏ vươn dài phía sau (trái, giữa, phải)
      poly([[14, 22], [6, 14], [11, 14], [18, 20]], '#74ab27');
      poly([[18, 20], [15, 7], [19, 6], [21, 19]], '#5c8d1e');
      poly([[24, 19], [23, 5], [27, 7], [28, 18]], '#5c8d1e');
      poly([[29, 19], [38, 9], [41, 12], [33, 21]], '#74ab27');
      poly([[31, 21], [43, 15], [44, 18], [34, 23]], '#8bc34a');
      // Viên đá cuội lớn bên phải (màu xám kem ấm như ảnh 3)
      poly([[20, 25], [21, 16], [28, 14], [34, 16], [35, 25], [27, 26]], '#b8afa6');
      poly([[22, 16], [28, 14], [33, 16], [33, 21], [23, 21]], '#d6cfc7');
      dot(25, 16, '#ebe6e0', 4, 2);
      dot(29, 18, '#a3998f', 2, 2);
      // Viên đá cuội nhỏ bên trái
      poly([[11, 27], [12, 21], [18, 20], [22, 23], [21, 27]], '#a3998f');
      poly([[13, 21], [18, 20], [20, 23], [13, 24]], '#d6cfc7');
      // Các ngọn cỏ non đan chéo trước mặt viên đá
      poly([[21, 26], [25, 18], [27, 18], [24, 26]], '#4a7715');
      poly([[27, 27], [30, 17], [32, 18], [29, 27]], '#8bc34a');
      dot(15, 25, '#5c8d1e', 3, 3);
      resultCanvas = canvas;
      break;
    }

    case 'chiseled_stone_block': {
      // Mẫu ảnh 5 (hàng 1 & 2): Phiến đá chữ nhật vát cạnh cổ đại có vân gạch ở chân
      const { canvas, dot, poly } = createPixelCanvas(38, 26, 2);
      poly([[3, 19], [35, 19], [36, 23], [2, 23]], 'rgba(15, 23, 42, 0.38)');
      // Khối đế gạch đá sẫm
      poly([[5, 13], [33, 13], [33, 20], [5, 20]], '#2b3138');
      dot(6, 14, '#525b66', 26, 5);
      // Mặt trên phẳng sáng có vết nứt nhỏ
      poly([[5, 8], [9, 5], [29, 5], [33, 8], [33, 14], [5, 14]], '#8c96a1');
      poly([[7, 6], [29, 6], [31, 9], [31, 13], [7, 13]], '#9ea8b3');
      // Đường kẻ mạch gạch mặt trước & vết nứt
      dot(6, 16, '#373f47', 26, 1);
      dot(14, 14, '#373f47', 1, 5);
      dot(24, 14, '#373f47', 1, 5);
      dot(11, 6, '#525b66', 2, 2);
      dot(26, 12, '#525b66', 2, 2);
      resultCanvas = canvas;
      break;
    }

    case 'round_boulder': {
      // Mẫu ảnh 5 (hàng 3): Hòn đá cuội tròn nhẵn nhiều tầng sắc độ
      const { canvas, poly } = createPixelCanvas(34, 28, 2);
      poly([[4, 21], [30, 21], [31, 25], [3, 25]], 'rgba(15, 23, 42, 0.38)');
      poly([[6, 16], [8, 8], [16, 5], [25, 7], [28, 15], [25, 22], [9, 22]], '#373f47');
      poly([[7, 15], [9, 9], [16, 6], [24, 8], [27, 14], [24, 20], [10, 20]], '#636d78');
      poly([[9, 12], [11, 8], [17, 6], [23, 8], [25, 13], [19, 16], [11, 15]], '#808b96');
      poly([[12, 9], [17, 7], [22, 9], [20, 12], [13, 12]], '#9ea8b3');
      resultCanvas = canvas;
      break;
    }

    case 'sharp_spire_pair': {
      // Mẫu ảnh 5 (hàng 4 trái): Mỏm đá nhọn dựng đứng phong hóa
      const { canvas, poly } = createPixelCanvas(36, 40, 2);
      poly([[5, 33], [31, 33], [32, 37], [4, 37]], 'rgba(15, 23, 42, 0.4)');
      poly([[8, 33], [11, 14], [16, 5], [20, 7], [25, 17], [27, 33], [18, 35]], '#373f47');
      poly([[9, 32], [12, 15], [16, 6], [19, 8], [24, 18], [25, 32], [18, 34]], '#636d78');
      poly([[12, 28], [13, 15], [16, 7], [18, 14], [17, 30]], '#8c96a1');
      poly([[14, 16], [16, 8], [17, 14], [15, 22]], '#a7b1bc');
      resultCanvas = canvas;
      break;
    }

    case 'layered_rock_pile':
    default: {
      // Mẫu ảnh 5 (hàng 6): Cụm đá tảng nhiều khối chồng lên nhau bề thế
      const { canvas, poly } = createPixelCanvas(46, 38, 2);
      poly([[3, 31], [43, 31], [44, 35], [2, 35]], 'rgba(15, 23, 42, 0.42)');
      // Khối trụ đá lớn trung tâm
      poly([[12, 26], [13, 10], [21, 7], [29, 10], [30, 26]], '#373f47');
      poly([[13, 25], [14, 11], [21, 8], [28, 11], [28, 25]], '#6e7885');
      poly([[15, 11], [21, 8], [27, 11], [25, 15], [16, 15]], '#9ea8b3');
      // Các tảng đá nhỏ vây quanh chân (trái, giữa, phải)
      poly([[5, 29], [6, 21], [13, 19], [17, 24], [15, 31], [7, 31]], '#4b545e');
      poly([[7, 21], [13, 20], [15, 23], [8, 24]], '#8c96a1');

      poly([[15, 32], [16, 23], [24, 22], [28, 27], [26, 33], [17, 33]], '#525b66');
      poly([[17, 24], [24, 23], [26, 26], [18, 27]], '#9ea8b3');

      poly([[27, 31], [28, 20], [36, 19], [40, 25], [38, 31], [29, 32]], '#4b545e');
      poly([[29, 21], [35, 20], [38, 24], [30, 25]], '#8c96a1');
      resultCanvas = canvas;
      break;
    }
  }

  propCanvasCache.set(type, resultCanvas);
  return resultCanvas;
}

/**
 * Vẽ đoạn tường đá cổ bẻ góc chuẩn Isometric 2.5D (kèm trụ đá ở điểm bẻ góc, gạch đá 64x64 và rêu phong)
 */
export function drawAngledStoneWall(
  ctx: CanvasRenderingContext2D,
  seg: AngledStoneWallSegment
) {
  const { x1, y1, x2, y2, height, thickness } = seg;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  // Vector pháp tuyến mặt phẳng đất (vuông góc theo tỷ lệ 2.5D)
  const nx = (-dy / len) * (thickness * 0.5);
  const ny = (dx / len) * (thickness * 0.35);

  // 4 đỉnh mặt trên của bức tường đá
  const t1x = x1 - nx, t1y = y1 - ny - height;
  const t2x = x2 - nx, t2y = y2 - ny - height;
  const t3x = x2 + nx, t3y = y2 + ny - height;
  const t4x = x1 + nx, t4y = y1 + ny - height;

  // 4 đỉnh chân tường trên mặt đất
  const b1x = x1 - nx, b1y = y1 - ny;
  const b2x = x2 - nx, b2y = y2 - ny;
  const b3x = x2 + nx, b3y = y2 + ny;
  const b4x = x1 + nx, b4y = y1 + ny;

  ctx.save();

  // 1. Bóng đổ của tường đá xuống mặt cỏ
  ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
  ctx.beginPath();
  ctx.moveTo(b4x, b4y);
  ctx.lineTo(b3x, b3y);
  ctx.lineTo(b3x + 6, b3y + 7);
  ctx.lineTo(b4x + 6, b4y + 7);
  ctx.closePath();
  ctx.fill();

  // 2. Vách mặt trước của tường đá (chọn mặt hướng về phía người nhìn có Y lớn hơn)
  const isFront34 = (b3y + b4y) >= (b1y + b2y);
  const fAx = isFront34 ? b4x : b1x;
  const fAy = isFront34 ? b4y : b1y;
  const fBx = isFront34 ? b3x : b2x;
  const fBy = isFront34 ? b3y : b2y;
  const fTopAx = isFront34 ? t4x : t1x;
  const fTopAy = isFront34 ? t4y : t1y;
  const fTopBx = isFront34 ? t3x : t2x;
  const fTopBy = isFront34 ? t3y : t2y;

  // Đổ màu đá mặt đứng theo hướng góc nghiêng để tạo khối 3D rõ rệt
  const wallFaceColor = dy * (isFront34 ? 1 : -1) > 0 ? '#5b6470' : '#4a525d';
  ctx.fillStyle = wallFaceColor;
  ctx.beginPath();
  ctx.moveTo(fTopAx, fTopAy);
  ctx.lineTo(fTopBx, fTopBy);
  ctx.lineTo(fBx, fBy);
  ctx.lineTo(fAx, fAy);
  ctx.closePath();
  ctx.fill();

  // Viền chân tường sẫm màu
  ctx.strokeStyle = '#252b33';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Vẽ các hàng gạch đá 3D bám dọc theo góc nghiêng của mặt tường
  const rows = 3;
  for (let r = 1; r < rows; r++) {
    const ry = (height * r) / rows;
    ctx.strokeStyle = '#323942';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(fTopAx, fTopAy + ry);
    ctx.lineTo(fTopBx, fTopBy + ry);
    ctx.stroke();
  }

  // Các mạch gạch dọc xen kẽ và đốm rêu xanh trên mặt tường
  const brickCols = Math.max(2, Math.floor(len / 22));
  for (let c = 1; c < brickCols; c++) {
    const t = c / brickCols;
    const mx = fTopAx + (fTopBx - fTopAx) * t;
    const my = fTopAy + (fTopBy - fTopAy) * t;
    ctx.strokeStyle = '#323942';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const rowOffset = c % 2 === 0 ? 0 : height / rows;
    ctx.moveTo(mx, my + rowOffset);
    ctx.lineTo(mx, my + Math.min(height, rowOffset + (height * 2) / rows));
    ctx.stroke();

    // Đốm rêu xanh bám kẽ tường đá
    if ((c * 7) % 3 === 0) {
      ctx.fillStyle = '#4d7c0f';
      ctx.fillRect(mx - 3, my + height - 5, 6, 4);
      ctx.fillStyle = '#65a30d';
      ctx.fillRect(mx - 2, my + height - 4, 4, 2);
    }
  }

  // 3. Vách đầu hồi bên trái/phải của đoạn tường
  const drawSideEnd = (topX1: number, topY1: number, topX2: number, topY2: number, botX2: number, botY2: number, botX1: number, botY1: number, shade: string) => {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(topX1, topY1);
    ctx.lineTo(topX2, topY2);
    ctx.lineTo(botX2, botY2);
    ctx.lineTo(botX1, botY1);
    ctx.closePath();
    ctx.fill();
  };
  drawSideEnd(t1x, t1y, t4x, t4y, b4x, b4y, b1x, b1y, '#3e4650');
  drawSideEnd(t2x, t2y, t3x, t3y, b3x, b3y, b2x, b2y, '#687380');

  // 4. Mặt phẳng đỉnh tường đá (ốp vân đá cổ 64x64 + viền highlight sáng)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(t1x, t1y);
  ctx.lineTo(t2x, t2y);
  ctx.lineTo(t3x, t3y);
  ctx.lineTo(t4x, t4y);
  ctx.closePath();
  ctx.clip();

  const patternTile = getStoneFloorTileCanvas();
  const pat = ctx.createPattern(patternTile, 'repeat');
  if (pat) {
    ctx.fillStyle = pat;
    ctx.fill();
  } else {
    ctx.fillStyle = '#9ca6b0';
    ctx.fill();
  }
  ctx.restore();

  // Viền gờ đá mặt trên sắc nét
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(t1x, t1y);
  ctx.lineTo(t2x, t2y);
  ctx.lineTo(t3x, t3y);
  ctx.lineTo(t4x, t4y);
  ctx.closePath();
  ctx.stroke();

  // 5. Trụ đá vuông (Corner Pillar) tại các góc nối/bẻ góc để mối nối tường vuông vức, liền khối
  const drawCornerPillar = (cx: number, cy: number) => {
    const pw = thickness * 0.68;
    const ph = thickness * 0.42;
    const pHeight = height + 4;

    // Mặt trước trụ
    ctx.fillStyle = '#525b66';
    ctx.beginPath();
    ctx.moveTo(cx - pw, cy - pHeight);
    ctx.lineTo(cx, cy + ph - pHeight);
    ctx.lineTo(cx, cy + ph);
    ctx.lineTo(cx - pw, cy);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#3f4750';
    ctx.beginPath();
    ctx.moveTo(cx, cy + ph - pHeight);
    ctx.lineTo(cx + pw, cy - pHeight);
    ctx.lineTo(cx + pw, cy);
    ctx.lineTo(cx, cy + ph);
    ctx.closePath();
    ctx.fill();

    // Đỉnh trụ đá hình thoi Isometric
    ctx.fillStyle = '#b0bac4';
    ctx.strokeStyle = '#252b33';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ph - pHeight);
    ctx.lineTo(cx + pw, cy - pHeight);
    ctx.lineTo(cx, cy + ph - pHeight);
    ctx.lineTo(cx - pw, cy - pHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Nắp đá nhỏ trên đỉnh trụ
    ctx.fillStyle = '#d6d3d1';
    ctx.beginPath();
    ctx.moveTo(cx, cy - ph * 0.55 - pHeight);
    ctx.lineTo(cx + pw * 0.55, cy - pHeight);
    ctx.lineTo(cx, cy + ph * 0.55 - pHeight);
    ctx.lineTo(cx - pw * 0.55, cy - pHeight);
    ctx.closePath();
    ctx.fill();
  };

  if (seg.hasCornerPostStart) {
    drawCornerPillar(x1, y1);
  }
  if (seg.hasCornerPostEnd) {
    drawCornerPillar(x2, y2);
  }

  ctx.restore();
}

/**
 * Tạo danh sách các bức tường đá bẻ góc Isometric (bảo vệ quanh Làng và các phế tích cổ trên bản đồ)
 * Có chừa lối đi rộng rãi ở chính giữa để người chơi di chuyển mượt mà.
 */
export function generateAngledStoneWalls(): AngledStoneWallSegment[] {
  return [
    // Cụm tường thành đá bẻ góc phía Tây Làng (Bẻ 2 góc chuẩn Isometric 2.5D)
    {
      id: 'wall_west_1',
      x1: -520,
      y1: -20,
      x2: -380,
      y2: 55,
      height: 18,
      thickness: 18,
      hasCornerPostStart: true,
      hasCornerPostEnd: true,
    },
    {
      id: 'wall_west_2',
      x1: -380,
      y1: 55,
      x2: -170,
      y2: 55,
      height: 18,
      thickness: 18,
      hasCornerPostStart: true,
      hasCornerPostEnd: true,
    },
    // Cụm tường thành đá bẻ góc phía Đông Làng (Đối xứng qua cổng chính giữa làng)
    {
      id: 'wall_east_1',
      x1: 170,
      y1: 55,
      x2: 380,
      y2: 55,
      height: 18,
      thickness: 18,
      hasCornerPostStart: true,
      hasCornerPostEnd: true,
    },
    {
      id: 'wall_east_2',
      x1: 380,
      y1: 55,
      x2: 520,
      y2: -20,
      height: 18,
      thickness: 18,
      hasCornerPostStart: true,
      hasCornerPostEnd: true,
    },
    // Cụm tường đá cổ chữ L bẻ góc ở khu phế tích Tây Bắc
    {
      id: 'wall_nw_1',
      x1: -440,
      y1: -360,
      x2: -310,
      y2: -430,
      height: 16,
      thickness: 16,
      hasCornerPostStart: true,
      hasCornerPostEnd: true,
    },
    {
      id: 'wall_nw_2',
      x1: -310,
      y1: -430,
      x2: -190,
      y2: -365,
      height: 16,
      thickness: 16,
      hasCornerPostStart: true,
      hasCornerPostEnd: true,
    },
    // Cụm tường đá cổ chữ L bẻ góc ở khu phế tích Đông Bắc
    {
      id: 'wall_ne_1',
      x1: 190,
      y1: -365,
      x2: 310,
      y2: -430,
      height: 16,
      thickness: 16,
      hasCornerPostStart: true,
      hasCornerPostEnd: true,
    },
    {
      id: 'wall_ne_2',
      x1: 310,
      y1: -430,
      x2: 440,
      y2: -360,
      height: 16,
      thickness: 16,
      hasCornerPostStart: true,
      hasCornerPostEnd: true,
    },
    // Tường chắn phế tích cổ ở vùng săn quái (Wilderness)
    {
      id: 'wall_wild_west_1',
      x1: -640,
      y1: 390,
      x2: -510,
      y2: 460,
      height: 17,
      thickness: 17,
      hasCornerPostStart: true,
      hasCornerPostEnd: true,
    },
    {
      id: 'wall_wild_west_2',
      x1: -510,
      y1: 460,
      x2: -390,
      y2: 395,
      height: 17,
      thickness: 17,
      hasCornerPostStart: true,
      hasCornerPostEnd: true,
    },
    {
      id: 'wall_wild_east_1',
      x1: 390,
      y1: 395,
      x2: 510,
      y2: 460,
      height: 17,
      thickness: 17,
      hasCornerPostStart: true,
      hasCornerPostEnd: true,
    },
    {
      id: 'wall_wild_east_2',
      x1: 510,
      y1: 460,
      x2: 640,
      y2: 390,
      height: 17,
      thickness: 17,
      hasCornerPostStart: true,
      hasCornerPostEnd: true,
    },
  ];
}

/**
 * Khởi tạo cố định các chi tiết đá rêu, khúc gỗ mục, khóm cỏ đá cuội phân bổ hài hòa khắp bản đồ
 * (Tránh khu vực trung tâm bệ kiếm 0, -45 để không vướng lối đi)
 */
export function generateMapProps(): MapPropItem[] {
  const props: MapPropItem[] = [];
  const allTypes: MapPropType[] = [
    'mossy_rock_cluster',
    'mossy_spire_rock',
    'mossy_tilted_slab',
    'mossy_split_monolith',
    'hollow_log',
    'hollow_mossy_log',
    'splintered_log',
    'mossy_splintered_log',
    'fern_pebble_tuft',
    'chiseled_stone_block',
    'round_boulder',
    'layered_rock_pile',
    'sharp_spire_pair',
  ];

  // Các vị trí điểm nhấn đẹp mắt gần làng và dọc đường đá cổ
  const curatedSpots: [MapPropType, number, number, number, boolean][] = [
    ['mossy_tilted_slab', -235, -110, 0.95, false],
    ['fern_pebble_tuft', -195, -92, 0.85, false],
    ['hollow_mossy_log', 240, -125, 0.95, true],
    ['fern_pebble_tuft', 285, -108, 0.85, true],
    ['mossy_rock_cluster', -145, 28, 0.9, false],
    ['mossy_rock_cluster', 145, 28, 0.9, true],
    ['chiseled_stone_block', -125, -175, 0.9, false],
    ['chiseled_stone_block', 125, -175, 0.9, true],
    ['layered_rock_pile', -470, -180, 1.0, false],
    ['mossy_split_monolith', 480, -195, 1.0, false],
    ['mossy_splintered_log', -340, 210, 0.95, false],
    ['fern_pebble_tuft', -300, 225, 0.85, true],
    ['hollow_log', 350, 240, 0.95, false],
    ['mossy_spire_rock', -260, 480, 1.0, false],
    ['mossy_tilted_slab', 290, 510, 1.0, true],
    ['sharp_spire_pair', -680, 160, 1.0, false],
    ['round_boulder', 660, 175, 0.95, false],
  ];

  curatedSpots.forEach(([type, x, y, scale, flipX], idx) => {
    const isWalkableSmall = type === 'fern_pebble_tuft' || type === 'splintered_log' || type === 'mossy_splintered_log';
    props.push({
      id: `curated_prop_${idx}`,
      type,
      x,
      y,
      scale,
      flipX,
      collisionRadius: isWalkableSmall ? 0 : 18 * scale,
    });
  });

  // Phân bổ tự nhiên thêm khắp bản đồ (Deterministic pseudo-random)
  const hash = (n: number) => {
    let x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let i = 0; i < 68; i++) {
    const rx = (hash(i * 3 + 1) * 2 - 1) * 980;
    const ry = (hash(i * 3 + 2) * 2 - 1) * 960;

    // Không đặt vật cản đè lên bệ kiếm trung tâm làng hoặc cổng chính
    if (Math.hypot(rx, ry + 30) < 165) continue;
    if (Math.abs(ry - 65) < 48 && Math.abs(rx) < 560) continue;

    const typeIdx = Math.floor(hash(i * 7 + 5) * allTypes.length);
    const type = allTypes[typeIdx];
    const scale = 0.82 + hash(i * 11 + 3) * 0.26;
    const flipX = hash(i * 13 + 9) > 0.5;
    const isSmallOrFlat =
      type === 'fern_pebble_tuft' ||
      type === 'splintered_log' ||
      type === 'mossy_splintered_log' ||
      type === 'hollow_log' ||
      type === 'hollow_mossy_log';

    props.push({
      id: `wild_prop_${i}`,
      type,
      x: Math.round(rx),
      y: Math.round(ry),
      scale,
      flipX,
      collisionRadius: isSmallOrFlat ? 0 : Math.round(16 * scale),
    });
  }

  // Sắp xếp theo trục Y tăng dần để vẽ chuẩn chiều sâu 2.5D
  props.sort((a, b) => a.y - b.y);
  return props;
}
