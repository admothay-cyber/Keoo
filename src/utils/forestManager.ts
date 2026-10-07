/**
 * ==============================================================================
 * MÔ-ĐUN QUẢN LÝ TƯỜNG SƯƠNG MÙ RANH GIỚI (PROGRESSIVE BOUNDARY FOG & MIST SYSTEM)
 * ==============================================================================
 * 1. Thay thế hoàn toàn viền ranh giới bằng lớp sương mù: Càng ra xa lớp sương càng dày đặc
 * 2. Bên trong bản đồ: Không gian thông thoáng, điểm xuyết vài dải sương mỏng là đà
 * 3. Tiếp cận ranh giới: Sương bắt đầu cuồn cuộn xuất hiện (Translucent Haze)
 * 4. Vượt qua ranh giới ra xa: Lớp sương mù dày đặc 100% (Dense Opaque Fog Veil) che phủ toàn bộ
 * 5. Các khối mây sương bồng bềnh chuyển động hữu cơ theo thời gian thực (Multi-layered Sinusoidal Drift)
 * 6. Khóa va chạm người chơi (Boundary Clamping) giữ vững tại ranh giới bản đồ
 */

// ==================== 1. ĐỊNH NGHĨA TYPES & CẤU HÌNH ====================

export interface ForestBoundConfig {
  forestBoundX: number; // Giới hạn trục X (1760px -> [-1760, 1760])
  forestBoundY: number; // Giới hạn trục Y (1740px -> [-1740, 1740])
}

export const DEFAULT_FOREST_BOUNDS: ForestBoundConfig = {
  forestBoundX: 1760,
  forestBoundY: 1740,
};

export interface FogPuff {
  offsetX: number;
  offsetY: number;
  radius: number;
  alpha: number;
  colorType: 'white' | 'cyan' | 'twilight' | 'silver';
  driftSpeedX: number;
  driftSpeedY: number;
  phase: number;
}

export interface FogCluster {
  id: string;
  baseX: number;
  baseY: number;
  y: number; // Tọa độ Y dùng cho Y-Sorting
  scale: number;
  depthLayer: 'inner' | 'border' | 'outer_thick';
  driftSeed: number;
  puffs: FogPuff[];
}

export interface GroundWisp {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  angle: number;
  alpha: number;
  speedX: number;
  speedY: number;
  color: string;
  pulsePhase: number;
}

