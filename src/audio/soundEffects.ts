/**
 * Procedural Web Audio Sound Synthesizer for Top-Down ARPG
 * Provides crisp 8-bit & 16-bit sound effects with zero external audio assets.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  public volume: number = 0.24;
  private lastHitSoundTime: number = 0;
  private lastExplosionSoundTime: number = 0;
  private lastHeavySlashSoundTime: number = 0;
  private basicAttackBuffers: AudioBuffer[] = [];
  private basicAttackLoading: boolean = false;
  private lastBasicAttackIdx: number = -1;
  private tankSlamBuffer: AudioBuffer | null = null;
  private tankSlamLoading: boolean = false;
  private footstepBuffers: AudioBuffer[] = [];
  private footstepLoading: boolean = false;
  private lastFootstepIdx: number = -1;
  private chargedSkillBuffer: AudioBuffer | null = null;
  private chargedSkillLoading: boolean = false;

  // Weather Ambient & SFX (Mưa, Gió, Sấm sét ngẫu nhiên)
  private rainBuffer: AudioBuffer | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private isRainPlaying: boolean = false;
  private rainLoading: boolean = false;

  private windBuffers: AudioBuffer[] = [];
  private windSource: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private isWindPlaying: boolean = false;
  private windLoading: boolean = false;

  private thunderBuffers: AudioBuffer[] = [];
  private thunderLoading: boolean = false;
  private lastThunderIdx: number = -1;

  constructor() {
    if (typeof window !== 'undefined') {
      this.preloadBasicAttackSounds();
      this.preloadTankSlamSound();
      this.preloadFootstepSounds();
      this.preloadChargedSkillSound();
      this.preloadWeatherSounds();
    }
  }

  private initContext() {
    if (typeof window === 'undefined') return;

    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.basicAttackBuffers.length === 0 && !this.basicAttackLoading) {
        this.preloadBasicAttackSounds();
      }
      if (!this.tankSlamBuffer && !this.tankSlamLoading) {
        this.preloadTankSlamSound();
      }
      if (this.footstepBuffers.length === 0 && !this.footstepLoading) {
        this.preloadFootstepSounds();
      }
      if (!this.chargedSkillBuffer && !this.chargedSkillLoading) {
        this.preloadChargedSkillSound();
      }
      if (!this.rainBuffer && !this.rainLoading) {
        this.preloadWeatherSounds();
      }
    } catch (err) {
      console.warn('Audio init failed:', err);
    }
  }

  private async preloadChargedSkillSound() {
    if (this.chargedSkillLoading || typeof window === 'undefined') return;
    this.chargedSkillLoading = true;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      this.chargedSkillLoading = false;
      return;
    }
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }

    const chargedUrls = [
      '/audio/charged_skill.mp3',
      'https://www.image2url.com/r2/default/audio/1791063639639-b5680733-a47d-40af-89fd-ca03f4e1bb50.mp3',
    ];

    for (const url of chargedUrls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        const fullBuffer = await this.ctx.decodeAudioData(arr.slice(0));
        // Nếu tải từ URL gốc dài ~8s, cắt ngay từ 0.70s để tiếng vù diễn ra ngay lập tức không có độ trễ
        if (fullBuffer.duration > 3.0) {
          const sr = fullBuffer.sampleRate;
          const channels = fullBuffer.numberOfChannels;
          const startSample = Math.max(0, Math.floor(0.70 * sr));
          const endSample = Math.min(fullBuffer.length, Math.floor(1.55 * sr));
          const frameCount = endSample - startSample;
          if (frameCount > 0) {
            const subBuf = this.ctx.createBuffer(channels, frameCount, sr);
            for (let ch = 0; ch < channels; ch++) {
              const channelData = fullBuffer.getChannelData(ch).subarray(startSample, endSample);
              subBuf.copyToChannel(channelData, ch, 0);
            }
            this.chargedSkillBuffer = subBuf;
          } else {
            this.chargedSkillBuffer = fullBuffer;
          }
        } else {
          this.chargedSkillBuffer = fullBuffer;
        }
        break;
      } catch {
        // Ignore and try fallback URL
      }
    }
    this.chargedSkillLoading = false;
  }

  // Phát tiếng chiêu gồng của Đấu Sĩ và Sát Thủ (Chỉ phát từ mp3 đã thêm)
  playChargedSkill() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    if (this.chargedSkillBuffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = this.chargedSkillBuffer;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(Math.min(0.75, this.volume * 1.15), this.ctx.currentTime);

      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(0);
      return;
    }
  }

  private async preloadFootstepSounds() {
    if (this.footstepLoading || typeof window === 'undefined') return;
    this.footstepLoading = true;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      this.footstepLoading = false;
      return;
    }
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }

    // 1. Nạp 14 bản âm thanh bước chân đã được tách sẵn trong /audio/step_1.mp3 .. step_14.mp3
    const splitStepUrls = Array.from({ length: 14 }, (_, i) => `/audio/step_${i + 1}.mp3`);
    const loadedSteps: AudioBuffer[] = [];

    for (const url of splitStepUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const arr = await res.arrayBuffer();
          const decoded = await this.ctx.decodeAudioData(arr.slice(0));
          loadedSteps.push(decoded);
        }
      } catch {
        // Fallback bên dưới nếu không tải được từng file lẻ
      }
    }

    if (loadedSteps.length > 0) {
      this.footstepBuffers = loadedSteps;
      this.footstepLoading = false;
      return;
    }

    // 2. Fallback: Tải trực tiếp từ file gốc và tự động cắt thành 14 khoảng âm thanh bước chân
    const masterUrls = [
      '/audio/footsteps_master.mp3',
      'https://www.image2url.com/r2/default/audio/1791063426470-4f8791ac-773d-4197-81ba-dc56f0a09b44.mp3',
    ];

    const stepSlices: [number, number][] = [
      [0.17, 0.39],
      [0.94, 1.20],
      [1.84, 2.12],
      [2.77, 3.08],
      [3.52, 3.73],
      [4.45, 4.80],
      [5.33, 5.52],
      [6.13, 6.34],
      [6.97, 7.14],
      [7.72, 7.93],
      [8.48, 8.68],
      [9.20, 9.43],
      [9.92, 10.16],
      [10.87, 11.07],
    ];

    for (const masterUrl of masterUrls) {
      try {
        const res = await fetch(masterUrl);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        const fullBuffer = await this.ctx.decodeAudioData(arr.slice(0));
        const sr = fullBuffer.sampleRate;
        const channels = fullBuffer.numberOfChannels;

        for (const [startSec, endSec] of stepSlices) {
          const startSample = Math.max(0, Math.floor(startSec * sr));
          const endSample = Math.min(fullBuffer.length, Math.floor(endSec * sr));
          const frameCount = endSample - startSample;
          if (frameCount > 0) {
            const subBuf = this.ctx.createBuffer(channels, frameCount, sr);
            for (let ch = 0; ch < channels; ch++) {
              const channelData = fullBuffer.getChannelData(ch).subarray(startSample, endSample);
              subBuf.copyToChannel(channelData, ch, 0);
            }
            loadedSteps.push(subBuf);
          }
        }
        if (loadedSteps.length > 0) {
          this.footstepBuffers = loadedSteps;
          break;
        }
      } catch {
        // Ignore and try next URL
      }
    }
    this.footstepLoading = false;
  }

  /**
   * Phát tiếng bước chân đi bộ / chạy khớp nhịp với từng bước chân trái - phải
   * @param isRunning true nếu nhân vật đang chạy nhanh / lướt, false nếu đi bộ
   * @param footSide 'left' | 'right' tạo độ trầm bổng tự nhiên giữa chân trái và chân phải
   */
  playFootstep(isRunning: boolean = false, footSide: 'left' | 'right' = 'left') {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx || this.footstepBuffers.length === 0) return;

    let idx = Math.floor(Math.random() * this.footstepBuffers.length);
    if (this.footstepBuffers.length > 1 && idx === this.lastFootstepIdx) {
      idx = (idx + 1 + Math.floor(Math.random() * (this.footstepBuffers.length - 1))) % this.footstepBuffers.length;
    }
    this.lastFootstepIdx = idx;

    const source = this.ctx.createBufferSource();
    source.buffer = this.footstepBuffers[idx];

    // Chân trái và chân phải có độ trầm bổng hơi khác nhau một chút, khi chạy nhanh tốc độ phát dứt khoát hơn
    const sidePitchOffset = footSide === 'left' ? -0.03 : 0.03;
    const baseRate = isRunning ? 1.12 : 0.96;
    source.playbackRate.value = baseRate + sidePitchOffset + (Math.random() - 0.5) * 0.06;

    const gain = this.ctx.createGain();
    const stepVol = isRunning ? this.volume * 1.15 : this.volume * 0.85;
    gain.gain.setValueAtTime(Math.min(0.85, stepVol), this.ctx.currentTime);

    source.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(0);
  }

  private async preloadTankSlamSound() {
    if (this.tankSlamLoading || typeof window === 'undefined') return;
    this.tankSlamLoading = true;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      this.tankSlamLoading = false;
      return;
    }
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }

    const slamUrls = [
      '/audio/tank_slam.mp3',
      'https://www.image2url.com/r2/default/audio/1791062938247-1144c698-5fec-4a1b-8b0a-445918c18a2a.mp3',
    ];

    for (const url of slamUrls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        const decoded = await this.ctx.decodeAudioData(arr.slice(0));
        this.tankSlamBuffer = decoded;
        break;
      } catch {
        // Ignore and try fallback URL
      }
    }
    this.tankSlamLoading = false;
  }

  // Phát âm thanh đập đất của Đỡ Đòn (Chỉ phát từ mp3 đã thêm)
  playTankSlam() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    if (this.tankSlamBuffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = this.tankSlamBuffer;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(Math.min(1.0, this.volume * 0.90), this.ctx.currentTime);

      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(0);
      return;
    }
  }

  private async preloadBasicAttackSounds() {
    if (this.basicAttackLoading || typeof window === 'undefined') return;
    this.basicAttackLoading = true;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      this.basicAttackLoading = false;
      return;
    }
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }

    // 1. Nạp 5 bản âm thanh đánh thường đã được tách sẵn trong /audio/attack_1.mp3 .. attack_5.mp3
    const splitUrls = [
      '/audio/attack_1.mp3',
      '/audio/attack_2.mp3',
      '/audio/attack_3.mp3',
      '/audio/attack_4.mp3',
      '/audio/attack_5.mp3',
    ];

    const loadedBuffers: AudioBuffer[] = [];
    for (const url of splitUrls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const arr = await res.arrayBuffer();
          const decoded = await this.ctx.decodeAudioData(arr.slice(0));
          loadedBuffers.push(decoded);
        }
      } catch {
        // Fallback bên dưới nếu không tải được từng file lẻ
      }
    }

    if (loadedBuffers.length > 0) {
      this.basicAttackBuffers = loadedBuffers;
      this.basicAttackLoading = false;
      return;
    }

    // 2. Fallback: Tải trực tiếp từ file gốc và tự động cắt thành 5 đoạn âm thanh đánh thường riêng biệt
    const masterUrls = [
      '/audio/basic_attack.mp3',
      'https://www.image2url.com/r2/default/audio/1791062656806-70a4a21e-366b-4b76-81c6-ca2a14c36ff1.mp3',
    ];

    for (const masterUrl of masterUrls) {
      try {
        const res = await fetch(masterUrl);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        const fullBuffer = await this.ctx.decodeAudioData(arr.slice(0));
        const slices: [number, number][] = [
          [0.36, 0.78],
          [1.05, 1.56],
          [1.93, 2.45],
          [2.82, 3.25],
          [3.82, 4.30],
        ];
        const sr = fullBuffer.sampleRate;
        const channels = fullBuffer.numberOfChannels;

        for (const [startSec, endSec] of slices) {
          const startSample = Math.max(0, Math.floor(startSec * sr));
          const endSample = Math.min(fullBuffer.length, Math.floor(endSec * sr));
          const frameCount = endSample - startSample;
          if (frameCount > 0) {
            const subBuf = this.ctx.createBuffer(channels, frameCount, sr);
            for (let ch = 0; ch < channels; ch++) {
              const channelData = fullBuffer.getChannelData(ch).subarray(startSample, endSample);
              subBuf.copyToChannel(channelData, ch, 0);
            }
            loadedBuffers.push(subBuf);
          }
        }
        if (loadedBuffers.length > 0) {
          this.basicAttackBuffers = loadedBuffers;
          break;
        }
      } catch {
        // Ignore and try next URL
      }
    }
    this.basicAttackLoading = false;
  }

  // Phát ngẫu nhiên 1 trong 5 bản âm thanh đánh thường đã tách (mỗi lần đánh ra 1 tiếng ngẫu nhiên khác nhau)
  playBasicAttack() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    if (this.basicAttackBuffers.length > 0) {
      let idx = Math.floor(Math.random() * this.basicAttackBuffers.length);
      if (this.basicAttackBuffers.length > 1 && idx === this.lastBasicAttackIdx) {
        idx = (idx + 1 + Math.floor(Math.random() * (this.basicAttackBuffers.length - 1))) % this.basicAttackBuffers.length;
      }
      this.lastBasicAttackIdx = idx;

      const source = this.ctx.createBufferSource();
      source.buffer = this.basicAttackBuffers[idx];
      // Biến thiên nhẹ cao độ (0.94 - 1.06) để mỗi đòn đánh càng thêm sống động và tự nhiên
      source.playbackRate.value = 0.94 + Math.random() * 0.12;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(Math.min(0.75, this.volume * 1.1), this.ctx.currentTime);

      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(0);
      return;
    }

    // Không dùng âm thanh tổng hợp dư thừa
  }

  playSlash() { return; }
  playShoot() { return; }
  playFireball() { return; }
  playExplosion() { return; }
  playCoin() { return; }
  playHit(_isCrit?: boolean) { return; }
  playDash() { return; }
  playShield() { return; }
  playNoMana() { return; }
  playHeal() { return; }
  playFanfare() { return; }
  playPurchase() { return; }
  playChargeFull() { return; }
  playHeavySlash() { return; }
  playLevelUp() { return; }
  playClick() { return; }

  // Preload toàn bộ âm thanh thời tiết (Mưa, Gió, Sấm Sét ngẫu nhiên)
  private async preloadWeatherSounds() {
    if (this.rainLoading || typeof window === 'undefined') return;
    this.rainLoading = true;
    this.windLoading = true;
    this.thunderLoading = true;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      this.rainLoading = false;
      this.windLoading = false;
      this.thunderLoading = false;
      return;
    }
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }

    // 1. Tải âm thanh mưa lưu trực tiếp trong game (không tải qua web)
    try {
      const res = await fetch('/audio/rain.mp3');
      if (res.ok) {
        const arr = await res.arrayBuffer();
        this.rainBuffer = await this.ctx.decodeAudioData(arr.slice(0));
      }
    } catch {
      // Fallback
    }
    this.rainLoading = false;

    // 2. Tải âm thanh gió khi mưa (Wind loop / ambient)
    const windUrlPairs = [
      ['/audio/wind_1.mp3', 'https://www.image2url.com/r2/default/audio/1791138438121-8e14192b-583d-4b2f-995a-19a63c1ad512.mp3'],
      ['/audio/wind_2.mp3', 'https://www.image2url.com/r2/default/audio/1791138477884-64c086bb-9c04-41dc-bf36-6e34707a34a6.mp3'],
    ];
    const loadedWinds: AudioBuffer[] = [];
    for (const urls of windUrlPairs) {
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const arr = await res.arrayBuffer();
            const decoded = await this.ctx.decodeAudioData(arr.slice(0));
            loadedWinds.push(decoded);
            break;
          }
        } catch {
          // Fallback next URL
        }
      }
    }
    this.windBuffers = loadedWinds;
    this.windLoading = false;

    // 3. Tải luân phiên 3 âm thanh sấm sét mới được lưu trong thư mục cục bộ (không dùng trực tiếp web)
    const localThunderPaths = [
      '/audio/thunder_1.mp3',
      '/audio/thunder_2.mp3',
      '/audio/thunder_3.mp3',
    ];
    const loadedThunders: AudioBuffer[] = [];
    for (const path of localThunderPaths) {
      try {
        const res = await fetch(path);
        if (res.ok) {
          const arr = await res.arrayBuffer();
          const decoded = await this.ctx.decodeAudioData(arr.slice(0));
          loadedThunders.push(decoded);
        }
      } catch {
        // Bỏ qua nếu lỗi
      }
    }
    this.thunderBuffers = loadedThunders;
    this.thunderLoading = false;
  }

  // Bắt đầu phát âm thanh mưa và gió rít lồng ghép mượt mà
  startRainAndWind() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    // Bật âm thanh mưa
    if (!this.isRainPlaying && this.rainBuffer) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = this.rainBuffer;
        source.loop = true;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
        // Tăng mạnh âm lượng tiếng mưa theo yêu cầu (từ 0.70 lên 1.45, tối đa 1.0)
        const targetRainVol = Math.min(1.0, this.volume * 1.45);
        gain.gain.linearRampToValueAtTime(targetRainVol, this.ctx.currentTime + 1.2);

        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(0);

        this.rainSource = source;
        this.rainGain = gain;
        this.isRainPlaying = true;
      } catch {
        // AudioContext interrupted or not allowed yet
      }
    }

    // Bật âm thanh gió khi mưa
    if (!this.isWindPlaying && this.windBuffers.length > 0) {
      try {
        const randWindIdx = Math.floor(Math.random() * this.windBuffers.length);
        const source = this.ctx.createBufferSource();
        source.buffer = this.windBuffers[randWindIdx];
        source.loop = true;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(Math.min(0.75, this.volume * 0.70), this.ctx.currentTime + 1.5);

        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(0);

        this.windSource = source;
        this.windGain = gain;
        this.isWindPlaying = true;
      } catch {
        // AudioContext interrupted
      }
    }
  }

  // Tắt âm thanh mưa và gió khi tạnh mưa (fade-out êm dịu dần dần biến mất)
  stopRainAndWind() {
    if (this.ctx) {
      if (this.rainGain && this.rainSource) {
        try {
          const curVal = this.rainGain.gain.value;
          this.rainGain.gain.setValueAtTime(curVal, this.ctx.currentTime);
          this.rainGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 1.8);
          const oldSource = this.rainSource;
          setTimeout(() => {
            try {
              oldSource.stop();
              oldSource.disconnect();
            } catch {}
          }, 1850);
        } catch {}
        this.rainSource = null;
        this.rainGain = null;
      }

      if (this.windGain && this.windSource) {
        try {
          const curVal = this.windGain.gain.value;
          this.windGain.gain.setValueAtTime(curVal, this.ctx.currentTime);
          this.windGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 1.8);
          const oldSource = this.windSource;
          setTimeout(() => {
            try {
              oldSource.stop();
              oldSource.disconnect();
            } catch {}
          }, 1850);
        } catch {}
        this.windSource = null;
        this.windGain = null;
      }
    }
    this.isRainPlaying = false;
    this.isWindPlaying = false;
  }

  // Điều chỉnh âm lượng tiếng mưa và gió nhỏ dần theo tiến độ mưa tạnh (factor: 1.0 -> 0.0)
  setRainVolumeFactor(factor: number) {
    const f = Math.max(0, Math.min(1, factor));
    if (this.ctx) {
      if (this.rainGain && this.isRainPlaying) {
        const target = Math.max(0.0001, Math.min(1.0, this.volume * 1.45 * f));
        this.rainGain.gain.setValueAtTime(this.rainGain.gain.value, this.ctx.currentTime);
        this.rainGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.25);
      }
      if (this.windGain && this.isWindPlaying) {
        const target = Math.max(0.0001, Math.min(0.75, this.volume * 0.70 * f));
        this.windGain.gain.setValueAtTime(this.windGain.gain.value, this.ctx.currentTime);
        this.windGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.25);
      }
    }
  }

  // Phát luân phiên 3 bản âm thanh sấm sét mới (1 -> 2 -> 3 -> 1 -> 2 -> 3...)
  playRandomThunder() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    // Rung vật lý trên thiết bị di động (nếu trình duyệt hỗ trợ) đồng bộ cùng lúc với âm thanh sấm
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([120, 40, 100, 40, 180]);
      } catch {}
    }

    if (this.thunderBuffers.length > 0) {
      this.lastThunderIdx = (this.lastThunderIdx + 1) % this.thunderBuffers.length;
      const idx = this.lastThunderIdx;

      const source = this.ctx.createBufferSource();
      source.buffer = this.thunderBuffers[idx];
      source.playbackRate.value = 0.98 + Math.random() * 0.04;

      const gain = this.ctx.createGain();
      // Tăng âm lượng sét:
      // thunder_2 (idx === 1): tăng 2.2 lần
      // thunder_3 (idx === 2 - stingy-fuchsia): tăng 170% theo yêu cầu
      let multiplier = 1.6;
      if (idx === 1) multiplier = 2.2;
      else if (idx === 2) multiplier = 2.72; // Tăng 170%
      gain.gain.setValueAtTime(this.volume * multiplier, this.ctx.currentTime);

      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(0);
      return;
    }

    // Dự phòng âm thanh sấm sét tổng hợp sống động nếu file chưa giải mã xong
    this.synthesizeThunder();
  }

  // Âm thanh sấm sét dự phòng tổng hợp bằng Web Audio Synthesizer
  private synthesizeThunder() {
    return;
  }

  // Cập nhật âm lượng toàn cục
  setVolume(newVol: number) {
    this.volume = Math.max(0, Math.min(1, newVol));
    if (this.ctx && this.rainGain && this.isRainPlaying) {
      this.rainGain.gain.setValueAtTime(Math.min(0.75, this.volume * 0.70), this.ctx.currentTime);
    }
    if (this.ctx && this.windGain && this.isWindPlaying) {
      this.windGain.gain.setValueAtTime(Math.min(0.60, this.volume * 0.50), this.ctx.currentTime);
    }
  }
}

export const sounds = new SoundEngine();
