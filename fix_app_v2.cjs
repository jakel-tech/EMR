const fs = require('fs');
const path = require('path');
const appPath = path.join(process.cwd(), 'src/App.tsx');
let content = fs.readFileSync(appPath, 'utf8');

const marker = '// Helper Components';
const index = content.indexOf(marker);

if (index !== -1) {
  const cleanEnd = `// Helper Components
const AboutPage = ({ isRTL }: { isRTL: boolean }) => (
  <div className="p-8 max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center">
    <div className="bg-primary-50 p-4 rounded-full mb-6">
      <Info size={48} className="text-primary-600" />
    </div>
    <h2 className="text-3xl font-black mb-4 text-gray-900">{isRTL ? "عن منصة سلامات" : "About Salamat Platform"}</h2>
    <p className="text-gray-600 text-lg leading-relaxed mb-8">
      {isRTL 
        ? "سلامات هي منظومة موحدة لإدارة المستشفيات مصممة لرقمنة العمليات السريرية والإدارية وتوفير تجربة صحية متكاملة."
        : "Salamat is a unified hospital management system designed to digitize clinical and administrative operations, providing an integrated healthcare experience."}
    </p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-2xl">
      <div className="p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
        <h4 className="font-black text-gray-900 mb-2 uppercase text-sm tracking-tight">{isRTL ? "الأمان" : "Security"}</h4>
        <p className="text-xs text-gray-500 leading-relaxed font-bold">{isRTL ? "تشفير كامل للبيانات الطبية" : "Full encryption for medical data"}</p>
      </div>
      <div className="p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
        <h4 className="font-black text-gray-900 mb-2 uppercase text-sm tracking-tight">{isRTL ? "السرعة" : "Performance"}</h4>
        <p className="text-xs text-gray-500 leading-relaxed font-bold">{isRTL ? "وصول فوري للسجلات الطبية" : "Instant access to medical records"}</p>
      </div>
      <div className="p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm">
        <h4 className="font-black text-gray-900 mb-2 uppercase text-sm tracking-tight">{isRTL ? "التكامل" : "Integration"}</h4>
        <p className="text-xs text-gray-500 leading-relaxed font-bold">{isRTL ? "ربط كامل بين جميع الأقسام" : "Full connection between all units"}</p>
      </div>
    </div>
  </div>
);

const GlobalSearchModal = ({ 
  isOpen, 
  onClose, 
  isRTL, 
  hospitals, 
  users, 
  appointments, 
  onNavigate 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  isRTL: boolean; 
  hospitals: any[]; 
  users: any[]; 
  appointments: any[]; 
  onNavigate: (tab: string, viewTab?: string) => void; 
}) => {
  const [query, setQuery] = React.useState("");
  const results = React.useMemo(() => {
    if (!query) return [];
    const search = query.toLowerCase();
    const res: any[] = [];
    hospitals
      .filter((h) => h.name.toLowerCase().includes(search))
      .forEach((h) => res.push({ type: "Node", name: h.name, tab: "hospitals", viewTab: "manage" }));
    users
      .filter((u) => u.name.toLowerCase().includes(search))
      .forEach((u) => res.push({ type: "Staff", name: u.name, tab: "hospitals", viewTab: "accounts" }));
    appointments
      .filter((a) => a.reason?.toLowerCase().includes(search))
      .forEach((a) => res.push({ type: "Appt", name: a.reason || "Appointment", tab: "hospitals", viewTab: "settings" }));
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
  content = content.substring(0, index) + cleanEnd;
  fs.writeFileSync(appPath, content);
  console.log('Successfully fixed App.tsx and restored components');
} else {
  console.error('Marker not found');
}
