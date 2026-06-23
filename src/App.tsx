import { useState, useEffect, useCallback } from 'react';
import { Settings, Play, Pause, ChevronRight, RotateCcw, Clock, Download, Square } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import ThemeSwitch from './components/ThemeSwitch';

interface QuestionRecord {
  id: number;
  timeSpent: number;
  visited: boolean;
}

const STORAGE_KEY = 'exam_timer_pro_config_v4';

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
    totalQuestions: 90,
    totalMinutes: 300,
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
  const [currentQ, setCurrentQ] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  const [history, setHistory] = useState<QuestionRecord[]>(() => {
    return Array.from({ length: config.totalQuestions }, (_, i) => ({
      id: i + 1,
      timeSpent: 0,
      visited: false
    }));
  });

  const pacePerQuestion = Math.floor((config.totalMinutes * 60) / config.totalQuestions);

  useEffect(() => {
    const autoThreshold = Math.floor(pacePerQuestion * 0.8);
    if (config.alertThreshold !== autoThreshold) {
      setConfig((prev: any) => ({ ...prev, alertThreshold: autoThreshold }));
    }
  }, [config.totalMinutes, config.totalQuestions, pacePerQuestion]);

  useEffect(() => {
    setHistory(Array.from({ length: config.totalQuestions }, (_, i) => ({
      id: i + 1,
      timeSpent: 0,
      visited: false
    })));
    setTimeLeft(config.totalMinutes * 60);
  }, [config.totalQuestions, config.totalMinutes]);

  const handleResetConfig = () => {
    if (window.confirm("Resetar todas as configurações e progresso?")) {
      setConfig(DEFAULT_CONFIG);
      setCurrentQ(1);
      setIsRunning(false);
      setIsFinished(false);
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
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        
        setHistory((prevHistory) =>
          prevHistory.map((q) => {
            if (q.id === currentQ) {
              const nextTime = q.timeSpent + 1;
              if (nextTime === config.alertThreshold) playAlertSound();
              return { ...q, timeSpent: nextTime, visited: true };
            }
            return q;
          })
        );
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, isFinished, currentQ, config.alertThreshold, playAlertSound]);

  const format = (s: number, hours = false) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return hours 
      ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
      : `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const navigateToQuestion = (id: number) => {
    setHistory(prev => prev.map(q => q.id === currentQ ? { ...q, visited: true } : q));
    setCurrentQ(id);
  };

  const handleNext = () => {
    setHistory(prev => prev.map(q => q.id === currentQ ? { ...q, visited: true } : q));
    if (currentQ < config.totalQuestions) {
      setCurrentQ((prev) => prev + 1);
    } else {
      handleFinishExam();
    }
  };

  const handleFinishExam = () => {
    setIsRunning(false);
    setIsFinished(true);
  };

  const exportToCSV = () => {
    const headers = 'Questao,Tempo_Segundos,Tempo_Formatado,Status\n';
    const rows = history.map(q => {
      let status = 'NÃO RESPONDIDA';
      if (q.visited || q.timeSpent > 0) {
        status = q.timeSpent > pacePerQuestion ? 'LENTA' : q.timeSpent > config.alertThreshold ? 'ALERTA' : 'RÁPIDA';
      }
      return `${q.id},${q.timeSpent},"${format(q.timeSpent)}",${status}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ENEM_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const answeredQuestions = history.filter(q => q.timeSpent > 0);
  const avgTime = answeredQuestions.length > 0 
    ? Math.floor(answeredQuestions.reduce((a, b) => a + b.timeSpent, 0) / answeredQuestions.length) 
    : 0;

  // Calcula a soma total de tempo gasto em todas as questões feitas
  const totalTimeSpent = history.reduce((acc, q) => acc + q.timeSpent, 0);

  const currentQData = history.find(q => q.id === currentQ);
  const currentQTime = currentQData ? currentQData.timeSpent : 0;

  return (
    <div className="min-h-screen bg-base-300 p-2 sm:p-4 flex flex-col items-center justify-center font-sans relative">
      
      {/* PWA Alert */}
      {(offlineReady || needRefresh) && (
        <div className="toast toast-top toast-center z-[100] w-full max-w-xs">
          <div className="alert alert-info shadow-lg flex flex-col gap-2">
            <span className="text-xs font-bold">{offlineReady ? 'Pronto Offline' : 'Atualização Disponível!'}</span>
            <div className="flex gap-2 w-full">
              {needRefresh && <button className="btn btn-xs btn-primary flex-1" onClick={() => updateServiceWorker(true)}>Atualizar</button>}
              <button className="btn btn-xs flex-1" onClick={closePwaToast}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {!isFinished ? (
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          
          {/* PAINEL DO CRONÔMETRO PRINCIPAL */}
          <div className="card w-full bg-base-100 shadow-2xl border border-primary/10 overflow-hidden">
            <div className="flex justify-between items-center p-3 border-b border-base-200 bg-base-200/30">
              <button 
                className="btn btn-ghost btn-circle btn-sm text-base-content/70"
                onClick={() => (document.getElementById('settings_modal') as any).showModal()}
                disabled={isRunning || answeredQuestions.length > 0}
              >
                <Settings size={20} />
              </button>
              <span className="font-bold text-xs tracking-wider opacity-60">PRO TIMER MODO ESTRATÉGICO</span>
              <ThemeSwitch />
            </div>

            <div className="card-body px-6 py-8 items-center text-center">
              <div className="flex justify-between w-full mb-8 font-mono text-base-content/60">
                <div className="text-left">
                  <p className="text-[10px] uppercase font-black tracking-widest">Questão Atual</p>
                  <p className="text-lg font-black text-base-content">{currentQ} <span className="opacity-30 text-xs">/ {config.totalQuestions}</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-black tracking-widest">Tempo Restante Total</p>
                  <p className={`text-lg font-black ${timeLeft < 600 ? 'text-error animate-pulse' : 'text-base-content'}`}>{format(timeLeft, true)}</p>
                </div>
              </div>

              <div className="text-[10px] uppercase font-black tracking-widest opacity-40 mb-1">Tempo nesta Questão</div>
              <div className={`text-7xl sm:text-8xl font-mono font-black mb-6 transition-all tracking-tighter ${
                currentQTime > pacePerQuestion ? 'text-error animate-pulse' : 
                currentQTime > config.alertThreshold ? 'text-warning' : 'text-primary'
              }`}>
                {format(currentQTime)}
              </div>

              <progress className="progress progress-primary w-full mb-8 h-3" value={currentQ} max={config.totalQuestions}></progress>

              <div className="card-actions w-full flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  <button 
                    className={`btn btn-lg h-20 shadow-xl border-2 transition-all ${isRunning ? 'btn-outline btn-warning' : 'btn-primary text-xl font-black italic'}`}
                    onClick={() => setIsRunning(!isRunning)}
                  >
                    {isRunning ? <><Pause size={24}/> PAUSAR</> : <><Play size={24}/> INICIAR RELÓGIO</>}
                  </button>
                  
                  <button 
                    className="btn btn-secondary btn-lg h-20 shadow-lg font-black text-xl"
                    onClick={handleNext}
                    disabled={!isRunning}
                  >
                    Próxima <ChevronRight size={24}/>
                  </button>
                </div>

                <div className="divider opacity-50 my-1">Ações Globais</div>

                <button 
                  className="btn btn-error btn-outline btn-block font-bold shadow-md"
                  onClick={() => window.confirm("Deseja realmente encerrar a prova agora?") && handleFinishExam()}
                >
                  <Square size={16} fill="currentColor"/> Finalizar Simulado Completamente
                </button>
              </div>
            </div>
          </div>

          {/* TABELA / GRADE LATERAL DE NAVEGAÇÃO DE QUESTÕES */}
          <div className="card w-full bg-base-100 shadow-xl border border-base-200 p-4 max-h-[550px] lg:max-h-[600px] flex flex-col">
            <h3 className="font-black uppercase tracking-wider text-sm mb-3 opacity-70 text-center lg:text-left">Painel de Questões</h3>
            <div className="grid grid-cols-5 gap-2 overflow-y-auto p-1 flex-1 shadow-inner rounded-xl bg-base-200/50">
              {history.map((q) => {
                const isCurrent = q.id === currentQ;
                const hasTime = q.timeSpent > 0;
                
                let btnClass = "btn-neutral btn-outline opacity-70";
                if (isCurrent) btnClass = "btn-primary ring-2 ring-primary ring-offset-2 font-black";
                else if (hasTime && q.timeSpent > pacePerQuestion) btnClass = "btn-error text-error-content";
                else if (hasTime && q.timeSpent > config.alertThreshold) btnClass = "btn-warning text-warning-content";
                else if (hasTime) btnClass = "btn-success text-success-content";
                else if (q.visited) btnClass = "btn-neutral";

                return (
                  <button
                    key={q.id}
                    onClick={() => navigateToQuestion(q.id)}
                    className={`btn btn-sm p-0 font-mono text-xs shadow-sm ${btnClass}`}
                    title={q.timeSpent > 0 ? `Tempo: ${format(q.timeSpent)}` : 'Não visitada'}
                  >
                    {q.id.toString().padStart(2, '0')}
                    {q.timeSpent > 0 && <span className="absolute bottom-0 text-[7px] opacity-60 font-sans">{format(q.timeSpent)}</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-[10px] space-y-1 opacity-70 px-1">
              <div className="flex gap-2 items-center"><div className="w-2 h-2 rounded-full bg-success"></div> Tempo ideal</div>
              <div className="flex gap-2 items-center"><div className="w-2 h-2 rounded-full bg-warning"></div> Próximo do limite</div>
              <div className="flex gap-2 items-center"><div className="w-2 h-2 rounded-full bg-error"></div> Estourou tempo médio</div>
            </div>
          </div>

        </div>
      ) : (
        /* --- VISÃO DE RESULTADOS E ESTATÍSTICAS --- */
        <div className="card w-full max-w-3xl bg-base-100 shadow-2xl border border-primary/10 overflow-hidden">
          <div className="card-body p-4 sm:p-10">
            <h2 className="text-3xl font-black text-center mb-2 italic tracking-tight uppercase">Simulado Concluído!</h2>
            
            <div className="stats stats-vertical lg:stats-horizontal shadow bg-base-200 w-full mb-6 font-mono border border-base-300">
              <div className="stat place-items-center">
                <div className="stat-title text-[10px] uppercase font-black">Média/Questão (Feitas)</div>
                <div className={`stat-value text-2xl ${avgTime > pacePerQuestion ? 'text-error' : 'text-success'}`}>{format(avgTime)}</div>
              </div>
              
              {/* TEMPO TOTAL GASTO */}
              <div className="stat place-items-center">
                <div className="stat-title text-[10px] uppercase font-black">Tempo Total Gasto</div>
                <div className="stat-value text-2xl text-primary">{format(totalTimeSpent, true)}</div>
              </div>

              {/* TEMPO SOBRANDO (LADO A LADO COM O GASTO) */}
              <div className="stat place-items-center">
                <div className="stat-title text-[10px] uppercase font-black">Tempo Restante</div>
                <div className="stat-value text-2xl text-secondary">{format(timeLeft, true)}</div>
              </div>

              <div className="stat place-items-center">
                <div className="stat-title text-[10px] uppercase font-black">Questões Lentas</div>
                <div className="stat-value text-2xl text-warning">{history.filter(q => q.timeSpent > pacePerQuestion).length}</div>
              </div>
            </div>

            <div className="flex gap-3 mb-6">
              <button 
                className="btn btn-secondary flex-1 shadow-lg font-black uppercase tracking-widest text-xs" 
                onClick={exportToCSV}
              >
                <Download size={16}/> Exportar Dados (.CSV)
              </button>
            </div>

            {/* LISTA DETALHADA DE TODAS AS QUESTÕES */}
            <div className="bg-base-200 rounded-3xl p-2 mb-8 max-h-80 overflow-y-auto border border-base-300 shadow-inner">
              <table className="table table-pin-rows">
                <thead>
                  <tr className="border-b border-base-300">
                    <th className="bg-base-200 font-black text-[10px] uppercase tracking-widest opacity-50 text-center">ID</th>
                    <th className="bg-base-200 font-black text-[10px] uppercase tracking-widest opacity-50">Tempo Gasto</th>
                    <th className="bg-base-200 font-black text-[10px] uppercase tracking-widest opacity-50 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {[...history].map((record) => (
                    <tr key={record.id} className="border-base-300 hover:bg-base-100 transition-colors">
                      <td className="text-center font-bold opacity-40 italic">{record.id}</td>
                      <td className="font-black text-lg">
                         <div className="flex items-center gap-2">
                           <Clock size={14} className="opacity-30" />
                           {format(record.timeSpent)}
                         </div>
                      </td>
                      <td className="text-right">
                        {record.timeSpent === 0 ? (
                          <span className="badge badge-neutral badge-sm font-black italic opacity-40">PULADA</span>
                        ) : record.timeSpent > pacePerQuestion ? (
                          <span className="badge badge-error badge-sm font-black italic">LENTA</span>
                        ) : record.timeSpent > config.alertThreshold ? (
                          <span className="badge badge-warning badge-sm font-black italic">ALERTA</span>
                        ) : (
                          <span className="badge badge-success badge-sm font-black italic">RÁPIDA</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="btn btn-primary btn-block btn-lg shadow-2xl font-black uppercase tracking-widest" onClick={() => window.location.reload()}>
              <RotateCcw size={20}/> Reiniciar Novo Simulado
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL DE CONFIGURAÇÕES --- */}
      <dialog id="settings_modal" className="modal modal-bottom sm:modal-middle">
        <div className="modal-box p-6 bg-base-100 border-none">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-2xl uppercase italic tracking-tighter">Configurações</h3>
            <button className="btn btn-ghost btn-xs text-error font-black uppercase tracking-widest" onClick={handleResetConfig}>
              Resetar Padrões
            </button>
          </div>

          <div className="space-y-8 text-left">
            <div className="form-control">
              <label className="label py-0"><span className="label-text font-black uppercase text-[10px] opacity-50 tracking-widest">Total de Questões</span></label>
              <input 
                type="number" 
                className="input input-ghost border-none focus:outline-none w-full font-black text-2xl bg-base-200 mt-2 h-14" 
                value={config.totalQuestions} 
                onChange={(e) => setConfig({...config, totalQuestions: Number(e.target.value) || 1})}
              />
            </div>

            <div className="form-control">
              <label className="label py-0 flex justify-between items-end">
                <span className="label-text font-black uppercase text-[10px] opacity-50 tracking-widest">Tempo Total de Prova</span>
                <span className="text-primary font-mono font-black text-xs">{format(pacePerQuestion)}/q</span>
              </label>
              <input 
                type="time" 
                className="input input-ghost border-none focus:outline-none w-full font-black text-3xl h-16 bg-base-200 mt-2 text-center uppercase" 
                value={minutesToTimeString(config.totalMinutes)}
                onChange={(e) => setConfig({...config, totalMinutes: timeStringToMinutes(e.target.value) || 1})}
              />
            </div>
            
          </div>
          <div className="modal-action mt-10">
            <form method="dialog" className="w-full">
              <button className="btn btn-primary btn-block btn-lg font-black shadow-lg border-none uppercase">Salvar e Fechar</button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  );
}