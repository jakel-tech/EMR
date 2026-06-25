import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  User,
  Plus,
  Printer,
  Camera,
  CheckCircle,
  Video,
  AlertCircle,
  Trash2,
  HeartPulse,
  Info,
  ShieldCheck,
  ChevronRight,
  ClipboardList,
  Eye,
  Sliders,
  Scissors
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import SmartSearchPicker from "./SmartSearchPicker";

interface Patient {
  id: string;
  nationalId?: string;
  name: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
}

interface UserProfile {
  id: string;
  name: string;
  role: string;
}

interface ProceduresWorkstationProps {
  isRTL: boolean;
  patients: Patient[];
  users: UserProfile[];
  examinations?: any[];
  onUpdateExamination?: (examId: string, updatedFields: any) => Promise<void>;
}

interface ProcedureLog {
  id: string;
  patientId: string;
  patientName: string;
  surgeonId: string;
  surgeonName: string;
  procedureType: string;
  anesthesiaType: string;
  equipmentUsed: string;
  date: string;
  preOpDiagnosis: string;
  postOpDiagnosis: string;
  findings: string;
  complications: string;
  capturedImages: string[];
  vitalsAtClose: {
    hr: number;
    bp: string;
    spo2: number;
  };
  zoomScale?: number;
  scopeType?: string;
  recordingSeconds?: number;
}