export interface CameraViewport {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

// ==================== 2. SINH CÁC CỤM SƯƠNG MÙ ĐA TẦNG (MULTI-LAYER FOG GENERATOR) ====================

/**
 * Sinh danh sách các cụm sương mù đa tầng quanh 4 cạnh và 4 góc bản đồ
 * - Lớp Inner: Sương mỏng nhẹ ven trong rìa map (alpha 0.15 - 0.3)
 * - Lớp Border: Sương cuộn bồng bềnh ngay trên vạch ranh giới (alpha 0.45 - 0.7)
 * - Lớp Outer Thick: Sương mù cực dày, chắn hoàn toàn tầm nhìn bên ngoài (alpha 0.85 - 1.0)
 */
export function generateProgressiveFogClusters(edgeX = 1760, edgeY = 1740): FogCluster[] {
  const clusters: FogCluster[] = [];
  let clusterId = 0;

  const hash = (n: number) => {
    let x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  const createCluster = (
    cx: number,
    cy: number,
    seed: number,
    depth: 'inner' | 'border' | 'outer_thick'
  ): FogCluster => {
    const isOuter = depth === 'outer_thick';
    const isBorder = depth === 'border';

    const scale = isOuter ? 1.5 + hash(seed * 3) * 0.4 : isBorder ? 1.2 + hash(seed * 3) * 0.3 : 0.95 + hash(seed * 3) * 0.25;
    const puffCount = isOuter ? 6 + Math.floor(hash(seed * 5) * 3) : isBorder ? 5 : 4;
    const puffs: FogPuff[] = [];

    for (let p = 0; p < puffCount; p++) {
      const pSeed = seed * 43 + p * 19;
      const angle = hash(pSeed * 3) * Math.PI * 2;
      const dist = (hash(pSeed * 5) * 70 + 15) * scale;
      const r = (isOuter ? 160 + hash(pSeed * 7) * 110 : isBorder ? 130 + hash(pSeed * 7) * 80 : 95 + hash(pSeed * 7) * 60) * scale;

      const baseAlpha = isOuter
        ? 0.55 + hash(pSeed * 11) * 0.35
        : isBorder
        ? 0.32 + hash(pSeed * 11) * 0.25
        : 0.12 + hash(pSeed * 11) * 0.12;

      const colorVal = hash(pSeed * 13);
      const colorType: 'white' | 'cyan' | 'twilight' | 'silver' =
        colorVal < 0.35 ? 'white' : colorVal < 0.65 ? 'cyan' : colorVal < 0.85 ? 'silver' : 'twilight';

      puffs.push({
        offsetX: Math.cos(angle) * dist,
        offsetY: Math.sin(angle) * dist * 0.7,
        radius: Math.round(r),
        alpha: Number(baseAlpha.toFixed(3)),
        colorType,
        driftSpeedX: 0.0003 + hash(pSeed * 17) * 0.0005,
        driftSpeedY: 0.0002 + hash(pSeed * 19) * 0.0004,
        phase: hash(pSeed * 23) * Math.PI * 2,
      });
    }

    return {
      id: `fog_${clusterId++}`,
      baseX: cx + (hash(seed * 19) - 0.5) * 30,
      baseY: cy + (hash(seed * 23) - 0.5) * 30,
      y: cy,
      scale,
      depthLayer: depth,
      driftSeed: seed * 2.1,
      puffs,
    };
  };

  const R = 110;
  const innerX = edgeX - R;
  const innerY = edgeY - R;

  // Định nghĩa các dải khoảng cách (offset từ rìa)
  const layerOffsets: { depth: 'inner' | 'border' | 'outer_thick'; offset: number; step: number }[] = [
    { depth: 'inner', offset: -70, step: 95 },
    { depth: 'border', offset: 15, step: 75 },
    { depth: 'outer_thick', offset: 120, step: 80 },
    { depth: 'outer_thick', offset: 230, step: 95 },
  ];

  let s = 0;

  layerOffsets.forEach(({ depth, offset, step }) => {
    const bX = edgeX + offset;
    const bY = edgeY + offset;
    const inX = innerX + (offset > 0 ? offset * 0.7 : offset);
    const inY = innerY + (offset > 0 ? offset * 0.7 : offset);

    // 1. Cạnh Bắc (Top)
    for (let x = -inX; x <= inX; x += step) {
      const jy = (hash(s * 3) - 0.5) * 20;
      clusters.push(createCluster(x, -bY + jy, s++, depth));
    }

    // 2. Góc Đông Bắc
    for (let a = -Math.PI / 2; a <= 0; a += Math.PI / 5) {
      const rad = R + offset + (hash(s * 5) - 0.5) * 18;
      const cx = innerX + Math.cos(a) * rad;
      const cy = -innerY + Math.sin(a) * rad;
      clusters.push(createCluster(cx, cy, s++, depth));
    }

    // 3. Cạnh Đông (Right)
    for (let y = -inY; y <= inY; y += step) {
      const jx = (hash(s * 7) - 0.5) * 20;
      clusters.push(createCluster(bX + jx, y, s++, depth));
    }

    // 4. Góc Đông Nam
    for (let a = 0; a <= Math.PI / 2; a += Math.PI / 5) {
      const rad = R + offset + (hash(s * 9) - 0.5) * 18;
      const cx = innerX + Math.cos(a) * rad;
      const cy = innerY + Math.sin(a) * rad;
      clusters.push(createCluster(cx, cy, s++, depth));
    }

    // 5. Cạnh Nam (Bottom)
    for (let x = inX; x >= -inX; x -= step) {
      const jy = (hash(s * 11) - 0.5) * 20;
      clusters.push(createCluster(x, bY + jy, s++, depth));
    }

    // 6. Góc Tây Nam
    for (let a = Math.PI / 2; a <= Math.PI; a += Math.PI / 5) {
      const rad = R + offset + (hash(s * 13) - 0.5) * 18;
      const cx = -innerX + Math.cos(a) * rad;
      const cy = innerY + Math.sin(a) * rad;
      clusters.push(createCluster(cx, cy, s++, depth));
    }

    // 7. Cạnh Tây (Left)
    for (let y = inY; y >= -inY; y -= step) {
      const jx = (hash(s * 15) - 0.5) * 20;
      clusters.push(createCluster(-bX + jx, y, s++, depth));
    }

    // 8. Góc Tây Bắc
    for (let a = Math.PI; a <= Math.PI * 1.5; a += Math.PI / 5) {
      const rad = R + offset + (hash(s * 17) - 0.5) * 18;
      const cx = -innerX + Math.cos(a) * rad;
      const cy = -innerY + Math.sin(a) * rad;
      clusters.push(createCluster(cx, cy, s++, depth));
    }
  });

  clusters.sort((a, b) => a.y - b.y);
  return clusters;
}

export const PRECALCULATED_FOG_CLUSTERS: FogCluster[] = generateProgressiveFogClusters();

/**
 * Sinh danh sách các dải sương mù là đà trôi qua vùng chiến trận
 */
export function generateGroundMistWisps(): GroundWisp[] {
  const wisps: GroundWisp[] = [];
  const count = 36;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const dist = 280 + (i % 8) * 200;
    wisps.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist * 0.7,
      radiusX: 240 + (i % 4) * 80,
      radiusY: 110 + (i % 3) * 45,
      angle: ((i * 37) % 60 - 30) * (Math.PI / 180),
      alpha: 0.05 + (i % 3) * 0.025,
      speedX: 8 + (i % 4) * 4,
      speedY: 2 + (i % 3) * 1.5,
      color: i % 2 === 0 ? 'rgba(224, 242, 254, ' : 'rgba(240, 249, 255, ',
      pulsePhase: i * 0.8,
    });
  }
  return wisps;
}

