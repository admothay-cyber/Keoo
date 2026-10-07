import React from 'react';
import { CLASS_PRESETS } from '../data/classPresets';
import { ClassType } from '../types/game';
import {
  Swords,
  Shield,
  Zap,
  Crosshair,
  Sparkles,
  Flame,
  Heart,
  Gauge,
  Target,
  Clock,
  Play,
} from 'lucide-react';

interface ClassPresetsViewerProps {
  activeClass: ClassType;
  onSelectClass: (c: ClassType) => void;
  onLaunchGame: () => void;
}

export const ClassPresetsViewer: React.FC<ClassPresetsViewerProps> = ({
  activeClass,
  onSelectClass,
  onLaunchGame,
}) => {
  const currentPreset = CLASS_PRESETS[activeClass];

  return (
    <div className="flex flex-col gap-6 w-full text-slate-200">
      {/* 5 Class Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.keys(CLASS_PRESETS) as ClassType[]).map((cKey) => {
          const cls = CLASS_PRESETS[cKey];
          const isSelected = activeClass === cKey;
          return (
            <button
              key={cKey}
              onClick={() => onSelectClass(cKey)}
              className={`p-4 chamfer-md border text-left transition flex flex-col justify-between cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-rose-950/60 border-2 border-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.4)] scale-[1.02]'
                  : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-rose-900/60'
              }`}
            >
              {isSelected && (
                <div
                  className="absolute top-0 right-0 w-12 h-12 -mr-6 -mt-6 rounded-full opacity-30 blur-sm"
                  style={{ backgroundColor: cls.color }}
                />
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-8 h-8 chamfer-sm flex items-center justify-center font-black text-sm text-white shadow-sm"
                    style={{ backgroundColor: cls.color }}
                  >
                    {cls.name[0]}
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 chamfer-sm bg-rose-950 text-rose-200 border border-rose-500/50">
                      ACTIVE
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-sm text-white">{cls.name}</h4>
                <p className="text-[11px] text-slate-400 line-clamp-1">{cls.weaponType}</p>
              </div>

              <div className="mt-4 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>HP: {cls.maxHp}</span>
                <span>ATK: {cls.baseDamage}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Class Deep-Dive Panel */}
      <div className="bg-slate-900/80 backdrop-blur-md chamfer-lg border border-rose-900/50 p-6 shadow-2xl flex flex-col lg:flex-row gap-8">
        {/* Left: Lore, Identity & Stats */}
        <div className="w-full lg:w-96 flex flex-col gap-5 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="px-2.5 py-0.5 chamfer-sm text-xs font-bold text-white shadow-sm"
                style={{ backgroundColor: currentPreset.color }}
              >
                {currentPreset.title}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white">{currentPreset.name}</h2>
            <p className="text-xs text-rose-300 font-medium mt-0.5">{currentPreset.tagline}</p>
            <p className="text-xs text-slate-300 leading-relaxed mt-3">{currentPreset.description}</p>
          </div>

          {/* Core Stat Grid */}
          <div className="grid grid-cols-2 gap-2.5 bg-slate-950/60 p-4 chamfer-md border border-slate-800/80">
            <div className="flex items-center gap-2">
              <Heart size={16} className="text-rose-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Max Health</div>
                <div className="text-xs font-bold font-mono text-white">{currentPreset.maxHp} HP</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-amber-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Move Speed</div>
                <div className="text-xs font-bold font-mono text-white">{currentPreset.moveSpeed}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Swords size={16} className="text-rose-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Base Damage</div>
                <div className="text-xs font-bold font-mono text-white">{currentPreset.baseDamage} ATK</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Target size={16} className="text-emerald-400" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Crit / Multi</div>
                <div className="text-xs font-bold font-mono text-white">
                  {Math.round(currentPreset.critChance * 100)}% / {currentPreset.critMultiplier}x
                </div>
              </div>
            </div>
          </div>

          {/* Test in Prototype Button */}
          <button
            onClick={onLaunchGame}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-red-950 via-rose-900 to-red-950 hover:from-rose-900 hover:to-red-800 text-rose-100 font-bold text-xs chamfer-lg border border-rose-500/80 shadow-lg hover:shadow-[0_0_20px_rgba(225,29,72,0.7)] transition active:scale-95 cursor-pointer"
          >
            <Play size={16} fill="currentColor" className="text-rose-300" />
            <span>Play as {currentPreset.name} in Prototype</span>
          </button>
        </div>

        {/* Right: Combat Toolkit & ScriptableObject Configuration */}
        <div className="flex-1 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Sparkles className="text-amber-400" size={16} />
            Combat System & Active Skills
          </h3>

          {/* Basic Attack Card */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Swords size={14} className="text-slate-400" />
                Basic Attack: {currentPreset.weaponType}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Left Click / Space
              </span>
            </div>
            <p className="text-xs text-slate-300">{currentPreset.basicAttackDescription}</p>
          </div>

          {/* Skill 1 Card */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Zap size={14} style={{ color: currentPreset.skill1.color }} />
                Skill 1: {currentPreset.skill1.name}
              </span>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {currentPreset.skill1.key}
                </span>
                <span className="text-amber-400 flex items-center gap-1">
                  <Clock size={12} />
                  {currentPreset.skill1.cooldown}s CD
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-300">{currentPreset.skill1.description}</p>
          </div>

          {/* Skill 2 Card */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Flame size={14} style={{ color: currentPreset.skill2.color }} />
                Skill 2: {currentPreset.skill2.name}
              </span>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {currentPreset.skill2.key}
                </span>
                <span className="text-amber-400 flex items-center gap-1">
                  <Clock size={12} />
                  {currentPreset.skill2.cooldown}s CD
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-300">{currentPreset.skill2.description}</p>
          </div>

          {/* Skill 3 Card */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Sparkles size={14} style={{ color: currentPreset.skill3.color }} />
                Skill 3: {currentPreset.skill3.name}
              </span>
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {currentPreset.skill3.key}
                </span>
                <span className="text-amber-400 flex items-center gap-1">
                  <Clock size={12} />
                  {currentPreset.skill3.cooldown}s CD
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-300">{currentPreset.skill3.description}</p>
          </div>

          {/* ScriptableObject Unity Preset Snippet */}
          <div className="mt-2 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <div className="text-[11px] font-mono text-slate-400 mb-1">
              Unity ScriptableObject Asset Settings (<code className="text-sky-400">ClassDataSO</code>):
            </div>
            <pre className="text-[11px] font-mono text-sky-300/90 overflow-x-auto p-2 bg-slate-900/60 rounded-lg">
              {`// Assets/Data/${currentPreset.name}Data.asset
ClassType: ${currentPreset.id}
MaxHealth: ${currentPreset.maxHp}f
MoveSpeed: ${currentPreset.moveSpeed}f
BaseAttackDamage: ${currentPreset.baseDamage}f
CritChance: ${currentPreset.critChance}f
CritMultiplier: ${currentPreset.critMultiplier}f
AttacksPerSecond: ${currentPreset.attackSpeed}f
Skill1: { name: "${currentPreset.skill1.name}", cooldown: ${currentPreset.skill1.cooldown}f }
Skill2: { name: "${currentPreset.skill2.name}", cooldown: ${currentPreset.skill2.cooldown}f }`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
