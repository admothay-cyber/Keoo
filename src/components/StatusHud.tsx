import React from 'react';

export function formatCompactNumber(num: number): string {
  if (!Number.isFinite(num) || isNaN(num)) return '0';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000_000_000) {
    const val = abs / 1_000_000_000_000;
    return `${sign}${val >= 100 ? Math.round(val) : val.toFixed(1).replace(/\.0$/, '')}T`;
  }
  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    return `${sign}${val >= 100 ? Math.round(val) : val.toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    return `${sign}${val >= 100 ? Math.round(val) : val.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 1_000) {
    const val = abs / 1_000;
    return `${sign}${val >= 100 ? Math.round(val) : val.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `${sign}${Math.round(abs).toLocaleString()}`;
}

interface StatusHudProps {
  playerName?: string;
  classType?: string;
  level: number;
  reincarnations?: number;
  currentHp: number;
  maxHp: number;
  shieldHp?: number;
  currentMana: number;
  maxMana: number;
  currentExp?: number;
  maxExp?: number;
  expPercent?: number;
  gold?: number;
  redCurrency?: number;
  onLevelClick?: () => void;
}

const CLASS_VIETNAMESE: Record<string, string> = {
  Fighter: 'ĐẤU SĨ',
  Tank: 'ĐỠ ĐÒN',
  Mage: 'PHÁP SƯ',
  Assassin: 'SÁT THỦ',
  Marksman: 'XẠ THỦ',
};

export const StatusHud: React.FC<StatusHudProps> = React.memo(({
  playerName = 'KAELEN',
  classType = 'Fighter',
  level = 42,
  reincarnations = 0,
  currentHp,
  maxHp,
  shieldHp = 0,
  currentMana,
  maxMana,
  currentExp,
  maxExp,
  expPercent,
  gold = 0,
  redCurrency = 0,
  onLevelClick,
}) => {
  const activeShield = Math.max(0, shieldHp);
  const effectiveMaxHp = Math.max(1, maxHp, currentHp + activeShield);
  const hpPercent = Math.max(0, Math.min(1, currentHp / effectiveMaxHp));
  const shieldPercent = Math.max(0, Math.min(1 - hpPercent, activeShield / effectiveMaxHp));
  const manaPercent = Math.max(0, Math.min(1, currentMana / Math.max(1, maxMana)));

  const classDisplay = (CLASS_VIETNAMESE[classType] || classType).toUpperCase();
  const nameDisplay = playerName.toUpperCase();

  const hudXpColor =
    reincarnations === 1
      ? '#06b6d4'
      : reincarnations >= 2
      ? '#facc15'
      : '#38bdf8';

  const hudLevelTextColor =
    reincarnations === 1
      ? '#67e8f9'
      : reincarnations >= 2
      ? '#facc15'
      : '#ffffff';

  // EXP / LV ring progress fill arc calculation
  const fillPercent =
    expPercent !== undefined
      ? Math.max(0, Math.min(1, expPercent))
      : currentExp !== undefined && maxExp !== undefined && maxExp > 0
      ? Math.max(0, Math.min(1, currentExp / maxExp))
      : 0;

  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;

  const handleTouchLevelClick = (e: React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    onLevelClick?.();
  };

  return (
    <div className="relative select-none drop-shadow-[0_6px_20px_rgba(0,0,0,0.9)]">
      {/* Nút bấm phủ trực tiếp lên Huy hiệu Level tròn phóng to */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onLevelClick?.();
        }}
        onTouchEnd={handleTouchLevelClick}
        className="absolute top-0 left-0 w-24 h-24 rounded-full cursor-pointer pointer-events-auto bg-transparent active:scale-95 transition-all focus:outline-none z-20"
        title="Nhấn để mở Bảng Trạng Thái, Chuyển Sinh & Cài Đặt (LV)"
        aria-label="Bảng Trạng Thái Nhân Vật"
      />

      {/* SVG pixel-exact HUD layout (Mỏng hơn, thanh thoát hơn, LV phóng to, tích hợp thẻ mini Tiền & Kim Cương) */}
      <svg
        viewBox="0 0 460 88"
        className="w-[250px] sm:w-[350px] md:w-[440px] h-auto overflow-visible"
        style={{ shapeRendering: 'geometricPrecision' }}
      >
        <defs>
          <linearGradient id="hud-hp-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#450a0a" />
            <stop offset="40%" stopColor="#7f1d1d" />
            <stop offset="85%" stopColor="#991b1b" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>
          <linearGradient id="hud-mp-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0b1e4f" />
            <stop offset="40%" stopColor="#172554" />
            <stop offset="85%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
          <linearGradient id="hud-circle-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#09090b" />
          </linearGradient>
          <linearGradient id="hud-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="hud-ruby-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="50%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          
          <pattern id="hud-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
          </pattern>

          {/* Clip Paths to accurately mask filled bars inside the thinner slanted tracks */}
          <clipPath id="hud-hp-clip">
            <polygon points="98,27 435,27 442,33 442,42 103,42 98,37" />
          </clipPath>

          <clipPath id="hud-mp-clip">
            <polygon points="98,47 435,47 442,53 442,62 103,62 98,57" />
          </clipPath>
        </defs>

        <g fontFamily="Inter, Rajdhani, system-ui, sans-serif">
          {/* ================= HÀNG 1: THẺ TÊN + THẺ MINI VÀNG + THẺ MINI KIM CƯƠNG ================= */}
          {/* 1. Thẻ Tên Nhân Vật */}
          <g id="name-tag-group">
            <polygon points="98,6 236,6 242,12 242,22 102,22 98,18"
                     fill="rgba(15, 23, 42, 0.92)"
                     stroke="rgba(56, 189, 248, 0.45)"
                     strokeWidth="1" />
            <polygon points="98,6 102,6 98,10" fill="#38bdf8" />
            
            <text x="108" y="17.5" fill="#f8fafc" fontSize="9" fontWeight="800" letterSpacing="0.6">
              {nameDisplay} <tspan fill="#94a3b8" fontWeight="600" fontSize="8"> • {classDisplay}</tspan>
            </text>
          </g>

          {/* 2. Thẻ Mini Tiền Vàng (Đặt ngay cạnh thẻ tên) */}
          <g id="mini-gold-badge" transform="translate(248, 6)">
            <polygon points="0,0 88,0 93,5 93,16 4,16 0,12"
                     fill="rgba(15, 23, 42, 0.92)"
                     stroke="rgba(245, 158, 11, 0.6)"
                     strokeWidth="1" />
            {/* Đồng vàng mini */}
            <circle cx="9" cy="8" r="4.5" fill="url(#hud-gold-grad)" stroke="#fde047" strokeWidth="0.7" />
            <text x="18" y="11.5" fill="#fde047" fontSize="8.5" fontWeight="900" fontFamily="monospace">
              {formatCompactNumber(gold)}
            </text>
          </g>

          {/* 3. Thẻ Mini Kim Cương / Tiền Đỏ (Đặt cạnh thẻ vàng) */}
          <g id="mini-ruby-badge" transform="translate(346, 6)">
            <polygon points="0,0 84,0 89,5 89,16 4,16 0,12"
                     fill="rgba(15, 23, 42, 0.92)"
                     stroke="rgba(239, 68, 68, 0.6)"
                     strokeWidth="1" />
            {/* Kim cương mini */}
            <polygon points="9,4 12.5,8 9,12 5.5,8" fill="url(#hud-ruby-grad)" stroke="#fca5a5" strokeWidth="0.7" />
            <text x="17" y="11.5" fill="#f87171" fontSize="8.5" fontWeight="900" fontFamily="monospace">
              {formatCompactNumber(redCurrency)}
            </text>
          </g>

          {/* ================= HÀNG 2: THANH MÁU (HP BAR - MỎNG & GỌN GÀNG) ================= */}
          <g id="hp-bar-group">
            {/* Background Track */}
            <polygon points="98,27 435,27 442,33 442,42 103,42 98,37"
                     fill="#0f172a" stroke="#1e293b" strokeWidth="1.2" />
            
            <polygon points="98,27 435,27 442,33 442,42 103,42 98,37"
                     fill="url(#hud-stripes)" />
            
            {/* Dynamic Filled HP */}
            {hpPercent > 0 && (
              <rect x="98" y="27" width={344 * hpPercent} height="15"
                    fill="url(#hud-hp-grad)" clipPath="url(#hud-hp-clip)" />
            )}

            {/* Shield Over HP */}
            {activeShield > 0 && (
              <rect x={98 + 344 * hpPercent} y="27" width={Math.max(4, 344 * shieldPercent)} height="15"
                    fill="#ffffff" opacity="0.8" clipPath="url(#hud-hp-clip)" />
            )}

            {/* Vạch chia nhẹ */}
            <line x1="184" y1="27" x2="184" y2="42" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
            <line x1="270" y1="27" x2="270" y2="42" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
            <line x1="356" y1="27" x2="356" y2="42" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />

            {/* Outline */}
            <polygon points="98,27 435,27 442,33 442,42 103,42 98,37"
                     fill="none" stroke="rgba(185, 28, 28, 0.5)" strokeWidth="1" />

            {/* Label & Single Number: Chỉ hiển thị HP và chỉ số N */}
            <text x="105" y="38" fill="#f8fafc" fontSize="8.5" fontWeight="900" letterSpacing="0.8">HP</text>
            <text x="433" y="38" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="end" fontFamily="monospace">
              {formatCompactNumber(currentHp)}
              {activeShield > 0 ? ` (+${formatCompactNumber(activeShield)})` : ''}
            </text>
          </g>

          {/* ================= HÀNG 3: THANH MANA (MP BAR - MỎNG & GỌN GÀNG) ================= */}
          <g id="mp-bar-group">
            {/* Background Track */}
            <polygon points="98,47 435,47 442,53 442,62 103,62 98,57"
                     fill="#0f172a" stroke="#1e293b" strokeWidth="1.2" />
            
            <polygon points="98,47 435,47 442,53 442,62 103,62 98,57"
                     fill="url(#hud-stripes)" />
            
            {/* Dynamic Filled MP */}
            {manaPercent > 0 && (
              <rect x="98" y="47" width={344 * manaPercent} height="15"
                    fill="url(#hud-mp-grad)" clipPath="url(#hud-mp-clip)" />
            )}

            {/* Vạch chia nhẹ */}
            <line x1="184" y1="47" x2="184" y2="62" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
            <line x1="270" y1="47" x2="270" y2="62" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
            <line x1="356" y1="47" x2="356" y2="62" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />

            {/* Outline */}
            <polygon points="98,47 435,47 442,53 442,62 103,62 98,57"
                     fill="none" stroke="rgba(37, 99, 235, 0.5)" strokeWidth="1" />

            {/* Label & Single Number: Chỉ hiển thị MP và chỉ số N */}
            <text x="105" y="58" fill="#f8fafc" fontSize="8.5" fontWeight="900" letterSpacing="0.8">MP</text>
            <text x="433" y="58" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="end" fontFamily="monospace">
              {formatCompactNumber(currentMana)}
            </text>
          </g>

          {/* ================= HÌNH TRÒN LV PHÓNG TO (CIRCULAR LEVEL BADGE) ================= */}
          <g id="level-badge-group">
            {/* XP Ring Track */}
            <circle cx="48" cy="44" r={ringRadius}
                    fill="none" stroke="#1e293b" strokeWidth="5" strokeDasharray="6 3" />

            {/* XP Ring Progress Fill Arc */}
            <circle cx="48" cy="44" r={ringRadius}
                    fill="none" stroke={hudXpColor} strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${ringCircumference} ${ringCircumference}`}
                    strokeDashoffset={ringCircumference * (1 - fillPercent)}
                    transform="rotate(-90 48 44)"
                    className="transition-all duration-300 ease-out"
                    style={{ filter: `drop-shadow(0 0 6px ${hudXpColor})` }} />

            {/* Inner Level Circle Frame (Phóng to bề thế) */}
            <circle cx="48" cy="44" r="37"
                    fill="url(#hud-circle-bg)" stroke="#334155" strokeWidth="2.5" />
            <circle cx="48" cy="44" r="33"
                    fill="none" stroke={hudXpColor} strokeWidth="1.2" opacity="0.65" />

            {/* Level Label & Number */}
            <text x="48" y="32" textAnchor="middle" fill="#94a3b8" fontSize="8.5" fontWeight="800" letterSpacing="1.2">LV</text>
            <text x="48" y="52" textAnchor="middle" fill={hudLevelTextColor} fontSize="20" fontWeight="900" fontFamily="Rajdhani, Inter, sans-serif">
              {level}
            </text>
            <text x="48" y="63" textAnchor="middle" fill="#38bdf8" fontSize="7.5" fontWeight="800" fontFamily="monospace">
              {currentExp !== undefined && maxExp !== undefined ? `${currentExp}/${maxExp}` : `${Math.round(fillPercent * 100)}%`}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
});
