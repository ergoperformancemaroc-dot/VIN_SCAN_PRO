
import React, { useState, useRef, useEffect } from 'react';
import { extractVehicleData, extractLocationData } from './services/geminiService';
import { VehicleInfo, ScanType, AppSettings } from './types';
import { Button } from './components/Button';

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [vehicleData, setVehicleData] = useState<Partial<VehicleInfo>>({});
  const [history, setHistory] = useState<VehicleInfo[]>([]);
  const [activeLocation, setActiveLocation] = useState<string>('');
  const [newLocationInput, setNewLocationInput] = useState<string>('');
  const [isLocationLocked, setIsLocationLocked] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  // États pour la confirmation de suppression sécurisée
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isConfirmingClearSettings, setIsConfirmingClearSettings] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>({
    companyName: 'MA CONCESSION',
    allowedLocations: [],
    strictLocationMode: false
  });
  
  const vinCameraRef = useRef<HTMLInputElement>(null);
  const vinGalleryRef = useRef<HTMLInputElement>(null);
  const locCameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    const savedHistory = localStorage.getItem('vin_scan_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    
    const savedSettings = localStorage.getItem('vin_scan_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  useEffect(() => {
    localStorage.setItem('vin_scan_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('vin_scan_settings', JSON.stringify(settings));
  }, [settings]);

  const vibrate = (type: 'success' | 'warning' | 'error' = 'success') => {
    if (!window.navigator || !window.navigator.vibrate) return;
    const patterns = { success: [10, 30, 10], warning: [100, 50, 100], error: [200, 50, 200] };
    window.navigator.vibrate(patterns[type]);
  };

  const handleShare = async () => {
    const shareData = {
      title: 'VIN Scan Pro',
      text: `Application de gestion de stock pour ${settings.companyName}`,
      url: window.location.origin + window.location.pathname,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        vibrate('success');
      } else {
        await copyAppURL();
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') await copyAppURL();
    }
  };

  const copyAppURL = async () => {
    const url = window.location.origin + window.location.pathname;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        showCopySuccess();
        return;
      } catch (e) {}
    }
    const textArea = document.createElement("textarea");
    textArea.value = url;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showCopySuccess();
    } catch (err) {}
    document.body.removeChild(textArea);
  };

  const showCopySuccess = () => {
    setCopyFeedback(true);
    vibrate('success');
    setTimeout(() => setCopyFeedback(false), 2500);
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('vin_scan_history');
    setIsConfirmingClear(false);
    setIsConfirmingClearSettings(false);
    vibrate('warning');
  };

  const exportToCSV = () => {
    if (history.length === 0) return;
    const headers = ["NIV", "Marque", "Modele", "Annee", "Emplacement", "Remarques", "Date", "Heure", "Entreprise"];
    const rows = history.map(item => [
      item.vin, item.make, item.model, item.year, item.location, 
      item.remarks || "", item.fullDate, item.timestamp, settings.companyName
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `stock_${settings.companyName.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: ScanType) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      try {
        if (type === 'vin') {
          const result = await extractVehicleData(base64String);
          if (result.error) {
            setError(result.error);
            vibrate('error');
          } else {
            const detectedVin = (result.vin || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (detectedVin.length !== 17) {
              setError(`NIV incomplet (${detectedVin.length}/17). Réessayez.`);
              setVehicleData({ vin: detectedVin, make: result.make || '', model: result.model || '', year: result.year || '' });
              vibrate('warning');
            } else if (history.some(item => item.vin === detectedVin)) {
              setError("VÉHICULE DÉJÀ EN STOCK");
              vibrate('error');
            } else {
              vibrate('success');
              setVehicleData({ vin: detectedVin, make: result.make || '', model: result.model || '', year: result.year || '', remarks: '' });
            }
          }
        } else {
          const locResult = await extractLocationData(base64String);
          if (locResult) {
            vibrate('success');
            setActiveLocation(locResult.toUpperCase().substring(0, 15));
            setIsLocationLocked(true);
          }
        }
      } catch (err) {
        setError("Erreur IA. Vérifiez votre connexion.");
      } finally {
        setLoading(false);
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const saveToHistory = () => {
    const vin = (vehicleData.vin || '').trim().toUpperCase();
    if (vin.length !== 17 || !activeLocation) return;
    const now = new Date();
    const newEntry: VehicleInfo = {
      vin, make: vehicleData.make || 'Inconnue', model: vehicleData.model || 'Inconnu', year: vehicleData.year || 'N/A',
      location: activeLocation, remarks: (vehicleData.remarks || '').trim(),
      fullDate: now.toLocaleDateString('fr-FR'), timestamp: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };
    setHistory([newEntry, ...history]);
    setVehicleData({ vin: '', make: '', model: '', year: '', remarks: '' }); 
    vibrate('success');
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col font-sans relative pb-10">
      
      {!isStandalone && (
        <div className="bg-blue-900 text-white p-4 flex items-center justify-between border-b border-blue-800 sticky top-0 z-[100] shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">📲</span>
            <div className="flex flex-col">
              <p className="text-[9px] font-black uppercase leading-tight tracking-tighter">Mode App :</p>
              <p className="text-[8px] text-blue-300 font-bold uppercase italic">Ajouter à l'écran d'accueil</p>
            </div>
          </div>
          <button onClick={handleShare} className={`text-[9px] font-black px-4 py-2 rounded-lg transition-all active:scale-90 border-2 ${copyFeedback ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-blue-600 border-blue-400 text-white'}`}>
            {copyFeedback ? 'LIEN COPIÉ !' : 'PARTAGER'}
          </button>
        </div>
      )}

      <header className="bg-blue-600 text-white p-6 pb-12 rounded-b-[3rem] shadow-xl relative z-40" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
        <div className="flex justify-between items-center">
          <div className="flex-1 mr-4 overflow-hidden">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tighter uppercase italic truncate">{settings.companyName}</h1>
              <span className="bg-amber-400 text-amber-900 text-[8px] font-black px-1.5 py-0.5 rounded italic">BETA</span>
            </div>
            <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mt-1">Stock IA Pro v0.8.0</p>
          </div>
          <button onClick={() => setShowSettings(true)} className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 active:scale-90 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black uppercase italic tracking-tight text-slate-900">Paramètres</h2>
              <button onClick={() => {setShowSettings(false); setIsConfirmingClearSettings(false);}} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">✕</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nom Concession</label>
                <input value={settings.companyName} onChange={e => setSettings({...settings, companyName: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold focus:border-blue-500 outline-none" />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Zones de Stockage</label>
                <div className="flex gap-2 mb-2">
                  <input maxLength={15} value={newLocationInput} onChange={e => setNewLocationInput(e.target.value.toUpperCase())} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none" placeholder="Ex: ZONE-A" />
                  <button onClick={() => { if(newLocationInput){ setSettings({...settings, allowedLocations: [...settings.allowedLocations, newLocationInput.toUpperCase()]}); setNewLocationInput(''); vibrate('success'); } }} className="bg-blue-600 text-white px-5 rounded-xl font-bold">+</button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                  {settings.allowedLocations.length === 0 && <p className="text-[9px] text-slate-400 italic">Aucune zone enregistrée</p>}
                  {settings.allowedLocations.map(loc => (
                    <span key={loc} className="bg-slate-100 px-3 py-1.5 rounded-lg text-[10px] font-black text-slate-700 flex items-center gap-2">
                      {loc} <button onClick={() => setSettings({...settings, allowedLocations: settings.allowedLocations.filter(l => l !== loc)})} className="text-red-400">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                {!isConfirmingClearSettings ? (
                  <button 
                    onClick={() => setIsConfirmingClearSettings(true)}
                    className="w-full py-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 border-red-100 transition-all"
                  >
                    Vider l'historique de stock
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={handleClearHistory} className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg animate-pulse">Confirmer ?</button>
                    <button onClick={() => setIsConfirmingClearSettings(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">Annuler</button>
                  </div>
                )}
              </div>
            </div>
            <Button onClick={() => setShowSettings(false)} className="w-full py-4 uppercase font-black tracking-widest text-[11px]">Enregistrer</Button>
          </div>
        </div>
      )}

      <main className="flex-1 p-5 -mt-8 space-y-6 z-10">
        {/* SECTION EMPLACEMENT */}
        <section className={`bg-white p-6 rounded-[2.5rem] shadow-xl border-2 transition-all ${!isLocationLocked ? 'border-blue-500 ring-4 ring-blue-500/5' : 'border-slate-100'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Emplacement</h2>
            {isLocationLocked && <button onClick={() => setIsLocationLocked(false)} className="text-[10px] font-black text-blue-600 uppercase underline">Modifier</button>}
          </div>
          
          {!isLocationLocked ? (
            <div className="space-y-3">
              <select value={activeLocation} onChange={e => setActiveLocation(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-black text-slate-900 focus:border-blue-500 outline-none appearance-none">
                <option value="">-- Choisir une Zone --</option>
                {settings.allowedLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-[2px] bg-slate-100"></div>
                <span className="text-[8px] font-black text-slate-300 uppercase italic">Ou Scanner</span>
                <div className="flex-1 h-[2px] bg-slate-100"></div>
              </div>
              <button onClick={() => locCameraRef.current?.click()} className="w-full flex items-center justify-center gap-3 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">
                Scanner Panneau Zone
              </button>
              <Button onClick={() => { if(activeLocation) setIsLocationLocked(true); vibrate('success'); }} disabled={!activeLocation} className="w-full py-4 bg-emerald-600 font-black uppercase tracking-widest text-[11px]">Valider la Zone</Button>
            </div>
          ) : (
            <div className="flex items-center gap-4 bg-emerald-50 p-5 rounded-[2rem] border border-emerald-100 animate-in zoom-in-95">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Zone Actuelle :</p>
                <p className="text-lg font-black text-slate-900 tracking-tight">{activeLocation}</p>
              </div>
            </div>
          )}
          <input type="file" accept="image/*" capture="environment" className="hidden" ref={locCameraRef} onChange={(e) => handleImageUpload(e, 'location')} />
        </section>

        {/* SECTION SCAN NIV */}
        {isLocationLocked && (
          <section className="space-y-6 animate-in slide-in-from-bottom-5 duration-500">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-white/50 space-y-4">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">2. Scanner le NIV</h2>
              <div className="space-y-3">
                <button onClick={() => vinCameraRef.current?.click()} className="w-full flex flex-col items-center justify-center gap-2 py-8 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-sm shadow-xl active:scale-95 transition-all shadow-blue-500/20">
                  <svg className="w-10 h-10 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" strokeWidth="2.5" /></svg>
                  Scanner (Photo / Fichier)
                </button>
              </div>
              <input type="file" accept="image/*" capture="environment" className="hidden" ref={vinCameraRef} onChange={(e) => handleImageUpload(e, 'vin')} />
            </div>

            {/* FORMULAIRE VÉHICULE */}
            <div className="bg-white p-7 rounded-[2.5rem] shadow-xl space-y-5 border border-white/50">
              <div className="space-y-4">
                <div className="relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">N° de Châssis (17 caractères)</label>
                  <input value={vehicleData.vin || ''} maxLength={17} onChange={e => setVehicleData({...vehicleData, vin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})} className={`w-full bg-slate-50 border-2 rounded-2xl px-5 py-5 text-lg font-black uppercase outline-none transition-all font-mono text-slate-900 ${error ? 'border-red-500 ring-4 ring-red-100' : 'border-slate-100 focus:border-blue-500'}`} placeholder="ABC123XYZ..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={vehicleData.make || ''} onChange={e => setVehicleData({...vehicleData, make: e.target.value})} className="bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none" placeholder="Marque" />
                  <input value={vehicleData.model || ''} onChange={e => setVehicleData({...vehicleData, model: e.target.value})} className="bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none" placeholder="Modèle" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Notes / Remarques</label>
                  <textarea value={vehicleData.remarks || ''} onChange={e => setVehicleData({...vehicleData, remarks: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 outline-none min-h-[60px]" placeholder="État du véhicule, clés présentes, etc..." />
                </div>
              </div>
              {error && <p className="text-[9px] font-black text-center text-red-600 uppercase bg-red-50 p-3 rounded-xl border border-red-100 animate-pulse">{error}</p>}
              <Button onClick={saveToHistory} disabled={!vehicleData.vin || vehicleData.vin.length !== 17} className="w-full py-5 rounded-2xl uppercase font-black text-[11px] shadow-2xl tracking-widest">Enregistrer au Stock</Button>
            </div>
          </section>
        )}

        {/* LISTE HISTORIQUE */}
        {history.length > 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock en cours ({history.length})</h3>
              <div className="flex gap-2">
                {!isConfirmingClear ? (
                  <button onClick={() => setIsConfirmingClear(true)} className="text-[9px] font-black text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100 active:scale-95 transition-all uppercase">Vider</button>
                ) : (
                  <div className="flex gap-1">
                    <button onClick={handleClearHistory} className="text-[8px] font-black text-white bg-red-600 px-3 py-2 rounded-xl">OUI</button>
                    <button onClick={() => setIsConfirmingClear(false)} className="text-[8px] font-black text-slate-500 bg-slate-100 px-3 py-2 rounded-xl">NON</button>
                  </div>
                )}
                <button onClick={exportToCSV} className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 active:scale-95 transition-all uppercase font-mono">CSV</button>
              </div>
            </div>
            
            <div className="space-y-3 px-1">
              {history.map((item, idx) => (
                <div key={idx} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex-shrink-0 flex items-center justify-center text-blue-600 font-black text-[11px] uppercase font-mono">{item.make.substring(0, 1) || 'V'}</div>
                      <div className="truncate">
                        <p className="text-xs font-black text-slate-900 truncate tracking-tight">{item.make} {item.model}</p>
                        <p className="text-[9px] font-mono text-slate-400 font-bold uppercase truncate">{item.vin}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="bg-slate-900 text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase">{item.location}</span>
                    </div>
                  </div>
                  {item.remarks && (
                    <div className="bg-amber-50 p-3 rounded-xl border border-dashed border-amber-200">
                      <p className="text-[9px] text-amber-800 italic leading-snug"><span className="font-black not-italic text-amber-500 mr-1 uppercase">Notes:</span>{item.remarks}</p>
                    </div>
                  )}
                  <div className="flex justify-between items-center opacity-40">
                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{settings.companyName}</p>
                    <p className="text-[7px] font-bold text-slate-400 uppercase">{item.fullDate} - {item.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* LOADER IA */}
      {loading && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[300] flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-xl">🔍</div>
          </div>
          <p className="font-black text-white uppercase tracking-[0.2em] text-[10px] mt-8 animate-pulse">Intelligence Artificielle en action...</p>
          <p className="text-[9px] text-blue-300 font-bold mt-2 uppercase italic">Analyse du NIV et décodage du véhicule</p>
        </div>
      )}
    </div>
  );
};

export default App;
