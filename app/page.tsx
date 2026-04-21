"use client";
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Trash2, Move, Send, CheckCircle, Clock, Activity, ShieldAlert } from 'lucide-react';

export default function Dashboard() {
  const [action, setAction] = useState('DELETE');
  const [path, setPath] = useState('');
  const [dest, setDest] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch recent command history
  const fetchHistory = async () => {
    const { data } = await supabase
      .from('commands')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setHistory(data);
  };

  useEffect(() => {
    fetchHistory();
    // Subscribe to changes so the UI updates automatically
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commands' }, () => {
        fetchHistory();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const sendCommand = async () => {
    if (!path) return alert("Please enter a source path");
    if (action === 'MOVE' && !dest) return alert("Please enter a destination path");

    setLoading(true);
    const { error } = await supabase.from('commands').insert([
      { 
        action_type: action, 
        payload: { path, dest: action === 'MOVE' ? dest : null },
        status: 'pending' 
      }
    ]);

    if (error) {
      alert("Error: " + error.message);
    } else {
      setPath('');
      setDest('');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-slate-200 p-4 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Control Panel */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#161618] rounded-2xl p-8 border border-slate-800 shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Activity className="text-blue-500" size={24} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Operation Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setAction('DELETE')}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border transition-all ${action === 'DELETE' ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-slate-900/50 border-slate-800 text-slate-400'}`}
                  >
                    <Trash2 size={18} /> DELETE
                  </button>
                  <button 
                    onClick={() => setAction('MOVE')}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border transition-all ${action === 'MOVE' ? 'bg-blue-500/10 border-blue-500/50 text-blue-500' : 'bg-slate-900/50 border-slate-800 text-slate-400'}`}
                  >
                    <Move size={18} /> MOVE
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Target Path</label>
                <input
                  type="text"
                  placeholder="C:\Windows\Temp\log.txt"
                  className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-mono"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                />
              </div>

              {action === 'MOVE' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Destination</label>
                  <input
                    type="text"
                    placeholder="D:\Backups\log.txt"
                    className="w-full bg-slate-900 border border-slate-800 p-4 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-mono"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                  />
                </div>
              )}

              <button
                onClick={sendCommand}
                disabled={loading || !path}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
              >
                {loading ? "Transmitting..." : <><Send size={18} /> Execute Command</>}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Feed */}
        <div className="space-y-6">
          <div className="bg-[#161618] rounded-2xl p-6 border border-slate-800 h-full">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
              <Clock size={16} /> Live Logs
            </h2>
            
            <div className="space-y-4">
              {history.map((cmd) => (
                <div key={cmd.id} className="p-4 bg-slate-900/50 rounded-xl border border-slate-800/50 text-xs">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`font-bold ${cmd.action_type === 'DELETE' ? 'text-red-400' : 'text-blue-400'}`}>{cmd.action_type}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${cmd.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500 animate-pulse'}`}>
                      {cmd.status}
                    </span>
                  </div>
                  <p className="text-slate-400 font-mono truncate">{cmd.payload.path}</p>
                </div>
              ))}
              {history.length === 0 && <p className="text-slate-600 text-center py-8 italic text-sm">No recent activity</p>}
            </div>

            <div className="mt-8 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 flex gap-3">
              <ShieldAlert className="text-orange-500 shrink-0" size={18} />
              <p className="text-[10px] text-orange-200/60 leading-relaxed">
                Ensure the Remote Agent is active. Commands are final once processed by the target system.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}