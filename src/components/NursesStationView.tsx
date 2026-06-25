import React, { useState } from "react";
import { Wrench, X, Radio, Plus, ShieldAlert, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { AppUser, NursesStation, NurseStationDevice, Asset, Patient } from "../types";
import SmartSearchPicker from "./SmartSearchPicker";

interface NursesStationViewProps {
  isRTL: boolean;
  currentUser: AppUser | null;
  nursesStations: NursesStation[];
  stationDevices: NurseStationDevice[];
  selectedStationId: string;
  setSelectedStationId: (id: string) => void;
  setIsVisitModalOpen: (open: boolean) => void;
  resolveSosAlert: (id: string) => Promise<void>;
  sosAlertsList: any[];
  assets: Asset[];
  patients: Patient[];
  apiFetch: any;
  fetchNursesStationsAndDevices: () => Promise<void>;
  fetchData: (silent?: boolean) => Promise<void>;
}

const NursesStationView: React.FC<NursesStationViewProps> = ({
  isRTL,
  currentUser,
  nursesStations,
  stationDevices,
  selectedStationId,
  setSelectedStationId,
  setIsVisitModalOpen,
  resolveSosAlert,
  sosAlertsList,
  assets,
  patients,
  apiFetch,
  fetchNursesStationsAndDevices,
  fetchData,
}) => {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);
  const [isManualVitalsModalOpen, setIsManualVitalsModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<any | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Manual Vitals form state
  const [manualVitalsPulse, setManualVitalsPulse] = useState(72);
  const [manualVitalsTemp, setManualVitalsTemp] = useState(36.6);
  const [manualVitalsBp, setManualVitalsBp] = useState("120/80");
  const [manualVitalsSpo2, setManualVitalsSpo2] = useState(98);

  // Link form state
  const [linkAssetId, setLinkAssetId] = useState("");
  const [linkPatientId, setLinkPatientId] = useState("");
  const [linkBedNumber, setLinkBedNumber] = useState("");
  const [linkVitalsPulse, setLinkVitalsPulse] = useState(72);
  const [linkVitalsTemp, setLinkVitalsTemp] = useState(36.6);
  const [linkVitalsBp, setLinkVitalsBp] = useState("120/80");
  const [linkVitalsSpo2, setLinkVitalsSpo2] = useState(98);

  // Station form state
  const [stationName, setStationName] = useState("");
  const [stationLocation, setStationLocation] = useState("");
  const [stationHeadNurseId, setStationHeadNurseId] = useState("");

  const activeStation = nursesStations.find(s => s.id === selectedStationId);
  const activeDevices = stationDevices.filter(d => d.station_id === selectedStationId);

  // Assets currently linked
  const linkedAssetIds = new Set(stationDevices.map(d => d.asset_id));
  // Filter available assets
  const availableAssets = assets.filter(a => !linkedAssetIds.has(a.id) && a.status !== "In Use" && a.status !== "Scrapped");
  const selectableAssets = availableAssets.length > 0 ? availableAssets : assets.filter(a => !linkedAssetIds.has(a.id));

  const handleSaveStation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        name: stationName,
        location: stationLocation,
        head_nurse_id: stationHeadNurseId || null
      };
      let res;
      if (editingStation) {
        res = await apiFetch(`/api/nurses-stations/${editingStation.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      } else {
        res = await apiFetch("/api/nurses-stations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });
      }

      if (res.ok) {
        toast.success(isRTL ? "تم حفظ محطة التمريض بنجاح" : "Nurses station saved successfully");
        setIsStationModalOpen(false);
        setEditingStation(null);
        setStationName("");
        setStationLocation("");
        setStationHeadNurseId("");
        fetchNursesStationsAndDevices();
      } else {
        toast.error(isRTL ? "فشل في حفظ محطة التمريض" : "Failed to save nurses station");
      }
    } catch (err) {
      console.error(err);
      toast.error("Internal Error");
    }
  };

  const handleDeleteStation = async (id: string) => {
    if (!window.confirm(isRTL ? "هل أنت متأكد من رغبتك في حذف محطة التمريض هذه؟ سيتم إلغاء ربط الأجهزة التابعة لها." : "Are you sure you want to delete this station? All linked devices will be unlinked.")) return;
    try {
      const res = await apiFetch(`/api/nurses-stations/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(isRTL ? "تم حذف المحطة بنجاح" : "Station deleted successfully");
        if (selectedStationId === id) {
          setSelectedStationId(nursesStations[0]?.id || "");
        }
        fetchNursesStationsAndDevices();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLinkDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkAssetId) {
      toast.error(isRTL ? "الرجاء اختيار الجهاز الطبي" : "Please select a medical device");
      return;
    }
    try {
      const body = {
        station_id: selectedStationId,
        asset_id: linkAssetId,
        patient_id: linkPatientId || null,
        bed_number: linkBedNumber || `Bed ${Math.floor(Math.random() * 200 + 1)}`,
        vitals_pulse: Number(linkVitalsPulse),
        vitals_temp: Number(linkVitalsTemp),
        vitals_bp: linkVitalsBp,
        vitals_spo2: Number(linkVitalsSpo2)
      };
      const res = await apiFetch("/api/nurses-stations-devices/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        toast.success(isRTL ? "تم تفعيل مراقبة الجهاز والسرير بنجاح" : "Telemetry setup active!");
        setIsLinkModalOpen(false);
        setLinkAssetId("");
        setLinkPatientId("");
        setLinkBedNumber("");
        fetchNursesStationsAndDevices();
        // Force active asset status refresh by fetching full sync
        fetchData(true);
      } else {
        const errData = await res.json();
        toast.error(errData.error || (isRTL ? "فشل ربط الجهاز" : "Failed to link device"));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnlinkDevice = async (id: string) => {
    const reason = window.prompt(isRTL ? "سبب الإخلاء / إلغاء الربط:" : "Reason for evacuation / unlinking:", isRTL ? "تحسن الحالة" : "Patient condition improved");
    if (reason === null) return; // Cancelled
    
    try {
      const res = await apiFetch(`/api/nurses-stations-devices/${id}/unlink`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        toast.success(isRTL ? "تم فصل وإخلاء الجهاز بنجاح" : "Device disconnected and available.");
        fetchNursesStationsAndDevices();
        fetchData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualVitalsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceId) return;

    try {
      const body = {
        vitals_pulse: Number(manualVitalsPulse),
        vitals_temp: Number(manualVitalsTemp),
        vitals_bp: manualVitalsBp,
        vitals_spo2: Number(manualVitalsSpo2),
        status: "monitoring"
      };
      const res = await apiFetch(`/api/nurses-stations-devices/${selectedDeviceId}/vitals`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        toast.success(isRTL ? "تم تحديث المؤشرات الحيوية يدويا" : "Vitals updated manually");
        setIsManualVitalsModalOpen(false);
        fetchNursesStationsAndDevices();
      } else {
        toast.error(isRTL ? "فشل تحديث المؤشرات" : "Failed to update vitals");
      }
    } catch (err) {
      console.error(err);
      toast.error("Internal Error");
    }
  };

  const editStationHandler = (st: any) => {
    setEditingStation(st);
    setStationName(st.name);
    setStationLocation(st.location);
    setStationHeadNurseId(st.head_nurse_id || "");
    setIsStationModalOpen(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-teal-500 to-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 text-white px-3 py-1 rounded-full text-[10px] font-mono tracking-wider font-extrabold uppercase">
              {isRTL ? "قسم الأجهزة الحيوية والتمريض" : "CLINICAL TELEMETRY"}
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight uppercase leading-none">
            {isRTL ? "محطات التمريض والمراقبة المركزية" : "Nurses Station Central"}
          </h1>
          <p className="text-white/80 font-medium text-sm">
            {isRTL
              ? "ربط الأجهزة الطبية الحية بأسرة المرضى ومراقبة المؤشرات الحيوية بشكل فوري وتفاعلي."
              : "Bind medical assets directly to patient beds, and track live biometric streaming telemetry."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingStation(null);
              setStationName("");
              setStationLocation("");
              setStationHeadNurseId("");
              setIsStationModalOpen(true);
            }}
            className="px-6 py-3 bg-white text-teal-700 hover:bg-slate-50 font-black text-xs rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Plus size={14} />
            {isRTL ? "إنشاء محطة جديدة" : "New Nurses Station"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left column: stations list */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest px-1">
            {isRTL ? "المحطات والأجنحة" : "Stations & Wards"}
          </h2>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {nursesStations.map((st) => {
              const devCount = stationDevices.filter((d) => d.station_id === st.id).length;
              const alertCount = sosAlertsList.filter((a) => a.location === st.location && a.status === "Active").length;
              const isActive = selectedStationId === st.id;

              return (
                <div
                  key={st.id}
                  onClick={() => setSelectedStationId(st.id)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                    isActive
                      ? "bg-slate-900 border-slate-900 text-white shadow-md"
                      : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-gray-800"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-sm leading-tight">{st.name}</h3>
                      <p className={`text-[11px] mt-1 ${isActive ? "text-slate-300" : "text-gray-400"}`}>
                        📍 {st.location}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                      }`}>
                        {devCount} {isRTL ? "أجهزة" : "devs"}
                      </span>
                      {alertCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white animate-pulse">
                          🚨 {alertCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions on station */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-dashed border-white/20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        editStationHandler(st);
                      }}
                      className="text-xs font-bold hover:underline py-1 px-2 rounded hover:bg-white/10"
                    >
                      {isRTL ? "تعديل" : "Edit"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteStation(st.id);
                      }}
                      className="text-xs font-bold hover:underline text-red-400 py-1 px-2 rounded hover:bg-red-500/10"
                    >
                      {isRTL ? "حذف" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}

            {nursesStations.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-xs">
                {isRTL ? "لم يتم تسجيل أي محطات بعد" : "No nurses stations registered."}
              </div>
            )}
          </div>
        </div>

        {/* Connected Beds Dashboard */}
        <div className="lg:col-span-3 space-y-6">
          {!activeStation ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center text-gray-500">
              {isRTL ? "الرجاء اختيار أو إنشاء محطة تمريض للبدء" : "Please choose or create a Nurses Station to begin"}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Station Info Card */}
              <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Radio size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800">{activeStation.name}</h2>
                    <p className="text-xs text-slate-500">
                      <span>📍 {isRTL ? `الموقع: ${activeStation.location}` : `Location: ${activeStation.location}`}</span>
                      {activeStation.head_nurse_id && (
                        <span className="before:content-['•'] before:mx-2 text-slate-400">
                          👤 {isRTL ? "رئيسة التمريض: Sarah Connor" : "Head Nurse: u1"}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div>
                  <button
                    onClick={() => {
                      setLinkAssetId("");
                      setLinkPatientId("");
                      setLinkBedNumber("");
                      setIsLinkModalOpen(true);
                    }}
                    className="px-4 py-2 bg-slate-900 border border-slate-900 text-white font-black text-xs rounded-xl flex items-center gap-2 hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    {isRTL ? "ربط جهاز طبي بسرير" : "Link Device to Bed"}
                  </button>
                </div>
              </div>

              {/* Patient SOS Window */}
              <div className="space-y-4 bg-white p-6 rounded-[2.5rem] border border-red-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full blur-3xl -z-10 opacity-50" />
                
                <h3 className="text-sm font-black uppercase text-red-600 flex items-center gap-2">
                  <ShieldAlert size={18} className={sosAlertsList.some(alert => alert.status === 'Active') ? "animate-bounce text-red-500" : "text-red-300"} />
                  {isRTL ? "نافذة استغاثة المرضى (SOS)" : "Patient SOS Emergency Window"}
                </h3>

                {sosAlertsList.some(alert => alert.status === 'Active') ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sosAlertsList.filter(alert => alert.status === 'Active').map(alert => (
                      <div key={alert.id} className="bg-red-50 border-2 border-red-200 rounded-3xl p-5 shadow-lg shadow-red-100 flex flex-col justify-between animate-pulse relative z-10">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-black text-red-700 text-sm">{alert.patient_name}</h4>
                            <span className="text-[10px] font-mono font-bold text-red-400 bg-red-100 px-2 py-0.5 rounded-full">{alert.id}</span>
                          </div>
                          <p className="text-xs text-red-600 font-bold mb-3 leading-relaxed">"{alert.message}"</p>
                          <div className="flex items-center gap-2 text-[10px] text-red-500 font-black uppercase">
                            <MapPin size={12} />
                            {alert.location}
                          </div>
                        </div>
                        <button 
                          onClick={() => resolveSosAlert(alert.id)}
                          className="w-full mt-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-red-200"
                        >
                          {isRTL ? "استجابة وإلغاء الاستغاثة" : "Resolve Emergency"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-red-100 rounded-2xl p-6 text-center text-xs text-slate-400">
                    {isRTL ? "لا توجد استغاثات نشطة حاليا. جميع المرضى مستقرون." : "No active distress calls. All telemetry indicators normal."}
                  </div>
                )}
              </div>

              {/* Devices Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeDevices.map((dev) => {
                  const hasAlert = sosAlertsList.some(
                    (alert) => alert.patient_id === dev.patient_id && alert.status === "Active"
                  );

                  return (
                    <div
                      key={dev.id}
                      className={`bg-white rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col justify-between transition-all ${
                        hasAlert
                          ? "border-red-500 ring-2 ring-red-100"
                          : "border-slate-150 hover:border-slate-300"
                      }`}
                    >
                      {/* Bed header */}
                      <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
                        <div>
                          <span className="text-[10px] font-mono tracking-wider font-black text-indigo-500 uppercase">
                            🛏️ {dev.bed_number}
                          </span>
                          <h4 className="text-sm font-extrabold text-slate-800 leading-none mt-1">
                            {dev.patient_national_id || dev.patient_id || (isRTL ? "سرير غير مخصص لمريض" : "No Patient Assigned")}
                          </h4>
                          {dev.patient_name && (
                            <p className="text-[10px] text-gray-400">
                              {dev.patient_gender} • {isRTL ? "تاريخ الميلاد" : "DOB"}: {dev.patient_dob}
                            </p>
                          )}
                        </div>
                        <div>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black ${
                            hasAlert
                              ? "bg-red-100 text-red-700 animate-pulse"
                              : dev.status === "paused"
                              ? "bg-yellow-100 text-yellow-850"
                              : "bg-emerald-100 text-emerald-700"
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${hasAlert ? "bg-red-500" : dev.status === "paused" ? "bg-yellow-500" : "bg-emerald-500"}`} />
                            {hasAlert 
                              ? (isRTL ? "خطر حرج" : "CRITICAL") 
                              : dev.status === "paused" 
                              ? (isRTL ? "موقوف مؤقتا" : "PAUSED") 
                              : (isRTL ? "مستقر" : "MONITORING")}
                          </span>
                        </div>
                      </div>

                      {/* Telemetry panel */}
                      <div className="p-5 grid grid-cols-2 gap-4">
                        {/* Heart Beat Pulse */}
                        <div className="bg-slate-50 p-4 rounded-2xl flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-gray-400 block uppercase">
                            💓 {isRTL ? "معدل نبضات القلب" : "Heart Rate (PR)"}
                          </span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className={`text-3xl font-black font-mono ${dev.vitals_pulse > 100 || dev.vitals_pulse < 55 ? "text-red-600" : "text-emerald-600"}`}>
                              {dev.vitals_pulse || "--"}
                            </span>
                            <span className="text-xs text-gray-400 font-bold">bpm</span>
                          </div>
                          <div className="mt-2 flex items-center gap-1">
                            {/* Pulse wave visual */}
                            <svg className="w-full h-8 text-emerald-500" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2">
                              <path
                                d="M 0 20 L 25 20 L 30 10 L 35 30 L 40 5 L 45 35 L 50 20 L 100 20"
                                className={hasAlert ? "text-red-500 animate-pulse" : "animate-pulse"}
                              />
                            </svg>
                          </div>
                        </div>

                        {/* SpO2 oxygen */}
                        <div className="bg-slate-50 p-4 rounded-2xl flex flex-col justify-between">
                          <span className="text-[10px] font-bold text-gray-400 block uppercase">
                            🩸 {isRTL ? "أكسجين الدم" : "SPO₂ Level"}
                          </span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className={`text-3xl font-black font-mono ${dev.vitals_spo2 < 93 ? "text-red-600 animate-pulse" : "text-sky-600"}`}>
                              {dev.vitals_spo2 || "--"}
                            </span>
                            <span className="text-xs text-gray-400 font-bold">%</span>
                          </div>
                          <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                            <div
                              style={{ width: `${dev.vitals_spo2 || 95}%` }}
                              className={`h-2 rounded-full ${dev.vitals_spo2 < 93 ? "bg-red-500" : "bg-sky-500"}`}
                            />
                          </div>
                        </div>

                        {/* Temp & BP */}
                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <span className="text-[10px] font-bold text-gray-400 block uppercase">
                            🌡️ {isRTL ? "درجة الحرارة" : "Body Temperature"}
                          </span>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-xl font-extrabold text-slate-700 font-mono">
                              {dev.vitals_temp || "36.6"}
                            </span>
                            <span className="text-xs text-slate-400 font-bold">°C</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl">
                          <span className="text-[10px] font-bold text-gray-400 block uppercase">
                            🩺 {isRTL ? "ضغط الدم" : "Blood Pressure"}
                          </span>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-xl font-extrabold text-slate-700 font-mono">
                              {dev.vitals_bp || "120/80"}
                            </span>
                            <span className="text-xs text-slate-400 font-bold">mmHg</span>
                          </div>
                        </div>
                      </div>

                      {/* Associated medical equipment info */}
                      <div className="px-5 py-3 bg-indigo-50/50 border-t border-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          <span className="text-xs font-bold text-indigo-900 truncate max-w-[200px]">
                            {dev.asset_name} ({dev.asset_category})
                          </span>
                        </div>
                      </div>

                      {/* Link Control triggers */}
                      <div className="p-4 bg-slate-50 border-t border-gray-100 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setSelectedDeviceId(dev.id);
                            setManualVitalsPulse(dev.vitals_pulse || 72);
                            setManualVitalsTemp(dev.vitals_temp || 36.6);
                            setManualVitalsBp(dev.vitals_bp || "120/80");
                            setManualVitalsSpo2(dev.vitals_spo2 || 98);
                            setIsManualVitalsModalOpen(true);
                          }}
                          className="w-full px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-black rounded-xl border border-indigo-100 shadow-sm transition-all cursor-pointer text-center flex items-center justify-center gap-1"
                        >
                          📝 {isRTL ? "تسجيل يدوي" : "Manual Entry"}
                        </button>
                        <button
                          onClick={() => handleUnlinkDevice(dev.id)}
                          className="w-full px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-black rounded-xl border border-red-100 shadow-sm transition-all cursor-pointer text-center flex items-center justify-center gap-1"
                        >
                          ❌ {isRTL ? "إخلاء" : "Release"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {activeDevices.length === 0 && (
                  <div className="col-span-1 md:col-span-2 border border-dashed border-slate-200 rounded-[2.5rem] p-12 text-center text-gray-500 bg-slate-50/50">
                    <Wrench size={32} className="mx-auto text-slate-400 mb-2 animate-bounce" />
                    <p className="font-extrabold text-slate-700 text-sm">
                      {isRTL ? "لا يوجد أجهزة متصلة بهذه المحطة حاليا" : "No devices connected to this station yet"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {isRTL ? "انقر فوق زر ربط جهاز طبي بالسرير لتوصيل سرير" : "Click 'Link Device to Bed' to register telemetry"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==========================================
          POPUP DIALOG: ADD/EDIT NURSES STATION
          ========================================== */}
      {isStationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full p-6 shadow-2xl border border-gray-100 relative">
            <button
              onClick={() => setIsStationModalOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>
            <h3 className="text-xl font-black text-gray-800 mb-4 uppercase">
              {editingStation 
                ? (isRTL ? "تعديل محطة التمريض" : "Edit Nurses Station") 
                : (isRTL ? "إنشاء محطة تمريض جديدة" : "Create Nurses Station")}
            </h3>
            <form onSubmit={handleSaveStation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  {isRTL ? "اسم المحطة / الجناح" : "Station / Ward Name"}
                </label>
                <input
                  type="text"
                  required
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  placeholder={isRTL ? "مثال: جناح العناية المركزة أ" : "e.g., Ward A Emergency Line"}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  {isRTL ? "موقع الجناح في المستشفى" : "Location (Building/Floor)"}
                </label>
                <input
                  type="text"
                  required
                  value={stationLocation}
                  onChange={(e) => setStationLocation(e.target.value)}
                  placeholder={isRTL ? "مثال: المبنى أ، الطابق الثالث" : "e.g., Building A, 3rd Floor"}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  {isRTL ? "معرف الممرضة المسؤولة" : "Head Nurse Username/ID"}
                </label>
                <input
                  type="text"
                  value={stationHeadNurseId}
                  onChange={(e) => setStationHeadNurseId(e.target.value)}
                  placeholder="e.g. u1"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsStationModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-slate-50 cursor-pointer"
                >
                  {isRTL ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-black cursor-pointer shadow-md"
                >
                  {isRTL ? "حفظ" : "Save Station"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          POPUP DIALOG: LINK DEVICE TO BED
          ========================================== */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-6 shadow-2xl border border-gray-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsLinkModalOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>
            <h3 className="text-xl font-black text-gray-800 mb-4 uppercase">
              {isRTL ? "وصل جهاز طبي حيوية وتخصيص السرير" : "Link Telemetry Monitor"}
            </h3>
            <form onSubmit={handleLinkDevice} className="space-y-4">
              
              {/* Device Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  {isRTL ? "اختر الجهاز الطبي المتوفر" : "Select Available Medical Asset"}
                </label>
                <select
                  required
                  value={linkAssetId}
                  onChange={(e) => setLinkAssetId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value="">{isRTL ? "-- اختر من مخزون المستشفى --" : "-- Select Device --"}</option>
                  {selectableAssets.map((as) => (
                    <option key={as.id} value={as.id}>
                      [{as.id}] {as.name} - {as.category} ({as.location || "Operational"})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1 italic">
                  {isRTL ? "* الأجهزة الشاغرة فقط تظهر في القائمة كأجهزة الفحص والتنفس والمراقبة." : "* Shows available diagnostic, ventilator and vitals equipment."}
                </p>
              </div>

              {/* Patient Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-2">
                  <Users size={12} />
                  {isRTL ? "ربط مريض (سجل صحي)" : "Assign Patient (EMR)"}
                </label>
                <SmartSearchPicker
                  items={patients.map(p => ({
                    id: p.id,
                    name: p.name,
                    nationalId: p.nationalId,
                    description: p.nationalId || p.id,
                    details: p.bloodType
                  }))}
                  selectedId={linkPatientId}
                  onSelect={(item) => setLinkPatientId(item ? item.id : "")}
                  placeholder={isRTL ? "البحث بالاسم أو الرقم الوطني..." : "Search by Name or ID..."}
                  type="patient"
                  isRTL={isRTL}
                />
              </div>

              {/* Bed number */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  {isRTL ? "رقم السرير" : "Bed Number / Label"}
                </label>
                <input
                  type="text"
                  required
                  value={linkBedNumber}
                  onChange={(e) => setLinkBedNumber(e.target.value)}
                  placeholder={isRTL ? "مثال: Bed 12" : "e.g., Bed 15-A"}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              {/* Vitals initializer */}
              <div className="bg-slate-50 p-4 rounded-2xl grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <span className="text-[11px] font-black text-slate-500 uppercase">
                    📊 {isRTL ? "المؤشرات الحيوية الابتدائية للمريض" : "Initialize Live Vitals"}
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">{isRTL ? "نبضات القلب" : "Pulse (bpm)"}</label>
                  <input
                    type="number"
                    required
                    value={linkVitalsPulse}
                    onChange={(e) => setLinkVitalsPulse(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">{isRTL ? "الحرارة" : "Temp (°C)"}</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={linkVitalsTemp}
                    onChange={(e) => setLinkVitalsTemp(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">{isRTL ? "ضغط الدم" : "Blood Pressure"}</label>
                  <input
                    type="text"
                    required
                    value={linkVitalsBp}
                    onChange={(e) => setLinkVitalsBp(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">{isRTL ? "الأكسجين" : "Oxygen (SpO₂ %)"}</label>
                  <input
                    type="number"
                    required
                    value={linkVitalsSpo2}
                    onChange={(e) => setLinkVitalsSpo2(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-slate-50 cursor-pointer"
                >
                  {isRTL ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-black cursor-pointer shadow-md"
                >
                  {isRTL ? "ربط وتوصيل" : "Link & Activate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ==========================================
          POPUP DIALOG: MANUAL VITALS ENTRY
          ========================================== */}
      {isManualVitalsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-6 shadow-2xl border border-gray-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsManualVitalsModalOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full cursor-pointer"
            >
              <X size={18} />
            </button>
            <h3 className="text-xl font-black text-gray-800 mb-4 uppercase">
              {isRTL ? "تسجيل المؤشرات الحيوية يدويا" : "Manual Vitals Entry"}
            </h3>
            <form onSubmit={handleManualVitalsSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">{isRTL ? "نبضات القلب" : "Pulse (bpm)"}</label>
                  <input
                    type="number"
                    required
                    value={manualVitalsPulse}
                    onChange={(e) => setManualVitalsPulse(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">{isRTL ? "الحرارة" : "Temp (°C)"}</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={manualVitalsTemp}
                    onChange={(e) => setManualVitalsTemp(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">{isRTL ? "ضغط الدم" : "Blood Pressure"}</label>
                  <input
                    type="text"
                    required
                    value={manualVitalsBp}
                    onChange={(e) => setManualVitalsBp(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-bold mb-1">{isRTL ? "الأكسجين" : "Oxygen (SpO₂ %)"}</label>
                  <input
                    type="number"
                    required
                    value={manualVitalsSpo2}
                    onChange={(e) => setManualVitalsSpo2(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualVitalsModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-slate-50 cursor-pointer"
                >
                  {isRTL ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black cursor-pointer shadow-md"
                >
                  {isRTL ? "حفظ وتحديث" : "Save Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NursesStationView;