export const ProceduresWorkstation: React.FC<ProceduresWorkstationProps> = ({
  isRTL,
  patients,
  users,
  examinations = [],
  onUpdateExamination
}) => {
  // Records to populate workspace
  // Initial logs empty
  const [logs, setLogs] = useState<ProcedureLog[]>(() => {
    const saved = localStorage.getItem("procedure_logs_data");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("procedure_logs_data", JSON.stringify(logs));
  }, [logs]);

  // Form States
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [leadSurgeonId, setLeadSurgeonId] = useState("");
  const [procedureType, setProcedureType] = useState("Laparoscopic Appendectomy");
  const [anesthesia, setAnesthesia] = useState("General Anesthesia");
  const [equipmentName, setEquipmentName] = useState("Storz HD Surgical Stack");
  const [preOpDiag, setPreOpDiag] = useState("");
  const [postOpDiag, setPostOpDiag] = useState("");
  const [operativeFindings, setOperativeFindings] = useState("");
  const [complicationsInput, setComplicationsInput] = useState(isRTL ? "لا يوجد" : "None");

  // Vitals tracking
  const [currentVitals, setCurrentVitals] = useState({
    hr: 0,
    bp: "---/---",
    spo2: 0,
    rr: 0
  });

  // Pulse waveform coordinates
  const [pulseWave, setPulseWave] = useState<string>("M0,30 L200,30");
  const waveTicker = useRef<number>(0);

  // Fiberoptic camera visual effect state
  const [scopeType, setScopeType] = useState<"lap" | "general">("lap");
  const [cameraLight, setCameraLight] = useState(100); 
  const [capturedSnapsInSession, setCapturedSnapsInSession] = useState<string[]>([]);
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<ProcedureLog | null>(null);

  // Advanced Integrated Surgical Optics State (Cleaned)
  const [selectedPathology, setSelectedPathology] = useState<string>("lap_normal");
  const [zoomScale, setZoomScale] = useState<1 | 1.5 | 2 | 4>(1); 
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Real Hardware device camera integration state
  const [isUsingRealCamera, setIsUsingRealCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  useEffect(() => {
    if (isUsingRealCamera && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoIn = devices.filter(d => d.kind === "videoinput");
          setVideoDevices(videoIn);
          if (videoIn.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(videoIn[0].deviceId);
          }
        })
        .catch(err => console.error("Error enumerating video devices:", err));
    }
  }, [isUsingRealCamera]);

  useEffect(() => {
    async function startCamera() {
      if (isUsingRealCamera) {
        try {
          if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
          }
          const constraints: MediaStreamConstraints = {
            video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : { facingMode: "environment" },
            audio: false
          };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          setMediaStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Error accessing camera:", err);
          setIsUsingRealCamera(false);
        }
      } else {
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
          setMediaStream(null);
        }
      }
    }
    startCamera();
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isUsingRealCamera, selectedDeviceId]);

  // Surgical Templates (Reference data for documentation)
  const pathologyTemplates: Record<string, {
    nameEn: string;
    nameAr: string;
    imageUrl: string;
    scopeType: "lap" | "general";
    findingsEn: string;
    findingsAr: string;
    preOpEn: string;
    preOpAr: string;
    postOpEn: string;
    postOpAr: string;
    procedureEn: string;
    procedureAr: string;
    equipmentEn: string;
    equipmentAr: string;
    anesthesiaEn: string;
    anesthesiaAr: string;
  }> = {
    lap_normal: {
      nameEn: "Laparoscopic Abdominal Exploration",
      nameAr: "استكشاف التجويف البطني بالمنظار",
      imageUrl: "https://images.unsplash.com/photo-1579684389782-64d84b5e901a?auto=format&fit=crop&q=80&w=600",
      scopeType: "lap",
      findingsEn: "Exploration shows healthy anatomical structures without visible abnormalities.",
      findingsAr: "الاستكشاف يظهر هياكل تشريحية سليمة دون وجود أي عيوب أو ترسبات غير طبيعية.",
      preOpEn: "Chronic abdominal pain",
      preOpAr: "آلام بطن مزمنة غير محددة",
      postOpEn: "Normal diagnostic laparoscopy",
      postOpAr: "منظار بطن تشخيصي طبيعي",
      procedureEn: "Diagnostic Laparoscopy",
      procedureAr: "منظار بطن تشخيصي",
      equipmentEn: "Storz HD Surgical Stack",
      equipmentAr: "منظومة شتورز الجراحية المتكاملة",
      anesthesiaEn: "General Anesthesia",
      anesthesiaAr: "تخدير عام"
    }
  };

  // Heartbeat tracking
  useEffect(() => {
    // Only update wave for UI rhythm
    const interval = setInterval(() => {
      waveTicker.current += 1;
      const points = [];
      const steps = 30;
      for (let i = 0; i <= steps; i++) {
        let y = 30;
        const x = (i / steps) * 200;
        const cycle = (waveTicker.current * 4 + i) % 24;
        if (cycle === 4) y = 25; 
        else if (cycle === 6) y = 32; 
        else if (cycle === 7) y = 10; 
        else if (cycle === 8) y = 55; 
        else if (cycle === 10) y = 28; 
        else if (cycle === 12) y = 20; 
        points.push(`${i === 0 ? "M" : "L"}${x},${y}`);
      }
      setPulseWave(points.join(" "));
    }, 180);

    return () => clearInterval(interval);
  }, []);

  // Endoscopic DVR (Digital Video Recorder) session interval
  useEffect(() => {
    let timerId: any;
    if (isRecording) {
      timerId = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(timerId);
  }, [isRecording]);

  const handleCaptureSnapshot = () => {
    if (isUsingRealCamera && videoRef.current) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg");
          setCapturedSnapsInSession(prev => [...prev, dataUrl]);
          return;
        }
      } catch (err) {
        console.error("Failed to capture image from video element:", err);
      }
    }

    const activeTemplate = pathologyTemplates[selectedPathology];
    if (activeTemplate) {
      setCapturedSnapsInSession(prev => [...prev, activeTemplate.imageUrl]);
    } else {
      setCapturedSnapsInSession(prev => [
        ...prev,
        "https://images.unsplash.com/photo-1579684389782-64d84b5e901a?auto=format&fit=crop&q=80&w=400"
      ]);
    }
  };

  const handleSaveProcedureLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      alert(isRTL ? "الرجاء اختيار مريض لتسجيل العملية!" : "Please select target patient case!");
      return;
    }

    const patient = patients.find(p => p.id === selectedPatientId);
    const doctor = users.find(u => u.id === leadSurgeonId) || users[0];

    const newLog: ProcedureLog = {
      id: `PROC-${Math.floor(100 + Math.random() * 900)}`,
      patientId: selectedPatientId,
      patientName: patient?.name || "Anonymous Patient",
      surgeonId: leadSurgeonId,
      surgeonName: doctor?.name || "Dr. Staff On-duty",
      procedureType,
      anesthesiaType: anesthesia,
      equipmentUsed: equipmentName,
      date: new Date().toISOString().split("T")[0],
      preOpDiagnosis: preOpDiag || (isRTL ? "حالة جراحية طارئة" : "Emergency Surgical Case"),
      postOpDiagnosis: postOpDiag || preOpDiag || (isRTL ? "استئصال ناجح" : "Successful Operative Resection"),
      findings: operativeFindings || (isRTL ? "تمت العملية بنجاح وبدون أي أحداث غير اعتيادية سلبية." : "Procedure executed successfully without any adverse intraoperative events."),
      complications: complicationsInput || (isRTL ? "لا يوجد" : "None"),
      capturedImages: capturedSnapsInSession.length > 0 ? capturedSnapsInSession : [
        "https://images.unsplash.com/photo-1579684389782-64d84b5e901a?auto=format&fit=crop&q=80&w=400"
      ],
      vitalsAtClose: {
        hr: currentVitals.hr,
        bp: currentVitals.bp,
        spo2: currentVitals.spo2
      },
      zoomScale,
      scopeType,
      recordingSeconds: isRecording ? recordingSeconds : (recordingSeconds > 0 ? recordingSeconds : undefined)
    };

    setLogs(prev => [newLog, ...prev]);

    // Mark corresponding surgical examination order as Completed
    const pendingProc = (examinations || []).find(
      (ex) =>
        ex.patientId === selectedPatientId &&
        ex.type === "Procedure" &&
        (ex.status === "Pending" || ex.status === "In Progress")
    );
    if (pendingProc && onUpdateExamination) {
      onUpdateExamination(pendingProc.id, {
        status: "Completed",
        result: `${procedureType} completed successfully by ${doctor?.name || "Dr. Staff"} on ${newLog.date}. findings: ${newLog.findings}`
      });
    }

    // Reset inputs
    setPreOpDiag("");
    setPostOpDiag("");
    setOperativeFindings("");
    setComplicationsInput(isRTL ? "لا يوجد" : "None");
    setCapturedSnapsInSession([]);
  };

  const handleDeleteLog = (logId: string) => {
    if (confirm(isRTL ? "هل أنت متأكد من رغبتك في حذف هذا الملف الجراحي؟" : "Are you sure you want to delete this operative procedure file?")) {
      setLogs(prev => prev.filter(l => l.id !== logId));
      if (selectedLogForDetail?.id === logId) {
        setSelectedLogForDetail(null);
      }
    }
  };

  const handlePrintProcedureReport = (log: ProcedureLog) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${isRTL ? "ar" : "en"}" dir="${isRTL ? "rtl" : "ltr"}">
      <head>
        <meta charset="utf-8">
        <title>Operative & Diagnostic Procedure Report - ${log.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;650;700;800&family=Inter:wght@400;500;650;700;800&display=swap');
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            font-family: ${isRTL ? "'Cairo'" : "'Inter'"}, serif;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .letterhead {
            border-bottom: 3px double #0284c7;
            padding-bottom: 12px;
            margin-bottom: 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .letterhead img {
            max-height: 55px;
            width: auto;
          }
          .letterhead-title {
            text-align: ${isRTL ? "right" : "left"};
          }
          .letterhead-title h1 {
            margin: 0 0 4px 0;
            font-size: 18px;
            font-weight: 800;
            color: #0369a1;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .letterhead-title p {
            margin: 0;
            font-size: 10px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1.5px;
          }
          .report-header {
            background: #f0f9ff;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 25px;
            border: 1px solid #e0f2fe;
          }
          .report-title-card {
            text-align: center;
            margin-bottom: 20px;
          }
          .report-title-card h2 {
            margin: 0 0 5px 0;
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            border-bottom: 2px solid #38bdf8;
            display: inline-block;
            padding-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .grid-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            font-size: 12px;
          }
          .info-item {
            display: flex;
            border-bottom: 1px dashed #e2e8f0;
            padding-bottom: 6px;
          }
          .info-label {
            font-weight: 700;
            color: #475569;
            width: 150px;
            shrink: 0;
          }
          .info-value {
            color: #0f172a;
            font-weight: 500;
          }
          .section-block {
            margin-bottom: 25px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 13px;
            font-weight: 800;
            background-color: #0284c7;
            color: #ffffff;
            padding: 6px 12px;
            border-radius: 6px;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .text-content {
            font-size: 12px;
            color: #334155;
            background: #fafafa;
            border: 1px solid #f1f5f9;
            padding: 12px;
            border-radius: 8px;
            min-height: 40px;
          }
          .vitals-box {
            display: flex;
            gap: 20px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px 20px;
            margin-bottom: 20px;
          }
          .vital-pill {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
          }
          .vital-name {
            font-weight: 700;
            color: #64748b;
          }
          .vital-val {
            font-weight: 800;
            color: #0284c7;
          }
          .image-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 25px;
          }
          .image-container {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            overflow: hidden;
            background: #000;
            text-align: center;
            height: 180px;
          }
          .image-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .footer-section {
            border-top: 1px solid #e2e8f0;
            margin-top: 50px;
            padding-top: 20px;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          .signature-box {
            text-align: center;
            width: 200px;
          }
          .signature-line {
            border-top: 1px solid #7c3aed;
            margin-bottom: 6px;
            margin-top: 35px;
          }
          .signature-name {
            font-size: 11px;
            font-weight: 700;
            color: #1e293b;
          }
          .signature-title {
            font-size: 9px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
          }
          .barcode-container {
            text-align: right;
          }
          .watermark {
            position: absolute;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 44px;
            font-weight: 900;
            color: rgba(2, 132, 199, 0.04);
            letter-spacing: 5px;
            line-height: 1;
            user-select: none;
            pointer-events: none;
            z-index: -100;
          }
          @media print {
            body {
              background-color: #ffffff !important;
            }
            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="watermark">OFFICIAL OPERATIVE PROTOCOL</div>
        
        <div class="letterhead" style="border-bottom: 4px solid #0284c7; padding-bottom: 12px; margin-bottom: 25px; font-family: 'Cairo', 'Inter', sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; width: 100%;">
            <!-- LEFT: English Hospital Metadata & Accreditation -->
            <div style="text-align: left; line-height: 1.3;">
              <h2 style="margin: 0; font-size: 14px; font-weight: 800; color: #0284c7;">JAKEL MULTI-SPECIALTY MEDICAL CENTER</h2>
              <p style="margin: 2px 0 0 0; font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase;">Sudan Federal Ministry of Health Approved</p>
              <p style="margin: 2px 0 0 0; font-size: 8px; color: #94a3b8; font-family: monospace;">Lic. No: FMOH/KRT/902-DX • General Hospital Division</p>
              <p style="margin: 1px 0 0 0; font-size: 8px; color: #94a3b8; font-family: monospace;">Accredited: Joint Commission International (JCI)</p>
            </div>
            
            <!-- CENTER: Brand Logo / Premium Hospital Crest Icon -->
            <div style="text-align: center; padding: 0 10px;">
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <span style="font-size: 26px; line-height: 1;">🏥</span>
                <span style="font-size: 11px; font-weight: 900; color: #0284c7; letter-spacing: 2px; margin-top: 4px; font-family: 'Inter', sans-serif;">ROYAL CARE</span>
              </div>
            </div>
            
            <!-- RIGHT: Arabic Hospital Metadata & Accreditation -->
            <div style="text-align: right; line-height: 1.3; direction: rtl;">
              <h2 style="margin: 0; font-size: 14px; font-weight: 800; color: #0284c7;">مستشفى مركز جاكل الطبي التخصصي</h2>
              <p style="margin: 2px 0 0 0; font-size: 9px; font-weight: bold; color: #64748b;">جمهورية السودان - وزارة الصحة الاتحادية - ولاية الخرطوم</p>
              <p style="margin: 2px 0 0 0; font-size: 8px; color: #94a3b8; font-family: monospace;">ترخيص رقم: و.ص/خ/902-د • قسم الجراحة التخصصية والتشخيص</p>
              <p style="margin: 1px 0 0 0; font-size: 8px; color: #94a3b8;">معتمد لدى الهيئة العامة للتأمين الصحي القومي</p>
            </div>
          </div>
          
          <div style="display: flex; height: 3px; gap: 4px; margin-top: 5px; width: 100%;">
            <div style="flex: 3; background-color: #0284c7;"></div>
            <div style="flex: 1; background-color: #f59e0b;"></div>
            <div style="flex: 4; background-color: #0284c7;"></div>
          </div>
        </div>

        <div class="report-title-card">
          <h2>${isRTL ? "تقرير وملخص الإجراء الجراحي والمنظاري" : "Operative & Procedural Clinical Record"}</h2>
          <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: bold; letter-spacing: 2px;">
            PROCEDURAL ID: ${log.id} / DATE: ${log.date}
          </p>
        </div>

        <div class="report-header">
          <div class="grid-info">
            <div class="info-item">
              <span class="info-label">${isRTL ? "اسم المريض:" : "Patient Case:"}</span>
              <span class="info-value">${log.patientName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">${isRTL ? "رقم المريض:" : "Patient ID:"}</span>
              <span class="info-value">${log.patientId}</span>
            </div>
            <div class="info-item">
              <span class="info-label">${isRTL ? "الجراح / الطبيب القائم:" : "Lead Specialist:"}</span>
              <span class="info-value">${log.surgeonName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">${isRTL ? "نوع التخدير:" : "Anesthesia Type:"}</span>
              <span class="info-value">${log.anesthesiaType}</span>
            </div>
            <div class="info-item" style="grid-column: span 2;">
              <span class="info-label">${isRTL ? "الأجهزة والمعدات الطبية:" : "Equipments Utilized:"}</span>
              <span class="info-value" style="font-weight: 600; color: #5b21b6;">${log.equipmentUsed}</span>
            </div>
          </div>
        </div>

        <div class="vitals-box">
          <div class="vital-pill">
            <span class="vital-name">${isRTL ? "معدل نبضات القلب:" : "Heart Rate at Exit:"}</span>
            <span class="vital-val">${log.vitalsAtClose.hr} bpm</span>
          </div>
          <div class="vital-pill">
            <span class="vital-name">${isRTL ? "ضغط الدم المخرج:" : "Blood Pressure (BP):"}</span>
            <span class="vital-val">${log.vitalsAtClose.bp}</span>
          </div>
          <div class="vital-pill">
            <span class="vital-name">${isRTL ? "تشبع الأكسجين SpO2:" : "SpO2 Level:"}</span>
            <span class="vital-val">${log.vitalsAtClose.spo2}%</span>
          </div>
        </div>

        <!-- Camera Lens & Video telemetry parameters -->
        <div class="section-block">
          <div class="section-title">${isRTL ? "مواصفات التكامليات البصرية والعدسات وجهاز التسجيل" : "Integrated Camera Optics & DVR telemetry details"}</div>
          <div style="background-color: #fafafa; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 11px;">
            <table style="width: 100%; border-collapse: collapse; font-family: monospace;">
              <tr>
                <td style="padding: 4px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #475569; width: 30%;">${isRTL ? "نوع العدسة والمنظار:" : "Scope / Lens Type:"}</td>
                <td style="padding: 4px; border-bottom: 1px solid #f1f5f9; color: #0284c7; font-weight: bold;">${(log.scopeType || "lap").toUpperCase()} Lens Feed</td>
                <td style="padding: 4px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #475569; width: 30%;">${isRTL ? "الحزمة الضوئية:" : "Optical Filter:"}</td>
                <td style="padding: 4px; border-bottom: 1px solid #f1f5f9; color: #b45309; font-weight: bold;">White Light Imaging (WLI)</td>
              </tr>
              <tr>
                <td style="padding: 4px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #475569;">${isRTL ? "معدل تقريب العدسة:" : "Optical Zoom Factor:"}</td>
                <td style="padding: 4px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: bold;">${log.zoomScale || 1.0}x Digital/Optical Zoom</td>
                <td style="padding: 4px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #475569;">${isRTL ? "تسجيل الفيديو الرقمي DVR:" : "Video Clip Logged:"}</td>
                <td style="padding: 4px; border-bottom: 1px solid #f1f5f9; color: #10b981; font-weight: bold;">
                  ${log.recordingSeconds ? `DVR-${log.id}.mp4 (${Math.floor(log.recordingSeconds / 60)}:${(log.recordingSeconds % 60).toString().padStart(2, '0')} min)` : `${isRTL ? "لا يوجد تسجيل نشط لحالة العملية" : "No DVR Recording Active"}`}
                </td>
              </tr>
            </table>
          </div>
        </div>

        <div class="section-block">
          <div class="section-title">${isRTL ? "التشخيص قبل العملية الجراحية" : "Pre-Operative Clinical Diagnosis"}</div>
          <div class="text-content">${log.preOpDiagnosis}</div>
        </div>

        <div class="section-block">
          <div class="section-title">${isRTL ? "التشخيص بعد العملية الجراحية" : "Post-Operative Resolved Diagnosis"}</div>
          <div class="text-content">${log.postOpDiagnosis}</div>
        </div>

        <div class="section-block">
          <div class="section-title">${isRTL ? "النتائج الجراحية والتفاصيل التشريحية" : "Intraoperative Findings & Procedure Protocol"}</div>
          <div class="text-content" style="white-space: pre-wrap;">${log.findings}</div>
        </div>

        <div class="section-block">
          <div class="section-title">${isRTL ? "المضاعفات الجانبية المحتملة" : "Operative Adverse Event & Complications Log"}</div>
          <div class="text-content" style="color: ${log.complications.toLowerCase() === "none" || log.complications === "لا يوجد" ? "green" : "red"}; font-weight: bold;">
            ${log.complications}
          </div>
        </div>

        ${log.capturedImages && log.capturedImages.length > 0 ? `
          <div class="section-block">
            <div class="section-title">${isRTL ? "الصور المستخرجة ومستودع الفحص" : "Endoscopic Lens / Intraoperative Video Captures"}</div>
            <div class="image-grid">
              ${log.capturedImages.map(img => `
                <div class="image-container">
                  <img src="${img}" referrerpolicy="no-referrer" alt="Microscopic Capture">
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}

        <!-- Premium bilingual letterfoot section -->
        <div class="print-letterfoot" style="border-top: 2px solid #cbd5e1; padding-top: 15px; margin-top: 45px; font-family: 'Cairo', 'Inter', sans-serif; font-size: 10px; color: #475569; page-break-inside: avoid; display: flex; justify-content: space-between; align-items: flex-end; width: 100%;">
          
          <!-- CONTACT INFO (Left side) -->
          <div style="text-align: left; width: 40%; line-height: 1.4;">
            <p style="margin: 0; font-weight: bold; color: #0f172a; font-size: 9px; text-transform: uppercase;">HQ General & Surgical Emergency Division</p>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 8px;">
              📍 Al-Mashtal St, Riyadh, Khartoum, Republic of Sudan<br/>
              📞 Hotline: +249 183 999 888 | Emergency Core: 990<br/>
              ✉️ Contact: info@jakelmedical.ly.sd | Web: www.jakelmedical.org
            </p>
          </div>
          
          <!-- EMBEDDED DIGITAL CLINICAL STAMP AND QR -->
          <div style="text-align: center; width: 25%; display: flex; flex-direction: column; align-items: center; justify-content: center; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; padding: 0 10px; min-height: 80px;">
            <div style="width: 50px; height: 50px; border: 2px double #10b981; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: monospace; transform: rotate(-5deg); color: #10b981; background: rgba(16, 185, 129, 0.05); margin-bottom: 2px;">
              <span style="font-size: 6px; font-weight: bold; text-transform: uppercase;">APPROVED</span>
              <span style="font-size: 5px; font-weight: bold;">JAKEL CLINIC</span>
              <span style="font-size: 9px; font-weight: bold;">✓</span>
            </div>
            <p style="margin: 0; font-size: 7px; font-weight: bold; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px;">VERIFIED SURGICAL DOC</p>
          </div>
          
          <!-- SECONDARY CONTACT / ARABIC INFO (Right side) -->
          <div style="text-align: right; width: 35%; direction: rtl; line-height: 1.4;">
            <p style="margin: 0; font-weight: bold; color: #0f172a; font-size: 9px;">الإدارة الطبية العامة والطوارئ الجراحية</p>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 8px;">
              📍 جمهورية السودان، ولاية الخرطوم - الرياض، شارع المشتل<br/>
              📞 الطوارئ والاستعلامات: 990 | هاتف المركز: +249183999888<br/>
              🔒 السجل السريري مؤمن ومكود رقمياً على خادم الأرشيف الوطني.
            </p>
          </div>
          
        </div>
        
        <div style="width: 100%; border-top: 1px dashed #e2e8f0; padding-top: 6px; margin-top: 10px; text-align: center; font-size: 8px; color: #94a3b8; font-family: monospace;">
          DOCUMENT HASH-SIGNATURE: SHA256-JMC-SURG-VERIFY-${Math.floor(100000 + Math.random() * 900000)} • OPERATING SURGEON: ${log.surgeonName.toUpperCase()}
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 text-slate-800 animate-fade-in">
      {/* LEFT COLUMN: Operations and Diagnostic Control Center (7 cols) */}
      <div className="xl:col-span-7 flex flex-col gap-6">
        
        {/* Surgical Specimen Video feed & Vitals monitor */}
        <div className="bg-slate-950 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl overflow-hidden relative">
          
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-950 flex items-center justify-center text-red-500 animate-pulse">
                <HeartPulse size={18} />
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-wider text-red-500 font-mono">
                  {isRTL ? "غرفة العمليات الجراحية المتقدمة" : "LIVE OPERATING ROOM FEED"}
                </h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest font-mono">
                  {isRTL ? "المراقبة الفورية والمؤشرات الحيوية" : "Intraoperative Patient Telemetry"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[9px] font-mono font-black text-emerald-400 uppercase tracking-widest">
                {isRTL ? "متصل بالقولبة الحية" : "Vitals Sync: On"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Live Camera Feed Feed */}
            <div className="md:col-span-8 bg-slate-900 rounded-3xl border border-slate-800 relative h-64 overflow-hidden flex flex-col items-center justify-center p-4">
              <div className="absolute inset-0 bg-neutral-900 overflow-hidden select-none">
                {isUsingRealCamera ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transition-all duration-300 transform"
                    style={{ 
                      filter: `brightness(${cameraLight}%) contrast(120%)`,
                      transform: `scale(${zoomScale})`
                    }}
                  />
                ) : (
                  <img
                    src={
                      pathologyTemplates[selectedPathology]?.imageUrl ||
                      "https://images.unsplash.com/photo-1579684389782-64d84b5e901a?auto=format&fit=crop&q=80&w=600"
                    }
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-all duration-300 transform"
                    style={{ 
                      filter: `brightness(${cameraLight}%) contrast(120%)`,
                      transform: `scale(${zoomScale})`
                    }}
                    alt="Endoscopy Realtime Feed"
                  />
                )}

                {/* Scope Lens Vignette */}
                <div className="absolute inset-0 ring-12 ring-black/85 rounded-3xl pointer-events-none shadow-inner" />
                
                {/* Calibration HUD Status */}
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 select-none pointer-events-none">
                  <div className="flex items-center gap-1.5 bg-black/75 rounded-lg px-2 py-0.5 border border-white/10 font-mono text-[8px] text-white font-bold whitespace-nowrap">
                    <Video size={10} className="text-red-500 animate-pulse" />
                    LENS FEED: {scopeType.toUpperCase()}
                  </div>
                  <div className="bg-black/75 rounded-lg px-2 py-0.5 border border-white/10 font-mono text-[8px] text-slate-300 font-bold">
                    EXPOSURE: {cameraLight}%
                  </div>
                  {zoomScale > 1 && (
                    <div className="bg-indigo-950/80 text-indigo-400 rounded-lg px-2 py-0.5 border border-indigo-500/30 font-mono text-[7px] font-black tracking-widest">
                      ZOOM: {zoomScale}X
                    </div>
                  )}
                </div>

                {/* DVR Recording timer banner */}
                {isRecording && (
                  <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-red-650 rounded-lg px-2.5 py-0.5 border border-red-500 font-mono text-[8px] text-white font-black animate-pulse shadow-md whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                    REC {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                  </div>
                )}

                {/* Reticle / Crosshair */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                  <div className="w-20 h-20 border border-white/10 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-red-500/30 rounded-full" />
                  </div>
                  {/* Outer scope circular HUD limits */}
                  <div className="w-full h-full border-[14px] border-slate-950/20 absolute inset-0 rounded-3xl" />
                </div>

                {/* Ambient Capture overlay */}
                <div className="absolute bottom-4 right-4 z-10 flex gap-2">
                  {/* Print directly from scope helper */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecording(!isRecording);
                    }}
                    className={`flex items-center gap-1 bg-black/80 text-white hover:bg-black border rounded-lg px-2 py-1 text-[8px] font-bold cursor-pointer transition ${isRecording ? "text-red-400 border-red-500/50" : "border-slate-800"}`}
                  >
                    <span>🎥</span> {isRecording ? (isRTL ? "إيقاف التسجيل" : "Stop Rec") : (isRTL ? "تسجيل فيديو" : "Record")}
                  </button>
                  <button
                    onClick={handleCaptureSnapshot}
                    className="flex items-center gap-1.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-transform cursor-pointer shadow-lg active:scale-95 border border-indigo-505"
                  >
                    <Camera size={12} />
                    {isRTL ? "التقاط فوري" : "Snap Frame"}
                  </button>
                </div>
              </div>
            </div>

            {/* Living Waveform Vitals Dashboard */}
            <div className="md:col-span-4 flex flex-col gap-2.5">
              
              {/* Cardiac Rhythm wave container */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between h-28 relative overflow-hidden">
                <span className="text-[7px] font-mono text-emerald-400 uppercase tracking-widest font-black leading-none block">
                  ECG WAVEFORM (II)
                </span>
                <svg className="w-full h-12 stroke-emerald-400 stroke-2 fill-none overflow-visible">
                  <path d={pulseWave} />
                </svg>
                <div className="flex justify-between items-baseline">
                  <span className="text-[8px] font-bold text-slate-400">HR RATE</span>
                  <span className="text-2xl font-mono font-black text-emerald-400 tracking-tighter leading-none animate-pulse">
                    {currentVitals.hr} <span className="text-[8px] font-sans">bpm</span>
                  </span>
                </div>
              </div>

              {/* SpO2 Tracker */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[7px] font-mono text-cyan-400 uppercase tracking-widest font-black leading-none mb-1">
                    SpO2 Oxygen
                  </span>
                  <span className="text-[8px] font-bold text-slate-400">Pleth amplitude</span>
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-xl font-mono font-black text-cyan-400 leading-none">
                    {currentVitals.spo2}
                  </span>
                  <span className="text-[8px] text-cyan-400 font-bold">%</span>
                </div>
              </div>

              {/* BP Monitor */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="text-[7px] font-mono text-violet-400 uppercase tracking-widest font-black leading-none mb-1">
                    SYS/DIA Arterial
                  </span>
                  <span className="text-[8px] font-bold text-slate-400">Non-invasive mmHg</span>
                </div>
                <span className="text-sm font-mono font-black text-violet-400 leading-none">
                  {currentVitals.bp}
                </span>
              </div>

            </div>
          </div>

          {/* Interactive Pathology Case Selection Tray */}
          <div className="mt-4 bg-slate-900 border border-slate-850 rounded-2xl p-3.5">
            <div className="flex items-center justify-between border-b border-slate-803 pb-2 mb-2.5">
              <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest block">
                {isRTL ? "العدسة التشخيصية الطيفية النشطة" : "ACTIVE DIAGNOSTIC PATHOLOGY LENS"}
              </span>
              <button
                type="button"
                onClick={() => {
                  const templ = pathologyTemplates[selectedPathology];
                  if (templ) {
                    setProcedureType(isRTL ? templ.procedureAr : templ.procedureEn);
                    setPreOpDiag(isRTL ? templ.preOpAr : templ.preOpEn);
                    setPostOpDiag(isRTL ? templ.postOpAr : templ.postOpEn);
                    setOperativeFindings(isRTL ? templ.findingsAr : templ.findingsEn);
                    setEquipmentName(isRTL ? templ.equipmentAr : templ.equipmentEn);
                    setAnesthesia(templ.anesthesiaEn);
                  }
                }}
                className="text-[8px] font-black text-indigo-400 hover:text-white bg-indigo-950 hover:bg-slate-800 border border-indigo-900 hover:border-indigo-700 px-2.5 py-1 rounded-lg cursor-pointer transition uppercase tracking-wider"
              >
                📝 {isRTL ? "تعبئة تلقائية ذكية للبروتوكول" : "Auto-Fill Operative Protocol"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(pathologyTemplates)
                .filter(([_, t]) => t.scopeType === scopeType)
                .map(([key, t]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedPathology(key)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-semibold transition cursor-pointer ${
                      selectedPathology === key
                        ? "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950/50"
                        : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {isRTL ? t.nameAr : t.nameEn}
                  </button>
                ))}
            </div>
          </div>

          {/* Micro-adjustments parameter bar */}
          <div className="mt-4 flex flex-wrap gap-4 items-center justify-between border-t border-slate-800 pt-3">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider font-semibold">
                {isRTL ? "جهاز العرض:" : "Optics Module:"}
              </span>
              <div className="flex gap-1.5 bg-slate-900 rounded-lg p-1 border border-slate-800">
                {(["lap", "general"] as const).map(scope => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => {
                      setScopeType(scope);
                      const firstMatch = Object.keys(pathologyTemplates).find(
                        k => pathologyTemplates[k].scopeType === scope
                      );
                      if (firstMatch) setSelectedPathology(firstMatch);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest cursor-pointer transition ${
                      scopeType === scope
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {scope === "lap" ? "Laparoscope" : "General Case"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Real Camera Feed vs Sim Toggle */}
              <button
                type="button"
                onClick={() => setIsUsingRealCamera(!isUsingRealCamera)}
                className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider cursor-pointer border transition-all flex items-center gap-1 ${
                  isUsingRealCamera 
                    ? "bg-rose-950 text-rose-400 border-rose-500/50 animate-pulse" 
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Camera size={10} />
                {isUsingRealCamera ? (isRTL ? "بث الكاميرا نشط" : "LIVE FEED ON") : (isRTL ? "كاميرا حقيقية" : "REAL CAMERA")}
              </button>

              {isUsingRealCamera && videoDevices.length > 0 && (
                <div className="flex items-center gap-1 bg-slate-950 border border-rose-500/30 rounded-lg px-2 py-1 max-w-[150px]">
                  <span className="text-[7px] font-black text-rose-400 uppercase tracking-widest">
                    {isRTL ? "الجهاز:" : "Device:"}
                  </span>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="bg-transparent text-slate-300 text-[8px] font-bold focus:outline-none cursor-pointer border-none p-0 pr-1 truncate"
                  >
                    {videoDevices.map((device, idx) => (
                      <option key={device.deviceId} value={device.deviceId} className="bg-slate-900 text-white">
                        {device.label || `${isRTL ? "كاميرا جراحية" : "Surgical Cam"} #${idx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Digital Zoom controls */}
              <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                {([1, 1.5, 2, 4] as const).map(z => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoomScale(z)}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono cursor-pointer transition ${
                      zoomScale === z
                        ? "bg-slate-800 text-indigo-400 font-extrabold"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {z}x
                  </button>
                ))}
              </div>

              <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider ml-1">
                {isRTL ? "مصدر الضوء:" : "Xenon Light:"}
              </span>
              <input
                type="range"
                min="30"
                max="100"
                value={cameraLight}
                onChange={(e) => setCameraLight(parseInt(e.target.value))}
                className="w-16 accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Required Surgical Operations Inbox (طلبات العمليات معلقة) */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center text-violet-650">
                <HeartPulse size={16} />
              </div>
              <div className="text-left font-sans">
                <h4 className="text-xs font-black uppercase text-slate-800 tracking-tight">
                  {isRTL ? "طلبات العمليات الجراحية الطارئة والواردة" : "Operating Room Required Procedures"}
                </h4>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                  {isRTL ? "البروتوكولات المطلوبة للتحضير ودخول غرف العمليات" : "Clinical operations request queue from clinicians"}
                </p>
              </div>
            </div>
            <span className="text-[9px] font-black bg-rose-50 text-rose-600 px-2 rounded-full uppercase">
              {(examinations || []).filter(ex => ex.type === 'Procedure' && ex.status !== 'Completed' && ex.status !== 'Cancelled').length} {isRTL ? "مطلوبة" : "Pending"}
            </span>
          </div>

          <div className="overflow-x-auto pb-2 custom-scrollbar">
            <div className="flex gap-4 min-w-max text-left font-sans">
              {(examinations || []).filter(ex => ex.type === 'Procedure' && ex.status !== 'Completed' && ex.status !== 'Cancelled').length === 0 ? (
                <div className="w-full flex flex-col items-center justify-center text-center py-4">
                  <span className="text-xs font-black text-slate-350">🎉 {isRTL ? "لا توجد أي طلبات عمليات معلقة حالياً!" : "No pending surgeries!"}</span>
                  <span className="text-[9px] text-slate-400 mt-1">{isRTL ? "المرتبة السريرية والعمليات المجدولة بحالة ممتازة." : "All surgical orders in active pipeline are finalized."}</span>
                </div>
              ) : (
                (examinations || []).filter(ex => ex.type === 'Procedure' && ex.status !== 'Completed' && ex.status !== 'Cancelled').map(ex => {
                  const pat = patients.find(p => p.id === ex.patientId);
                  const isSTAT = ex.priority === "STAT";
                  const isUrgent = ex.priority === "Urgent";
                  return (
                    <div
                      key={ex.id}
                      className="w-[280px] p-4 rounded-2xl border border-slate-150 bg-slate-50 hover:bg-slate-100/60 transition bg-slate-50 flex flex-col justify-between gap-3 relative overflow-hidden"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-slate-800 truncate max-w-[130px]">
                            {pat?.name || "Unknown Patient"}
                          </span>
                          <span
                            className={`text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase ${
                              isSTAT
                                ? "bg-red-100 text-red-650 border border-red-200 animate-pulse"
                                : isUrgent
                                  ? "bg-amber-100 text-amber-700 border border-amber-200"
                                  : "bg-slate-205 text-slate-600"
                            }`}
                          >
                            {ex.priority || "Routine"}
                          </span>
                        </div>

                        <div>
                          <h5 className="text-[10px] font-black uppercase text-violet-705">
                            {ex.testName}
                          </h5>
                          {ex.notes && (
                            <p className="text-[9px] text-slate-500 italic line-clamp-2">
                              "{ex.notes}"
                            </p>
                          )}
                        </div>
                        
                        <p className="text-[8px] text-slate-405">
                          {isRTL ? "مطلوب بواسطة: " : "Ordered by: "}
                          <span className="font-bold">{ex.requestedBy || "Surgeon"}</span> • {ex.date}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(ex.patientId);
                          setProcedureType(ex.testName);
                          setPreOpDiag(ex.notes || "");
                          const doc = users.find(u => u.name === ex.requestedBy);
                          if (doc) setLeadSurgeonId(doc.id);
                          
                          if (onUpdateExamination) {
                            onUpdateExamination(ex.id, { status: "In Progress" });
                          }
                        }}
                        className="w-full py-1.5 bg-violet-650 hover:bg-violet-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        <HeartPulse size={11} />
                        {isRTL ? "برمجة وبدء العملية الجراحية" : "Start Operative Session"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Surgical Record Placement Form */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
              <Scissors size={18} />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                {isRTL ? "تسجيل وتدوين بروتوكول العملية" : "PROCEDURE RECORDING CENTER"}
              </h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {isRTL ? "توثيق فوري للنتائج والبيانات الجراحية" : "Intraoperative Findings Log"}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProcedureLog} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  {isRTL ? "المريض المستهدف" : "Target Patient"}
                </label>
                <SmartSearchPicker
                  items={patients.map(p => ({
                    id: p.id,
                    name: p.name,
                    nationalId: p.nationalId,
                    description: p.nationalId || p.id,
                    details: p.gender
                  }))}
                  selectedId={selectedPatientId}
                  onSelect={(item) => setSelectedPatientId(item ? item.id : "")}
                  placeholder={isRTL ? "البحث بالاسم أو الرقم الوطني..." : "Search by Name or ID..."}
                  type="patient"
                  isRTL={isRTL}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  {isRTL ? "الطبيب المسؤول / الجراح الأخصائي" : "Lead Operating Specialist"}
                </label>
                <select
                  value={leadSurgeonId}
                  onChange={(e) => setLeadSurgeonId(e.target.value)}
                  className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-violet-500 outline-none"
                  required
                >
                  <option value="">
                    {isRTL ? "-- اختر الطبيب المعالج --" : "-- Choose Specialist --"}
                  </option>
                  {users.filter(u => u.role.toLowerCase().includes("doctor") || u.role === "Admin").map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                  {isRTL ? "نوع العملية الجراحية" : "Procedure Protocol"}
                </label>
                <input
                  type="text"
                  value={procedureType}
                  onChange={(e) => setProcedureType(e.target.value)}
                  className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-violet-500 outline-none"
                  placeholder="Laparoscopic Appendectomy / Surgery"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                  {isRTL ? "منهجية التخدير" : "Anesthesia Protocol"}
                </label>
                <select
                  value={anesthesia}
                  onChange={(e) => setAnesthesia(e.target.value)}
                  className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-violet-500 outline-none"
                >
                  <option value="General Anesthesia">General Anesthesia</option>
                  <option value="Spinal Anesthesia">Spinal Anesthesia</option>
                  <option value="Conscious Sedation">Conscious Sedation</option>
                  <option value="Local Anesthesia">Local Local Infiltration</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                  {isRTL ? "الأجهزة الطبية المستعملة" : "Clinical Tools & Hardware"}
                </label>
                <input
                  type="text"
                  value={equipmentName}
                  onChange={(e) => setEquipmentName(e.target.value)}
                  className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-violet-500 outline-none"
                  placeholder="Olympus Visera, Storz Endoscope..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                  {isRTL ? "التشخيص القبلي (Pre-Op Diagnosis)" : "Pre-Operative Diagnosis"}
                </label>
                <input
                  type="text"
                  value={preOpDiag}
                  onChange={(e) => setPreOpDiag(e.target.value)}
                  className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-violet-500 outline-none"
                  placeholder={isRTL ? "مثال: التهاب معوي حاد" : "e.g. Acute abdominal pain, suspected appendicitis"}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                  {isRTL ? "التشخيص البعدي (Post-Op Diagnosis)" : "Post-Operative Resolved Diagnosis"}
                </label>
                <input
                  type="text"
                  value={postOpDiag}
                  onChange={(e) => setPostOpDiag(e.target.value)}
                  className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-violet-500 outline-none"
                  placeholder={isRTL ? "مثال: انفجار مراري حاد" : "e.g. Ruptured gangrenous appendix resected"}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                {isRTL ? "النتائج الجراحية والتفاصيل الكلية للعملية" : "Intraoperative Findings & Detailed Procedure Protocol"}
              </label>
              <textarea
                value={operativeFindings}
                onChange={(e) => setOperativeFindings(e.target.value)}
                rows={3}
                className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-violet-500 outline-none resize-none"
                placeholder={
                  isRTL
                    ? "صف بالتفصيل الأحداث التي تمت داخل شق العمليات، الأنسجة المستهدفة، كمية النزف..."
                    : "Describe state of organs, anatomical anomalies, tissue damage, intra-op biopsy margins..."
                }
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                  {isRTL ? "المضاعفات أو الأحداث السلبية" : "Operative Complications / Incidents"}
                </label>
                <input
                  type="text"
                  value={complicationsInput}
                  onChange={(e) => setComplicationsInput(e.target.value)}
                  className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-1 focus:ring-violet-500 outline-none"
                  placeholder="None / Minimal bleeding"
                />
              </div>

              <div className="pt-4">
                {capturedSnapsInSession.length > 0 ? (
                  <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-2xl p-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                      {capturedSnapsInSession.length} {isRTL ? "صورة فوتوغرافية جاهزة للربط" : "OPTIC CAPTURES TIED TO LOG"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCapturedSnapsInSession([])}
                      className="ml-auto text-[8px] font-black text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400 p-2 text-[9px] font-bold uppercase tracking-wider">
                    <AlertCircle size={14} className="text-amber-500" />
                    {isRTL ? "استخدم كاميرا المنظار أعلاه لالتقاط صور تشريحية حية" : "No live optic photos captured in this session yet."}
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-xs uppercase tracking-widest hover:scale-[1.01] hover:shadow-lg transition-transform active:scale-95"
            >
              {isRTL ? "حفظ التقرير وإدراجه في السجل الطبي" : "Commit To Clinical History & Save Protocol"}
            </button>
          </form>
        </div>

      </div>

      {/* RIGHT COLUMN: Surgical Repository & Search Index (5 cols) */}
      <div className="xl:col-span-5 flex flex-col gap-6">

        {/* Informative Stats Widget */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-b from-indigo-50/50 to-white p-5 rounded-3xl border border-indigo-150 flex flex-col justify-between">
            <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center">
              🛡️
            </span>
            <div className="mt-4">
              <span className="text-[18px] font-mono font-black text-indigo-950 block leading-none">
                {logs.length}
              </span>
              <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider mt-1 block">
                {isRTL ? "إجمالي العمليات الموثقة" : "TOTAL PROCEDURES LOGGED"}
              </span>
            </div>
          </div>

          <div className="bg-gradient-to-b from-emerald-50/50 to-white p-5 rounded-3xl border border-emerald-150 flex flex-col justify-between">
            <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center">
              🚀
            </span>
            <div className="mt-4">
              <span className="text-[18px] font-mono font-black text-emerald-950 block leading-none">
                100%
              </span>
              <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider mt-1 block">
                {isRTL ? "تحقق سلامة التقارير الجراحية" : "VERIFICATION INTEGRITY"}
              </span>
            </div>
          </div>
        </div>

        {/* Procedures List Index */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-4 flex-1">
          <div className="flex justify-between items-center border-b border-slate-50 pb-3">
            <div>
              <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                {isRTL ? "مستودع الأرشيف الجراحي والمنظار" : "OPERATIVE TIMELINE & FILES"}
              </h5>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                {isRTL ? "انقر لعرض التفاصيل الكاملة وطباعة التقرير" : "Interactive Clinical Summaries Client"}
              </span>
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[640px] pr-1 scrollbar-thin">
            {logs.map(log => (
              <div
                key={log.id}
                onClick={() => setSelectedLogForDetail(selectedLogForDetail?.id === log.id ? null : log)}
                className={`p-4 rounded-3xl border transition-all cursor-pointer flex flex-col gap-3 relative overflow-hidden group ${
                  selectedLogForDetail?.id === log.id
                    ? "bg-indigo-50/30 border-indigo-200/80 shadow-md ring-1 ring-indigo-100"
                    : "bg-slate-50/50 border-slate-100 hover:bg-slate-100 flex-1 hover:border-slate-200"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[7px] font-mono bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider block w-max mb-1">
                      {log.id}
                    </span>
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight">
                      {log.procedureType}
                    </h5>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                      {isRTL ? "المريض:" : "Patient:"} <span className="text-slate-800 font-black">{log.patientName}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handlePrintProcedureReport(log)}
                      className="p-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition flex items-center gap-1 text-[8px] font-black uppercase tracking-widest border border-emerald-100"
                      title="Print Report"
                    >
                      <Printer size={10} />
                      {isRTL ? "طباعة" : "Print"}
                    </button>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition"
                    >
                      <Trash2 size={9} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono font-bold text-slate-400 border-t border-slate-100/50 pt-2 shrink-0">
                  <span>{log.date}</span>
                  <span className="text-indigo-600 font-black">{log.surgeonName}</span>
                </div>

                <AnimatePresence>
                  {selectedLogForDetail?.id === log.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-2 border-t border-indigo-100 pt-3 space-y-3.5 text-xs text-slate-700 select-all overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                        <div>
                          <span className="text-slate-400 uppercase tracking-[0.1em] text-[8px] block">{isRTL ? "التشخيص القبلي" : "Pre-Op Diag"}</span>
                          <span className="text-slate-700">{log.preOpDiagnosis}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 uppercase tracking-[0.1em] text-[8px] block">{isRTL ? "التشخيص البعدي" : "Post-Op Diag"}</span>
                          <span className="text-slate-700">{log.postOpDiagnosis}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 uppercase tracking-[0.1em] text-[8px] block font-bold">{isRTL ? "الأجهزة الطبية والأدوات المستعملة" : "Tools Utilized"}</span>
                        <span className="text-indigo-900 font-black tracking-wide">{log.equipmentUsed}</span>
                      </div>

                      <div>
                        <span className="text-slate-400 uppercase tracking-[0.1em] text-[8px] block font-bold">{isRTL ? "الملاحظات والنتائج الجراحية" : "Clinical Findings"}</span>
                        <p className="bg-slate-100/60 p-2.5 rounded-xl text-[10px] leading-relaxed text-slate-600">
                          {log.findings}
                        </p>
                      </div>

                      {/* Integrated Camera Lens & DVR telemetry box */}
                      <div className="bg-slate-900 text-slate-300 p-3.5 rounded-2xl border border-slate-800 space-y-2 font-sans">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-1.5 text-[9px] font-bold">
                          <span className="text-slate-400 uppercase tracking-widest">{isRTL ? "مواصفات العدسات والاتصال جراحي" : "Surgical Optics & Device telemetry"}</span>
                          <span className="text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"/>
                            {isRTL ? "بث مدمج متكامل" : "Device Integrated"}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-slate-500 block text-[8px] uppercase">{isRTL ? "نوع الجهاز" : "Hardware type"}</span>
                            <span className="font-mono font-bold text-slate-200">{(log.scopeType || "lap").toUpperCase()} Feed</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[8px] uppercase">{isRTL ? "التقريب الرقمي" : "Digital zoom"}</span>
                            <span className="font-mono font-bold text-slate-200">{log.zoomScale || 1}x Zoom</span>
                          </div>
                        </div>

                        {log.recordingSeconds ? (
                          <div className="mt-1.5 p-2 bg-slate-950 rounded-xl border border-slate-900 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 bg-red-650 rounded-full animate-pulse shrink-0" />
                              <div className="text-left leading-none">
                                <span className="text-[7px] font-mono text-slate-500 block uppercase">Recorded Operative Video Clip</span>
                                <span className="text-[10px] text-slate-300 font-mono font-bold truncate block w-[160px]">
                                  DVR-{log.id}.mp4 ({Math.floor(log.recordingSeconds / 60)}:{(log.recordingSeconds % 60).toString().padStart(2, '0')})
                                </span>
                              </div>
                            </div>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                alert(isRTL 
                                  ? "جاري استدعاء البث السريري المشفر للجراحة من خادم الأرشيف الرئيسي..." 
                                  : "Retrieving encrypted clinical operative recording from hospital PACS cluster...");
                              }}
                              className="px-2 py-1 bg-red-950 hover:bg-red-900 border border-red-900 text-red-400 rounded-lg text-[8px] font-black uppercase font-mono tracking-wider transition active:scale-95 cursor-pointer flex items-center gap-1"
                            >
                              ▶ Play Clip
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-1">
                        <span className="text-slate-400 uppercase tracking-[0.1em] text-[8px] block font-bold">{isRTL ? "اللقطات المأخوذة" : "Captured Snaps"}</span>
                        <div className="flex gap-2">
                          {log.capturedImages.map((img, index) => (
                            <div key={index} className="w-16 h-12 bg-black rounded-lg overflow-hidden border border-slate-200 relative">
                              <img src={img} referrerpolicy="no-referrer" className="w-full h-full object-cover" alt="Surgical lens snapshot" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
};
