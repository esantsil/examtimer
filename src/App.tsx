import { useState, useEffect, useCallback } from 'react';
import { Settings, Play, Pause, FastForward, RotateCcw, Target, Clock, AlertTriangle } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import ThemeSwitch from './components/ThemeSwitch';

interface QuestionRecord {
  id: number;
  timeSpent: number;
}

const STORAGE_KEY = 'exam_timer_pro_config';

export default function App() {
  // --- PWA Register ---
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const closePwaToast = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  // --- State & Persistence ---
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {
      totalQuestions: 70,
      totalMinutes: 220,
      alertThreshold: 170, 
    };
  });

  const [timeLeft, setTimeLeft] = useState(config.totalMinutes * 60);
  const [qTime, setQTime] = useState(0);
  const [currentQ, setCurrentQ] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [history, setHistory] = useState<QuestionRecord[]>([]);

  // --- Auto Adjustment Logic ---
  const pacePerQuestion = Math.floor((config.totalMinutes * 60) / config.totalQuestions);

  useEffect(() => {
    const autoThreshold = Math.floor(pacePerQuestion * 0.9);
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

  // --- Audio Engine ---
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
    } catch (e) { console.error("Audio error:", e); }
  }, []);

  // --- Timer Engine ---
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
      
      {/* PWA Toast Notification */}
      {(offlineReady || needRefresh) && (
        <div className="toast toast-top toast-center z-[100] w-full max-w-xs">
          <div className="alert alert-info shadow-lg flex flex-col gap-2">
            <span className="text-xs font-bold">{offlineReady ? 'App ready for offline use' : 'New update available!'}</span>
            <div className="flex gap-2 w-full">
              {needRefresh && <button className="btn btn-xs btn-primary flex-1" onClick={() => updateServiceWorker(true)}>Update</button>}
              <button className="btn btn-xs flex-1" onClick={closePwaToast}>Close</button>
            </div>
          </div>
        </div>
      )}

      {!isFinished ? (
        /* --- TIMER CARD --- */
        <div className="card w-full max-w-md bg-base-100 shadow-2xl border border-primary/10 overflow-hidden">
          
          {/* Internal Header */}
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
            <div className="flex justify-between w-full mb-8 font-mono">
              <div className="text-left">
                <p className="text-[10px] uppercase font-black opacity-40 tracking-widest">Question</p>
                <p className="text-lg font-black">{currentQ} <span className="opacity-30 text-xs">/ {config.totalQuestions}</span></p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-black opacity-40 tracking-widest">Total Time</p>
                <p className={`text-lg font-black ${timeLeft < 600 ? 'text-error animate-pulse' : ''}`}>{format(timeLeft, true)}</p>
              </div>
            </div>

            <div className={`text-7xl sm:text-8xl font-mono font-black mb-6 transition-all tracking-tighter ${
              qTime > pacePerQuestion ? 'text-error animate-pulse' : 
              qTime > config.alertThreshold ? 'text-warning' : 'text-primary'
            }`}>
              {format(qTime)}
            </div>

            <progress className="progress progress-primary w-full mb-12 h-3 shadow-inner" value={currentQ} max={config.totalQuestions}></progress>

            <div className="card-actions w-full flex flex-col gap-3">
              <button 
                className={`btn btn-block btn-lg h-20 shadow-xl border-2 transition-all ${isRunning ? 'btn-outline btn-warning' : 'btn-primary text-2xl font-black italic tracking-tight'}`}
                onClick={() => setIsRunning(!isRunning)}
              >
                {isRunning ? <><Pause size={28}/> PAUSE</> : <><Play size={28}/> START EXAM</>}
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
        /* --- RESULTS DASHBOARD --- */
        <div className="card w-full max-w-2xl bg-base-100 shadow-2xl border border-primary/10 overflow-hidden">
          <div className="bg-primary text-primary-content p-5 flex justify-between items-center">
            <h2 className="font-black text-2xl uppercase italic tracking-tighter">Final Performance</h2>
            <ThemeSwitch />
          </div>

          <div className="card-body p-6 sm:p-10">
            <div className="stats stats-vertical sm:stats-horizontal shadow bg-base-200 w-full mb-8 font-mono border border-base-300">
              <div className="stat place-items-center py-6">
                <div className="stat-title text-[10px] uppercase font-black"><Target size={12} className="inline mr-1"/> Avg/Question</div>
                <div className={`stat-value text-3xl ${avgTime > pacePerQuestion ? 'text-error' : 'text-success'}`}>{format(avgTime)}</div>
              </div>
              <div className="stat place-items-center py-6 border-y sm:border-y-0 sm:border-x border-base-300">
                <div className="stat-title text-[10px] uppercase font-black"><Clock size={12} className="inline mr-1"/> Time Saved</div>
                <div className="stat-value text-3xl text-secondary">{format(timeLeft, true)}</div>
              </div>
              <div className="stat place-items-center py-6">
                <div className="stat-title text-[10px] uppercase font-black"><AlertTriangle size={12} className="inline mr-1"/> Slow Items</div>
                <div className="stat-value text-3xl text-warning">{history.filter(q => q.timeSpent > config.alertThreshold).length}</div>
              </div>
            </div>

            <div className="overflow-x-auto max-h-64 rounded-2xl border border-base-300 shadow-inner mb-8 bg-base-200/50">
              <table className="table table-xs sm:table-sm table-zebra table-pin-rows w-full font-mono text-center">
                <thead className="bg-base-300 uppercase text-[9px] font-black">
                  <tr><th>Item</th><th>Time</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="hover">
                      <td className="font-black opacity-30 italic">#{item.id}</td>
                      <td className="font-bold">{format(item.timeSpent)}</td>
                      <td>
                        <span className={`badge badge-xs font-black ${item.timeSpent > pacePerQuestion ? 'badge-error' : item.timeSpent > config.alertThreshold ? 'badge-warning' : 'badge-success'}`}>
                          {item.timeSpent > pacePerQuestion ? 'CRITICAL' : item.timeSpent > config.alertThreshold ? 'SLOW' : 'GOOD'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="btn btn-primary btn-block btn-lg shadow-2xl font-black uppercase tracking-widest" onClick={() => window.location.reload()}>
              <RotateCcw size={20}/> RESTART EXAM
            </button>
          </div>
        </div>
      )}

      {/* --- SETTINGS MODAL --- */}
      <dialog id="settings_modal" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box border-t-8 border-primary p-6">
          <div className="flex items-center gap-3 mb-8 text-primary">
            <Settings size={32} />
            <h3 className="font-black text-2xl uppercase italic tracking-tighter">Settings</h3>
          </div>
          
          <div className="space-y-8 text-left">
            <div className="form-control">
              <label className="label py-0"><span className="label-text font-black uppercase text-[10px] opacity-50">Total Questions</span></label>
              <input type="number" className="input input-bordered input-primary w-full font-black text-xl bg-base-200 focus:bg-base-100 transition-colors" value={config.totalQuestions} onChange={(e) => setConfig({...config, totalQuestions: Number(e.target.value)})}/>
            </div>

            <div className="form-control">
              <label className="label py-0 flex justify-between items-end">
                <span className="label-text font-black uppercase text-[10px] opacity-50">Exam Duration</span>
                <span className="text-primary font-mono font-black text-xs bg-primary/10 px-2 py-1 rounded">Target: {format(pacePerQuestion)} / q</span>
              </label>
              <div className="flex items-center gap-4 bg-base-200 p-4 rounded-2xl mt-2 shadow-inner">
                 <span className="font-black text-xl min-w-[70px] text-center">{config.totalMinutes}<small className="text-[10px] opacity-50 ml-1">min</small></span>
                 <input type="range" min="10" max="330" step="1" value={config.totalMinutes} className="range range-primary range-sm" onChange={(e) => setConfig({...config, totalMinutes: Number(e.target.value)})}/>
              </div>
            </div>

            <div className="alert alert-warning shadow-sm border-none bg-warning/20 text-warning-content flex gap-3">
              <AlertTriangle size={20}/>
              <div>
                <p className="text-[10px] font-black uppercase leading-tight">Auto-Alert (90% Pace)</p>
                <p className="text-sm font-mono font-bold">Beep will trigger at {format(config.alertThreshold)}</p>
              </div>
            </div>
          </div>

          <div className="modal-action mt-10">
            <form method="dialog" className="w-full">
              <button className="btn btn-primary btn-block btn-lg font-black shadow-lg text-lg">SAVE & CLOSE</button>
            </form>
          </div>
        </div>
      </dialog>

      <footer className="mt-8 text-[9px] opacity-20 text-center uppercase tracking-[0.5em] font-black pb-4">
        Exam Timer Pro // Studio Mode
      </footer>
    </div>
  );
}