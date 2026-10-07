import React, { useState } from 'react';
import { UNITY_SCRIPTS, UnityScriptFile } from '../data/unityScripts';
import JSZip from 'jszip';
import {
  Copy,
  Check,
  Download,
  FileCode,
  FolderArchive,
  Search,
  BookOpen,
  Sparkles,
} from 'lucide-react';

export const UnityCodeViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<UnityScriptFile>(UNITY_SCRIPTS[0]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);

  const categories = ['All', 'Core & Data', 'Combat & Weapons', 'Enemies & Spawning', 'Town & Economy', 'UI & Feedback'];

  const filteredScripts = UNITY_SCRIPTS.filter((script) => {
    const matchesCategory = selectedCategory === 'All' || script.category === selectedCategory;
    const matchesSearch =
      script.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      script.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadAllZip = async () => {
    setIsExportingZip(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('ARPG_Prototype_Scripts');

      UNITY_SCRIPTS.forEach((script) => {
        folder?.file(script.filename, script.code);
      });

      // Add a handy Readme for the Unity project
      folder?.file(
        'README_SETUP.txt',
        `SOUL KNIGHT STYLE 2D TOP-DOWN ARPG PROTOTYPE
--------------------------------------------------
Created by Senior Unity 2D ARPG Engineer

INSTRUCTIONS:
1. Drag this entire folder into your Unity project's "Assets/Scripts/" folder.
2. Follow the Step-by-Step Inspector & Prefab Guide provided in the Web Suite.
3. Use Unity default shapes (Sprites > Circle / Square) - zero external assets needed!
4. Create ScriptableObjects by Right-Clicking in Project > Create > ARPG > Class Preset.
`
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ARPG_Unity_Scripts.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to create zip', err);
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full min-h-[640px] text-slate-200">
      {/* Sidebar: Script Navigator & Filters */}
      <div className="w-full lg:w-80 flex flex-col gap-4 bg-slate-900/80 backdrop-blur-md p-4 chamfer-lg border border-rose-900/40 shrink-0">
        {/* Header & Bulk Export */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FileCode className="text-rose-400" size={18} />
              C# Scripts ({UNITY_SCRIPTS.length})
            </h3>
            <span className="text-[11px] px-2 py-0.5 chamfer-sm bg-rose-950/80 text-rose-300 border border-rose-500/40 font-mono">
              Unity 2022+ / 6
            </span>
          </div>

          <button
            onClick={handleDownloadAllZip}
            disabled={isExportingZip}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 chamfer-md bg-gradient-to-r from-red-950 via-rose-900 to-red-950 hover:from-rose-900 hover:to-red-800 text-rose-100 border border-rose-500/80 hover:shadow-[0_0_18px_rgba(225,29,72,0.65)] font-bold text-xs shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <FolderArchive size={16} className="text-rose-300" />
            <span>{isExportingZip ? 'Packing ZIP...' : 'Download All Scripts (.zip)'}</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-rose-400/70" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scripts..."
            className="w-full pl-9 pr-3 py-2 chamfer-sm bg-slate-950/80 border border-rose-900/50 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-[11px] px-2.5 py-1 chamfer-sm transition font-medium cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-rose-900 text-rose-100 font-bold border border-rose-500 shadow-[0_0_12px_rgba(225,29,72,0.4)]'
                  : 'bg-slate-950/80 text-slate-400 hover:text-rose-200 hover:bg-slate-900 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Scripts List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[380px] pr-1 custom-scrollbar">
          {filteredScripts.map((script) => {
            const isSelected = selectedFile.filename === script.filename;
            return (
              <button
                key={script.filename}
                onClick={() => setSelectedFile(script)}
                className={`w-full text-left p-2.5 chamfer-sm border transition flex flex-col gap-0.5 cursor-pointer ${
                  isSelected
                    ? 'bg-rose-950/80 border-rose-500 text-white shadow-[0_0_12px_rgba(225,29,72,0.35)]'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-900 hover:text-slate-200 hover:border-rose-900/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-mono text-xs font-bold text-rose-300">{script.filename}</span>
                  <span className="text-[10px] text-slate-400">{script.category.split(' ')[0]}</span>
                </div>
                <span className="text-[11px] text-slate-400 line-clamp-1">{script.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Panel: Script Viewer */}
      <div className="flex-1 flex flex-col bg-slate-900/80 backdrop-blur-md chamfer-lg border border-rose-900/40 overflow-hidden shadow-2xl">
        {/* Script Info Topbar */}
        <div className="flex flex-wrap items-center justify-between p-4 bg-slate-950/60 border-b border-rose-900/40 gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold font-mono text-white flex items-center gap-2">
                <FileCode className="text-rose-400" size={18} />
                {selectedFile.filename}
              </h2>
              <span className="text-[10px] px-2 py-0.5 chamfer-sm bg-slate-900 border border-slate-700 text-slate-300 font-mono">
                {selectedFile.category}
              </span>
              {selectedFile.unityMenuPath && (
                <span className="text-[10px] px-2 py-0.5 chamfer-sm bg-rose-950/80 border border-rose-500/40 text-rose-300 font-mono">
                  {selectedFile.unityMenuPath}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">{selectedFile.description}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className={`flex items-center gap-1.5 px-3 py-2 chamfer-sm text-xs font-bold border transition cursor-pointer ${
                copied
                  ? 'bg-rose-900/80 text-rose-200 border-rose-500 shadow-[0_0_12px_rgba(225,29,72,0.5)]'
                  : 'bg-gradient-to-r from-red-950 to-rose-900 hover:from-rose-900 hover:to-red-800 text-rose-100 border-rose-500/70 hover:shadow-[0_0_12px_rgba(225,29,72,0.5)]'
              }`}
            >
              {copied ? <Check size={15} className="text-rose-300" /> : <Copy size={15} className="text-rose-300" />}
              <span>{copied ? 'Copied Script!' : 'Copy Code'}</span>
            </button>
          </div>
        </div>

        {/* Code View with Line Numbers */}
        <div className="flex-1 overflow-auto bg-slate-950/95 p-4 font-mono text-xs leading-relaxed max-h-[560px]">
          <pre className="text-slate-300 font-mono">
            <code>{selectedFile.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