export const PRECALCULATED_GROUND_WISPS: GroundWisp[] = generateGroundMistWisps();

// ==================== 3. VẼ TƯỜNG SƯƠNG MÙ TIỆM TIẾN (PROGRESSIVE FOG BARRIER) ====================

/**
 * Tính toán vùng nhìn thấy của Camera (Frustum Bounding Box)
 */
export function getCameraViewport(
  camera: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  zoom = 1.0,
  padding = 320
): CameraViewport {
  const halfW = canvasWidth / (2 * zoom) + padding;
  const halfH = canvasHeight / (2 * zoom) + padding;

  return {
    minX: camera.x - halfW,
    maxX: camera.x + halfW,
    minY: camera.y - halfH,
    maxY: camera.y + halfH,
    width: halfW * 2,
    height: halfH * 2,
  };
}

/**
 * Vẽ màn sương mù chuyển tiếp mềm mại (Progressive Perimeter Fog Gradient Mask)
 * Càng ra xa khỏi ranh giới map, độ mờ đục càng tăng dần lên 100%
 */
function renderProgressiveFogVeil(
  ctx: CanvasRenderingContext2D,
  viewport: CameraViewport,
  timeMs: number,
  bounds: ForestBoundConfig = DEFAULT_FOREST_BOUNDS
): void {
  const { forestBoundX, forestBoundY } = bounds;
  const innerX = forestBoundX - 140;
  const innerY = forestBoundY - 140;
  const outerX = forestBoundX + 180;
  const outerY = forestBoundY + 180;

  // Chỉ vẽ khi khung nhìn camera bao quát vùng rìa
  if (
    viewport.maxX < innerX &&
    viewport.minX > -innerX &&
    viewport.maxY < innerY &&
    viewport.minY > -innerY
  ) {
    return;
  }

  ctx.save();

  // Nhịp thở mờ ảo hữu cơ
  const breathe = Math.sin(timeMs * 0.0008) * 12;

  // 1. Dải sương mù phía Bắc (Top)
  if (viewport.minY < -innerY) {
    const topStart = -innerY + breathe;
    const topEnd = -outerY;
    const gradTop = ctx.createLinearGradient(0, topStart, 0, topEnd);
    gradTop.addColorStop(0, 'rgba(230, 243, 255, 0)');
    gradTop.addColorStop(0.35, 'rgba(215, 235, 255, 0.42)');
    gradTop.addColorStop(0.70, 'rgba(200, 225, 250, 0.82)');
    gradTop.addColorStop(1, 'rgba(185, 215, 245, 1.0)');

    ctx.fillStyle = gradTop;
    ctx.fillRect(viewport.minX, viewport.minY, viewport.width, Math.max(0, topStart - viewport.minY));
  }

  // 2. Dải sương mù phía Nam (Bottom)
  if (viewport.maxY > innerY) {
    const bottomStart = innerY - breathe;
    const bottomEnd = outerY;
    const gradBottom = ctx.createLinearGradient(0, bottomStart, 0, bottomEnd);
    gradBottom.addColorStop(0, 'rgba(230, 243, 255, 0)');
    gradBottom.addColorStop(0.35, 'rgba(215, 235, 255, 0.42)');
    gradBottom.addColorStop(0.70, 'rgba(200, 225, 250, 0.82)');
    gradBottom.addColorStop(1, 'rgba(185, 215, 245, 1.0)');

    ctx.fillStyle = gradBottom;
    ctx.fillRect(viewport.minX, bottomStart, viewport.width, Math.max(0, viewport.maxY - bottomStart));
  }

  // 3. Dải sương mù phía Tây (Left)
  if (viewport.minX < -innerX) {
    const leftStart = -innerX + breathe;
    const leftEnd = -outerX;
    const gradLeft = ctx.createLinearGradient(leftStart, 0, leftEnd, 0);
    gradLeft.addColorStop(0, 'rgba(230, 243, 255, 0)');
    gradLeft.addColorStop(0.35, 'rgba(215, 235, 255, 0.42)');
    gradLeft.addColorStop(0.70, 'rgba(200, 225, 250, 0.82)');
    gradLeft.addColorStop(1, 'rgba(185, 215, 245, 1.0)');

    ctx.fillStyle = gradLeft;
    ctx.fillRect(viewport.minX, viewport.minY, Math.max(0, leftStart - viewport.minX), viewport.height);
  }

  // 4. Dải sương mù phía Đông (Right)
  if (viewport.maxX > innerX) {
    const rightStart = innerX - breathe;
    const rightEnd = outerX;
    const gradRight = ctx.createLinearGradient(rightStart, 0, rightEnd, 0);
    gradRight.addColorStop(0, 'rgba(230, 243, 255, 0)');
    gradRight.addColorStop(0.35, 'rgba(215, 235, 255, 0.42)');
    gradRight.addColorStop(0.70, 'rgba(200, 225, 250, 0.82)');
    gradRight.addColorStop(1, 'rgba(185, 215, 245, 1.0)');

    ctx.fillStyle = gradRight;
    ctx.fillRect(rightStart, viewport.minY, Math.max(0, viewport.maxX - rightStart), viewport.height);
  }

  ctx.restore();
}

