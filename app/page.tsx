"use client";
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Trash2, Move, Send, Clock, Activity, ShieldAlert, Folder, FileText, Terminal } from 'lucide-react';

// Interfaces for better type safety
interface FileItem {
  id: string;
  name: string;
  path: string;
  is_dir: boolean;
}

interface LogEntry {
  id: string;
  created_at: string;
  message: string;
  level: 'INFO' | 'ERROR';
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const [action, setAction] = useState('DELETE');
  const [path, setPath] = useState('');
  const [dest, setDest] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // New States for integrated features
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [systemLogs, setSystemLogs] = useState<LogEntry[]>([]);

  // 1. Initial Data Fetching
  const fetchData = async () => {
    try {
      const { data: files, error: fileError } = await supabase.from('file_structure').select('*').order('name');
      const { data: logs, error: logError } = await supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(20);
      
      if (files) setFileList(files);
      if (logs) setSystemLogs(logs);
      if (fileError || logError) console.error("Data fetch error:", fileError || logError);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // 2. Realtime Subscriptions (Syncs dashboard with PC Agent)
    const channel = supabase.channel('agent-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, (payload) => {
        setSystemLogs(prev => [payload.new, ...prev].slice(0, 20));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'file_structure' }, () => {
        fetchData(); // Refresh file list when PC scans new files
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const sendCommand = async () => {
    if (!path) return alert("Select a file from the explorer");
    setLoading(true);
    try {
      const { error } = await supabase.from('commands').insert([
        { 
          action_type: action, 
          payload: { path, dest: action === 'MOVE' ? dest : null },
          status: 'pending' 
        }
      ]);

      if (!error) { setPath(''); setDest(''); }
      else { alert(`Command transmission failed: ${error.message}`); }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMN 1: REMOTE FILE EXPLORER (New Feature) */}
        <div className="lg:col-span-4 bg-[#161618] rounded-2xl border border-slate-800 flex flex-col h-[700px]">
          <div className="p-6 border-b border-slate-800 flex items-center gap-2">
            <Folder className="text-blue-500" size={20} />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">File Explorer</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {initialLoading ? <p className="text-slate-600 text-xs animate-pulse">Scanning drives...</p> : 
            {fileList.map((file) => (
              <div 
                key={file.id}
                onClick={() => setPath(file.path)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${path === file.path ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'hover:bg-white/5 border-transparent text-slate-400'}`}
              >
                {file.is_dir ? <Folder size={16} /> : <FileText size={16} />}
                <span className="text-xs font-mono truncate">{file.name}</span>
              </div>
            ))}
            }
          </div>
        </div>

        {/* COLUMN 2: COMMAND CENTER (Updated) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#161618] rounded-2xl p-8 border border-slate-800 shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
              <Activity className="text-blue-500" size={24} />
              <h1 className="text-xl font-bold tracking-tight">Control Panel</h1>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setAction('DELETE')} className={`flex flex-col items-center p-4 rounded-xl border transition-all ${action === 'DELETE' ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                  <Trash2 size={20} className="mb-1" /> <span className="text-[10px] font-bold">DELETE</span>
                </button>
                <button onClick={() => setAction('MOVE')} className={`flex flex-col items-center p-4 rounded-xl border transition-all ${action === 'MOVE' ? 'bg-blue-500/10 border-blue-500/50 text-blue-500' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                  <Move size={20} className="mb-1" /> <span className="text-[10px] font-bold">MOVE</span>
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Target Path</label>
                <input readOnly value={path} className="w-full bg-black border border-slate-800 p-4 rounded-xl text-xs font-mono text-blue-400 outline-none" placeholder="Select a file from left..." />
              </div>

              {action === 'MOVE' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Destination</label>
                  <input type="text" value={dest} onChange={(e) => setDest(e.target.value)} className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl text-xs font-mono" placeholder="D:\Backup\..." />
                </div>
              )}

              <button onClick={sendCommand} disabled={loading || !path} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2">
                {loading ? "Transmitting..." : <><Send size={18} /> Send Signal</>}
              </button>

              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 flex gap-3">
                <ShieldAlert className="text-orange-500 shrink-0" size={16} />
                <p className="text-[10px] text-orange-200/50 leading-tight">Admin mode active. Command Jitter enabled for network stealth.</p>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 3: SYSTEM LOGS (Enhanced Feature) */}
        <div className="lg:col-span-4 bg-[#161618] rounded-2xl border border-slate-800 flex flex-col h-[700px]">
          <div className="p-6 border-b border-slate-800 flex items-center gap-2">
            <Terminal className="text-green-500" size={20} />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">System Logs</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-black/30 font-mono text-[10px] custom-scrollbar">
            {systemLogs.map((log) => (
              <div key={log.id} className="flex gap-2 border-l-2 border-slate-800 pl-3 py-1">
                <span className="text-slate-600">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                <span className={log.level === 'ERROR' ? 'text-red-500' : 'text-green-500'}>{log.message}</span>
              </div>
            ))}
            {systemLogs.length === 0 && <p className="text-slate-600 text-center py-8">Waiting for agent handshake...</p>}
          </div>
        </div>

      </div>
    </div>
  );
}