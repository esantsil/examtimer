import { useState, useEffect, useCallback } from 'react';
import { Settings, Play, Pause, FastForward, RotateCcw, AlertTriangle, Clock } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import ThemeSwitch from './components/ThemeSwitch';

interface QuestionRecord {
  id: number;
  timeSpent: number;
}

const STORAGE_KEY = 'exam_timer_pro_config';

export default function App() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const closePwaToast = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const DEFAULT_CONFIG = {
    totalQuestions: 70,
    totalMinutes: 220,
    alertThreshold: 176, 
  };

  const minutesToTimeString = (total: number) => {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const timeStringToMinutes = (timeStr: string) => {
    if (!timeStr) return 1;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + m || 1;
  };

  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  const [timeLeft, setTimeLeft] = useState(config.totalMinutes * 60);
  const [qTime, setQTime] = useState(0);
  const [currentQ, setCurrentQ] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [history, setHistory] = useState<QuestionRecord[]>([]);

  const pacePerQuestion = Math.floor((config.totalMinutes * 60) / config.totalQuestions);

  useEffect(() => {
    const autoThreshold = Math.floor(pacePerQuestion * 0.8);
    if (config.alertThreshold !== autoThreshold) {
      setConfig((prev: any) => ({ ...prev, alertThreshold: autoThreshold }));
    }
  }, [config.totalMinutes, config.totalQuestions, pacePerQuestion]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    if (!isRunning && history.length === 0) {
      setTimeLeft(config.totalMinutes * 60);
    }
  }, [config, isRunning, history.length]);

  const handleResetConfig = () => {
    if (window.confirm("Reset all settings and progress?")) {
      setConfig(DEFAULT_CONFIG);
      setTimeLeft(DEFAULT_CONFIG.totalMinutes * 60);
      setHistory([]);
      setCurrentQ(1);
      setQTime(0);
      setIsRunning(false);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const playAlertSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    let timer: number;
    if (isRunning && timeLeft > 0 && !isFinished) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
        setQTime((prev) => {
          const next = prev + 1;
          if (next === config.alertThreshold) playAlertSound();
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, isFinished, config.alertThreshold, playAlertSound]);

  const handleNext = () => {
    const updatedHistory = [...history, { id: currentQ, timeSpent: qTime }];
    setHistory(updatedHistory);
    if (currentQ < config.totalQuestions) {
      setCurrentQ((prev) => prev + 1);
      setQTime(0);
    } else {
      setIsRunning(false);
      setIsFinished(true);
    }
  };

  const format = (s: number, hours = false) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return hours 
      ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
      : `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const avgTime = history.length > 0 
    ? Math.floor(history.reduce((a, b) => a + b.timeSpent, 0) / history.length) 
    : 0;

  return (
    <div className="min-h-screen bg-base-300 p-2 sm:p-4 flex flex-col items-center justify-center font-sans relative">
      
      {/* PWA Alert */}
      {(offlineReady || needRefresh) && (
        <div className="toast toast-top toast-center z-[100] w-full max-w-xs">
          <div className="alert alert-info shadow-lg flex flex-col gap-2">
            <span className="text-xs font-bold">{offlineReady ? 'Ready for offline' : 'Update available!'}</span>
            <div className="flex gap-2 w-full">
              {needRefresh && <button className="btn btn-xs btn-primary flex-1" onClick={() => updateServiceWorker(true)}>Update</button>}
              <button className="btn btn-xs flex-1" onClick={closePwaToast}>Close</button>
            </div>
          </div>
        </div>
      )}

      {!isFinished ? (
        <div className="card w-full max-w-md bg-base-100 shadow-2xl border border-primary/10 overflow-hidden">
          <div className="flex justify-between items-center p-3 border-b border-base-200 bg-base-200/30">
            <button 
              className="btn btn-ghost btn-circle btn-sm text-base-content/70"
              onClick={() => (document.getElementById('settings_modal') as any).showModal()}
              disabled={isRunning || history.length > 0}
            >
              <Settings size={20} />
            </button>
            <ThemeSwitch />
          </div>

          <div className="card-body px-6 py-10 items-center text-center">
            <div className="flex justify-between w-full mb-8 font-mono text-base-content/60">
              <div className="text-left">
                <p className="text-[10px] uppercase font-black tracking-widest">Question</p>
                <p className="text-lg font-black text-base-content">{currentQ} <span className="opacity-30 text-xs">/ {config.totalQuestions}</span></p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-black tracking-widest">Time Left</p>
                <p className={`text-lg font-black ${timeLeft < 600 ? 'text-error animate-pulse' : 'text-base-content'}`}>{format(timeLeft, true)}</p>
              </div>
            </div>

            <div className={`text-7xl sm:text-8xl font-mono font-black mb-6 transition-all tracking-tighter ${
              qTime > pacePerQuestion ? 'text-error animate-pulse' : 
              qTime > config.alertThreshold ? 'text-warning' : 'text-primary'
            }`}>
              {format(qTime)}
            </div>

            <progress className="progress progress-primary w-full mb-12 h-3" value={currentQ} max={config.totalQuestions}></progress>

            <div className="card-actions w-full flex flex-col gap-3">
              <button 
                className={`btn btn-block btn-lg h-20 shadow-xl border-2 transition-all ${isRunning ? 'btn-outline btn-warning' : 'btn-primary text-2xl font-black italic tracking-tight'}`}
                onClick={() => setIsRunning(!isRunning)}
              >
                {isRunning ? <><Pause size={28}/> PAUSE</> : <><Play size={28}/> START CLOCK</>}
              </button>
              
              <button 
                className="btn btn-secondary btn-block btn-lg h-16 shadow-lg font-black text-lg"
                onClick={handleNext}
                disabled={!isRunning}
              >
                <FastForward size={24}/> {currentQ === config.totalQuestions ? 'FINISH' : 'NEXT'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* --- RESULTS VIEW WITH LIST --- */
        <div className="card w-full max-w-2xl bg-base-100 shadow-2xl border border-primary/10 overflow-hidden">
  

          <div className="card-body p-4 sm:p-10">
            <div className="stats stats-vertical lg:stats-horizontal shadow bg-base-200 w-full mb-8 font-mono border border-base-300">
              <div className="stat place-items-center">
                <div className="stat-title text-[10px] uppercase font-black">Avg/Q</div>
                <div className={`stat-value text-2xl ${avgTime > pacePerQuestion ? 'text-error' : 'text-success'}`}>{format(avgTime)}</div>
              </div>
              <div className="stat place-items-center">
                <div className="stat-title text-[10px] uppercase font-black">Saved</div>
                <div className="stat-value text-2xl text-secondary">{format(timeLeft, true)}</div>
              </div>
              <div className="stat place-items-center">
                <div className="stat-title text-[10px] uppercase font-black">Slow Qs</div>
                <div className="stat-value text-2xl text-warning">{history.filter(q => q.timeSpent > pacePerQuestion).length}</div>
              </div>
            </div>

            {/* DETAILED HISTORY LIST */}
            <div className="bg-base-200 rounded-3xl p-2 mb-8 max-h-80 overflow-y-auto border border-base-300 shadow-inner">
              <table className="table table-pin-rows">
                <thead>
                  <tr className="border-b border-base-300">
                    <th className="bg-base-200 font-black text-[10px] uppercase tracking-widest opacity-50 text-center">ID</th>
                    <th className="bg-base-200 font-black text-[10px] uppercase tracking-widest opacity-50">Time Spent</th>
                    <th className="bg-base-200 font-black text-[10px] uppercase tracking-widest opacity-50 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {[...history].reverse().map((record) => (
                    <tr key={record.id} className="border-base-300 hover:bg-base-100 transition-colors">
                      <td className="text-center font-bold opacity-40 italic">{record.id}</td>
                      <td className="font-black text-lg">
                         <div className="flex items-center gap-2">
                           <Clock size={14} className="opacity-30" />
                           {format(record.timeSpent)}
                         </div>
                      </td>
                      <td className="text-right">
                        {record.timeSpent > pacePerQuestion ? (
                          <span className="badge badge-error badge-sm font-black italic">SLOW</span>
                        ) : record.timeSpent > config.alertThreshold ? (
                          <span className="badge badge-warning badge-sm font-black italic">NEAR</span>
                        ) : (
                          <span className="badge badge-success badge-sm font-black italic">FAST</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="btn btn-primary btn-block btn-lg shadow-2xl font-black uppercase tracking-widest" onClick={() => window.location.reload()}>
              <RotateCcw size={20}/> RESTART
            </button>
          </div>
        </div>
      )}

      {/* --- SETTINGS MODAL --- */}
      <dialog id="settings_modal" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box p-6 bg-base-100 border-none">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-2xl uppercase italic tracking-tighter">Settings</h3>
            <button className="btn btn-ghost btn-xs text-error font-black uppercase tracking-widest" onClick={handleResetConfig}>
              Reset Defaults
            </button>
          </div>

          <div className="space-y-8 text-left">
            <div className="form-control">
              <label className="label py-0"><span className="label-text font-black uppercase text-[10px] opacity-50 tracking-widest">Total Questions</span></label>
              <input 
                type="number" 
                className="input input-ghost border-none focus:outline-none w-full font-black text-2xl bg-base-200 mt-2 h-14" 
                value={config.totalQuestions} 
                onChange={(e) => setConfig({...config, totalQuestions: Number(e.target.value) || 1})}
              />
            </div>

            <div className="form-control">
              <label className="label py-0 flex justify-between items-end">
                <span className="label-text font-black uppercase text-[10px] opacity-50 tracking-widest">Exam Duration</span>
                <span className="text-primary font-mono font-black text-xs">{format(pacePerQuestion)}/q</span>
              </label>
              <input 
                type="time" 
                className="input input-ghost border-none focus:outline-none w-full font-black text-3xl h-16 bg-base-200 mt-2 text-center uppercase" 
                value={minutesToTimeString(config.totalMinutes)}
                onChange={(e) => setConfig({...config, totalMinutes: timeStringToMinutes(e.target.value) || 1})}
              />
            </div>
            
            <div className="alert alert-warning shadow-none border-none bg-warning/10 text-warning flex gap-3 rounded-2xl">
              <AlertTriangle size={20}/>
              <div>
                <p className="text-[10px] font-black uppercase leading-tight">Auto-Alert (80% Pace)</p>
                <p className="text-sm font-mono font-bold">Sound triggers at {format(config.alertThreshold)}</p>
              </div>
            </div>
          </div>
          <div className="modal-action mt-10">
            <form method="dialog" className="w-full">
              <button className="btn btn-primary btn-block btn-lg font-black shadow-lg border-none uppercase">Save & Close</button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  );
}