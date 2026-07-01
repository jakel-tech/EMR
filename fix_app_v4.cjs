import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find the truncated line
const truncatedLine = '{navItems.some((n) => n';
const index = content.lastIndexOf(truncatedLine);

if (index !== -1) {
  // Take everything before the truncated line
  const baseContent = content.substring(0, index);
  
  const restOfFile = `                  {navItems.some((n) => n.id === activeTab) ||
                  ["maintenance", "departments", "about"].includes(activeTab) ? (
                    <>
                      {activeTab === "dashboard" && renderDashboard()}
                      {activeTab === "governance" &&
                        renderGovernanceWorkspace()}
                      {activeTab === "analytics" && renderAnalytics()}
                      {activeTab === "workshop" && renderWorkshop()}
                      {activeTab === "nursesStation" && (
                        <NursesStationView
                          isRTL={isRTL}
                          currentUser={currentUser}
                          nursesStations={nursesStations}
                          stationDevices={stationDevices}
                          selectedStationId={selectedStationId}
                          setSelectedStationId={setSelectedStationId}
                          nursesTasks={nursesTasks}
                          setNursesTasks={setNursesTasks}
                          patients={patients}
                          users={users}
                          departments={departments}
                          apiFetch={apiFetch}
                        />
                      )}
                      {activeTab === "hospitals" && renderHospitals()}
                      {activeTab === "maintenance" && renderMaintenance()}
                      {activeTab === "emr" && renderEMR()}
                      {activeTab === "telehealth" && renderTelehealthPortal()}
                      {activeTab === "organizations" && renderHospitals()}
                      {activeTab === "feedback" && renderFeedback()}
                      {activeTab === "settings" && renderSettings()}
                      {activeTab === "about" && <AboutPage isRTL={isRTL} />}
                      {activeTab === "departments" && renderDepartments()}
                    </>
                  ) : null}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        isRTL={isRTL}
        hospitals={hospitals}
        users={users}
        appointments={appointments}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

// Helper Components
const AboutPage = ({ isRTL }: { isRTL: boolean }) => {
  const [activeSlide, setActiveSlide] = React.useState(0);
  const slides = [
    {
      titleAr: "بنية تحتية متينة",
      titleEn: "Robust Infrastructure",
      descAr: "نظام سلامات مبني على أحدث تقنيات الحوسبة السحابية لضمان استمرارية العمل بنسبة 99.9%.",
      descEn: "Salamat OS is built on cutting-edge cloud tech ensuring 99.9% uptime for medical critical paths.",
      icon: <Server className="text-primary-500" size={40} />
    },
    {
      titleAr: "أمان البيانات",
      titleEn: "Data Security",
      descAr: "تشفير كامل للبيانات الطبية (End-to-End) مع الالتزام بمعايير HIPAA العالمية لحماية خصوصية المريض.",
      descEn: "End-to-End encryption for clinical data, adhering to global HIPAA standards for patient privacy.",
      icon: <ShieldCheck className="text-emerald-500" size={40} />
    },
    {
      titleAr: "ذكاء اصطناعي مدمج",
      titleEn: "Native AI Engine",
      descAr: "محرك ذكاء اصطناعي يساعد الأطباء في تحليل الصور الإشعاعية والنتائج المخبرية بدقة عالية.",
      descEn: "Built-in AI engine assisting clinicians in analyzing radiography and lab results with high precision.",
      icon: <Brain className="text-purple-500" size={40} />
    }
  ];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/40">
              <Sparkles size={14} className="text-primary-600" />
              <span className="text-[10px] font-black text-primary-700 dark:text-primary-400 uppercase tracking-widest">
                {isRTL ? "منظومة سلامات الموحدة" : "Unified Salamat Ecosystem"}
              </span>
            </div>
            <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              {isRTL ? "عن نظام سلامات الرقمي" : "About Salamat Digital System"}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold leading-relaxed text-lg">
              {isRTL 
                ? "منصة متكاملة تربط بين المستشفيات، المعامل، الصيدليات والمرضى في شبكة موحدة لضمان سرعة الرعاية الصحية وجودة الخدمة."
                : "An integrated platform connecting hospitals, labs, pharmacies, and patients in a unified network to ensure rapid healthcare."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
             <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm">
                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600 mb-4">
                  <Activity size={20} />
                </div>
                <h4 className="font-black text-slate-800 dark:text-white text-sm mb-1">{isRTL ? "تزامن لحظي" : "Real-time Sync"}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{isRTL ? "تحديث فوري للسجلات" : "Instant EMR Updates"}</p>
             </div>
             <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
                  <Database size={20} />
                </div>
                <h4 className="font-black text-slate-800 dark:text-white text-sm mb-1">{isRTL ? "أرشفة ضخمة" : "Massive Archival"}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{isRTL ? "نظام PACS طبي" : "Clinical PACS Nodes"}</p>
             </div>
          </div>
        </div>

        <div className="relative">
          <div className="bg-slate-900 rounded-[3rem] p-10 overflow-hidden relative shadow-2xl min-h-[400px] flex flex-col justify-end group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlide}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 space-y-4"
              >
                <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl w-fit">
                  {slides[activeSlide].icon}
                </div>
                <h3 className="text-2xl font-black text-white">
                  {isRTL ? slides[activeSlide].titleAr : slides[activeSlide].titleEn}
                </h3>
                <p className="text-slate-400 font-bold text-sm leading-relaxed">
                  {isRTL ? slides[activeSlide].descAr : slides[activeSlide].descEn}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="flex gap-2 mt-8">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  className={\`h-1 rounded-full transition-all \${i === activeSlide ? "w-8 bg-primary-500" : "w-2 bg-slate-700"}\`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-12 border-t border-slate-100 dark:border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
             <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-800 dark:text-white font-black text-xl">S</div>
                <div>
                   <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">Salamat OS</h4>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Enterprise Clinical Cloud</p>
                </div>
             </div>
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-4 justify-end items-center">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRTL ? "تم التطوير بواسطة فريق سلامات الرقمي" : "Developed by Salamat Digital Team"}</span>
             <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">© 2026 SALAMAT SYSTEMS</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const GlobalSearchModal = ({ 
  isOpen, 
  onClose, 
  isRTL, 
  hospitals = [], 
  users = [], 
  appointments = [], 
  onNavigate 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  isRTL: boolean; 
  hospitals?: any[]; 
  users?: any[]; 
  appointments?: any[]; 
  onNavigate: (tab: string, viewTab?: string) => void; 
}) => {
  const [query, setQuery] = React.useState("");
  const results = React.useMemo(() => {
    if (!query) return [];
    const search = query.toLowerCase();
    const res: any[] = [];
    (hospitals || [])
      .filter((h: any) => h.name?.toLowerCase().includes(search))
      .forEach((h: any) => res.push({ type: "Node", name: h.name, tab: "hospitals", viewTab: "manage" }));
    (users || [])
      .filter((u: any) => u.name?.toLowerCase().includes(search))
      .forEach((u: any) => res.push({ type: "Staff", name: u.name, tab: "users", viewTab: "accounts" }));
    (appointments || [])
      .filter((a: any) => a.reason?.toLowerCase().includes(search))
      .forEach((a: any) => res.push({ type: "Appt", name: a.reason || "Appointment", tab: "appointments" }));
    return res;
  }, [query, hospitals, users, appointments]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4 sm:px-6">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
        <div className="p-4 border-b dark:border-gray-800 flex items-center gap-3 bg-gray-50/50 dark:bg-gray-800/50">
          <Search size={20} className="text-gray-400" />
          <input
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-gray-800 dark:text-white placeholder-gray-400"
            placeholder={isRTL ? "البحث العالمي السريع..." : "Global system search..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
          {results.length > 0 ? (
            <div className="space-y-2">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onNavigate(r.tab, r.viewTab);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-4 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-3xl transition-colors group text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-2xl flex items-center justify-center text-primary-600 shadow-sm border border-primary-100 dark:border-primary-900/50">
                      {r.type === "Node" ? <Building2 size={18} /> : r.type === "Staff" ? <Users size={18} /> : <Calendar size={18} />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-primary-400 uppercase tracking-widest">{r.type}</p>
                      <p className="text-sm font-black text-gray-800 dark:text-white">{r.name}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-400">
               <Zap size={32} className="mx-auto mb-4 opacity-20" />
               <p className="text-xs font-bold uppercase tracking-widest">Start typing to search everything</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;`;

  fs.writeFileSync(filePath, baseContent + restOfFile);
  console.log('File successfully restored');
} else {
  console.log('Truncated line not found');
}
