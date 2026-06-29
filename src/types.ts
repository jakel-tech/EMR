export type AssetStatus = 'Operational' | 'Under Maintenance' | 'Broken' | 'Decommissioned';
export type PMFrequency = 'monthly' | 'quarterly' | 'yearly' | 'none';

export type Manufacturer = {
  id: string;
  name: string;
  logo_url?: string;
  website?: string;
  support_phone?: string;
  support_email?: string;
  notes?: string;
};

export type MedicalDeviceCategory = 
  | 'ECG' | 'EMG' | 'EEG' | 'X-ray' | 'CBC' | 'Ultrasound' | 'MRI' | 'CT Scan' | 'PET Scan' | 'Mammography'
  | 'ICU Bed' | 'Ventilator' | 'Patient Monitor' | 'Defibrillator' | 'Infusion Pump' | 'Syringe Pump'
  | 'Incubator' | 'Phototherapy' | 'Anesthesia Machine' | 'Dialysis Machine' | 'Heart-Lung Machine'
  | 'Surgical Laser' | 'C-Arm' | 'Autoclave' | 'Centrifuge' | 'Microscope'
  | 'Laboratory' | 'Surgical' | 'Physiotherapy' | 'Dental' | 'Ophthalmology' | 'Orthopedic'
  | 'General' | 'Other';

export type Asset = {
  id: string;
  name: string;
  category: MedicalDeviceCategory | string;
  type?: string; 
  status: AssetStatus;
  location: string;
  department_id?: string;
  pm_frequency?: PMFrequency;
  next_pm_date?: string;
  manufacturer_id?: string;
  manufacturer_name?: string; // Cache for display
  model?: string;
  serial_number?: string;
  purchase_date?: string;
  warranty_expiration?: string;
  asset_image_url?: string;
  is_medical_imaging?: boolean;
  imaging_modality?: 'CT' | 'MR' | 'DX' | 'US' | 'PET' | 'MG' | 'XA';
};

export type WOStatus = 'Pending' | 'In Progress' | 'On Hold' | 'Completed';
export type WOPriority = 'Low' | 'Medium' | 'High';
export type WorkOrder = {
  id: string;
  assetId: string;
  description: string;
  priority: WOPriority;
  status: WOStatus;
  dueDate: string;
  is_pm?: boolean;
  cost?: number;
  downtime_hours?: number;
  parts_used?: string;
  iso_compliance_notes?: string;
  quality_signature?: string;
};

export type MaintFrequency = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
export type Maintenance = {
  id: string;
  assetId: string;
  task: string;
  frequency: MaintFrequency;
  nextDueDate: string;
};

export type InventoryItem = {
  id: string;
  partNumber: string;
  name: string;
  supplier: string;
  category: string;
  currentQuantity: number;
  minQuantity: number;
  cost?: number;
  manufacturer_id?: string;
  barcode?: string;
};

export type IntegrationLog = {
  id: string;
  syncType: string;
  status: 'Success' | 'Failed';
  logs: string;
  timestamp: string;
};

export type KPISnapshot = {
  id: string;
  month: string;
  mttr: number;
  mtbf: number;
  totalCost: number;
  pmCompletionRate: number;
};

export type ExternalWorkshop = {
  id: string;
  name: string;
  specialty: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  rating?: number;
  sla_details?: string;
  password?: string;
};

export type ExternalRepairTicket = {
  id: string;
  asset_id: string;
  asset_name: string;
  workshop_id: string;
  workshop_name: string;
  issue_description: string;
  status: 'Sent' | 'Under Inspection' | 'Repaired' | 'Returned & Verified';
  cost?: number;
  dispatch_date: string;
  expected_return_date?: string;
  actual_return_date?: string;
  warranty_period_months?: number;
  technician_notes?: string;
};

export type Language = 'en' | 'ar';

export type UserRole =
  | "Requester"
  | "Technician"
  | "Admin"
  | "Manager"
  | "Super Admin"
  | "Hospital Admin"
  | "Doctor"
  | "Nurse"
  | "Pharmacist"
  | "Lab Technician"
  | "Radiologist"
  | "Accountant"
  | "Receptionist"
  | "HR"
  | "IT Support"
  | "Patient";