/**
 * Vẽ một cụm sương mù mờ ảo với chuyển động bồng bềnh
 */
function renderSingleFogCluster(
  ctx: CanvasRenderingContext2D,
  cluster: FogCluster,
  viewport: CameraViewport,
  timeMs: number
): void {
  const { baseX, baseY, scale, driftSeed, puffs, depthLayer } = cluster;

  const isOuter = depthLayer === 'outer_thick';
  const driftAmpX = isOuter ? 36 : 24;
  const driftAmpY = isOuter ? 20 : 14;

  const driftX = Math.sin(timeMs * 0.00055 + driftSeed) * driftAmpX;
  const driftY = Math.cos(timeMs * 0.00042 + driftSeed * 1.3) * driftAmpY;
  const cx = baseX + driftX;
  const cy = baseY + driftY;

  // Frustum Culling
  const maxR = 340 * scale;
  if (
    cx + maxR < viewport.minX ||
    cx - maxR > viewport.maxX ||
    cy + maxR < viewport.minY ||
    cy - maxR > viewport.maxY
  ) {
    return;
  }

  ctx.save();
  for (let i = 0; i < puffs.length; i++) {
    const p = puffs[i];
    const pDriftX = Math.sin(timeMs * p.driftSpeedX + p.phase) * 26;
    const pDriftY = Math.cos(timeMs * p.driftSpeedY + p.phase) * 16;
    const px = cx + p.offsetX + pDriftX;
    const py = cy + p.offsetY + pDriftY;

    // Nhịp thở phồng xẹp mờ ảo nhẹ nhàng
    const breathe = 1.0 + Math.sin(timeMs * 0.0011 + p.phase) * 0.14;
    const currentR = p.radius * breathe;
    const currentAlpha = Math.min(
      1.0,
      p.alpha * (0.88 + Math.sin(timeMs * 0.0008 + p.phase) * 0.16)
    );

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1.0, 0.68); // Phối cảnh 2.5D Isometric dẹt

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, currentR);
    if (p.colorType === 'cyan') {
      grad.addColorStop(0, `rgba(186, 230, 253, ${Math.min(1.0, currentAlpha * 1.15).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(224, 242, 254, ${(currentAlpha * 0.75).toFixed(3)})`);
      grad.addColorStop(0.80, `rgba(186, 230, 253, ${(currentAlpha * 0.28).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(186, 230, 253, 0)');
    } else if (p.colorType === 'silver') {
      grad.addColorStop(0, `rgba(241, 245, 249, ${Math.min(1.0, currentAlpha * 1.2).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(226, 232, 240, ${(currentAlpha * 0.8).toFixed(3)})`);
      grad.addColorStop(0.80, `rgba(203, 213, 225, ${(currentAlpha * 0.25).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(241, 245, 249, 0)');
    } else if (p.colorType === 'twilight') {
      grad.addColorStop(0, `rgba(238, 235, 255, ${Math.min(1.0, currentAlpha * 1.1).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(224, 235, 255, ${(currentAlpha * 0.7).toFixed(3)})`);
      grad.addColorStop(0.80, `rgba(200, 220, 255, ${(currentAlpha * 0.22).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(200, 220, 255, 0)');
    } else {
      grad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1.0, currentAlpha * 1.25).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(240, 249, 255, ${(currentAlpha * 0.72).toFixed(3)})`);
      grad.addColorStop(0.80, `rgba(224, 242, 254, ${(currentAlpha * 0.22).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, currentR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Vẽ các dải sương mù là đà lững lờ trôi qua chiến trận
 */
function renderGroundMistWisps(
  ctx: CanvasRenderingContext2D,
  viewport: CameraViewport,
  timeMs: number
): void {
  const timeSec = timeMs * 0.001;
  const bound = 1800;
  const periodX = bound * 2;

  ctx.save();
  for (let i = 0; i < PRECALCULATED_GROUND_WISPS.length; i++) {
    const w = PRECALCULATED_GROUND_WISPS[i];
    const rawX = w.x + timeSec * w.speedX;
    const curX = (((rawX + bound) % periodX) + periodX) % periodX - bound;
    const swayY = Math.sin(timeSec * 0.35 + w.pulsePhase) * 20;
    const curY = w.y + swayY;

    if (
      curX + w.radiusX < viewport.minX ||
      curX - w.radiusX > viewport.maxX ||
      curY + w.radiusY < viewport.minY ||
      curY - w.radiusY > viewport.maxY
    ) {
      continue;
    }

    const pulse = 1.0 + Math.sin(timeSec * 0.6 + w.pulsePhase) * 0.15;
    const curAlpha = w.alpha * (0.8 + Math.sin(timeSec * 0.4 + w.pulsePhase) * 0.2);

    ctx.save();
    ctx.translate(curX, curY);
    ctx.rotate(w.angle);
    ctx.scale(1.0, w.radiusY / w.radiusX);

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w.radiusX * pulse);
    grad.addColorStop(0, `${w.color}${curAlpha.toFixed(3)})`);
    grad.addColorStop(0.5, `${w.color}${(curAlpha * 0.5).toFixed(3)})`);
    grad.addColorStop(1, `${w.color}0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, w.radiusX * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Hàm vẽ tường sương mù tiệm tiến (drawMistLayer / drawFogLayer)
 * Càng ra xa ranh giới, lớp sương càng dày đặc
 * @param ctx Ngữ cảnh Canvas 2D
 * @param camera Tọa độ tâm camera
 * @param playerY Tọa độ Y nhân vật
 * @param pass 'back' (vẽ sau người chơi), 'front' (vẽ PHỦ LÊN người chơi), 'all' (vẽ toàn bộ)
 */
export function drawMistLayer(
  ctx: CanvasRenderingContext2D,
  camera: { x: number; y: number },
  playerY: number,
  pass: 'back' | 'front' | 'all' = 'front',
  clusters: FogCluster[] = PRECALCULATED_FOG_CLUSTERS
): void {
  const canvas = ctx.canvas;
  const viewport = getCameraViewport(camera, canvas.width, canvas.height, 1.0, 320);
  const timeMs = performance.now();

  // Vẽ các cụm sương mù cuộn trôi
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    const isBehindPlayer = c.y <= playerY - 10;

    if (pass === 'all') {
      renderSingleFogCluster(ctx, c, viewport, timeMs);
    } else if (pass === 'back' && isBehindPlayer) {
      renderSingleFogCluster(ctx, c, viewport, timeMs);
    } else if (pass === 'front' && !isBehindPlayer) {
      // Sương mù bao phủ nhẹ nhàng lên người chơi tạo chiều sâu không gian
      renderSingleFogCluster(ctx, c, viewport, timeMs);
    }
  }

  // Ở pass 'front', vẽ thêm dải gradient sương dày tiệm tiến và sương là đà mặt đất
  if (pass === 'front' || pass === 'all') {
    renderProgressiveFogVeil(ctx, viewport, timeMs);
    renderGroundMistWisps(ctx, viewport, timeMs);
  }
}

/**
 * Alias tương thích ngược
 */
export const drawCanopyLayer = drawMistLayer;
export const drawFogLayer = drawMistLayer;

// ==================== 4. HỘP VA CHẠM RANH GIỚI BẢN ĐỒ ====================

/**
 * Khóa vị trí nhân vật trong ranh giới bản đồ (Player Boundary Clamping)
 */
export function clampPlayerPosition(
  p: { x: number; y: number; vx?: number; vy?: number; radius?: number },
  bounds: ForestBoundConfig = DEFAULT_FOREST_BOUNDS
): { collidedX: boolean; collidedY: boolean } {
  const { forestBoundX, forestBoundY } = bounds;
  let collidedX = false;
  let collidedY = false;

  if (p.y <= -forestBoundY) {
    p.y = -forestBoundY;
    if (p.vy !== undefined && p.vy < 0) p.vy = 0;
    collidedY = true;
  } else if (p.y >= forestBoundY) {
    p.y = forestBoundY;
    if (p.vy !== undefined && p.vy > 0) p.vy = 0;
    collidedY = true;
  }

  if (p.x <= -forestBoundX) {
    p.x = -forestBoundX;
    if (p.vx !== undefined && p.vx < 0) p.vx = 0;
    collidedX = true;
  } else if (p.x >= forestBoundX) {
    p.x = forestBoundX;
    if (p.vx !== undefined && p.vx > 0) p.vx = 0;
    collidedX = true;
  }

  return { collidedX, collidedY };
}
