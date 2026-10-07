import React, { useState } from 'react';
import { UNITY_GUIDE_STEPS, GuideStep } from '../data/unityGuide';
import {
  Layers,
  User,
  Crosshair,
  Skull,
  Coins,
  Sparkles,
  CheckCircle2,
  Circle,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  Smartphone,
} from 'lucide-react';

export const UnitySetupGuide: React.FC = () => {
  const [activeStepId, setActiveStepId] = useState<string>(UNITY_GUIDE_STEPS[0].id);
  const [checkedItems, setCheckedItems] = useState<{ [key: string]: boolean }>({});

  const activeStep = UNITY_GUIDE_STEPS.find((s) => s.id === activeStepId) || UNITY_GUIDE_STEPS[0];

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getStepIcon = (iconName: string) => {
    switch (iconName) {
      case 'Layers':
        return <Layers size={18} />;
      case 'User':
        return <User size={18} />;
      case 'Crosshair':
        return <Crosshair size={18} />;
      case 'Skull':
        return <Skull size={18} />;
      case 'Coins':
        return <Coins size={18} />;
      case 'Sparkles':
        return <Sparkles size={18} />;
      case 'Smartphone':
        return <Smartphone size={18} />;
      default:
        return <Circle size={18} />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full text-slate-200">
      {/* Sidebar: Step List */}
      <div className="w-full lg:w-80 flex flex-col gap-3 bg-slate-900/80 backdrop-blur-md p-4 chamfer-lg border border-rose-900/40 shrink-0">
        <div className="flex items-center justify-between pb-2 border-b border-rose-900/40">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Lightbulb className="text-rose-400" size={18} />
            Setup Roadmap
          </h3>
          <span className="text-[11px] font-mono text-slate-400">6 Steps</span>
        </div>

        <div className="flex flex-col gap-2">
          {UNITY_GUIDE_STEPS.map((step) => {
            const isCurrent = step.id === activeStepId;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStepId(step.id)}
                className={`w-full text-left p-3 chamfer-md border transition flex items-start gap-3 cursor-pointer ${
                  isCurrent
                    ? 'bg-rose-950/80 border-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)]'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 hover:border-rose-900/50'
                }`}
              >
                <div
                  className={`p-2 chamfer-sm mt-0.5 ${
                    isCurrent ? 'bg-rose-900 text-rose-100 border border-rose-500' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {getStepIcon(step.icon)}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-rose-400 font-bold">STEP {step.stepNumber}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-200">{step.title}</span>
                  <span className="text-[11px] text-slate-400 line-clamp-1">{step.summary}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Pro Tip Callout */}
        <div className="mt-2 p-3 bg-rose-950/30 border border-rose-900/50 chamfer-md text-xs text-rose-300">
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <Sparkles size={14} className="text-rose-400" />
            <span>Zero External Assets</span>
          </div>
          <p className="text-[11px] text-rose-200/80 leading-relaxed">
            All graphics use Unity default shapes (<code className="text-white font-mono">2D Object &gt; Sprites &gt; Square / Circle</code>) rotated and scaled. No asset store packages required!
          </p>
        </div>
      </div>

      {/* Main Guide Content */}
      <div className="flex-1 flex flex-col bg-slate-900/80 backdrop-blur-md chamfer-lg border border-rose-900/40 p-6 shadow-2xl">
        {/* Step Header */}
        <div className="border-b border-rose-900/40 pb-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 chamfer-sm bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-mono font-bold">
              STEP {activeStep.stepNumber} OF 6
            </span>
          </div>
          <h2 className="text-xl font-black text-white">{activeStep.title}</h2>
          <p className="text-xs text-slate-400 mt-1">{activeStep.summary}</p>
        </div>

        {/* Step Details & Sections */}
        <div className="space-y-6">
          {activeStep.details.map((section, idx) => (
            <div key={idx} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
              <h4 className="text-sm font-bold text-sky-300 mb-2">{section.heading}</h4>
              <p className="text-xs text-slate-300 leading-relaxed mb-3">{section.description}</p>

              {/* Bullet list */}
              {section.bulletPoints && (
                <ul className="space-y-2 mb-3">
                  {section.bulletPoints.map((bp, bidx) => {
                    const checkKey = `${activeStep.id}-${idx}-${bidx}`;
                    const isChecked = !!checkedItems[checkKey];
                    return (
                      <li
                        key={bidx}
                        onClick={() => toggleCheck(checkKey)}
                        className={`flex items-start gap-2.5 text-xs p-2 rounded-lg cursor-pointer transition ${
                          isChecked ? 'bg-emerald-500/10 text-emerald-300' : 'hover:bg-slate-900 text-slate-300'
                        }`}
                      >
                        <span className="mt-0.5 shrink-0 text-slate-400">
                          {isChecked ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                          ) : (
                            <Circle size={16} />
                          )}
                        </span>
                        <span className={isChecked ? 'line-through text-slate-400' : ''}>{bp}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Table */}
              {section.table && (
                <div className="overflow-x-auto rounded-lg border border-slate-800 my-2">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900 text-sky-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        {section.table.headers.map((h, hidx) => (
                          <th key={hidx} className="p-2.5 font-bold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {section.table.rows.map((row, ridx) => (
                        <tr key={ridx} className="hover:bg-slate-900/40">
                          {row.map((cell, cidx) => (
                            <td key={cidx} className="p-2.5 text-slate-300">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Code snippet if present */}
              {section.codeSnippet && (
                <div className="mt-3 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs text-sky-300 overflow-x-auto">
                  <code>{section.codeSnippet}</code>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-800">
          <button
            disabled={activeStep.stepNumber === 1}
            onClick={() => {
              const prev = UNITY_GUIDE_STEPS.find((s) => s.stepNumber === activeStep.stepNumber - 1);
              if (prev) setActiveStepId(prev.id);
            }}
            className="px-4 py-2 chamfer-md bg-slate-900 hover:bg-slate-800 text-rose-200 border border-rose-900/50 disabled:opacity-40 text-xs font-bold transition cursor-pointer"
          >
            ← Previous Step
          </button>

          <span className="text-xs text-rose-300 font-mono">
            {activeStep.stepNumber} / {UNITY_GUIDE_STEPS.length}
          </span>

          <button
            disabled={activeStep.stepNumber === UNITY_GUIDE_STEPS.length}
            onClick={() => {
              const next = UNITY_GUIDE_STEPS.find((s) => s.stepNumber === activeStep.stepNumber + 1);
              if (next) setActiveStepId(next.id);
            }}
            className="px-4 py-2 chamfer-md bg-gradient-to-r from-red-950 via-rose-900 to-red-950 hover:from-rose-900 hover:to-red-800 text-rose-100 border border-rose-500/80 hover:shadow-[0_0_15px_rgba(225,29,72,0.65)] disabled:opacity-40 font-bold text-xs shadow-md transition cursor-pointer"
          >
            Next Step →
          </button>
        </div>
      </div>
    </div>
  );
};