export type UserPermissions = {
  assets?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
  workOrders?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
  inventory?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
  users?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
  analytics?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
  maintenance?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
  hospitals?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
  patient?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
  medicalRecord?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
  medication?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
  examination?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
  department?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
  appointment?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
  billing?: { view?: boolean, add?: boolean, edit?: boolean, delete?: boolean },
};

export type Department = {
  id: string;
  hospital_id: string;
  name: string;
  description?: string;
  head_id?: string; // User ID of the department head
  building?: string;
  phone?: string;
  status?: string;
  budget?: number;
  color?: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  type?: 'user' | 'hospital' | 'patient';
  phone?: string;
  department: string; 
  department_id?: string;
  role: UserRole;
  is_verified?: boolean;
  is_blocked?: boolean;
  plain_password?: string;
  password?: string;
  hospitalId?: string;
  hospital_id?: string; // Keep for legacy if needed
  permissions?: string; 
  avatar?: string;
  bio?: string;
  specialty?: string;
  status_message?: string;
  hire_date?: string;
  salary?: number;
  attendance_rate?: number;
  contract_type?: string;
  bank_account?: string;
  national_id?: string;
  last_payroll_date?: string;
  assigned_hospitals?: string;
  balance?: number;
  signature?: string;
  availability_status?: 'available' | 'unavailable';
  external_lab_id?: string;
  external_pharmacy_id?: string;
  external_workshop_id?: string;
  biometric_credential?: string;
  biometric_public_key?: string;
  incomplete_profile?: boolean | number;
};

export type PatientGender = 'Male' | 'Female' | 'Other';
export type Patient = {
  id: string;
  nationalId?: string;
  name: string;
  dob: string;
  gender: PatientGender;
  bloodType: string;
  contactNumber: string;
  address?: string;
  allergies?: string;
  medicalHistory?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_copay_percent?: number;
  insurance_expiry?: string;
  insurance_plan_name?: string;
  balance?: number;
  visitType?: 'inpatient' | 'outpatient' | 'emergency';
  avatar?: string;
  incomplete_profile?: boolean | number;
};

export type MedicalRecord = {
  id: string;
  patientId: string;
  doctorId: string;
  visitDate: string;
  diagnosis: string;
  treatment: string;
  prescription?: string;
  doctorInstructions?: string;
  notes?: string;
  images?: string[]; // Array of image URLs/Base64
  dicomFiles?: string[]; // Array of DICOM file data (base64)
};

export type Examination = {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  type: 'Laboratory' | 'Imaging' | 'Other' | 'Surgery';
  testName: string;
  priority?: 'Routine' | 'Urgent' | 'STAT';
  requestedBy?: string;
  approvedBy?: string;
  result?: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  notes?: string;
};

export type Medication = {
  id: string;
  name: string;
  genericName?: string;
  category: string;
  stock: number;
  unit: string;
  price: number;
  expiryDate: string;
  concentration?: string;
  manufacturingDate?: string;
  batchNumber?: string;
  ndcCode?: string;
  manufacturer?: string;
  storageConditions?: string;
  fdaStatus?: 'Approved' | 'OTC' | 'Rx' | 'Under Review' | 'Recalled';
  barcode?: string;
};

export type Hospital = {
  id: string;
  name: string;
  subscription_plan: string;
  subscription_status: string;
  location?: string;
  contact_email?: string;
  contact_phone?: string;
  total_beds?: number;
  active_users_count?: number;
  assets_count?: number;
  logo_url?: string;
  password?: string;
  slogan?: string;
  license_code?: string;
  address?: string;
  director_name?: string;
  type?: 'hospital' | 'laboratory' | 'pharmacy' | 'workshop' | string;
};

export type HospitalVisit = {
  id: string;
  patient_id: string;
  hospital_id: string;
  visit_date: string;
  reason: string;
  vitals?: string;
  notes?: string;
  doctor_id?: string;
  doctor_name?: string;
  cost?: number;
  status: 'Admitted' | 'Discharged' | 'Observation';
  nfc_tag?: string;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  type: 'critical' | 'warning' | 'info';
  timestamp: string;
};

