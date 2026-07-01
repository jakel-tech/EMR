import React, { useState } from "react";
import { 
  Users, ClipboardList, BarChart3, Plus, ExternalLink, Wrench, Edit, 
  Trash2, User, PhoneCall, Mail, MapPin, Activity, Coins, Truck, 
  CheckCircle, ShieldCheck, X 
} from "lucide-react";
import { toast } from "sonner";
import { ExternalWorkshop, ExternalRepairTicket, Asset, AppUser } from "../types";

interface ExternalWorkshopsProps {
  isRTL: boolean;
  currentUser: AppUser | null;
  externalWorkshops: ExternalWorkshop[];
  setExternalWorkshops: React.Dispatch<React.SetStateAction<ExternalWorkshop[]>>;
  externalRepairTickets: ExternalRepairTicket[];
  setExternalRepairTickets: React.Dispatch<React.SetStateAction<ExternalRepairTicket[]>>;
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
  apiFetch: any;
}

const ExternalWorkshops: React.FC<ExternalWorkshopsProps> = ({
  isRTL,
  currentUser,
  externalWorkshops,
  setExternalWorkshops,
  externalRepairTickets,
  setExternalRepairTickets,
  assets,
  setAssets,
  apiFetch,
}) => {
  const [extWsSubTab, setExtWsSubTab] = useState<"directory" | "tickets" | "analytics">("directory");
  const [isWsModalOpen, setIsWsModalOpen] = useState(false);
  const [wsModalType, setWsModalType] = useState<"workshop" | "ticket">("workshop");
  const [wsEditingItem, setWsEditingItem] = useState<any>(null);

  // Workshop Form States
  const [wsFormName, setWsFormName] = useState("");
  const [wsFormSpecialty, setWsFormSpecialty] = useState("");
  const [wsFormContactPerson, setWsFormContactPerson] = useState("");
  const [wsFormPhone, setWsFormPhone] = useState("");
  const [wsFormEmail, setWsFormEmail] = useState("");
  const [wsFormPassword, setWsFormPassword] = useState("");
  const [wsFormAddress, setWsFormAddress] = useState("");
  const [wsFormRating, setWsFormRating] = useState(5);
  const [wsFormSlaDetails, setWsFormSlaDetails] = useState("");

  // Ticket Form States
  const [tkFormAssetId, setTkFormAssetId] = useState("");
  const [tkFormWorkshopId, setTkFormWorkshopId] = useState("");
  const [tkFormIssueDesc, setTkFormIssueDesc] = useState("");
  const [tkFormStatus, setTkFormStatus] = useState<"Sent" | "Under Inspection" | "Repaired" | "Returned & Verified">("Sent");
  const [tkFormCost, setTkFormCost] = useState(0);
  const [tkFormDispatchDate, setTkFormDispatchDate] = useState("");
  const [tkFormExpectedReturnDate, setTkFormExpectedReturnDate] = useState("");
  const [tkFormActualReturnDate, setTkFormActualReturnDate] = useState("");
  const [tkFormWarrantyMonths, setTkFormWarrantyMonths] = useState(0);
  const [tkFormNotes, setTkFormNotes] = useState("");

  const saveExternalWorkshop = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = wsEditingItem?.id || "ws_" + Math.random().toString(36).substring(2, 8);
    const body = {
      id,
      name: wsFormName,
      specialty: wsFormSpecialty,
      contact_person: wsFormContactPerson,
      phone: wsFormPhone,
      email: wsFormEmail,
      password: wsFormPassword,
      address: wsFormAddress,
      rating: wsFormRating,
      sla_details: wsFormSlaDetails,
    };

    const method = wsEditingItem ? "PUT" : "POST";
    const endpoint = wsEditingItem ? `/api/external-workshops/${wsEditingItem.id}` : "/api/external-workshops";

    try {
      const res = await apiFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        if (wsEditingItem) {
          setExternalWorkshops((prev) => prev.map((w) => (w.id === wsEditingItem.id ? { ...w, ...body } : w)));
          toast.success(isRTL ? "تم تحديث بيانات الورشة بنجاح" : "Workshop updated successfully");
        } else {
          setExternalWorkshops((prev) => [...prev, body]);
          toast.success(isRTL ? "تمت إضافة الورشة بنجاح" : "Workshop added successfully");
        }
        setIsWsModalOpen(false);
        setWsEditingItem(null);
      } else {
        toast.error(isRTL ? "فشلت العملية" : "Operation failed");
      }
    } catch (err) {
      toast.error(isRTL ? "خطأ في الاتصال بالسيرفر" : "Connection error");
    }
  };

  const deleteExternalWorkshop = async (id: string) => {
    if (!window.confirm(isRTL ? "هل أنت متأكد من حذف هذه الورشة؟" : "Are you sure you want to delete this workshop?")) return;
    try {
      const res = await apiFetch(`/api/external-workshops/${id}`, { method: "DELETE" });
      if (res.ok) {
        setExternalWorkshops((prev) => prev.filter((w) => w.id !== id));
        toast.success(isRTL ? "تم حذف الورشة بنجاح" : "Workshop deleted successfully");
      } else {
        toast.error(isRTL ? "فشل حذف الورشة" : "Failed to delete workshop");
      }
    } catch (err) {
      toast.error(isRTL ? "خطأ في الاتصال" : "Connection error");
    }
  };

  const saveExternalRepairTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = wsEditingItem?.id || "tk_" + Math.random().toString(36).substring(2, 8);
    const selectedAsset = assets.find((a) => a.id === tkFormAssetId);
    const selectedWs = externalWorkshops.find((w) => w.id === tkFormWorkshopId);

    const body = {
      id,
      asset_id: tkFormAssetId,
      asset_name: selectedAsset ? selectedAsset.name : "",
      workshop_id: tkFormWorkshopId,
      workshop_name: selectedWs ? selectedWs.name : "",
      issue_description: tkFormIssueDesc,
      status: tkFormStatus,
      cost: Number(tkFormCost) || 0,
      dispatch_date: tkFormDispatchDate,
      expected_return_date: tkFormExpectedReturnDate || null,
      actual_return_date: tkFormActualReturnDate || null,
      warranty_period_months: Number(tkFormWarrantyMonths) || 0,
      technician_notes: tkFormNotes,
    };

    const method = wsEditingItem ? "PUT" : "POST";
    const endpoint = wsEditingItem ? `/api/external-repair-tickets/${wsEditingItem.id}` : "/api/external-repair-tickets";

    try {
      const res = await apiFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        if (wsEditingItem) {
          setExternalRepairTickets((prev) => prev.map((t) => (t.id === wsEditingItem.id ? { ...t, ...body } : t)));
          if (tkFormStatus === "Returned & Verified" && selectedAsset) {
            await apiFetch(`/api/assets/${selectedAsset.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...selectedAsset, status: "Operational" }),
            });
            setAssets((prev) => prev.map((a) => (a.id === selectedAsset.id ? { ...a, status: "Operational" } : a)));
          }
          toast.success(isRTL ? "تم تحديث التذكرة بنجاح" : "Ticket updated successfully");
        } else {
          setExternalRepairTickets((prev) => [...prev, body]);
          if (selectedAsset) {
            await apiFetch(`/api/assets/${selectedAsset.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...selectedAsset, status: "Under Maintenance" }),
            });
            setAssets((prev) => prev.map((a) => (a.id === selectedAsset.id ? { ...a, status: "Under Maintenance" } : a)));
          }
          toast.success(isRTL ? "تم تسجيل طلب الإصلاح الخارجي وإرساله" : "External repair ticket logged and dispatched");
        }
        setIsWsModalOpen(false);
        setWsEditingItem(null);
      } else {
        toast.error(isRTL ? "فشلت العملية" : "Operation failed");
      }
    } catch (err) {
      toast.error(isRTL ? "خطأ في الاتصال" : "Connection error");
    }
  };

  const deleteExternalRepairTicket = async (id: string) => {
    if (!window.confirm(isRTL ? "هل أنت متأكد من حذف تذكرة الإصلاح هذه؟" : "Are you sure you want to delete this repair ticket?")) return;
    try {
      const res = await apiFetch(`/api/external-repair-tickets/${id}`, { method: "DELETE" });
      if (res.ok) {
        setExternalRepairTickets((prev) => prev.filter((t) => t.id !== id));
        toast.success(isRTL ? "تم حذف التذكرة بنجاح" : "Ticket deleted successfully");
      } else {
        toast.error(isRTL ? "فشل حذف التذكرة" : "Failed to delete ticket");
      }
    } catch (err) {
      toast.error(isRTL ? "خطأ في الاتصال" : "Connection error");
    }
  };

  const openWsModal = (type: "workshop" | "ticket", item: any = null) => {
    setWsModalType(type);
    setWsEditingItem(item);
    if (type === "workshop") {
      setWsFormName(item?.name || "");
      setWsFormSpecialty(item?.specialty || "");
      setWsFormContactPerson(item?.contact_person || "");
      setWsFormPhone(item?.phone || "");
      setWsFormEmail(item?.email || "");
      setWsFormPassword("");
      setWsFormAddress(item?.address || "");
      setWsFormRating(item?.rating || 5);
      setWsFormSlaDetails(item?.sla_details || "");
    } else {
      setTkFormAssetId(item?.asset_id || "");
      setTkFormWorkshopId(item?.workshop_id || "");
      setTkFormIssueDesc(item?.issue_description || "");
      setTkFormStatus(item?.status || "Sent");
      setTkFormCost(item?.cost || 0);
      setTkFormDispatchDate(item?.dispatch_date || new Date().toISOString().split("T")[0]);
      setTkFormExpectedReturnDate(item?.expected_return_date || "");
      setTkFormActualReturnDate(item?.actual_return_date || "");
      setTkFormWarrantyMonths(item?.warranty_period_months || 0);
      setTkFormNotes(item?.technician_notes || "");
    }
    setIsWsModalOpen(true);
  };

  const totalRepairSpend = externalRepairTickets.reduce((sum, tk) => sum + (tk.cost || 0), 0);
  const activeOutCount = externalRepairTickets.filter((tk) => tk.status !== "Returned & Verified").length;
  const completedCount = externalRepairTickets.filter((tk) => tk.status === "Returned & Verified").length;
  const avgWarranty = externalRepairTickets.length > 0 
    ? (externalRepairTickets.reduce((sum, tk) => sum + (tk.warranty_period_months || 0), 0) / externalRepairTickets.length).toFixed(1)
    : "0";

  return (
    <div className="pb-32 pt-4 px-4 sm:px-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-900/40 backdrop-blur-md p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-800 shadow-sm gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
            {isRTL ? "ورش طبية مستقلة (خاصة)" : "Independent Medical Workshops"}
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            {isRTL ? "إدارة وتتبع عقود وتذاكر الصيانة مع أطراف خارجية" : "Manage and track off-site third-party repairs & contracts"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center shadow-inner border border-slate-200/50 dark:border-slate-700">
            {[
              { id: "directory", label: isRTL ? "دليل الورش" : "Directory", icon: Users },
              { id: "tickets", label: isRTL ? "طلبات الإصلاح" : "Repair Tickets", icon: ClipboardList },
              { id: "analytics", label: isRTL ? "التحليلات" : "Analytics", icon: BarChart3 },
            ].map((subTab) => {
              const isActive = extWsSubTab === subTab.id;
              return (
                <button
                  key={subTab.id}
                  onClick={() => setExtWsSubTab(subTab.id as any)}
                  className={`px-4 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer ${
                    isActive 
                      ? "bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400 border border-slate-100 dark:border-slate-600" 
                      : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  <subTab.icon size={12} />
                  {subTab.label}
                </button>
              );
            })}
          </div>
          {extWsSubTab === "directory" && (
            <button
              onClick={() => openWsModal("workshop")}
              className="bg-primary-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={14} className="stroke-[3]" />
              {isRTL ? "إضافة ورشة" : "Add Workshop"}
            </button>
          )}
          {extWsSubTab === "tickets" && (
            <button
              onClick={() => openWsModal("ticket")}
              className="bg-primary-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={14} className="stroke-[3]" />
              {isRTL ? "طلب إصلاح خارجي" : "New Repair Ticket"}
            </button>
          )}
        </div>
      </div>

      {extWsSubTab === "directory" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {externalWorkshops.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-700 p-12 rounded-[2rem] text-center space-y-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                <ExternalLink size={28} />
              </div>
              <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase">
                {isRTL ? "لا توجد ورش خارجية مسجلة" : "No External Workshops Registered"}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {isRTL ? "قم بإضافة أول ورشة صيانة خارجية لتتمكن من إرسال الأجهزة الطبية إليها وتتبع حالة الإصلاح والضمان." : "Add your first external vendor or calibration contractor to start dispatching devices and tracking repair tickets."}
              </p>
              <button
                onClick={() => openWsModal("workshop")}
                className="bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 transition-colors px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer"
              >
                {isRTL ? "تسجيل ورشة جديدة" : "Register Workshop"}
              </button>
            </div>
          ) : (
            externalWorkshops.map((ws) => (
              <div
                key={ws.id}
                className="bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800 p-6 rounded-[2rem] hover:shadow-lg transition-all flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="bg-primary-50 dark:bg-primary-950/40 p-3 rounded-2xl text-primary-600 dark:text-primary-400">
                      <Wrench size={20} />
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openWsModal("workshop", ws)}
                        className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        onClick={() => deleteExternalWorkshop(ws.id)}
                        className="p-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 rounded-lg text-red-500 transition-colors cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-black text-base text-slate-800 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {ws.name}
                    </h4>
                    <span className="inline-block bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-500 px-2.5 py-1 rounded-full mt-1.5 tracking-wider">
                      {ws.specialty}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-2 border-t border-dashed border-slate-100 dark:border-slate-800 pt-3">
                    {ws.contact_person && (
                      <div className="flex items-center gap-2">
                        <User size={12} className="text-slate-400 shrink-0" />
                        <span>{ws.contact_person}</span>
                      </div>
                    )}
                    {ws.phone && (
                      <div className="flex items-center gap-2">
                        <PhoneCall size={12} className="text-slate-400 shrink-0" />
                        <span>{ws.phone}</span>
                      </div>
                    )}
                    {ws.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{ws.email}</span>
                      </div>
                    )}
                    {ws.address && (
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{ws.address}</span>
                      </div>
                    )}
                  </div>
                </div>
                {ws.sla_details && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-[10px] text-slate-500 mt-4 border border-slate-100 dark:border-slate-800">
                    <span className="font-bold uppercase text-slate-400 tracking-wider block mb-1">
                      {isRTL ? "تفاصيل الاتفاقية (SLA):" : "SLA Details:"}
                    </span>
                    {ws.sla_details}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {extWsSubTab === "tickets" && (
        <div className="space-y-6">
          {externalRepairTickets.length === 0 ? (
            <div className="bg-white dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-700 p-12 rounded-[2rem] text-center space-y-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                <ClipboardList size={28} />
              </div>
              <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase">
                {isRTL ? "لا توجد تذاكر صيانة حالية" : "No Active Repair Tickets"}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {isRTL ? "سجل تذاكر الإصلاح الخارجي لتتبع الأجهزة المعطلة التي أرسلتها إلى ورش خارجية، وقيمة الصيانة وتواريخ الاستلام." : "Log repair tickets to keep full logs of broken biomedical devices sent out for repair, billing cost, and delivery estimations."}
              </p>
              <button
                onClick={() => openWsModal("ticket")}
                className="bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 transition-colors px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer"
              >
                {isRTL ? "إنشاء طلب إصلاح أول" : "Create First Ticket"}
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-6 py-4">{isRTL ? "الجهاز" : "Asset"}</th>
                      <th className="px-6 py-4">{isRTL ? "الورشة المستقبلة" : "External Workshop"}</th>
                      <th className="px-6 py-4">{isRTL ? "العطل المشخص" : "Issue Description"}</th>
                      <th className="px-6 py-4">{isRTL ? "تاريخ الإرسال" : "Dispatch Date"}</th>
                      <th className="px-6 py-4">{isRTL ? "تاريخ العودة المتوقع" : "Expected Return"}</th>
                      <th className="px-6 py-4">{isRTL ? "حالة الإصلاح" : "Repair Status"}</th>
                      <th className="px-6 py-4">{isRTL ? "التكلفة" : "Repair Cost"}</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {externalRepairTickets.map((tk) => {
                      const statusColors: Record<string, string> = {
                        "Sent": "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
                        "Under Inspection": "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
                        "Repaired": "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
                        "Returned & Verified": "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                      };

                      return (
                        <tr key={tk.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500">
                                <Activity size={14} />
                              </div>
                              <span className="font-bold text-slate-800 dark:text-white">{tk.asset_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">{tk.workshop_name}</td>
                          <td className="px-6 py-4 max-w-xs truncate">{tk.issue_description}</td>
                          <td className="px-6 py-4">{tk.dispatch_date}</td>
                          <td className="px-6 py-4">{tk.expected_return_date || "-"}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${statusColors[tk.status] || "bg-slate-100 text-slate-600"}`}>
                              {isRTL 
                                ? (tk.status === "Sent" ? "تم الإرسال" 
                                  : tk.status === "Under Inspection" ? "قيد الفحص"
                                  : tk.status === "Repaired" ? "تم الإصلاح"
                                  : "مستلم ومفحوص")
                                : tk.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-slate-800 dark:text-white">
                            SDG {Number(tk.cost || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openWsModal("ticket", tk)}
                                className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors cursor-pointer"
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                onClick={() => deleteExternalRepairTicket(tk.id)}
                                className="p-2 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 rounded-xl text-red-500 transition-colors cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {extWsSubTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: isRTL ? "إجمالي الإنفاق" : "Total Outsource Spend", value: `SDG ${totalRepairSpend.toLocaleString()}`, icon: Coins, color: "primary" },
              { label: isRTL ? "أجهزة قيد الصيانة بالخارج" : "Active External Repairs", value: activeOutCount, icon: Truck, color: "amber" },
              { label: isRTL ? "تم إصلاحها واستلامها" : "Returned & Verified", value: completedCount, icon: CheckCircle, color: "emerald" },
              { label: isRTL ? "متوسط فترة الضمان" : "Avg Warranty Period", value: `${avgWarranty} mos`, icon: ShieldCheck, color: "indigo" },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800 p-6 rounded-[2rem] flex flex-col justify-between shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{stat.label}</span>
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500">
                    <stat.icon size={16} />
                  </div>
                </div>
                <span className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white mt-4">{stat.value}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                {isRTL ? "الإنفاق حسب ورش الصيانة" : "Outsource Spending By Workshop"}
              </h4>
              <div className="h-64 flex items-center justify-center">
                {externalRepairTickets.length === 0 ? (
                  <span className="text-xs text-slate-400">{isRTL ? "لا توجد بيانات حالياً" : "No spending data logged"}</span>
                ) : (
                  <div className="w-full h-full flex flex-col justify-center space-y-4">
                    {externalWorkshops.map((ws) => {
                      const wsSpend = externalRepairTickets
                        .filter((tk) => tk.workshop_id === ws.id)
                        .reduce((sum, tk) => sum + (tk.cost || 0), 0);
                      const pct = totalRepairSpend > 0 ? (wsSpend / totalRepairSpend) * 100 : 0;
                      return (
                        <div key={ws.id} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span>{ws.name}</span>
                            <span>SDG {wsSpend.toLocaleString()} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-600 rounded-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800 p-6 rounded-[2rem] shadow-sm space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">
                {isRTL ? "معدل الحالات لطلبات الإصلاح" : "Repair Ticket State Ratios"}
              </h4>
              <div className="h-64 flex flex-col justify-center space-y-4">
                {externalRepairTickets.length === 0 ? (
                  <span className="text-xs text-slate-400">{isRTL ? "لا توجد أجهزة مسجلة" : "No ticket status data"}</span>
                ) : (
                  ["Sent", "Under Inspection", "Repaired", "Returned & Verified"].map((st) => {
                    const count = externalRepairTickets.filter((tk) => tk.status === st).length;
                    const pct = (count / externalRepairTickets.length) * 100;
                    const labelAr: Record<string, string> = {
                      "Sent": "تم الإرسال والترحيل",
                      "Under Inspection": "تحت التشخيص الفني",
                      "Repaired": "جاهز للاستلام والتوريد",
                      "Returned & Verified": "تم الاستلام والتحقق الفني بالمنشأة"
                    };
                    return (
                      <div key={st} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span>{isRTL ? labelAr[st] : st}</span>
                          <span>{count} {isRTL ? "أجهزة" : "assets"} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${
                            st === "Sent" ? "bg-blue-500" :
                            st === "Under Inspection" ? "bg-amber-500" :
                            st === "Repaired" ? "bg-purple-500" :
                            "bg-emerald-500"
                          }`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isWsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                {wsModalType === "workshop" 
                  ? (wsEditingItem ? (isRTL ? "تعديل ورشة طبية مستقلة" : "Edit Independent Medical Workshop") : (isRTL ? "تسجيل ورشة طبية مستقلة" : "Register Independent Medical Workshop"))
                  : (wsEditingItem ? (isRTL ? "تحديث تذكرة إصلاح" : "Update Repair Ticket") : (isRTL ? "إرسال وتصدير طلب صيانة خارجي" : "New External Repair Dispatch"))
                }
              </h3>
              <button
                onClick={() => setIsWsModalOpen(false)}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-full text-slate-500 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {wsModalType === "workshop" ? (
              <form onSubmit={saveExternalWorkshop} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "اسم الورشة / الشركة" : "Workshop Name"}</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                    value={wsFormName}
                    onChange={(e) => setWsFormName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "التخصص والاعتماد" : "Specialization"}</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Biomedical Imaging"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                      value={wsFormSpecialty}
                      onChange={(e) => setWsFormSpecialty(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "الشخص المسؤول" : "Contact Person"}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                      value={wsFormContactPerson}
                      onChange={(e) => setWsFormContactPerson(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "البريد الإلكتروني للمدير" : "Admin Email"}</label>
                    <input
                      required
                      type="email"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                      value={wsFormEmail}
                      onChange={(e) => setWsFormEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "كلمة مرور المدير" : "Admin Password"}</label>
                    <input
                      required={!wsEditingItem}
                      type="password"
                      placeholder={wsEditingItem ? "Leave empty to keep" : "••••••••"}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                      value={wsFormPassword}
                      onChange={(e) => setWsFormPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "رقم هاتف التواصل" : "Contact Phone"}</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                    value={wsFormPhone}
                    onChange={(e) => setWsFormPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "العنوان بالتفصيل" : "Address"}</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                    value={wsFormAddress}
                    onChange={(e) => setWsFormAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "شروط الضمان وتفاصيل العقد (SLA)" : "SLA Contract Details"}</label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                    value={wsFormSlaDetails}
                    onChange={(e) => setWsFormSlaDetails(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-widest mt-4 transition-colors cursor-pointer"
                >
                  {isRTL ? "حفظ البيانات" : "Save Workshop"}
                </button>
              </form>
            ) : (
              <form onSubmit={saveExternalRepairTicket} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "اختر الجهاز الطبي المراد إصلاحه" : "Select Biomedical Asset"}</label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 border-none text-slate-800 dark:text-white bg-white"
                    value={tkFormAssetId}
                    onChange={(e) => setTkFormAssetId(e.target.value)}
                  >
                    <option value="">{isRTL ? "اختر الجهاز..." : "Choose asset..."}</option>
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.status})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "اختر ورشة الصيانة الخارجية" : "Select Target Workshop"}</label>
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 border-none text-slate-800 dark:text-white bg-white"
                    value={tkFormWorkshopId}
                    onChange={(e) => setTkFormWorkshopId(e.target.value)}
                  >
                    <option value="">{isRTL ? "اختر الورشة المتخصصة..." : "Choose workshop..."}</option>
                    {externalWorkshops.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.specialty})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "وصف دقيق للأعطال الفنية" : "Issue & Fault Details"}</label>
                  <textarea
                    required
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                    value={tkFormIssueDesc}
                    onChange={(e) => setTkFormIssueDesc(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "تاريخ الإرسال والترحيل" : "Dispatch Date"}</label>
                    <input
                      required
                      type="date"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                      value={tkFormDispatchDate}
                      onChange={(e) => setTkFormDispatchDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "تاريخ العودة المتوقع" : "Expected Return"}</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                      value={tkFormExpectedReturnDate}
                      onChange={(e) => setTkFormExpectedReturnDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "قيمة وتكلفة الصيانة (SDG)" : "Repair Cost (SDG)"}</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                      value={tkFormCost}
                      onChange={(e) => setTkFormCost(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "فترة الضمان المقدم (بالأشهر)" : "Warranty Months"}</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                      value={tkFormWarrantyMonths}
                      onChange={(e) => setTkFormWarrantyMonths(Number(e.target.value))}
                    />
                  </div>
                </div>
                {wsEditingItem && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "حالة طلب الصيانة" : "Repair Ticket Status"}</label>
                      <select
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 border-none text-slate-800 dark:text-white bg-white"
                        value={tkFormStatus}
                        onChange={(e) => setTkFormStatus(e.target.value as any)}
                      >
                        <option value="Sent">{isRTL ? "تم الإرسال والترحيل" : "Sent"}</option>
                        <option value="Under Inspection">{isRTL ? "تحت التشخيص الفني" : "Under Inspection"}</option>
                        <option value="Repaired">{isRTL ? "تم الإصلاح بنجاح" : "Repaired"}</option>
                        <option value="Returned & Verified">{isRTL ? "تم الاستلام والتحقق الفني بالمنشأة" : "Returned & Verified"}</option>
                      </select>
                    </div>
                  </div>
                )}
                {tkFormStatus === "Returned & Verified" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "تاريخ الاستلام والتحقق الفعلي" : "Actual Return Date"}</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                      value={tkFormActualReturnDate}
                      onChange={(e) => setTkFormActualReturnDate(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{isRTL ? "ملاحظات وتفاصيل فنية إضافية" : "Additional Technical Notes"}</label>
                  <textarea
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-white"
                    value={tkFormNotes}
                    onChange={(e) => setTkFormNotes(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-widest mt-4 transition-colors cursor-pointer"
                >
                  {isRTL ? "تأكيد وإرسال" : "Dispatch Request"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalWorkshops;
