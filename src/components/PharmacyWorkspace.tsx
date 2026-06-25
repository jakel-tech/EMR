import React, { useState, useEffect, useMemo } from 'react';
import { 
  Truck, Sparkles, ShoppingCart, ClipboardList, CheckCircle, Coins, 
  Plus, Users, Camera, Pill, Trash2, Building2, Store, MapPin, 
  Network, ShieldCheck, Edit, Search, Package, ExternalLink, Activity
, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import SmartSearchPicker from './SmartSearchPicker';
import { 
  AppUser, Supplier, PharmacyOrder, PharmacySale, Medication, 
  InventoryItem, Patient, MedicalRecord, AuditLog 
} from '../types';

interface PharmacyWorkspaceProps {
  isRTL: boolean;
  currentUser: AppUser | null;
  apiFetch: any;
  medications: Medication[];
  setMedications: React.Dispatch<React.SetStateAction<Medication[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  pharmacyOrders: PharmacyOrder[];
  setPharmacyOrders: React.Dispatch<React.SetStateAction<PharmacyOrder[]>>;
  pharmacySales: PharmacySale[];
  setPharmacySales: React.Dispatch<React.SetStateAction<PharmacySale[]>>;
  externalPharmacies: any[];
  setExternalPharmacies: React.Dispatch<React.SetStateAction<any[]>>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  patients: Patient[];
  medicalRecords: MedicalRecord[];
  fetchData: (silent?: boolean) => Promise<void>;
  currencySymbol: string;
  hospitals: any[];
  users: AppUser[];
  openModal: (type: string, data?: any) => void;
  handleDelete: (collection: string, id: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  t: (key: string) => string;

  renderStaffPermissionsManager: (context: 'pharmacy' | 'lab') => React.ReactNode;
}

const PharmacyWorkspace: React.FC<PharmacyWorkspaceProps> = ({
  isRTL,
  currentUser,
  apiFetch,
  medications,
  setMedications,
  suppliers,
  setSuppliers,
  pharmacyOrders,
  setPharmacyOrders,
  pharmacySales,
  setPharmacySales,
  externalPharmacies,
  setExternalPharmacies,
  inventory,
  setInventory,
  patients,
  medicalRecords,
  fetchData,
  renderStaffPermissionsManager,
  currencySymbol,
  hospitals,
  users,
  openModal,
  handleDelete,
  hasPermission,
  t,
}) => {
  const [pharmacyViewMode, setPharmacyViewMode] = useState<
    'inventory' | 'suppliers' | 'orders' | 'sales' | 'prescriptions' | 'externalPharmacies' | 'permissions'
  >('inventory');
  const [pharmacySelectedMedId, setPharmacySelectedMedId] = useState<string | null>(null);
  const [rxSearchQuery, setRxSearchQuery] = useState('');
  const [rxFilterMode, setRxFilterMode] = useState<'all' | 'pending' | 'dispensed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [dispensedRxIds, setDispensedRxIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dispensed_rx_ids');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Walk-In Pharmacy Sales State
  const [pharmacySaleCart, setPharmacySaleCart] = useState<{medication_id: string; name: string; quantity: number; price: number;}[]>([]);
  const [pharmacySaleSelectedMedId, setPharmacySaleSelectedMedId] = useState('');
  const [pharmacySaleAddQuantity, setPharmacySaleAddQuantity] = useState(1);
  const [pharmacySaleBuyerName, setPharmacySaleBuyerName] = useState(isRTL ? 'مشتري خارجي' : 'Walk-In Buyer');
  const [pharmacySaleBuyerPhone, setPharmacySaleBuyerPhone] = useState('');
  const [pharmacySalePaymentMethod, setPharmacySalePaymentMethod] = useState('Cash');
  const [pharmacySaleSelectedPatientId, setPharmacySaleSelectedPatientId] = useState<string | null>(null);
  const [pharmacySaleIsOTC, setPharmacySaleIsOTC] = useState(true);
  const [pharmacySalePrescriptionImage, setPharmacySalePrescriptionImage] = useState<string | null>(null);
  const [pharmacySaleCheckOwner, setPharmacySaleCheckOwner] = useState('');
  const [pharmacySaleCheckBank, setPharmacySaleCheckBank] = useState('');
  const [pharmacySaleCheckAmount, setPharmacySaleCheckAmount] = useState(0);
  const [pharmacySaleCheckProgress, setPharmacySaleCheckProgress] = useState(1);
  const [pharmacySaleCheckPhoto, setPharmacySaleCheckPhoto] = useState<string | null>(null);
  const [pharmacySaleExpandedCheckId, setPharmacySaleExpandedCheckId] = useState<string | null>(null);

  // External Pharmacies local states
  const [extName, setExtName] = useState('');
  const [extType, setExtType] = useState<'Private' | 'External'>('External');
  const [extLocation, setExtLocation] = useState('');
  const [extEmail, setExtEmail] = useState('');
  const [extPhone, setExtPhone] = useState('');
  const [extStatus, setExtStatus] = useState<'Active' | 'Inactive'>('Active');
  const [extLicense, setExtLicense] = useState('');
  const [extNotes, setExtNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Private' | 'External'>('All');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const selectedPat = patients.find(p => p.id === pharmacySaleSelectedPatientId);
    if (selectedPat) {
      setPharmacySaleBuyerName(selectedPat.name);
      setPharmacySaleBuyerPhone(selectedPat.contactNumber);
    } else {
      setPharmacySaleBuyerName(isRTL ? 'مشتري خارجي' : 'Walk-In Buyer');
      setPharmacySaleBuyerPhone('');
    }
  }, [pharmacySaleSelectedPatientId, isRTL, patients]);

    const renderPharmacySuppliers = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white/40 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/50 shadow-sm bento-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <Truck size={22} className="stroke-[2.5]" />
              </div>
              <h3 className="font-black text-gray-800 text-lg uppercase tracking-tight">
                {isRTL ? "إضافة مورد جديد" : "Register Supplier"}
              </h3>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newSupplier = {
                  id: "sup_" + Math.random().toString(36).substr(2, 9),
                  name: formData.get("name"),
                  contact_person: formData.get("contact_person"),
                  email: formData.get("email"),
                  phone: formData.get("phone"),
                  address: formData.get("address"),
                  category: formData.get("category"),
                  rating: 5,
                };

                try {
                  const res = await apiFetch("/api/suppliers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newSupplier),
                  });
                  if (res.ok) {
                    toast.success(
                      isRTL ? "تم تسجيل المورد" : "Supplier registered",
                    );
                    fetchData(true);
                    (e.target as HTMLFormElement).reset();
                  }
                } catch (err) {
                  toast.error("Failed to register supplier");
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  {isRTL ? "اسم المورد" : "Supplier Name"}
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-white/80 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 outline-none font-bold text-xs transition-all shadow-inner"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  {isRTL ? "مسؤول التواصل" : "Contact Person"}
                </label>
                <input
                  name="contact_person"
                  type="text"
                  className="w-full px-4 py-3 bg-white/80 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 outline-none font-bold text-xs transition-all shadow-inner"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                    {isRTL ? "الهاتف" : "Phone"}
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    className="w-full px-4 py-3 bg-white/80 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 outline-none font-bold text-xs transition-all shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                    {isRTL ? "الفئة" : "Category"}
                  </label>
                  <select
                    name="category"
                    className="w-full px-4 py-3 bg-white/80 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 outline-none font-bold text-xs transition-all shadow-inner appearance-none"
                  >
                    <option value="Pharmaceuticals">Pharmaceuticals</option>
                    <option value="Disposables">Disposables</option>
                    <option value="Surgical">Surgical</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98]"
              >
                {isRTL ? "حفظ المورد" : "Save Supplier"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white/40 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/50 shadow-sm flex flex-col h-[700px] bento-card">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-gray-800 text-lg uppercase tracking-tight">
                {isRTL ? "دليل الموردين" : "Supplier Directory"}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-indigo-100">
                  {suppliers.length} {isRTL ? "مورد" : "Total"}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
              {suppliers.length === 0 ? (
                <div className="text-center py-48 opacity-20">
                  <Truck size={80} className="mx-auto mb-4" />
                  <p className="font-black uppercase tracking-widest text-xs">
                    No suppliers registered
                  </p>
                </div>
              ) : (
                suppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="p-5 bg-white/80 hover:bg-white rounded-[2rem] border border-gray-100 flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-black uppercase text-sm">
                        {supplier.name.substring(0, 2)}
                      </div>
                      <div>
                        <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight leading-none mb-1">
                          {supplier.name}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                          {supplier.contact_person} • {supplier.phone} •{" "}
                          {supplier.category}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <Sparkles
                            key={i}
                            size={10}
                            fill={
                              i < (supplier.rating || 5)
                                ? "currentColor"
                                : "none"
                            }
                            className={
                              i < (supplier.rating || 5)
                                ? "opacity-100"
                                : "opacity-20"
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPharmacyOrders = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-gray-900 rounded-[2.5rem] p-6 text-white shadow-2xl bento-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <ShoppingCart size={22} className="stroke-[2.5]" />
              </div>
              <h3 className="font-black text-white text-lg uppercase tracking-tight">
                {isRTL ? "إصدار أمر شراء" : "Create Purchase Order"}
              </h3>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newOrder = {
                  id: "po_" + Math.random().toString(36).substr(2, 9),
                  supplier_id: formData.get("supplier_id"),
                  items: JSON.stringify([
                    {
                      medication_id: formData.get("medication_id"),
                      quantity: parseInt(formData.get("quantity") as string),
                      price:
                        medications.find(
                          (m) => m.id === formData.get("medication_id"),
                        )?.price || 0,
                    },
                  ]),
                  total_amount:
                    (medications.find(
                      (m) => m.id === formData.get("medication_id"),
                    )?.price || 0) *
                    parseInt(formData.get("quantity") as string),
                  status: "Pending",
                  order_date: new Date().toISOString(),
                };

                try {
                  const res = await apiFetch("/api/pharmacy-orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newOrder),
                  });
                  if (res.ok) {
                    toast.success(
                      isRTL ? "تم إرسال طلب الشراء" : "Purchase order created",
                    );
                    fetchData(true);
                    (e.target as HTMLFormElement).reset();
                  }
                } catch (err) {
                  toast.error("Order creation failed");
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Supplier
                </label>
                <select
                  name="supplier_id"
                  required
                  className="w-full px-4 py-3 bg-white/10 rounded-2xl border-none outline-none font-bold text-xs ring-1 ring-white/20 focus:ring-2 focus:ring-primary-500 transition-all appearance-none"
                >
                  <option value="" className="bg-gray-800 text-white">
                    Select Supplier
                  </option>
                  {suppliers.map((s) => (
                    <option
                      key={s.id}
                      value={s.id}
                      className="bg-gray-800 text-white"
                    >
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Medication
                </label>
                <select
                  name="medication_id"
                  required
                  className="w-full px-4 py-3 bg-white/10 rounded-2xl border-none outline-none font-bold text-xs ring-1 ring-white/20 focus:ring-2 focus:ring-primary-500 transition-all appearance-none"
                >
                  <option value="" className="bg-gray-800 text-white">
                    Select Item
                  </option>
                  {medications.map((m) => (
                    <option
                      key={m.id}
                      value={m.id}
                      className="bg-gray-800 text-white"
                    >
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Quantity
                </label>
                <input
                  name="quantity"
                  type="number"
                  required
                  className="w-full px-4 py-3 bg-white/10 rounded-2xl border-none outline-none font-bold text-xs ring-1 ring-white/20 focus:ring-2 focus:ring-primary-500 transition-all"
                />
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-200 hover:bg-primary-700 transition-all"
              >
                {isRTL ? "إرسال الطلب للمورد" : "Submit PO to Vendor"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white/40 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/50 shadow-sm flex flex-col h-[700px] bento-card">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-gray-800 text-lg uppercase tracking-tight">
                {isRTL ? "سجل المشتريات" : "PO History & Receiving"}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
              {pharmacyOrders.length === 0 ? (
                <div className="text-center py-48 opacity-20">
                  <ShoppingCart size={80} className="mx-auto mb-4" />
                  <p className="font-black uppercase tracking-widest text-xs">
                    No orders on record
                  </p>
                </div>
              ) : (
                pharmacyOrders.map((order, idx) => {
                  const supplier = suppliers.find(
                    (s) => s.id === order.supplier_id,
                  );
                  const items = JSON.parse(order.items || "[]");

                  return (
                    <div
                      key={`${order.id}-${idx}`}
                      className={`p-5 rounded-[2rem] border transition-all flex items-center justify-between ${order.status === "Received" ? "bg-emerald-50/50 border-emerald-100 opacity-70" : "bg-white border-gray-100 shadow-sm"}`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${order.status === "Received" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}
                        >
                          <ClipboardList size={22} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">
                              {supplier?.name || "Various Vendors"}
                            </h4>
                            <span className="text-[8px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-black uppercase tracking-[0.2em]">
                              {order.id}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-2">
                            Ordered{" "}
                            {new Date(order.order_date).toLocaleDateString()} •
                            Items: {items.length}
                          </p>
                          <span className="text-xs font-black text-primary-600">
                            {currencySymbol}
                            {order.total_amount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {order.status === "Pending" ? (
                        <button
                          onClick={async () => {
                            try {
                              const res = await apiFetch(
                                `/api/pharmacy-orders/${order.id}/receive`,
                                {
                                  method: "PUT",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ items }),
                                },
                              );
                              if (res.ok) {
                                toast.success(
                                  isRTL
                                    ? "تم استلام الطلب وتحديث المخزون"
                                    : "Order received & stock updated",
                                );
                                fetchData(true);
                              }
                            } catch (err) {
                              toast.error("Receiving failed");
                            }
                          }}
                          className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2"
                        >
                          <CheckCircle size={14} />{" "}
                          {isRTL ? "تأكيد الاستلام" : "Receive Order"}
                        </button>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                            Received
                          </span>
                          <span className="text-[10px] font-bold text-gray-400">
                            {new Date(
                              order.receive_date || "",
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPharmacySales = () => {
    const cart = pharmacySaleCart;
    const setCart = setPharmacySaleCart;
    const selectedMedId = pharmacySaleSelectedMedId;
    const setSelectedMedId = setPharmacySaleSelectedMedId;
    const addQuantity = pharmacySaleAddQuantity;
    const setAddQuantity = setPharmacySaleAddQuantity;
    const buyerName = pharmacySaleBuyerName;
    const setBuyerName = setPharmacySaleBuyerName;
    const buyerPhone = pharmacySaleBuyerPhone;
    const setBuyerPhone = setPharmacySaleBuyerPhone;
    const paymentMethod = pharmacySalePaymentMethod;
    const setPaymentMethod = setPharmacySalePaymentMethod;
    const selectedPatientId = pharmacySaleSelectedPatientId;
    const setSelectedPatientId = setPharmacySaleSelectedPatientId;
    const isOTC = pharmacySaleIsOTC;
    const setIsOTC = setPharmacySaleIsOTC;
    const prescriptionImage = pharmacySalePrescriptionImage;
    const setPrescriptionImage = setPharmacySalePrescriptionImage;
    const checkOwner = pharmacySaleCheckOwner;
    const setCheckOwner = setPharmacySaleCheckOwner;
    const checkBank = pharmacySaleCheckBank;
    const setCheckBank = setPharmacySaleCheckBank;
    const checkAmount = pharmacySaleCheckAmount;
    const setCheckAmount = setPharmacySaleCheckAmount;
    const checkProgress = pharmacySaleCheckProgress;
    const setCheckProgress = setPharmacySaleCheckProgress;
    const checkPhoto = pharmacySaleCheckPhoto;
    const setCheckPhoto = setPharmacySaleCheckPhoto;
    const expandedSaleCheckId = pharmacySaleExpandedCheckId;
    const setExpandedSaleCheckId = setPharmacySaleExpandedCheckId;

    const selectedMed = medications.find((m) => m.id === selectedMedId);
    const selectedPatient = patients.find(p => p.id === selectedPatientId);

    const handleAddToCart = () => {
        if (!selectedMedId || !selectedMed) return;
        if (addQuantity <= 0) {
          toast.error(
            isRTL
              ? "الكمية يجب أن تكون أكبر من صفر"
              : "Quantity must be greater than zero",
          );
          return;
        }
        if (selectedMed.stock < addQuantity) {
          toast.error(
            isRTL
              ? `المخزون غير كافٍ. المتوفر: ${selectedMed.stock}`
              : `Insufficient stock. Available: ${selectedMed.stock}`,
          );
          return;
        }

        const existing = cart.find((c) => c.medication_id === selectedMedId);
        if (existing) {
          const newQty = existing.quantity + addQuantity;
          if (selectedMed.stock < newQty) {
            toast.error(
              isRTL
                ? `المخزون غير كافٍ. المتوفر: ${selectedMed.stock}`
                : `Insufficient stock. Available: ${selectedMed.stock}`,
            );
            return;
          }
          setCart(
            cart.map((c) =>
              c.medication_id === selectedMedId
                ? { ...c, quantity: newQty }
                : c,
            ),
          );
        } else {
          setCart([
            ...cart,
            {
              medication_id: selectedMedId,
              name: selectedMed.name,
              quantity: addQuantity,
              price: selectedMed.price,
            },
          ]);
        }
        setSelectedMedId("");
        setAddQuantity(1);
        toast.success(
          isRTL ? "تمت إضافة الدواء إلى السلة" : "Medication added to cart",
        );
      };

      const handleRemoveFromCart = (medId: string) => {
        setCart(cart.filter((c) => c.medication_id !== medId));
      };

      const cartTotal = cart.reduce(
        (acc, item) => acc + item.price * item.quantity,
        0,
      );

      // We use cartTotal natively now. Removed useEffect that caused hook order error.

      const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (cart.length === 0) {
          toast.error(isRTL ? "سلة الشراء فارغة" : "Your cart is empty");
          return;
        }

        let salePaymentMethod = paymentMethod;
        if (paymentMethod === "Check") {
          salePaymentMethod = JSON.stringify({
            type: "BankCheck",
            owner: checkOwner,
            bank: checkBank,
            amount: checkAmount || cartTotal,
            progress: checkProgress,
            photo: checkPhoto,
          });
        }

        const saleData = {
          id: "sale_" + Math.random().toString(36).substr(2, 9),
          buyer_name: buyerName,
          buyer_phone: buyerPhone,
          items: JSON.stringify(cart),
          total_amount: cartTotal,
          payment_method: salePaymentMethod,
          patient_id: selectedPatientId,
          is_otc: isOTC,
          prescription_image: prescriptionImage
        };

        try {
          const res = await apiFetch("/api/pharmacy-sales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(saleData),
          });
          if (res.ok) {
            // If linked to a patient, create a medical record entry for this dispense
            if (selectedPatientId) {
              const medicationsList = cart.map(item => `${item.name} (${item.quantity})`).join(", ");
              const recordData = {
                id: "rec_" + Math.random().toString(36).substr(2, 9),
                patientId: selectedPatientId,
                doctorId: (currentUser as any)?.id || "pharmacy_dispenser",
                visitDate: new Date().toISOString(),
                diagnosis: isRTL ? "صرف صيدلي مباشر" : "Direct Pharmacy Dispense",
                treatment: isRTL ? `تم صرف: ${medicationsList}` : `Dispensed: ${medicationsList}`,
                notes: isOTC 
                  ? (isRTL ? "طلب مباشر من المريض (بدون وصفة)" : "Direct patient request (OTC)") 
                  : (isRTL ? "بناءً على وصفة طبية (ورقية مصورة)" : "Based on prescription (Paper scanned)"),
                images: prescriptionImage ? [prescriptionImage] : []
              };
              await apiFetch("/api/medical-records", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(recordData),
              });
            }

            toast.success(
              isRTL
                ? "تم تسجيل عملية البيع وتحديث سجل المريض بنجاح"
                : "Pharmacy sale recorded & patient history updated",
            );
            setCart([]);
            setBuyerName(isRTL ? "مشتري خارجي" : "Walk-In Buyer");
            setBuyerPhone("");
            setSelectedPatientId(null);
            setPrescriptionImage(null);
            setIsOTC(true);
            fetchData(true);
          } else {
            toast.error(isRTL ? "فشل إتمام العملية" : "Checkout failed");
          }
        } catch (err) {
          toast.error(
            isRTL ? "حدث خطأ غير متوقع" : "Unexpected error during checkout",
          );
        }
      };

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* New Walk-In Sale Entry */}
            <div className="lg:col-span-5 bg-gray-900 rounded-[2.5rem] p-6 text-white shadow-2xl flex flex-col justify-between bento-card">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <Coins size={22} className="stroke-[2.5]" />
                  </div>
                  <h3 className="font-black text-white text-lg uppercase tracking-tight">
                    {isRTL ? "مسجل مبيعات خارجي" : "Walk-In POS Term"}
                  </h3>
                </div>

                {/* Patient/Buyer Info */}
                <div className="space-y-4 mb-6 pt-2 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-primary-400">
                      {isRTL ? "بيانات المشتري" : "Client Info"}
                    </h4>
                    <div className="flex gap-2">
                       <button 
                         type="button" 
                         onClick={() => setIsOTC(true)}
                         className={`text-[8px] font-black px-2 py-0.5 rounded-full transition-all ${isOTC ? 'bg-primary-500 text-white' : 'bg-white/5 text-gray-500'}`}
                       >
                         {isRTL ? "طلب مباشر" : "OTC Request"}
                       </button>
                       <button 
                         type="button" 
                         onClick={() => setIsOTC(false)}
                         className={`text-[8px] font-black px-2 py-0.5 rounded-full transition-all ${!isOTC ? 'bg-primary-500 text-white' : 'bg-white/5 text-gray-500'}`}
                       >
                         {isRTL ? "بوصفة طبية" : "Prescription"}
                       </button>
                    </div>
                  </div>

                  {!isOTC && (
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2 mb-2">
                      <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">
                        {isRTL ? "صورة الوصفة الورقية" : "Paper Prescription Image"}
                      </label>
                      <div className="flex gap-2">
                         <label className="flex-1 bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 text-[10px] font-black uppercase py-2 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-2 border border-primary-500/20">
                            <Plus size={14} />
                            {isRTL ? "رفع صورة" : "Upload Scan"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = () => setPrescriptionImage(reader.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                         </label>
                         {prescriptionImage && (
                           <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0">
                              <img src={prescriptionImage} className="w-full h-full object-cover" />
                           </div>
                         )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <label className="block text-[10px] font-black text-primary-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <Users size={12} />
                        {isRTL ? "ربط بملف مريض موجود" : "Link to Patient File"}
                      </label>
                      <div className="dark">
                        <SmartSearchPicker
                          items={patients.map(p => ({
                            id: p.id,
                            name: p.name,
                            nationalId: p.nationalId,
                            description: p.nationalId || p.id,
                            details: p.bloodType
                          }))}
                          selectedId={selectedPatientId || ""}
                          onSelect={(item) => setSelectedPatientId(item ? item.id : null)}
                          placeholder={isRTL ? "البحث بالاسم أو الرقم الوطني..." : "Search by Name or ID..."}
                          type="patient"
                          isRTL={isRTL}
                        />
                      </div>
                      {selectedPatientId && (
                        <div className="mt-2 text-[10px] text-gray-400 font-bold bg-white/5 p-2 rounded-lg flex items-center justify-between">
                           <span>{isRTL ? "تم الاختيار:" : "Selected:"} {buyerName}</span>
                           <button onClick={() => setSelectedPatientId(null)} className="text-red-400 hover:text-red-300">
                             {isRTL ? "إلغاء" : "Clear"}
                           </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 p-3 rounded-2xl border border-white/5 transition-all focus-within:ring-1 focus-within:ring-primary-500/50">
                        <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">
                          {isRTL ? "اسم العميل" : "Client Name"}
                        </label>
                        <input
                          type="text"
                          value={buyerName}
                          onChange={(e) => setBuyerName(e.target.value)}
                          required
                          className="w-full bg-transparent border-none outline-none font-bold text-xs text-white p-0"
                        />
                      </div>
                      <div className="bg-white/5 p-3 rounded-2xl border border-white/5 transition-all focus-within:ring-1 focus-within:ring-primary-500/50">
                        <label className="block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">
                          {isRTL ? "هاتف التواصل" : "Contact Phone"}
                        </label>
                        <input
                          type="text"
                          value={buyerPhone}
                          placeholder={isRTL ? "رقم الهاتف" : "Phone number"}
                          onChange={(e) => setBuyerPhone(e.target.value)}
                          className="w-full bg-transparent border-none outline-none font-bold text-xs text-white p-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Add item form */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-primary-400">
                    {isRTL ? "أضف منتج طبي إلى السلة" : "Add Medical Products"}
                  </h4>
                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                      {isRTL ? "اختر الدواء / المستحضر" : "Select Item"}
                    </label>
                    <div className="dark">
                      <SmartSearchPicker
                        items={medications
                          .filter((m) => m.stock > 0)
                          .map((m) => ({
                            id: m.id,
                            name: `${m.name} (${m.genericName || m.category})`,
                            description: `${isRTL ? "مخزون:" : "Stock:"} ${m.stock}`,
                            details: `${currencySymbol}${m.price}`
                          }))}
                        selectedId={selectedMedId}
                        onSelect={(item) => setSelectedMedId(item ? item.id : "")}
                        placeholder={isRTL ? "اختر الدواء..." : "Select Medication"}
                        type="medical"
                        isRTL={isRTL}
                      />
                    </div>
                  </div>

                  {selectedMed && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold block">
                          {isRTL ? "الملصق الطبي" : "Category"}
                        </span>
                        <span className="text-white font-black text-xs">
                          {selectedMed.category}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold block">
                          {isRTL ? "السعر الفردي" : "Price"}
                        </span>
                        <span className="text-emerald-400 font-black text-xs">
                          {currencySymbol}
                          {selectedMed.price}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                        {isRTL ? "الكمية المطلوبة" : "Quantity"}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={selectedMed ? selectedMed.stock : 999}
                        value={addQuantity}
                        onChange={(e) =>
                          setAddQuantity(parseInt(e.target.value) || 1)
                        }
                        className="w-full px-4 py-3 bg-white/10 rounded-xl border-none outline-none font-bold text-xs ring-1 ring-white/10 focus:ring-2 focus:ring-primary-500 transition-all text-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={!selectedMedId}
                        className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:hover:bg-primary-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/10 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus size={14} className="stroke-[3]" />
                        {isRTL ? "إضافة للسلة" : "Add to Cart"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cart checkout settings */}
              <div className="pt-6 border-t border-white/10 mt-6 space-y-4">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 text-left">
                    {isRTL ? "طريقة السداد" : "Payment Type"}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "Cash", label: isRTL ? "نقدي" : "Cash", icon: Coins, color: "bg-amber-500", initial: null },
                      { id: "Bankak", label: isRTL ? "بنكك" : "Bankak", icon: Smartphone, color: "bg-[#004b8d]", initial: "B" },
                      { id: "Fawry", label: isRTL ? "فوري" : "Fawry", icon: Smartphone, color: "bg-[#78be20]", initial: "F" },
                      { id: "Ocash", label: isRTL ? "أوكاش" : "Ocash", icon: Smartphone, color: "bg-[#0084ff]", initial: "O" },
                      { id: "SyberPay", label: isRTL ? "سايبر باي" : "SyberPay", icon: Smartphone, color: "bg-[#ff5a00]", initial: "S" },
                      { id: "Check", label: isRTL ? "شيك بنكي" : "Bank Check", icon: ClipboardList, color: "bg-purple-600", initial: null },
                      { id: "Insurance", label: isRTL ? "تأمين" : "Insurance", icon: ShieldCheck, color: "bg-teal-600", initial: null },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`py-2 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider flex flex-col items-center gap-1 transition-all border ${paymentMethod === m.id ? "bg-white/10 text-white border-primary-500/50 shadow-sm" : "bg-white/5 border-transparent text-gray-400 hover:text-white hover:bg-white/10"}`}
                      >
                        {m.initial ? (
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-bold ${m.color}`}>
                            {m.initial}
                          </div>
                        ) : (
                          <m.icon size={14} className={paymentMethod === m.id ? "text-primary-400" : ""} />
                        )}
                        <span className="truncate w-full text-center">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === "Check" && (
                  <div className="bg-white/5 p-4 rounded-3xl border border-white/10 space-y-3.5 text-left text-white mt-2">
                    <label className="block text-[8px] font-black uppercase tracking-widest text-[#00f2fe]">
                      {isRTL
                        ? "بيانات الشيك المصرفي المقيد"
                        : "Bank Check Ledger"}
                    </label>

                    {/* Professional digital medical card inside POS */}
                    <div className="relative w-full h-36 rounded-2xl bg-gradient-to-br from-black/80 to-slate-900 border border-white/10 p-3 flex flex-col justify-between text-xs">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl pointer-events-none" />
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-[7px] text-[#00f2fe] font-mono leading-none uppercase tracking-widest mb-0.5">
                            Walk-In Bank Check
                          </p>
                          <h4 className="text-[10px] font-bold text-white uppercase tracking-tight truncate max-w-[120px] font-mono">
                            {checkBank ||
                              (isRTL ? "البنك المسحوب" : "ENTER BANK")}
                          </h4>
                        </div>
                        <div className="text-right">
                          <p className="text-[7px] text-gray-500 font-mono leading-none">
                            PROGRESS_STG_{checkProgress}
                          </p>
                          {checkPhoto ? (
                            <span className="inline-block mt-0.5 text-[7px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-400/20">
                              Verified Scan
                            </span>
                          ) : (
                            <span className="inline-block mt-0.5 text-[7px] font-black uppercase tracking-widest text-yellow-400 bg-yellow-500/10 px-1 py-0.2 rounded border border-yellow-400/20">
                              Waiting Receipt
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="my-1.5 border-t border-b border-white/5 py-1.5 flex justify-between items-center bg-white/[0.01] px-2.5 rounded-lg">
                        <div>
                          <p className="text-[7px] text-gray-500 uppercase leading-none">
                            Account Owner
                          </p>
                          <p className="text-[10px] text-primary-200 font-bold leading-none mt-1 truncate max-w-[150px]">
                            {checkOwner ||
                              (isRTL ? "اسم صاحب الشيك" : "ENTER OWNER")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[7px] text-gray-500 uppercase leading-none">
                            Amount
                          </p>
                          <p className="text-[11px] text-emerald-400 font-black leading-none mt-1 font-mono">
                            {currencySymbol}
                            {checkAmount.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-between items-end text-[7px] font-mono text-gray-500">
                        <span className="text-white bg-white/10 px-1 py-0.2 rounded">
                          {checkProgress} tx(s) completed
                        </span>
                        {checkPhoto && (
                          <div className="w-5 h-5 rounded bg-white/10 overflow-hidden border border-white/10">
                            <img
                              src={checkPhoto}
                              className="w-full h-full object-cover"
                              alt="receipt scan"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Check Inputs inside POS */}
                    <div className="grid grid-cols-2 gap-2 text-white">
                      <div>
                        <label className="block text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          {isRTL ? "صاحب الحساب" : "Account Owner"}
                        </label>
                        <input
                          type="text"
                          value={checkOwner}
                          onChange={(e) => setCheckOwner(e.target.value)}
                          className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-[10px] outline-none focus:ring-1 focus:ring-primary-500 font-bold"
                          placeholder={isRTL ? "اسم المالك" : "John Doe"}
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          {isRTL ? "البنك المصرفي" : "Bank Name"}
                        </label>
                        <input
                          type="text"
                          value={checkBank}
                          onChange={(e) => setCheckBank(e.target.value)}
                          className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-[10px] outline-none focus:ring-1 focus:ring-primary-500 font-bold"
                          placeholder={isRTL ? "اسم البنك" : "e.g. Chase"}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          {isRTL
                            ? "مراحل البيع المكتملة"
                            : "Transactions Progress"}
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setCheckProgress(Math.max(1, checkProgress - 1))
                            }
                            className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={checkProgress}
                            onChange={(e) =>
                              setCheckProgress(parseInt(e.target.value) || 1)
                            }
                            className="flex-1 text-center p-1 bg-white/5 border border-white/10 rounded text-[10px] outline-none focus:ring-1 focus:ring-primary-500 font-mono font-bold hover:bg-white/10"
                          />
                          <button
                            type="button"
                            onClick={() => setCheckProgress(checkProgress + 1)}
                            className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                          {isRTL ? "ورقة المعاملة المصورة" : "Receipt Paper"}
                        </label>
                        <div className="flex gap-1">
                          <label className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[8px] font-bold uppercase text-center py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1">
                            <Plus size={10} />
                            {isRTL ? "رفع" : "Upload"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = () =>
                                    setCheckPhoto(reader.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              const canvas = document.createElement("canvas");
                              canvas.width = 600;
                              canvas.height = 300;
                              const ctx = canvas.getContext("2d");
                              if (ctx) {
                                ctx.fillStyle = "#1e293b";
                                ctx.fillRect(0, 0, 600, 300);
                                ctx.strokeStyle = "#334155";
                                ctx.lineWidth = 4;
                                ctx.strokeRect(10, 10, 580, 280);
                                ctx.strokeStyle = "#0ea5e9";
                                ctx.lineWidth = 1;
                                ctx.strokeRect(15, 15, 570, 270);
                                ctx.fillStyle = "#38bdf8";
                                ctx.font = "bold 20px monospace";
                                ctx.fillText(
                                  checkBank || "HIMS CENTRAL BANK",
                                  30,
                                  45,
                                );
                                ctx.fillStyle = "#94a3b8";
                                ctx.font = "10px Courier";
                                ctx.fillText(
                                  "OFFICIAL BANK TRANSACTION PAPER / CHEQUE",
                                  30,
                                  65,
                                );
                                ctx.fillStyle = "#f8fafc";
                                ctx.font = "12px Courier";
                                ctx.fillText(
                                  `PAY TO: ${checkOwner || "Pharmacy Department"}`,
                                  30,
                                  120,
                                );
                                ctx.beginPath();
                                ctx.moveTo(80, 125);
                                ctx.lineTo(550, 125);
                                ctx.strokeStyle = "#cbd5e1";
                                ctx.stroke();
                                ctx.font = "bold 15px monospace";
                                ctx.fillText(
                                  `AMOUNT: ${currencySymbol}${(checkAmount || 0).toLocaleString()}`,
                                  30,
                                  165,
                                );
                                ctx.fillText(
                                  `PROGRESS TX: #${checkProgress}`,
                                  30,
                                  210,
                                );
                                ctx.font = "italic 12px serif";
                                ctx.fillText(
                                  "Authorized Signature File",
                                  380,
                                  210,
                                );
                                ctx.beginPath();
                                ctx.moveTo(360, 195);
                                ctx.lineTo(550, 195);
                                ctx.strokeStyle = "#a8a29e";
                                ctx.stroke();
                                ctx.beginPath();
                                ctx.moveTo(380, 190);
                                ctx.lineTo(390, 160);
                                ctx.lineTo(410, 190);
                                ctx.quadraticCurveTo(430, 140, 470, 185);
                                ctx.lineTo(510, 175);
                                ctx.strokeStyle = "#0284c7";
                                ctx.lineWidth = 2;
                                ctx.stroke();
                                ctx.fillStyle = "#94a3b8";
                                ctx.font = "bold 14px monospace";
                                ctx.fillText(
                                  "⑆0981124⑈  ⑆3142789⑈ 920  0443",
                                  120,
                                  260,
                                );
                                setCheckPhoto(canvas.toDataURL("image/jpeg"));
                                toast.success(
                                  isRTL
                                    ? "تم التقاط صورة الشيك بنجاح"
                                    : "Check paper snapshot generated successfully",
                                );
                              }
                            }}
                            className="flex-1 bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 text-[8px] font-bold uppercase py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 border border-primary-500/30"
                          >
                            <Camera size={10} />
                            {isRTL ? "كاميرا" : "Camera"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/10 text-left">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block leading-none mb-1">
                      {isRTL ? "المجموع المستحق" : "Checkout Total"}
                    </span>
                    <span className="text-2xl font-black text-emerald-400 leading-none">
                      {currencySymbol}
                      {cartTotal.toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={cart.length === 0}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle size={14} />
                    {isRTL ? "دفع وإصدار الفاتورة" : "Pay & Checkout"}
                  </button>
                </div>
              </div>
            </div>

            {/* Active Cart & Sales Logs */}
            <div className="lg:col-span-7 space-y-4">
              {/* Current Cart */}
              <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/50 shadow-sm flex flex-col h-[340px] bento-card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-gray-800 text-sm uppercase tracking-tight">
                    {isRTL ? "سلة شراء العميل الخارجي" : "Walk-In Active Cart"}
                  </h3>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline"
                    >
                      {isRTL ? "مسح السلة" : "Clear Basket"}
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                  {cart.length === 0 ? (
                    <div className="text-center py-20 opacity-20">
                      <ShoppingCart size={40} className="mx-auto mb-2" />
                      <p className="font-black uppercase tracking-wider text-[10px]">
                        {isRTL ? "السلة فارغة حالياً" : "No items added yet"}
                      </p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.medication_id}
                        className="p-3 bg-white hover:bg-slate-50 border border-gray-100/50 rounded-2xl flex items-center justify-between transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                            <Pill size={16} />
                          </div>
                          <div className="text-left">
                            <h4 className="font-bold text-gray-800 text-xs leading-none mb-1">
                              {item.name}
                            </h4>
                            <p className="text-[10px] text-gray-400 font-bold uppercase leading-none">
                              {isRTL ? "الكمية:" : "Qty:"} {item.quantity} •{" "}
                              {isRTL ? "السعر:" : "Price:"} {currencySymbol}
                              {item.price}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-black text-xs text-slate-800">
                            {currencySymbol}
                            {(item.price * item.quantity).toLocaleString()}
                          </span>
                          <button
                            onClick={() =>
                              handleRemoveFromCart(item.medication_id)
                            }
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-slate-100 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sales Logs */}
              <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/50 shadow-sm flex flex-col h-[340px] bento-card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-gray-800 text-sm uppercase tracking-tight text-left">
                    {isRTL
                      ? "سجل المبيعات الخارجية"
                      : "Walk-In Dispensation Log"}
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                  {pharmacySales.length === 0 ? (
                    <div className="text-center py-20 opacity-20">
                      <ClipboardList size={40} className="mx-auto mb-2" />
                      <p className="font-black uppercase tracking-wider text-[10px]">
                        {isRTL
                          ? "لا توجد مبيعات مسجلة"
                          : "No Sales Records Found"}
                      </p>
                    </div>
                  ) : (
                    pharmacySales.map((sale, idx) => {
                      const saleItems = JSON.parse(sale.items || "[]");
                      let isCheck = false;
                      let checkDetails: any = null;
                      if (
                        sale.payment_method &&
                        sale.payment_method.startsWith("{")
                      ) {
                        try {
                          const parsed = JSON.parse(sale.payment_method);
                          if (
                            parsed &&
                            typeof parsed === "object" &&
                            parsed.type === "BankCheck"
                          ) {
                            isCheck = true;
                            checkDetails = parsed;
                          }
                        } catch (e) {}
                      }
                      const isExpanded = expandedSaleCheckId === sale.id;

                      return (
                        <div
                          key={`${sale.id}-${idx}`}
                          className="p-3.5 bg-white border border-gray-100 rounded-2xl flex flex-col gap-2 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3 text-left">
                              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mt-0.5 shrink-0">
                                <Coins size={18} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <h4 className="font-black text-gray-800 text-xs uppercase tracking-tight">
                                    {sale.patient_national_id || sale.buyer_name}
                                  </h4>
                                  {sale.patient_id && (
                                     <span className="text-[7px] bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded font-black flex items-center gap-0.5">
                                       <Users size={8} />
                                       {isRTL ? "ملف مريض" : "PATIENT FILE"}
                                     </span>
                                  )}
                                  <span className="text-[8px] bg-slate-100 text-gray-500 px-1.5 py-0.5 rounded-md font-black font-mono">
                                    {sale.id}
                                  </span>
                                </div>
                                <p className="text-[9px] text-gray-400 font-bold uppercase leading-none mb-1.5">
                                  {new Date(
                                    sale.sale_date,
                                  ).toLocaleDateString()}{" "}
                                  •{" "}
                                  {sale.buyer_phone ||
                                    (isRTL ? "لا يوجد هاتف" : "No Phone")}
                                </p>
                                <div className="flex flex-wrap gap-1 leading-none text-[9px] font-medium text-gray-500">
                                  {saleItems.map((si: any, idx: number) => (
                                    <span
                                      key={idx}
                                      className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 font-mono"
                                    >
                                      {si.name} (x{si.quantity})
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end shrink-0">
                              <span className="font-black text-xs text-slate-800 mb-0.5 font-mono">
                                {currencySymbol}
                                {sale.total_amount.toLocaleString()}
                              </span>
                              {isCheck ? (
                                <button
                                  onClick={() =>
                                    setExpandedSaleCheckId(
                                      isExpanded ? null : sale.id,
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-[8px] uppercase tracking-widest bg-amber-50 text-amber-700 hover:bg-amber-100 px-2 py-0.5 rounded-full font-black border border-amber-200 transition-all cursor-pointer"
                                >
                                  <ClipboardList size={10} />
                                  {isRTL ? "عرض الشيك" : "Bank Check"}
                                </button>
                              ) : (
                                <span className="text-[8px] uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black">
                                  {sale.payment_method === "Cash"
                                    ? isRTL
                                      ? "نقداً"
                                      : "Cash"
                                    : sale.payment_method === "Insurance"
                                      ? isRTL
                                        ? "تأمين"
                                        : "Insurance"
                                      : isRTL && sale.payment_method === "Bankak" ? "بنكك" 
                                      : isRTL && sale.payment_method === "Fawry" ? "فوري"
                                      : isRTL && sale.payment_method === "Ocash" ? "أوكاش"
                                      : isRTL && sale.payment_method === "SyberPay" ? "سايبر باي"
                                      : sale.payment_method}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Expanded check info drawer */}
                          {isCheck && isExpanded && checkDetails && (
                            <div className="mt-1 p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-left text-xs antialiased space-y-2 animate-fadeIn">
                              <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-amber-100/50 shadow-xs">
                                <div>
                                  <span className="text-[8px] text-gray-400 uppercase tracking-wider block leading-none mb-1">
                                    {isRTL ? "صاحب الحساب" : "ACCOUNT OWNER"}
                                  </span>
                                  <span className="font-extrabold text-slate-800">
                                    {checkDetails.owner || "-"}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[8px] text-gray-400 uppercase tracking-wider block leading-none mb-1">
                                    {isRTL
                                      ? "البنك المسحوب"
                                      : "BANKING DIRECTORY"}
                                  </span>
                                  <span className="font-black text-[#0d9488] font-mono">
                                    {checkDetails.bank || "Unknown Bank"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-[9px] pt-1">
                                <div>
                                  <span className="text-gray-500 font-bold">
                                    {isRTL
                                      ? "مراحل التقدم:"
                                      : "Progress stages:"}{" "}
                                  </span>
                                  <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-black font-mono">
                                    {checkDetails.progress || 1} completed
                                  </span>
                                </div>
                                {checkDetails.photo ? (
                                  <button
                                    onClick={() => {
                                      const w = window.open();
                                      if (w) {
                                        w.document.write(
                                          `<img src="${checkDetails.photo}" style="max-width:100%; height:auto;" />`,
                                        );
                                      } else {
                                        toast.info(
                                          isRTL
                                            ? "افتاح الصورة المعروضة"
                                            : "Preview image loaded successfully",
                                        );
                                      }
                                    }}
                                    className="text-[8px] text-teal-600 hover:underline font-black uppercase flex items-center gap-1"
                                  >
                                    📷{" "}
                                    {isRTL
                                      ? "عرض المستند المرفق"
                                      : "Inspect Paper"}
                                  </button>
                                ) : (
                                  <span className="text-gray-400 italic text-[8px]">
                                    {isRTL
                                      ? "لا يوجد مستند مرفق"
                                      : "No photo uploaded"}
                                  </span>
                                )}
                              </div>
                              {checkDetails.photo && (
                                <div className="mt-1.5 w-full max-h-36 overflow-hidden rounded-lg border border-amber-200/50 shadow-xs">
                                  <img
                                    src={checkDetails.photo}
                                    className="w-full h-auto object-contain bg-white"
                                    alt="Transaction Paper Scan"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
  };

  // Helper to render the external pharmacies list in a way that's consistent with the Hospitals tab but styled for the Pharmacy tab
  const renderHospitalsViewForPharmacies = () => {
    const filteredPharmacies = (externalPharmacies || []).filter((p) => {
      const q = searchTerm.toLowerCase();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.id?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q) ||
        p.license_number?.toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/55 backdrop-blur-md p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <div>
            <h3 className="text-xl font-black text-gray-800 tracking-tight">
              {isRTL ? "إدارة الصيدليات الخارجية والخاصة" : "External & Private Pharmacies Management"}
            </h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
              {isRTL ? "إضافة وتسجيل وتصنيف الصيدليات المرتبطة بنظام المستشفى" : "Register and coordinate affiliate private or third-party partner institutions"}
            </p>
          </div>
          {currentUser.role === "Super Admin" && (
            <button
              onClick={() => openModal("externalPharmacy")}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              {isRTL ? "تسجيل صيدلية جديد" : "Register Pharmacy Node"}
            </button>
          )}
        </div>

        {/* Grid List */}
        {filteredPharmacies.length === 0 ? (
          <div className="bg-white/40 p-12 text-center rounded-3xl border border-dashed border-gray-200">
            <Building2 size={48} className="mx-auto text-gray-300 stroke-[1.5] mb-4" />
            <p className="text-sm font-bold text-gray-400">
              {isRTL ? "لم يتم العثور على صيدليات مسجلة" : "No pharmacies registered matching search parameters."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPharmacies.map((p, i) => {
              const linkedHospitalName = hospitals.find(h => h.id === p.hospital_id)?.name;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={`pharm-p-${p.id}`}
                  className="p-6 rounded-[2rem] bg-white border border-gray-100 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                        <Store size={24} />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          p.type === "Private" ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-purple-50 text-purple-600 border border-purple-100"
                        }`}>
                          {p.type || "Independent"}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          p.status === "Active" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        }`}>
                          {p.status || "Active"}
                        </span>
                      </div>
                    </div>
                    <h4 className="text-xl font-black text-gray-800 tracking-tight truncate mb-1">{p.name}</h4>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-bold uppercase tracking-wide mb-6">
                      <MapPin size={14} className="text-gray-400" />
                      <span className="truncate">{p.location || (isRTL ? "غير محدد" : "Unspecified")}</span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3 mt-4 text-xs font-medium">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 flex items-center gap-2"><Network size={14} /> {isRTL ? "الارتباط المؤسسي:" : "Affiliation:"}</span>
                        <span className="truncate font-black text-primary-600 uppercase italic text-[9px]">
                          {linkedHospitalName || (isRTL ? "صيدلية عامة" : "Global standalone")}
                        </span>
                      </div>
                      {p.license_number && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 flex items-center gap-2"><ShieldCheck size={14} /> {isRTL ? "ترخيص الصحة:" : "License ID:"}</span>
                          <code className="bg-amber-100/50 text-amber-700 px-2 py-1 rounded-md text-[9px] font-bold tracking-widest">{p.license_number}</code>
                        </div>
                      )}
                    </div>
                  </div>

                  {currentUser.role === "Super Admin" && (
                    <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => openModal("externalPharmacy", p)}
                        className="p-3 bg-gray-50 text-gray-500 rounded-xl hover:bg-primary-50 hover:text-primary-600 transition-colors cursor-pointer"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, "externalPharmacy")}
                        className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderExternalPharmacies = () => {
    const resetForm = () => {
      setExtName("");
      setExtType("External");
      setExtLocation("");
      setExtEmail("");
      setExtPhone("");
      setExtStatus("Active");
      setExtLicense("");
      setExtNotes("");
      setEditingId(null);
    };

    const handleEdit = (p: any) => {
      setEditingId(p.id);
      setExtName(p.name || "");
      setExtType(p.type || "External");
      setExtLocation(p.location || "");
      setExtEmail(p.contact_email || "");
      setExtPhone(p.contact_phone || "");
      setExtStatus(p.status || "Active");
      setExtLicense(p.license_number || "");
      setExtNotes(p.notes || "");
      setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
      if (confirm(isRTL ? "هل أنت متأكد من حذف هذه الصيدلية؟" : "Are you sure you want to delete this pharmacy?")) {
        try {
          const res = await apiFetch(`/api/external-pharmacies/${id}`, { method: "DELETE" });
          if (res.ok) {
            toast.success(isRTL ? "تم حذف الصيدلية بنجاح" : "Pharmacy deleted successfully");
            fetchData(true);
          } else {
            toast.error(isRTL ? "فشل الحذف" : "Deletion failed");
          }
        } catch (err) {
          toast.error("Network error");
        }
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!extName.trim()) {
        toast.error(isRTL ? "يرجى إدخال اسم الصيدلية" : "Please enter pharmacy name");
        return;
      }

      const payload = {
        id: editingId || "pharm_" + Math.random().toString(36).substring(2, 9),
        name: extName,
        type: extType,
        location: extLocation,
        contact_email: extEmail,
        contact_phone: extPhone,
        status: extStatus,
        license_number: extLicense,
        notes: extNotes
      };

      try {
        const url = editingId ? `/api/external-pharmacies/${editingId}` : "/api/external-pharmacies";
        const method = editingId ? "PUT" : "POST";
        const res = await apiFetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          toast.success(editingId ? (isRTL ? "تم تحديث البيانات" : "Pharmacy updated") : (isRTL ? "تم تسجيل الصيدلية" : "Pharmacy registered"));
          setIsFormOpen(false);
          resetForm();
          fetchData(true);
        } else {
          toast.error("Process failed");
        }
      } catch (err) {
        toast.error("Network Error");
      }
    };

    const filteredPharmacies = (externalPharmacies || []).filter(p => {
      const matchSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.license_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType === "All" || p.type === filterType;
      return matchSearch && matchType;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/55 backdrop-blur-md p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <div>
            <h3 className="text-xl font-black text-gray-800 tracking-tight">
              {isRTL ? "إدارة الصيدليات الخارجية والخاصة" : "External & Private Pharmacies Management"}
            </h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
              {isRTL ? "إضافة وتسجيل وتصنيف الصيدليات المرتبطة بنظام المستشفى" : "Register and coordinate affiliate private or third-party partner institutions"}
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setIsFormOpen(true); }}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-md flex items-center gap-2"
          >
            <Plus size={16} />
            {isRTL ? "تسجيل صيدلية جديدة" : "Register Pharmacy"}
          </button>
        </div>

        {/* Filters bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/40 backdrop-blur-sm p-4 rounded-2xl border border-gray-100">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={isRTL ? "البحث بالاسم، الترخيص أو الموقع..." : "Search by name, license, address..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white/80 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            {(["All", "Private", "External"] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterType === t ? "bg-slate-800 text-white shadow-sm" : "bg-white text-gray-500 hover:bg-slate-50 border border-gray-100"
                }`}
              >
                {t === "All" ? (isRTL ? "الكل" : "All") : t === "Private" ? (isRTL ? "خاصة" : "Private") : (isRTL ? "خارجية" : "External")}
              </button>
            ))}
          </div>
        </div>

        {/* Grid List */}
        {filteredPharmacies.length === 0 ? (
          <div className="bg-white/40 p-12 text-center rounded-3xl border border-dashed border-gray-200">
            <Building2 size={48} className="mx-auto text-gray-300 stroke-[1.5] mb-4" />
            <p className="text-sm font-bold text-gray-400">
              {isRTL ? "لم يتم العثور على صيدليات مسجلة" : "No pharmacies registered matching search parameters."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPharmacies.map(p => (
              <motion.div
                key={p.id}
                layoutId={`pharm-${p.id}`}
                className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      p.type === "Private" ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-purple-50 text-purple-600 border border-purple-100"
                    }`}>
                      {p.type === "Private" ? (isRTL ? "صيدلية خاصة" : "Private Affiliated") : (isRTL ? "صيدلية خارجية" : "External Partner")}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      p.status === "Active" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    }`}>
                      {p.status === "Active" ? (isRTL ? "نشط" : "Active") : (isRTL ? "غير نشط" : "Inactive")}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-gray-800 tracking-tight mb-2">{p.name}</h4>
                  
                  <div className="space-y-2.5 my-4 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-400 w-16 text-[10px] uppercase">{isRTL ? "الموقع:" : "Address:"}</span>
                      <span className="truncate">{p.location || "—"}</span>
                    </div>
                    {p.license_number && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-400 w-16 text-[10px] uppercase">{isRTL ? "الترخيص:" : "License:"}</span>
                        <code className="bg-gray-50 px-1.5 py-0.5 rounded text-gray-600 font-semibold">{p.license_number}</code>
                      </div>
                    )}
                    {(p.contact_email || p.contact_phone) && (
                      <div className="pt-2 border-t border-gray-50 space-y-1 text-gray-500">
                        {p.contact_email && <p className="truncate flex items-center gap-1.5">📧 {p.contact_email}</p>}
                        {p.contact_phone && <p className="truncate flex items-center gap-1.5">📞 {p.contact_phone}</p>}
                      </div>
                    )}
                  </div>
                </div>

                {p.notes && (
                  <p className="text-[11px] text-gray-400 italic mt-2 line-clamp-2 bg-gray-50/50 p-2 rounded-xl border border-gray-50">
                    {p.notes}
                  </p>
                )}

                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-2">
                  <button
                    onClick={() => handleEdit(p)}
                    className="p-2 text-gray-500 hover:text-primary-600 bg-gray-50 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 text-gray-400 hover:text-rose-600 bg-gray-50 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Upsert Dialog */}
        {isFormOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100"
            >
              <div className="px-6 py-4 bg-gray-50/80 border-b border-gray-100 flex justify-between items-center">
                <h4 className="text-lg font-black text-gray-800 tracking-tight">
                  {editingId ? (isRTL ? "تعديل تفاصيل الصيدلية" : "Edit Pharmacy Details") : (isRTL ? "تسجيل صيدلية جديدة" : "Register Pharmacy")}
                </h4>
                <button onClick={() => setIsFormOpen(false)} className="p-1 px-3 text-sm hover:bg-gray-100 rounded-lg">✕</button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{isRTL ? "اسم الصيدلية *" : "Pharmacy Name *"}</label>
                    <input
                      type="text"
                      required
                      value={extName}
                      onChange={(e) => setExtName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{isRTL ? "نوع الصيدلية" : "Pharmacy Type"}</label>
                    <select
                      value={extType}
                      onChange={(e) => setExtType(e.target.value as any)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="Private">{isRTL ? "صيدلية خاصة (تابعة)" : "Private (Affiliated)"}</option>
                      <option value="External">{isRTL ? "صيدلية خارجية (شريكة)" : "External (Partner)"}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{isRTL ? "الحالة" : "Status"}</label>
                    <select
                      value={extStatus}
                      onChange={(e) => setExtStatus(e.target.value as any)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="Active">{isRTL ? "نشط" : "Active"}</option>
                      <option value="Inactive">{isRTL ? "غير نشط" : "Inactive"}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{isRTL ? "رقم الترخيص الدوائي" : "Drug License Number"}</label>
                    <input
                      type="text"
                      value={extLicense}
                      onChange={(e) => setExtLicense(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{isRTL ? "رقم الهاتف" : "Phone Number"}</label>
                    <input
                      type="text"
                      value={extPhone}
                      onChange={(e) => setExtPhone(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{isRTL ? "البريد الإلكتروني للجهة" : "Contact Email"}</label>
                    <input
                      type="email"
                      value={extEmail}
                      onChange={(e) => setExtEmail(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{isRTL ? "الموقع والعنوان" : "Physical Location"}</label>
                    <input
                      type="text"
                      value={extLocation}
                      onChange={(e) => setExtLocation(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{isRTL ? "ملاحظات وتفاصيل إضافية" : "Additional Notes"}</label>
                    <textarea
                      value={extNotes}
                      onChange={(e) => setExtNotes(e.target.value)}
                      rows={2}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 border border-gray-200 rounded-xl text-xs hover:bg-gray-50"
                  >
                    {isRTL ? "إلغاء وكتم" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md"
                  >
                    {isRTL ? "حفظ وتفعيل" : "Save Pharmacy"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    );
  };

  const renderPharmacyPrescriptions = () => {
    // Medical records that contain prescription text
    const recordsWithRx = medicalRecords.filter(rec => rec.prescription && rec.prescription.trim().length > 0);

    const filteredRecords = recordsWithRx.filter(rec => {
      const pat = patients.find(p => p.id === rec.patientId);
      const matchesSearch = 
        (pat?.name || "").toLowerCase().includes(rxSearchQuery.toLowerCase()) ||
        rec.prescription.toLowerCase().includes(rxSearchQuery.toLowerCase()) ||
        rec.id.toLowerCase().includes(rxSearchQuery.toLowerCase());

      const isDispensed = dispensedRxIds.includes(rec.id);
      if (rxFilterMode === "pending") return matchesSearch && !isDispensed;
      if (rxFilterMode === "dispensed") return matchesSearch && isDispensed;
      return matchesSearch;
    });

    return (
      <div className="space-y-6">
        {/* Title and stats bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/50 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div>
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
              {isRTL ? "مستند بروتوكول صرف الوصفات الطبية للمرضى" : "PATIENT RX DISPENSING MASTER CONTROL"}
            </h3>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-1">
              {isRTL ? "قائمة فورية تعكس كافة الأدوية الموصى بها مسبقاً من الأطباء المعالجين" : "Live clinical queue showing home prescriptions formulated by specialized clinicians"}
            </p>
          </div>

          <div className="flex gap-4">
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100/50 flex flex-col justify-center min-w-[120px] text-center">
              <span className="text-slate-450 text-[8px] font-black uppercase tracking-wider block">
                {isRTL ? "بانتظار الصرف" : "Pending Rx"}
              </span>
              <span className="text-xl font-display font-black text-amber-700 mt-1">
                {recordsWithRx.filter(r => !dispensedRxIds.includes(r.id)).length}
              </span>
            </div>
            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100/50 flex flex-col justify-center min-w-[120px] text-center">
              <span className="text-slate-450 text-[8px] font-black uppercase tracking-wider block">
                {isRTL ? "إجمالي المنصرف" : "Dispensed"}
              </span>
              <span className="text-xl font-display font-black text-indigo-700 mt-1">
                {dispensedRxIds.length}
              </span>
            </div>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder={isRTL ? "البحث باسم المريض، رقم الوصفة، الدواء..." : "Search by patient, Rx code, medication name..."}
              value={rxSearchQuery}
              onChange={(e) => setRxSearchQuery(e.target.value)}
              className="w-full text-xs font-semibold pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl focus:outline-none focus:ring-1 focus:ring-primary-500 shadow-xs"
            />
          </div>

          <div className="flex gap-1 bg-slate-105 p-1 rounded-2xl shrink-0">
            {[
              { id: "all", label: isRTL ? "الكل" : "All Prescriptions" },
              { id: "pending", label: isRTL ? "المعلقة" : "Pending Rx Only" },
              { id: "dispensed", label: isRTL ? "المنصرفة" : "Dispensed Scripts" }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setRxFilterMode(f.id as any)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                  rxFilterMode === f.id
                    ? "bg-white text-slate-800 shadow-sm font-black"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prescription List Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRecords.length === 0 ? (
            <div className="col-span-2 bg-white/50 backdrop-blur-md border border-slate-100 rounded-[2.5rem] py-16 flex flex-col items-center justify-center text-center">
              <ClipboardList size={48} className="text-slate-300 mb-3 animate-bounce" />
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                {isRTL ? "لا توجد وصفات طبية مطابقة" : "No prescriptions found"}
              </h4>
              <p className="text-[10px] text-slate-400 max-w-xs mt-1">
                {isRTL ? "تأكد من كتابة معايير تصفية صحيحة أو إضافة وصفات طبية جديدة عبر العيادات." : "Check your search terms or verify doctors have entered prescription text during examinations."}
              </p>
            </div>
          ) : (
            filteredRecords.map(rec => {
              const pat = patients.find(p => p.id === rec.patientId);
              const doc = users.find(u => u.id === rec.doctorId);
              const isDispensed = dispensedRxIds.includes(rec.id);

              // Detect match from Medication Inventory
              const words = rec.prescription.split(/[\s,]+/);
              const matchedDrug = inventory.find(inv => {
                return words.some(w => w.length > 3 && inv.name.toLowerCase().includes(w.toLowerCase()));
              });

              return (
                <div
                  key={rec.id}
                  className={`bg-white rounded-[2.5rem] border p-6 flex flex-col justify-between gap-6 shadow-sm relative overflow-hidden transition-all hover:shadow-md ${
                    isDispensed ? "border-indigo-100 bg-indigo-50/10" : "border-slate-100"
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header bar: code & status */}
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-mono font-black text-slate-400 block tracking-widest">
                          PRESCRIPTION ID
                        </span>
                        <span className="text-xs font-black text-slate-750">{rec.id}</span>
                      </div>

                      <span
                        className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                          isDispensed
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            : "bg-amber-50 text-amber-700 border border-amber-100 animate-pulse"
                        }`}
                      >
                        {isDispensed ? (isRTL ? "تم الصرف" : "DISPENSED") : (isRTL ? "بانتظار الصرف" : "PENDING DISPENSING")}
                      </span>
                    </div>

                    {/* Patient & Doctor */}
                    <div className="grid grid-cols-2 gap-4 border-y border-dashed border-slate-100 py-3.5">
                      <div>
                        <span className="text-[7.5px] font-mono text-slate-400 uppercase tracking-wider block">
                          {isRTL ? "اسم المريض" : "Patient Case"}
                        </span>
                        <span className="text-[11px] font-black text-slate-800 block mt-0.5 truncate">
                          {pat?.name || "Unknown Patient"}
                        </span>
                        <span className="text-[9px] font-mono text-slate-450 block">
                          ID: {rec.patientId}
                        </span>
                      </div>
                      <div>
                        <span className="text-[7.5px] font-mono text-slate-400 uppercase tracking-wider block">
                          {isRTL ? "الطبيب المعالج" : "Prescribing Doctor"}
                        </span>
                        <span className="text-[11px] font-black text-slate-800 block mt-0.5 truncate">
                          {doc?.name || "Dr. Outpatient Staff"}
                        </span>
                        <span className="text-[9px] font-mono text-slate-450 block">
                          {rec.visitDate}
                        </span>
                      </div>
                    </div>

                    {/* Prescription Details */}
                    <div>
                      <span className="text-[7.5px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                        {isRTL ? "الوصفة الطبية والصيغة الكيميائية" : "Prescription Directions"}
                      </span>
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <p className="text-xs text-slate-750 font-black whitespace-pre-line leading-relaxed">
                          {rec.prescription}
                        </p>
                      </div>
                    </div>

                    {/* Auto-matching drug in inventory */}
                    <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Package size={14} className="text-indigo-500 shrink-0" />
                        <div>
                          <span className="text-[8px] font-mono text-slate-450 block uppercase tracking-wider">
                            {isRTL ? "الدواء المتطابق بالمخزن" : "Auto-Matched Stock Medicine"}
                          </span>
                          <span className="text-[10px] font-black text-slate-700 block">
                            {matchedDrug ? `${matchedDrug.name} (${isRTL ? "المتاح:" : "Stock:"} ${matchedDrug.currentQuantity})` : (isRTL ? "لم يتم العثور على تطابق دقيق" : "No direct inventory match")}
                          </span>
                        </div>
                      </div>
                      {matchedDrug && matchedDrug.currentQuantity <= matchedDrug.minQuantity && (
                        <span className="text-[7px] font-black bg-rose-50 text-rose-650 border border-rose-100 px-2 py-0.5 rounded-md uppercase">
                          {isRTL ? "مخزون حرج!" : "Critically Low!"}
                        </span>
                      )}
                    </div>
                  </div>

                    {/* Actions window */}
                    {!isDispensed ? (
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              if (matchedDrug) {
                                const updatedQuantity = Math.max(0, matchedDrug.currentQuantity - 1);
                                await apiFetch(`/api/inventory/${matchedDrug.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    ...matchedDrug,
                                    currentQuantity: updatedQuantity
                                  })
                                });

                                setInventory(prev => prev.map(inv => inv.id === matchedDrug.id ? { ...inv, currentQuantity: updatedQuantity } : inv));
                              }

                              const saleItemObj = {
                                medication_id: matchedDrug?.id || "unknown",
                                name: matchedDrug?.name || rec.prescription.substring(0, 30),
                                quantity: 1,
                                price: matchedDrug?.cost || 15.00
                              };

                              const newSalePayload = {
                                buyer_name: pat?.name || "Clinic Patient",
                                buyer_phone: pat?.phone || "050000000",
                                sale_date: new Date().toISOString().substring(0, 10),
                                items: JSON.stringify([saleItemObj]),
                                total_amount: matchedDrug?.cost || 15.00,
                                payment_method: "Insurance Copay",
                                status: "Paid" as const
                              };

                              const rawResp = await apiFetch(`/api/pharmacy-sales`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(newSalePayload)
                              });

                              if (rawResp && rawResp.ok) {
                                setPharmacySales(prev => [
                                  {
                                    id: `SALE-${Math.floor(1000 + Math.random() * 9000)}`,
                                    hospital_id: "",
                                    buyer_name: newSalePayload.buyer_name!,
                                    buyer_phone: newSalePayload.buyer_phone,
                                    sale_date: newSalePayload.sale_date!,
                                    items: newSalePayload.items!,
                                    total_amount: newSalePayload.total_amount!,
                                    payment_method: newSalePayload.payment_method!,
                                    status: newSalePayload.status!
                                  },
                                  ...prev
                                ]);
                              }

                              const nextDispensed = [...dispensedRxIds, rec.id];
                              setDispensedRxIds(nextDispensed);
                              localStorage.setItem("dispensed_rx_ids", JSON.stringify(nextDispensed));

                              toast.success(isRTL ? `تم صرف العلاج ودعم مبيعات الصيدلية للمريض ${pat?.name} بنجاح!` : `Prescription dispensed & drug deduction executed successfully for ${pat?.name}!`);
                            } catch (err) {
                              toast.error("Failed to complete dispense operation.");
                            }
                          }}
                          className="w-full py-2.5 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition hover:shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <ClipboardList size={14} />
                          {isRTL ? "تأكيد وصرف دواء المريض" : "Verify & Dispense Script"}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const firstExt = externalPharmacies[0];
                            const msg = isRTL 
                              ? `سيتم إرسال نسخة رقمية من الوصفة إلى الصيدلية الخارجية: ${firstExt?.name || "صيدلية شريكة"}. هل تود المتابعة؟`
                              : `Transfer script data to ${firstExt?.name || "Partner Network"} for external fulfillment?`;
                            
                            if (confirm(msg)) {
                              const nextDispensed = [...dispensedRxIds, rec.id];
                              setDispensedRxIds(nextDispensed);
                              localStorage.setItem("dispensed_rx_ids", JSON.stringify(nextDispensed));
                              toast.success(isRTL ? "تم تحويل الوصفة بنجاح" : "Prescription transferred successfully.");
                            }
                          }}
                          className="w-full py-2 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink size={12} />
                          {isRTL ? "تحويل لصيدلية خارجية" : "Refer to External Pharmacy"}
                        </button>
                      </div>
                    ) : (
                    <div className="w-full py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-center text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center justify-center gap-1.5">
                      <CheckCircle size={14} />
                      {isRTL ? "مكتملة ومصروفة بالكامل" : "Script Dispensed & stock updated"}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderPharmacy = () => (
    <div className="pb-32 pt-4 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
      {/* Pharmacy Navigation */}
      <div className="flex gap-2 p-1.5 bg-slate-100/50 backdrop-blur-xl rounded-2xl max-w-4xl overflow-x-auto shadow-inner border border-slate-200/30 shrink-0 self-start">
        {[
          {
            id: "inventory",
            label: isRTL ? "المخزون الدوائي" : "Medication Inventory",
            icon: Package,
          },
          {
            id: "prescriptions",
            label: isRTL ? "صرف الوصفات الطبية" : "Patient RX Dispensing",
            icon: ClipboardList,
          },
          {
            id: "suppliers",
            label: isRTL ? "الموردين" : "Suppliers Chain",
            icon: Truck,
          },
          {
            id: "orders",
            label: isRTL ? "طلبات الشراء" : "Purchase Orders",
            icon: ShoppingCart,
          },
          {
            id: "sales",
            label: isRTL ? "مبيعات المشترين الخارجيين" : "Walk-In Sales",
            icon: Coins,
          },
          {
            id: "permissions",
            label: isRTL ? "صلاحيات العاملين" : "Staff Permissions",
            icon: ShieldCheck,
          },
        ].map((tab) => {
          const isActive = pharmacyViewMode === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setPharmacyViewMode(tab.id as any)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2.5 relative active:scale-95 group ${
                isActive ? "text-white" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="pharmacy-nav-active"
                  className="absolute inset-0 bg-primary-600 rounded-xl shadow-lg shadow-primary-500/20"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <tab.icon
                size={14}
                className={`relative z-10 transition-transform duration-300 group-hover:scale-110 ${isActive ? "text-white" : "text-gray-400"}`}
              />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {pharmacyViewMode === "suppliers" ? (
        renderPharmacySuppliers()
      ) : pharmacyViewMode === "orders" ? (
        renderPharmacyOrders()
      ) : pharmacyViewMode === "sales" ? (
        renderPharmacySales()
      ) : pharmacyViewMode === "prescriptions" ? (
        renderPharmacyPrescriptions()
      ) : pharmacyViewMode === "permissions" ? (
        renderStaffPermissionsManager("pharmacy")
      ) : (
        <>
          {/* Top Search and Stats Row (Mirrors EMR) */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/50 dark:bg-slate-900/40 backdrop-blur-md p-4 rounded-3xl border border-white/50 dark:border-white/5 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder={
                  isRTL
                    ? "البحث باسم أو تصنيف الدواء... (⌘ + K)"
                    : "Search by name, category... (⌘ + K)"
                }
                className="w-full pl-12 pr-12 py-3 bg-white/80 dark:bg-slate-800/80 rounded-2xl border-none focus:ring-2 focus:ring-primary-500 outline-none font-medium text-sm transition-all shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 font-mono text-[10px] font-medium text-slate-400">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar mr-4">
                {[
                  { id: "all", label: isRTL ? "الكل" : "All" },
                  {
                    id: "critical",
                    label: isRTL ? "نواقص حرجة" : "Critical Low",
                  },
                  { id: "healthy", label: isRTL ? "متوفر" : "Healthy Stock" },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => {}}
                    className="whitespace-nowrap px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 transition-all hover:border-primary-100"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <div className="bg-primary-50 dark:bg-primary-900/10 px-4 py-2 rounded-2xl border border-primary-100 dark:border-primary-900/20 flex flex-col items-center min-w-[80px]">
                <span className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-widest leading-none mb-1">
                  Total
                </span>
                <span className="text-xl font-black text-primary-700 dark:text-primary-200 leading-none">
                  {medications.length}
                </span>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/10 px-4 py-2 rounded-2xl border border-emerald-100 dark:border-emerald-900/20 flex flex-col items-center min-w-[80px]">
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none mb-1">
                  Value
                </span>
                <span className="text-lg font-black text-emerald-700 dark:text-emerald-200 leading-none">
                  {currencySymbol}
                  {(
                    medications.reduce((acc, m) => acc + m.price * m.stock, 0) /
                    1000
                  ).toFixed(1)}
                  k
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Medications Master List - 5 Cols */}
            <div className="lg:col-span-5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] p-7 border border-white/50 dark:border-white/5 shadow-sm flex flex-col h-[750px] bento-card">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-primary-600 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-primary-100 ring-4 ring-primary-50/50">
                    <Pill size={24} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg uppercase tracking-tight leading-none mb-1.5">
                      {isRTL ? "قائمة الأدوية" : "Medication Registry"}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                      Clinical Inventory List
                    </p>
                  </div>
                </div>
                {hasPermission("add", "medication") && (
                  <button
                    onClick={() => openModal("medication")}
                    className="w-10 h-10 bg-white dark:bg-slate-800 border border-primary-100 dark:border-primary-900/30 text-primary-600 rounded-xl flex items-center justify-center hover:bg-primary-600 hover:text-white transition-all active:scale-95 shadow-sm"
                  >
                    <Plus size={22} className="stroke-[3]" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {medications.length === 0 ? (
                  <div className="text-center py-24 text-gray-400 bg-gray-50/50 rounded-[3rem] border border-dashed border-gray-100">
                    <Pill size={64} className="mx-auto mb-4 opacity-10" />
                    <p className="font-black text-lg uppercase tracking-tight">
                      {t.noData}
                    </p>
                  </div>
                ) : (
                  medications
                    .filter(
                      (m) =>
                        m.name
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase()) ||
                        m.genericName
                          ?.toLowerCase()
                          .includes(searchTerm.toLowerCase()),
                    )
                    .map((med, i) => {
                      const isSelected = pharmacySelectedMedId === med.id;
                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          key={med.id}
                          onClick={() => setPharmacySelectedMedId(med.id)}
                          className={`p-5 rounded-[2rem] border transition-all cursor-pointer flex justify-between items-center group relative overflow-hidden active:scale-[0.98] ${
                            isSelected
                              ? "bg-primary-50 border-primary-200 dark:bg-primary-900/20 dark:border-primary-800"
                              : "bg-white/70 hover:bg-white border-slate-100/50 hover:shadow-xl hover:shadow-primary-600/5"
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary-500 transition-opacity" />
                          )}
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform ${
                                isSelected
                                  ? "bg-primary-600 text-white"
                                  : "bg-gradient-to-br from-indigo-50 to-primary-50 text-primary-700"
                              }`}
                            >
                              <Pill size={20} className="stroke-[2.5]" />
                            </div>
                            <div>
                              <h4
                                className={`font-black text-sm leading-none uppercase tracking-tight mb-1.5 ${isSelected ? "text-primary-700" : "text-slate-800 group-hover:text-primary-600"}`}
                              >
                                {med.name}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none flex items-center gap-1.5">
                                {med.stock <= 0 ? (
                                  <span className="text-rose-500 font-black">
                                    OUT OF STOCK
                                  </span>
                                ) : med.stock <= 10 ? (
                                  <span className="text-amber-500 font-black">
                                    LOW: {med.stock} {med.unit}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-black">
                                    {med.stock} {med.unit}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Selected Medication Details - 7 Cols */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {!pharmacySelectedMedId ? (
                <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/50 dark:border-white/5 shadow-sm flex flex-col items-center justify-center h-[750px] bento-card text-center opacity-60">
                  <Package size={80} className="text-slate-300 mb-6" />
                  <h3 className="font-black text-slate-800 text-xl uppercase tracking-tighter mb-2">
                    No Drug Selected
                  </h3>
                  <p className="text-sm font-bold text-slate-400 max-w-sm uppercase tracking-widest leading-relaxed">
                    Select a medication from the registry to view clinical
                    details, real-time stock analytics, and management features.
                  </p>
                </div>
              ) : (
                (() => {
                  const selectedMed = medications.find(
                    (m) => m.id === pharmacySelectedMedId,
                  );
                  if (!selectedMed) return null;

                  const isLowStock =
                    selectedMed.stock <= 10 && selectedMed.stock > 0;
                  const isOutOfStock = selectedMed.stock === 0;

                  return (
                    <>
                      {/* Main Info Card */}
                      <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/50 dark:border-white/5 shadow-sm flex flex-col bento-card relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-50/50 rounded-full -mr-20 -mt-20 blur-3xl" />

                        <div className="flex justify-between items-start relative z-10 mb-8">
                          <div className="flex items-center gap-5">
                            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center shadow-inner">
                              <Pill size={40} className="stroke-[2.5]" />
                            </div>
                            <div>
                              <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">
                                {selectedMed.name}
                              </h2>
                              {selectedMed.genericName && (
                                <p className="text-xs font-black italic text-slate-400 uppercase tracking-widest">
                                  {selectedMed.genericName}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {hasPermission("edit", "medication") && (
                              <button
                                onClick={() =>
                                  openModal("medication", selectedMed)
                                }
                                className="w-10 h-10 bg-white border border-slate-200 text-slate-500 hover:text-primary-600 hover:border-primary-200 rounded-xl flex items-center justify-center transition-all shadow-sm"
                              >
                                <Edit size={18} />
                              </button>
                            )}
                            {hasPermission("delete", "medication") && (
                              <button
                                onClick={() => {
                                  setPharmacySelectedMedId(null);
                                  handleDelete(selectedMed.id, "medication");
                                }}
                                className="w-10 h-10 bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 rounded-xl flex items-center justify-center transition-all shadow-sm"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-8">
                          <div className="bg-white/60 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Category
                            </span>
                            <span className="font-black text-slate-800 text-sm uppercase tracking-tight">
                              {selectedMed.category}
                            </span>
                          </div>
                          <div className="bg-white/60 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Unit Price
                            </span>
                            <span className="font-black text-slate-800 text-lg uppercase tracking-tight">
                              {currencySymbol}
                              {selectedMed.price}
                            </span>
                          </div>
                          <div className="bg-white/60 p-4 rounded-2xl border border-slate-100 flex flex-col justify-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Expiry Date
                            </span>
                            <span
                              className={`font-black text-sm uppercase tracking-tight ${new Date(selectedMed.expiryDate) < new Date() ? "text-rose-600" : "text-slate-800"}`}
                            >
                              {selectedMed.expiryDate}
                            </span>
                          </div>
                        </div>

                        {/* Stock Management Banner */}
                        <div
                          className={`p-6 rounded-[2rem] border relative overflow-hidden flex justify-between items-center ${
                            isOutOfStock
                              ? "bg-rose-50 border-rose-100"
                              : isLowStock
                                ? "bg-amber-50 border-amber-100"
                                : "bg-emerald-50 border-emerald-100"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                                isOutOfStock
                                  ? "bg-rose-100 text-rose-600"
                                  : isLowStock
                                    ? "bg-amber-100 text-amber-600"
                                    : "bg-emerald-100 text-emerald-600"
                              }`}
                            >
                              <Package size={28} className="stroke-[2.5]" />
                            </div>
                            <div>
                              <h4
                                className={`text-2xl font-black leading-none mb-1 ${
                                  isOutOfStock
                                    ? "text-rose-900"
                                    : isLowStock
                                      ? "text-amber-900"
                                      : "text-emerald-900"
                                }`}
                              >
                                {selectedMed.stock}{" "}
                                <span className="text-base">
                                  {selectedMed.unit}
                                </span>
                              </h4>
                              <p
                                className={`text-[10px] font-black uppercase tracking-widest ${
                                  isOutOfStock
                                    ? "text-rose-600"
                                    : isLowStock
                                      ? "text-amber-600"
                                      : "text-emerald-600"
                                }`}
                              >
                                Current Inventory Level
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 ${
                                isOutOfStock || isLowStock
                                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                  : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              }`}
                            >
                              <ShoppingCart size={14} className="stroke-[3]" />
                              Restock Item
                            </button>
                          </div>
                        </div>

                        {/* FDA Regulatory Tracking Spec Sheet */}
                        <div className="mt-6 border-t border-slate-100 dark:border-slate-850 pt-6">
                          <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ShieldCheck
                              size={14}
                              className="text-primary-500"
                            />
                            {isRTL
                              ? "مواصفات تتبع هيئة الغذاء والدواء (FDA)"
                              : "FDA Compliance & Lot Tracking"}
                          </h4>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800 flex flex-col justify-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {isRTL ? "التركيز" : "Concentration"}
                              </span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs truncate">
                                {selectedMed.concentration ||
                                  (isRTL ? "غير محدد" : "N/A")}
                              </span>
                            </div>
                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800 flex flex-col justify-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {isRTL
                                  ? "رقم التشغيلة (Batch)"
                                  : "Batch Number"}
                              </span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs font-mono truncate">
                                {selectedMed.batchNumber ||
                                  (isRTL ? "غير متوفر" : "N/A")}
                              </span>
                            </div>
                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800 flex flex-col justify-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {isRTL ? "رمز الدواء الوطني" : "NDC Code"}
                              </span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs font-mono truncate">
                                {selectedMed.ndcCode ||
                                  (isRTL ? "غير متوفر" : "N/A")}
                              </span>
                            </div>
                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800 flex flex-col justify-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {isRTL ? "تاريخ التصنيع" : "Mfg. Date"}
                              </span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs truncate">
                                {selectedMed.manufacturingDate ||
                                  (isRTL ? "غير مسجل" : "N/A")}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800 flex flex-col justify-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {isRTL ? "الشركة المصنعة" : "Manufacturer"}
                              </span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs truncate">
                                {selectedMed.manufacturer ||
                                  (isRTL ? "غير معروف" : "N/A")}
                              </span>
                            </div>
                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800 flex flex-col justify-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {isRTL
                                  ? "شروط حفظ المخزون"
                                  : "Storage Conditions"}
                              </span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs truncate">
                                {selectedMed.storageConditions ||
                                  (isRTL
                                    ? "حرارة الغرفة العادية"
                                    : "Controlled Room Temp")}
                              </span>
                            </div>
                            <div className="bg-slate-50/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800 flex flex-col justify-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                {isRTL ? "حالة ترخيص FDA" : "FDA Regulation"}
                              </span>
                              <span
                                className={`font-black text-[10px] px-2.5 py-1 rounded-lg w-max tracking-wide uppercase ${
                                  selectedMed.fdaStatus === "Recalled"
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30"
                                    : selectedMed.fdaStatus === "Under Review"
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30"
                                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30"
                                }`}
                              >
                                {selectedMed.fdaStatus || "Approved"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Additional Details (e.g. Analytics / History) */}
                      <div className="grid grid-cols-2 gap-6 flex-1">
                        <div className="bg-indigo-900 text-indigo-100 rounded-[2.5rem] p-6 border border-indigo-800 flex flex-col justify-between relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <Activity size={80} />
                          </div>
                          <div>
                            <h4 className="font-black text-white text-sm uppercase tracking-widest mb-1">
                              Consumption Rate
                            </h4>
                            <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">
                              Est. weekly usage
                            </p>
                          </div>
                          <div>
                            <span className="text-4xl font-black text-white">
                              ~14
                            </span>
                            <span className="text-sm font-bold text-indigo-400 ml-1 uppercase">
                              {selectedMed.unit}/wk
                            </span>
                          </div>
                        </div>
                        <div className="bg-slate-900 text-slate-100 rounded-[2.5rem] p-6 border border-slate-800 flex flex-col justify-between relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <Truck size={80} />
                          </div>
                          <div>
                            <h4 className="font-black text-white text-sm uppercase tracking-widest mb-1">
                              Primary Supplier
                            </h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Active vendor link
                            </p>
                          </div>
                          <div>
                            <span className="text-xl font-black text-white tracking-tighter">
                              Global Meds Inc.
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );


  return renderPharmacy();
};

export default PharmacyWorkspace;