export type Appointment = {
  id: string;
  hospital_id: string;
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show';
  reason?: string;
  notes?: string;
};

export type Billing = {
  id: string;
  hospital_id: string;
  patientId: string;
  appointmentId?: string;
  date: string;
  amount: number;
  status: 'Pending' | 'Paid' | 'Cancelled';
  items: string; // JSON string
  paymentMethod?: string;
  insurance_covered_amount?: number;
  patient_copay_amount?: number;
  insurance_claim_status?: 'Not Applicable' | 'Submitted' | 'Approved' | 'Rejected' | 'Pending Approval';
};

export type AuditLog = {
  id: string;
  hospital_id: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id: string;
  old_data?: string;
  new_data?: string;
  timestamp: string;
  severity?: 'Low' | 'Medium' | 'High' | 'Critical';
  client_ip?: string;
  user_agent?: string;
};

export type Supplier = {
  id: string;
  hospital_id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  category: string;
  address: string;
  status: 'Active' | 'Inactive';
};

export type MedicationSchedule = {
  id: string;
  hospital_id: string;
  patient_id: string;
  medication_id: string;
  dose: string;
  route: string;
  frequency: string;
  status: 'Scheduled' | 'Administered' | 'Missed' | 'Cancelled';
  scheduled_time: string;
  administered_time?: string;
  nurse_id?: string;
  notes?: string;
};

export type PharmacyOrder = {
  id: string;
  hospital_id: string;
  supplier_id: string;
  medication_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: 'Pending' | 'Shipped' | 'Received' | 'Cancelled';
  order_date: string;
  expected_date?: string;
  received_date?: string;
};

export type PharmacySale = {
  id: string;
  hospital_id: string;
  buyer_name: string;
  buyer_phone?: string;
  sale_date: string;
  items: string; // JSON string of MedicationSaleItem[]
  total_amount: number;
  payment_method: string;
  status: 'Paid' | 'Refunded';
  patient_id?: string;
  is_otc?: boolean;
  prescription_image?: string;
  patient_national_id?: string;
};

export type MedicationSaleItem = {
  medication_id: string;
  name: string;
  quantity: number;
  price: number;
};

export type FinanceCategory = 'Supplies' | 'Salaries' | 'Equipment Maintenance' | 'Utilities & Admin Block' | 'Patient Services & Invoices' | 'Other Expenses' | 'Pharmacy' | 'Revenue';

export type FinanceTransaction = {
  id: string;
  hospital_id: string;
  type: 'Expense' | 'Income' | 'Revenue' | 'Payroll';
  category: FinanceCategory | string;
  amount: number;
  date: string;
  description: string;
  reference_id?: string;
};

export type ScanLog = {
  id: string;
  hospital_id: string;
  asset_id: string;
  user_id: string;
  user_name: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
  location_name?: string;
};

export type ShiftType = 'Morning' | 'Evening' | 'Night';

export type StaffShift = {
  id: string;
  hospital_id: string;
  user_id: string;
  department_id: string;
  day_of_week: string; // 'Monday', 'Tuesday', etc.
  shift_type: ShiftType;
  start_time: string;
  end_time: string;
  notes?: string;
};

export type StaffTask = {
  id: string;
  shift_id: string;
  hospital_id: string;
  user_id: string; // Assigned to
  title: string;
  description?: string;
  status: 'Pending' | 'Completed';
  priority: 'Low' | 'Medium' | 'High';
  due_time?: string; // Deadline
  completed_at?: string; // Audit timestamp
};

export type NursesStation = {
  id: string;
  hospital_id: string;
  name: string;
  location: string;
  head_nurse_id?: string;
};

export type NurseStationDevice = {
  id: string;
  hospital_id: string;
  station_id: string;
  asset_id: string;
  patient_id?: string;
  bed_number: string;
  vitals_pulse?: number;
  vitals_temp?: number;
  vitals_bp?: string;
  vitals_spo2?: number;
  status: 'monitoring' | 'paused' | 'alert';
  last_update: string;
  asset_name?: string;
  asset_category?: string;
  patient_name?: string;
  patient_national_id?: string;
  patient_gender?: string;
  patient_dob?: string;
};
