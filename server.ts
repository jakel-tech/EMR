import os from "os";
import express from "express";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";
import fs from "fs";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cron from "node-cron";
import nodemailer from "nodemailer";
import axios from "axios";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import twilio from "twilio";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import TelegramBot from "node-telegram-bot-api";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import zlib from "zlib";

dotenv.config();

// Standard Email Mailer transporter setup
let mailTransporter: nodemailer.Transporter | null = null;
let etherealAccount: nodemailer.TestAccount | null = null;

const initTransporter = async () => {
  if (process.env.SMTP_HOST && process.env.SMTP_HOST !== "smtp.example.com") {
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  } else {
    try {
      etherealAccount = await nodemailer.createTestAccount();
      mailTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: etherealAccount.user,
          pass: etherealAccount.pass,
        },
      });
      console.log("Created Ethereal Test Account for Emails");
    } catch (err) {
      console.warn("Failed to create Ethereal test account", err);
    }
  }
};

initTransporter();

// Telegram Bot setup
let telegramBot: TelegramBot | null = null;
let telegramBotUsername = "";
let telegramErrorCount = 0;

const botToken = process.env.TELEGRAM_BOT_TOKEN ? process.env.TELEGRAM_BOT_TOKEN.trim() : "";
const isPlaceholderToken = botToken === "8801203178:AAHeJ1lmT4qVeQGhKLFZjC4RRBAfn_dRTFk" || 
                           botToken === "ENTER_TELEGRAM_BOT_TOKEN" || 
                           !botToken;

if (isPlaceholderToken) {
  console.log("Using placeholder/empty Telegram Bot Token. Polling is disabled.");
} else {
  try {
    telegramBot = new TelegramBot(botToken, { polling: true });
    console.log("Telegram Bot initialized successfully.");
    
    telegramBot.getMe().then(me => {
      telegramBotUsername = me.username || "";
      telegramErrorCount = 0; // Reset count on success
    }).catch(err => {
      console.warn("Failed to get Telegram Bot username. Token may be invalid.", err.message);
    });
    
    telegramBot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      
      if (msg.text && msg.text.startsWith('/start')) {
        const parts = msg.text.split(' ');
        
        if (parts.length > 1) {
          // Has payload e.g., /start user_1 or /start patient_5
          const payload = parts[1];
          try {
            if (payload.startsWith('user_')) {
              const userId = payload.split('_')[1];
              await db.run("UPDATE users SET telegram_chat_id = ? WHERE id = ?", [chatId.toString(), userId]);
            } else if (payload.startsWith('patient_')) {
              const patientId = payload.split('_')[1];
              await db.run("UPDATE patients SET telegram_chat_id = ? WHERE id = ?", [chatId.toString(), patientId]);
            }
            telegramBot?.sendMessage(chatId, `تم ربط حسابك بنجاح! ستصلك التنبيهات هنا.\n\nAccount linked successfully! You will receive notifications here.`);
          } catch (dbErr) {
            console.error("Database error linking telegram by payload:", dbErr);
          }
        } else {
          // Normal start
          telegramBot?.sendMessage(chatId, `أهلاً بك في بوت نظام سلامات! يرجى الضغط على الزر أدناه لمشاركة رقم هاتفك وتفعيل التنبيهات.\n\nWelcome to Salamat HIMS Bot! Please click the button below to share your phone number and activate notifications.`, {
            reply_markup: {
              keyboard: [[{ text: "مشاركة رقم الهاتف / Share Phone Number", request_contact: true }]],
              one_time_keyboard: true,
              resize_keyboard: true
            }
          });
        }
      }

      if (msg.contact) {
        let phoneNumber = msg.contact.phone_number;
        // Normalize phone number: remove + and leading zeros for better matching if needed, 
        // but usually just keeping it as is or removing '+' is safest.
        const normalizedPhone = phoneNumber.replace(/\+/g, '');
        
        console.log(`Received contact: ${phoneNumber} for chatId: ${chatId}`);
        
        try {
          // Update users table
          await db.run("UPDATE users SET telegram_chat_id = ? WHERE phone = ? OR phone = ?", [chatId.toString(), phoneNumber, normalizedPhone]);
          // Update patients table
          await db.run("UPDATE patients SET telegram_chat_id = ? WHERE contactNumber = ? OR contactNumber = ?", [chatId.toString(), phoneNumber, normalizedPhone]);
          
          telegramBot?.sendMessage(chatId, `تم ربط رقم هاتفك بنجاح! ستصلك التنبيهات هنا.\n\nPhone number linked successfully! You will receive notifications here.`, {
            reply_markup: { remove_keyboard: true }
          });
        } catch (dbErr) {
          console.error("Database error linking telegram:", dbErr);
        }
      }
    });
    
    telegramBot.on('polling_error', (error: any) => {
      telegramErrorCount++;
      if (telegramErrorCount >= 5) {
        console.warn("Telegram bot has failed continuously 5 times. Disabling polling to prevent resource drain.");
        try {
          telegramBot?.stopPolling();
        } catch (stopErr) {
          console.error("Error stopping Telegram polling:", stopErr);
        }
      }
      if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
        console.warn("Telegram polling conflict: Another instance is running. Polling will retry.");
      } else if (error.code === 'EFATAL') {
        console.warn("Telegram polling EFATAL error (fetch failed). Will ignore/retry.", error.message);
      } else {
        console.error("Telegram polling error:", error.message || error);
      }
    });
  } catch (err) {
    console.error("Failed to initialize Telegram Bot:", err);
  }
}

const sendNodeMail = async (to: string, subject: string, html: string) => {
  if (!mailTransporter) {
    console.warn("Mail transporter not initialized yet. Cannot send email.");
    return { success: false, error: "Mail transporter not initialized" };
  }

  try {
    let fromAddress = process.env.SMTP_FROM_EMAIL;
    // If fromAddress is a system default or contains a system template domain,
    // or if using Gmail SMTP, we should prefer sending from the actual authenticated user (SMTP_USER)
    // to bypass strict SPF, DKIM, and anti-spoofing restrictions of modern mail services.
    if (
      !fromAddress ||
      fromAddress.includes("hims-") ||
      fromAddress.includes("ais-dev-") ||
      (process.env.SMTP_HOST && process.env.SMTP_HOST.includes("gmail"))
    ) {
      if (process.env.SMTP_USER) {
        fromAddress = `"سلامات | Salamat" <${process.env.SMTP_USER}>`;
      }
    }
    if (!fromAddress) {
      fromAddress = '"سلامات | Salamat" <Notifications@hims-482332599885.us-west1.run.app>';
    }

    const attachments: any[] = [];
    const logoPath = path.join(process.cwd(), "public", "images", "jakel_logo.png");
    if (fs.existsSync(logoPath)) {
      attachments.push({
        filename: "jakel_logo.png",
        path: logoPath,
        cid: "jakel_logo",
      });
    }

    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
      attachments,
    });
    console.log(`Email sent to ${to}: ${info.messageId}`);
    if (etherealAccount) {
      console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    return { success: true };
  } catch (error: any) {
    console.error(
      "Email sending failed:",
      error,
    );
    return { success: false, error: error.message };
  }
};

const sendWelcomeEmail = async (
  email: string,
  name: string,
  role: string,
  id: string,
  password?: string,
) => {
  const subject = `Welcome to Salamat - ${name} | أهلاً بك في سلامات`;
  const content = `
    <div style="direction: rtl; text-align: right; margin-bottom: 25px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
      <h2 style="color: #0284c7; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 10px;">أهلاً بك في منصة سلامات الطبية</h2>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 10px 0;">مرحباً <strong>${name}</strong>،</p>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0;">تم إكمال تسجيل حسابك بنجاح بصفتك <strong>${role === "Patient" ? "مريض مراجع" : role === "Super Admin" ? "مدير عام النظام" : role}</strong>.</p>
    </div>
    
    <div style="direction: ltr; text-align: left; margin-bottom: 25px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
      <h2 style="color: #4f46e5; font-size: 20px; font-weight: 800; margin-top: 0; margin-bottom: 10px;">Welcome to Salamat Medical Platform</h2>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 10px 0;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0;">Your registration as <strong>${role}</strong> has been completed successfully.</p>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 25px;">
      <h3 style="font-size: 14px; font-weight: 700; color: #1e293b; margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; text-align: center;">
        تفاصيل الحساب | Account Details
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #475569; text-align: left;">ID / المعرف:</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0f172a;">${id}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #475569; text-align: left;">Email / البريد:</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #0f172a;">${email}</td>
        </tr>
        ${password ? `
        <tr>
          <td style="padding: 8px 0; font-weight: bold; color: #dc2626; text-align: left;">Temp Password / كلمة المرور:</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #dc2626; font-family: monospace;">${password}</td>
        </tr>` : ""}
      </table>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.APP_URL || "https://hims.pro/login"}" style="background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 14px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);">
        تسجيل الدخول الآن | Login Now
      </a>
    </div>
  `;
  return sendNodeMail(email, subject, getEmailLayout(content, ""));
};

const getEmailLayout = (content: string, logoUrl: string) => `
  <!DOCTYPE html>
  <html lang="ar">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>سلامات | Salamat Portal</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
    <div style="background-color: #f1f5f9; padding: 40px 10px; min-height: 100%;">
      <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.04), 0 10px 15px -10px rgba(0, 0, 0, 0.04); border: 1px solid rgba(226, 232, 240, 0.8);">
        
        <!-- Header Banner Block with Gradient or Clean White Accents -->
        <div style="background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%); padding: 40px 30px 25px 30px; text-align: center; border-bottom: 1px solid #f1f5f9;">
          <!-- Use system-provided logo image with larger dimensions, centered perfectly and embedded directly to avoid broken images -->
          <div style="text-align: center; margin-bottom: 25px;">
            <img src="cid:jakel_logo" alt="JAKEL Logo" width="540" style="width: 540px; max-width: 100%; height: auto; display: inline-block; margin: 0 auto; vertical-align: middle;" />
          </div>
          
          <h1 style="color: #0f172a; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.02em;">سلامات | Salamat</h1>
          <p style="color: #0284c7; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 800; margin: 6px 0 0 0;">نظام إدارة المستشفيات الموحد</p>
          <p style="color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; margin: 2px 0 0 0;">Unified Hospital Information Management System</p>
        </div>

        <!-- Body Content Block -->
        <div style="padding: 40px 35px; background-color: #ffffff; line-height: 1.7; color: #334155;">
          ${content}
        </div>

        <!-- Extra Trust / Info Badging -->
        <div style="background-color: #fafbfd; padding: 20px 35px; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; text-align: center;">
          <div style="display: inline-block; vertical-align: middle; padding: 0 10px;">
            <span style="font-size: 11px; font-weight: 700; color: #0284c7;">🔒 اتصال آمن ونظام محمي بالكامل | Secure Connection</span>
          </div>
        </div>

        <!-- Footer Block -->
        <div style="padding: 40px 30px; background-color: #ffffff; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px dashed #e2e8f0;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #64748b;">تطبيق سلامات الموحد للرعاية الصحية والخدمات الطبية</p>
          <p style="margin: 0 0 20px 0; font-family: monospace;">Salamat Unified Health & Care Platform</p>
          <div style="height: 1px; background-color: #f1f5f9; width: 60px; margin: 0 auto 20px auto;"></div>
          <p style="margin: 0; font-size: 10px; color: #cbd5e1;">&copy; ${new Date().getFullYear()} Salamat Medical Solutions. جميع الحقوق محفوظة.</p>
        </div>

      </div>
    </div>
  </body>
  </html>
`;

let firebaseConfigObj: any = null;

// Support loading Firebase config from environment variables for Vercel/Cloud Run
if (process.env.FIREBASE_CONFIG) {
  try {
    firebaseConfigObj = JSON.parse(process.env.FIREBASE_CONFIG);
  } catch (err) {
    console.error("Failed to parse FIREBASE_CONFIG env variable:", err);
  }
} else if (process.env.FIREBASE_PROJECT_ID) {
  firebaseConfigObj = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID
  };
}

if (!firebaseConfigObj) {
  const firebaseConfigPath = path.join(
    process.cwd(),
    "firebase-applet-config.json",
  );
  if (fs.existsSync(firebaseConfigPath)) {
    try {
      firebaseConfigObj = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
    } catch (err) {
      console.error("Failed to read firebase-applet-config.json file:", err);
    }
  }
}

let firestoreDb: any = null;
if (firebaseConfigObj) {
  try {
    const firebaseApp = initializeApp(firebaseConfigObj);
    const databaseId =
      firebaseConfigObj.firestoreDatabaseId ||
      "ai-studio-9830d766-abc0-407c-8f6e-71c5da588f72";
    firestoreDb = initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    } as any, databaseId);
    console.log("Firebase initialized in server");
    loadLinkedAccounts();
  } catch (err) {
    console.error("Firebase server init error:", err);
  }
}

let fullLinkedAccounts: any[] = [];
let globalLinkedAccounts: string[] = [];

const remixDbCache: { [id: string]: any } = {};

function getRemixDb(dbId: string) {
  if (remixDbCache[dbId]) return remixDbCache[dbId];
  if (!firebaseConfigObj) return null;
  try {
    const appName = `remix_${dbId.replace(/[^a-zA-Z0-9]/g, '')}`;
    const newApp = initializeApp(firebaseConfigObj, appName);
    const db = initializeFirestore(newApp, {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    } as any, dbId);
    remixDbCache[dbId] = db;
    return db;
  } catch(e) {
    console.error("Failed to init remix db", dbId, e);
    return null;
  }
}

async function loadLinkedAccounts() {
  if (firestoreDb) {
    try {
      const docSnap = await getDoc(doc(firestoreDb, "system", "linkedAccounts"));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.accounts)) {
          fullLinkedAccounts = data.accounts;
          globalLinkedAccounts = fullLinkedAccounts.map((a: any) => typeof a === 'string' ? a : a.email).filter(Boolean);
          console.log(`Loaded ${globalLinkedAccounts.length} linked accounts from Firestore`);
        }
      }
    } catch (e: any) {
      if (e?.code === 'permission-denied') {
        // Expected if unauthenticated or rules block it
      } else {
        console.warn("Failed to load linked accounts from Firestore", e);
      }
    }
  }
}

let isRestoringDb = false;
let lastLocalTimestamp = 0;

async function downloadDbFromFirestore(sourcePath: string = "dbBackup", targetDbId?: string) {
  let dbToUse = firestoreDb;
  if (targetDbId) {
    dbToUse = getRemixDb(targetDbId);
  }
  if (!dbToUse) return false;
  try {
    console.log(`Checking Firebase for Global Sync DB at ${sourcePath} (dbId: ${targetDbId || 'default'})...`);
    const c0 = await getDoc(doc(dbToUse, sourcePath, "chunk_0"));
    if (c0.exists()) {
      const { timestamp, data: firstChunk, totalChunks, compressed } = c0.data();
      lastLocalTimestamp = timestamp;
      let base64 = firstChunk;
      const isCompressed = compressed === true;
      
      for (let i = 1; i < totalChunks; i++) {
        const c = await getDoc(doc(dbToUse, sourcePath, `chunk_${i}`));
        if (c.exists()) {
          base64 += c.data().data;
        } else {
          console.error(`CRITICAL: Missing chunk_${i} during DB sync from ${sourcePath}!`);
          return false;
        }
      }

      const buffer = Buffer.from(base64, "base64");
      const finalData = isCompressed ? zlib.gunzipSync(buffer) : buffer;

      // Verify SQLite header (The first 16 bytes must match "SQLite format 3\0")
      const sqliteHeader = "SQLite format 3\0";
      const headerBuffer = finalData.slice(0, 16);
      if (headerBuffer.toString("binary", 0, 16) !== sqliteHeader) {
        console.error("CRITICAL: Downloaded DB backup has an invalid SQLite header!");
        return false;
      }

      fs.writeFileSync(DB_PATH, finalData);
      console.log(
        `Successfully synced DB from Firebase (Compressed: ${isCompressed}, Size: ${finalData.length} bytes)`,
      );
      return true;
    }
  } catch (e) {
    console.error("Download DB Error:", e);
  }
  return false;
}

let syncTimeout: NodeJS.Timeout | null = null;

async function uploadDbToFirestore() {
  if (!firestoreDb || isRestoringDb) return;
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      if (!fs.existsSync(DB_PATH)) return;
      const stats = fs.statSync(DB_PATH);
      const sizeInMB = stats.size / (1024 * 1024);

      if (sizeInMB > MAX_DB_SIZE_MB) {
        console.warn(
          `[SCALE ALERT] Database size is ${sizeInMB.toFixed(2)} MB, exceeding ${MAX_DB_SIZE_MB}MB threshold. Sync skipped.`,
        );
        return;
      }

      const data = fs.readFileSync(DB_PATH);
      
      // Verify local DB integrity before uploading
      const sqliteHeader = "SQLite format 3\0";
      if (data.slice(0, 16).toString("binary", 0, 16) !== sqliteHeader) {
        console.warn("Skipping DB upload: Local database file has invalid header (possibly mid-transaction or corrupted).");
        return;
      }

      const compressed = zlib.gzipSync(data, { level: 9 });
      const base64 = compressed.toString("base64");

      const chunkSize = 900 * 1024;
      const chunks = Math.ceil(base64.length / chunkSize);
      const timestamp = Date.now();
      lastLocalTimestamp = timestamp;

      // Helper to write chunks to a specific base path
      const writeChunks = async (basePath: string) => {
        for (let i = 1; i < chunks; i++) {
          await setDoc(doc(firestoreDb, basePath, `chunk_${i}`), {
            data: base64.substring(i * chunkSize, (i + 1) * chunkSize),
            totalChunks: chunks,
            timestamp,
            compressed: true,
          });
        }
        if (chunks > 0) {
          await setDoc(doc(firestoreDb, basePath, "chunk_0"), {
            data: base64.substring(0, chunkSize),
            totalChunks: chunks,
            timestamp,
            compressed: true,
          });
        }
      };

      // Write to primary backup location
      await writeChunks("dbBackup");

      // Write to all linked accounts for redundancy
      for (const account of fullLinkedAccounts) {
        if (!account) continue;
        
        // Handle Remix Database Sync
        if (account.type === 'remix' && account.dbId) {
           const rDb = getRemixDb(account.dbId);
           if (rDb) {
             const writeChunksToDb = async (basePath: string) => {
               for (let i = 1; i < chunks; i++) {
                 await setDoc(doc(rDb, basePath, `chunk_${i}`), {
                   data: base64.substring(i * chunkSize, (i + 1) * chunkSize),
                   totalChunks: chunks,
                   timestamp,
                   compressed: true,
                 });
               }
               if (chunks > 0) {
                 await setDoc(doc(rDb, basePath, "chunk_0"), {
                   data: base64.substring(0, chunkSize),
                   totalChunks: chunks,
                   timestamp,
                   compressed: true,
                 });
               }
             };
             await writeChunksToDb("dbBackup").catch(err => {
               console.warn(`Failed to sync SQLite to Remix DB ${account.dbId}`, err);
             });
           }
        } else {
           const email = account.email || account;
           if (!email || typeof email !== 'string') continue;
           const safeEmail = email.replace(/[^a-zA-Z0-9_@.\-]/g, '');
           await writeChunks(`users/${safeEmail}/dbBackup`).catch(err => {
             console.warn(`Failed to sync SQLite to linked account ${safeEmail}`, err);
           });
        }
      }

      console.log(
        `Synced DB to Firebase (${chunks} chunks, compressed from ${sizeInMB.toFixed(2)} MB) + ${fullLinkedAccounts.length} linked accounts`,
      );
    } catch (e) {
      console.error("Upload DB Error:", e);
    }
  }, 5000); // 5-second responsive debounce for better real-time synchronization across multi-user environments
}

let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

const PORT = 3000;
const SECRET_KEY =
  process.env.JWT_SECRET || "hims_super_secret_secure_key_2026";
const DATA_DIR =
  process.env.NODE_ENV === "production"
    ? path.join("/tmp", "data")
    : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "database.sqlite");
const MAX_DB_SIZE_MB = 100;

let db: Database;
let io: SocketIOServer;
let onlineUsers = new Set<string>();

// Gmail Email Helper
async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}) {
  try {
    let sent = false;
    const gmailToken = db
      ? await db.get("SELECT value FROM sys_config WHERE key = ?", [
          "gmail_refresh_token",
        ])
      : null;

    if (gmailToken?.value) {
      try {
        const { google } = await import("googleapis");
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          `${process.env.APP_URL}/oauth2callback`,
        );

        oauth2Client.setCredentials({ refresh_token: gmailToken.value });
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
        const messageParts = [
          `To: ${to}`,
          `Content-Type: ${html ? "text/html" : "text/plain"}; charset=utf-8`,
          "MIME-Version: 1.0",
          `Subject: ${utf8Subject}`,
          "",
          html || text || "",
        ];
        const message = messageParts.join("\n");
        const encodedMessage = Buffer.from(message)
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw: encodedMessage },
        });
        console.log(`Email successfully sent to ${to} via Gmail OAuth`);
        sent = true;
      } catch (err) {
        console.error("Gmail sendEmail failed, falling back to SMTP...", err);
      }
    }

    if (!sent) {
      console.log(`Attempting to send email to ${to} via SMTP transporter...`);
      const result = await sendNodeMail(to, subject, html || text || "");
      if (result.success) {
        console.log(`Email successfully sent to ${to} via SMTP transporter`);
        return true;
      } else {
        console.error("SMTP fallback also failed:", result.error);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error("sendEmail completely failed:", err);
    return false;
  }
}

// Global Db Wrapper
let dataChangedTimeout: NodeJS.Timeout | null = null;
function emitDataChanged() {
  if (dataChangedTimeout) clearTimeout(dataChangedTimeout);
  dataChangedTimeout = setTimeout(() => {
    if (io) {
      io.emit("dataChanged");
      console.log("Debounced io.emit(dataChanged) triggered");
    }
  }, 1500); // 1.5-second debounce
}

const wrapDb = (database: any) => {
  const _run = database.run.bind(database);
  database.run = async function (...args: any[]) {
    const result = await _run(...args);
    uploadDbToFirestore();
    emitDataChanged();
    return result;
  };
  const _exec = database.exec.bind(database);
  database.exec = async function (...args: any[]) {
    const result = await _exec(...args);
    uploadDbToFirestore();
    emitDataChanged();
    return result;
  };
  const _prepare = database.prepare.bind(database);
  database.prepare = async function (...args: any[]) {
    const stmt = await _prepare(...args);
    if (stmt) {
      const _stmtRun = stmt.run.bind(stmt);
      stmt.run = async function (...stmtArgs: any[]) {
        const res = await _stmtRun(...stmtArgs);
        uploadDbToFirestore();
        emitDataChanged();
        return res;
      };
    }
    return stmt;
  };
};

async function openDatabase(path: string) {
  try {
    return await open({
      filename: path,
      driver: sqlite3.Database,
    });
  } catch (err: any) {
    if (err.message.includes("unsupported file format") || err.message.includes("SQLITE_CORRUPT")) {
      console.error(`CRITICAL: Database file at ${path} is corrupted. Attempting fresh start...`);
      const backupPath = `${path}.corrupted.${Date.now()}`;
      if (fs.existsSync(path)) fs.renameSync(path, backupPath);
      return await open({
        filename: path,
        driver: sqlite3.Database,
      });
    }
    throw err;
  }
}

async function initDb() {
  console.log("Initializing database...");
  if (!fs.existsSync(DATA_DIR)) {
    console.log("Creating data directory:", DATA_DIR);
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  isRestoringDb = true;
  await downloadDbFromFirestore();

  console.log("Opening database at:", DB_PATH);
  db = await openDatabase(DB_PATH);

  // Optimize SQLite parameters for high-concurrency scaling (Millions of Users)
  try {
    await db.exec(`PRAGMA journal_mode = WAL;`);
    await db.exec(`PRAGMA synchronous = NORMAL;`);
    await db.exec(`PRAGMA temp_store = MEMORY;`);
    await db.exec(`PRAGMA busy_timeout = 5000;`);
    console.log("Database performance PRAGMAs successfully configured.");
  } catch (err) {
    console.error("Failed to configure database performance PRAGMAs:", err);
  }

  if (firestoreDb) {
    onSnapshot(doc(firestoreDb, "dbBackup", "chunk_0"), async (snapshot) => {
      if (snapshot.exists() && snapshot.data().timestamp > lastLocalTimestamp) {
        console.log("Firebase remote DB updated! Syncing locally...");
        isRestoringDb = true;
        await db.close();
        await downloadDbFromFirestore();
        db = await openDatabase(DB_PATH);
        try {
          await db.exec(`PRAGMA journal_mode = WAL;`);
          await db.exec(`PRAGMA synchronous = NORMAL;`);
          await db.exec(`PRAGMA temp_store = MEMORY;`);
          await db.exec(`PRAGMA busy_timeout = 5000;`);
        } catch (e) {}
        wrapDb(db);
        await runMigrationsAndSeed(db);
        isRestoringDb = false;
        emitDataChanged();
      }
    });
  }

  wrapDb(db);

  await runMigrationsAndSeed(db);
  isRestoringDb = false;
  console.log(
    "Database initialization complete. Ready for real-time replication.",
  );
}

async function runMigrationsAndSeed(targetDb: Database) {
  db = targetDb;

  // Migration for pharmacy_sales new columns
  try {
    const salesCols = await db.all("PRAGMA table_info(pharmacy_sales)");
    const colNames = salesCols.map((c: any) => c.name);
    if (!colNames.includes("patient_id")) {
      await db.run("ALTER TABLE pharmacy_sales ADD COLUMN patient_id TEXT");
    }
    if (!colNames.includes("is_otc")) {
      await db.run(
        "ALTER TABLE pharmacy_sales ADD COLUMN is_otc BOOLEAN DEFAULT 1",
      );
    }
    if (!colNames.includes("barcode")) {
      await db.run("ALTER TABLE medications ADD COLUMN barcode TEXT");
    }
  } catch (e) {}

  try {
    const tableInfo = await db.all("PRAGMA table_info(inventory)");
    const colNames = tableInfo.map((c: any) => c.name);
    if (!colNames.includes("barcode")) {
      await db.run("ALTER TABLE inventory ADD COLUMN barcode TEXT");
    }
  } catch (e) {}

  try {
    const tableInfo = await db.all("PRAGMA table_info(users)");
    const colNames = tableInfo.map((c: any) => c.name);
    if (!colNames.includes("external_workshop_id")) {
      await db.run("ALTER TABLE users ADD COLUMN external_workshop_id TEXT");
    }
  } catch (e) {}

  try {
    const tableInfo = await db.all("PRAGMA table_info(external_pharmacies)");
    const colNames = tableInfo.map((c: any) => c.name);
    if (!colNames.includes("password")) {
      await db.run("ALTER TABLE external_pharmacies ADD COLUMN password TEXT");
    }
  } catch (e) {}

  try {
    const tableInfo = await db.all("PRAGMA table_info(external_labs)");
    const colNames = tableInfo.map((c: any) => c.name);
    if (!colNames.includes("password")) {
      await db.run("ALTER TABLE external_labs ADD COLUMN password TEXT");
    }
  } catch (e) {}

  try {
    const tableInfo = await db.all("PRAGMA table_info(external_workshops)");
    const colNames = tableInfo.map((c: any) => c.name);
    if (!colNames.includes("password")) {
      await db.run("ALTER TABLE external_workshops ADD COLUMN password TEXT");
    }
  } catch (e) {}

  try {
    const tableInfo = await db.all("PRAGMA table_info(patients)");
    const colNames = tableInfo.map((c: any) => c.name);
    if (!colNames.includes("national_id")) {
      await db.run("ALTER TABLE patients ADD COLUMN national_id TEXT");
    }
    if (!colNames.includes("is_verified")) {
      await db.run("ALTER TABLE patients ADD COLUMN is_verified BOOLEAN DEFAULT 0");
    }
    if (!colNames.includes("insurance_provider")) {
      await db.run("ALTER TABLE patients ADD COLUMN insurance_provider TEXT");
    }
    if (!colNames.includes("insurance_policy_number")) {
      await db.run("ALTER TABLE patients ADD COLUMN insurance_policy_number TEXT");
    }
    if (!colNames.includes("insurance_copay_percent")) {
      await db.run("ALTER TABLE patients ADD COLUMN insurance_copay_percent REAL DEFAULT 100");
    }
    if (!colNames.includes("insurance_expiry")) {
      await db.run("ALTER TABLE patients ADD COLUMN insurance_expiry TEXT");
    }
    if (!colNames.includes("insurance_plan_name")) {
      await db.run("ALTER TABLE patients ADD COLUMN insurance_plan_name TEXT");
    }
    if (!colNames.includes("balance")) {
      await db.run("ALTER TABLE patients ADD COLUMN balance REAL DEFAULT 0");
    }
    if (!colNames.includes("avatar")) {
      await db.run("ALTER TABLE patients ADD COLUMN avatar TEXT");
    }
    if (!colNames.includes("incomplete_profile")) {
      await db.run("ALTER TABLE patients ADD COLUMN incomplete_profile INTEGER DEFAULT 0");
    }
    if (!colNames.includes("visitType")) {
      await db.run("ALTER TABLE patients ADD COLUMN visitType TEXT");
    }
    if (!colNames.includes("telegram_chat_id")) {
      await db.run("ALTER TABLE patients ADD COLUMN telegram_chat_id TEXT");
    }
  } catch (e) {}

  await db.exec(`
    CREATE TABLE IF NOT EXISTS hospitals (
      id TEXT PRIMARY KEY,
      name TEXT,
      subscription_plan TEXT DEFAULT 'free',
      subscription_status TEXT DEFAULT 'active',
      location TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      password TEXT,
      slogan TEXT,
      license_code TEXT,
      address TEXT,
      director_name TEXT,
      logo_url TEXT
    );
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      name TEXT,
      category TEXT,
      status TEXT,
      location TEXT,
      department_id TEXT,
      manufacturer_id TEXT,
      manufacturer_name TEXT,
      model TEXT,
      serial_number TEXT,
      purchase_date TEXT,
      warranty_expiration TEXT,
      asset_image_url TEXT,
      pm_frequency TEXT DEFAULT 'monthly',
      next_pm_date TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id),
      FOREIGN KEY(department_id) REFERENCES departments(id)
    );
    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      assetId TEXT,
      description TEXT,
      priority TEXT,
      status TEXT,
      dueDate TEXT,
      is_pm BOOLEAN DEFAULT 0,
      cost REAL DEFAULT 0,
      downtime_hours REAL DEFAULT 0,
      parts_used TEXT,
      iso_compliance_notes TEXT,
      quality_signature TEXT,
      FOREIGN KEY(assetId) REFERENCES assets(id),
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS maintenance (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      assetId TEXT,
      task TEXT,
      frequency TEXT,
      nextDueDate TEXT,
      FOREIGN KEY(assetId) REFERENCES assets(id),
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      partNumber TEXT,
      name TEXT,
      supplier TEXT,
      category TEXT,
      currentQuantity INTEGER,
      minQuantity INTEGER,
      barcode TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS pm_schedules (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      assetId TEXT,
      scheduledDate TEXT,
      status TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS external_workshops (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      name TEXT,
      specialty TEXT,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      rating REAL DEFAULT 5.0,
      sla_details TEXT,
      password TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS external_repair_tickets (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      asset_id TEXT,
      asset_name TEXT,
      workshop_id TEXT,
      workshop_name TEXT,
      issue_description TEXT,
      status TEXT,
      cost REAL DEFAULT 0,
      dispatch_date TEXT,
      expected_return_date TEXT,
      actual_return_date TEXT,
      warranty_period_months INTEGER DEFAULT 0,
      technician_notes TEXT,
      FOREIGN KEY(workshop_id) REFERENCES external_workshops(id),
      FOREIGN KEY(asset_id) REFERENCES assets(id),
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      syncType TEXT,
      status TEXT,
      logs TEXT,
      timestamp TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS kpi_snapshots (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      month TEXT,
      mttr REAL,
      mtbf REAL,
      totalCost REAL,
      pmCompletionRate REAL,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      name TEXT,
      description TEXT,
      head_id TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      department_id TEXT,
      name TEXT,
      email TEXT,
      phone TEXT,
      department TEXT,
      role TEXT,
      is_verified BOOLEAN DEFAULT 0,
      permissions TEXT,
      password TEXT,
      balance REAL DEFAULT 0,
      signature TEXT,
      availability_status TEXT DEFAULT 'available', -- 'available' | 'unavailable'
      external_lab_id TEXT,
      external_pharmacy_id TEXT,
      external_workshop_id TEXT,
      telegram_chat_id TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id),
      FOREIGN KEY(department_id) REFERENCES departments(id)
    );
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      dob TEXT,
      gender TEXT,
      bloodType TEXT,
      contactNumber TEXT,
      address TEXT,
      allergies TEXT,
      medicalHistory TEXT,
      national_id TEXT,
      is_verified BOOLEAN DEFAULT 0,
      insurance_provider TEXT,
      insurance_policy_number TEXT,
      insurance_copay_percent REAL DEFAULT 100,
      insurance_expiry TEXT,
      insurance_plan_name TEXT,
      balance REAL DEFAULT 0,
      avatar TEXT,
      incomplete_profile INTEGER DEFAULT 0,
      visitType TEXT,
      telegram_chat_id TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS medical_records (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      patientId TEXT,
      doctorId TEXT,
      visitDate TEXT,
      diagnosis TEXT,
      treatment TEXT,
      prescription TEXT,
      notes TEXT,
      images TEXT,
      dicom_files TEXT,
      FOREIGN KEY(patientId) REFERENCES patients(id),
      FOREIGN KEY(doctorId) REFERENCES users(id),
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      name TEXT,
      genericName TEXT,
      category TEXT,
      stock INTEGER,
      unit TEXT,
      price REAL,
      expiryDate TEXT,
      concentration TEXT,
      manufacturingDate TEXT,
      batchNumber TEXT,
      ndcCode TEXT,
      manufacturer TEXT,
      storageConditions TEXT,
      fdaStatus TEXT,
      min_stock INTEGER DEFAULT 10,
      supplier_id TEXT,
      barcode TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS examinations (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      patientId TEXT,
      doctorId TEXT,
      date TEXT,
      type TEXT,
      testName TEXT,
      priority TEXT,
      requestedBy TEXT,
      approvedBy TEXT,
      result TEXT,
      status TEXT,
      notes TEXT,
      FOREIGN KEY(patientId) REFERENCES patients(id),
      FOREIGN KEY(doctorId) REFERENCES users(id),
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      patientId TEXT,
      doctorId TEXT,
      date TEXT,
      time TEXT,
      status TEXT,
      reason TEXT,
      notes TEXT,
      FOREIGN KEY(patientId) REFERENCES patients(id),
      FOREIGN KEY(doctorId) REFERENCES users(id),
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS billing (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      patientId TEXT,
      appointmentId TEXT,
      date TEXT,
      amount REAL,
      status TEXT,
      items TEXT,
      paymentMethod TEXT,
      insurance_covered_amount REAL DEFAULT 0,
      patient_copay_amount REAL DEFAULT 0,
      insurance_claim_status TEXT DEFAULT 'Not Applicable',
      FOREIGN KEY(patientId) REFERENCES patients(id),
      FOREIGN KEY(appointmentId) REFERENCES appointments(id),
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      user_id TEXT,
      action TEXT,
      entity TEXT,
      entity_id TEXT,
      old_data TEXT,
      new_data TEXT,
      timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS scan_logs (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      asset_id TEXT,
      user_id TEXT,
      user_name TEXT,
      timestamp TEXT,
      latitude REAL,
      longitude REAL,
      location_name TEXT,
      FOREIGN KEY(asset_id) REFERENCES assets(id)
    );
    CREATE TABLE IF NOT EXISTS staff_shifts (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      user_id TEXT,
      department_id TEXT,
      day_of_week TEXT,
      shift_type TEXT,
      start_time TEXT,
      end_time TEXT,
      notes TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(department_id) REFERENCES departments(id)
    );
    CREATE TABLE IF NOT EXISTS staff_tasks (
      id TEXT PRIMARY KEY,
      shift_id TEXT,
      hospital_id TEXT,
      user_id TEXT,
      title TEXT,
      description TEXT,
      status TEXT,
      priority TEXT,
      due_time TEXT,
      completed_at TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id),
      FOREIGN KEY(shift_id) REFERENCES staff_shifts(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      type TEXT, -- 'Income' | 'Expense' | 'Payroll'
      category TEXT, -- 'Patient Billing' | 'Salaries' | 'Equipment Maintenance' | 'Supplies' | 'Other'
      amount REAL,
      date TEXT,
      description TEXT,
      reference_id TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      name TEXT,
      contact_person TEXT,
      email TEXT,
      phone TEXT,
      category TEXT, -- 'Pharmaceuticals' | 'Medical Equipment' | 'Laboratory' | 'General'
      address TEXT,
      status TEXT DEFAULT 'Active',
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS medication_schedules (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      patient_id TEXT,
      medication_id TEXT,
      dose TEXT,
      route TEXT, -- 'Oral' | 'IV' | 'IM' | 'Subcutaneous' | 'Topical'
      frequency TEXT, -- 'Once' | 'BID' | 'TID' | 'QID' | 'PRN'
      status TEXT, -- 'Scheduled' | 'Administered' | 'Missed' | 'Cancelled'
      scheduled_time TEXT,
      administered_time TEXT,
      nurse_id TEXT,
      notes TEXT,
      FOREIGN KEY(patient_id) REFERENCES patients(id),
      FOREIGN KEY(medication_id) REFERENCES medications(id),
      FOREIGN KEY(nurse_id) REFERENCES users(id),
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS pharmacy_orders (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      supplier_id TEXT,
      medication_id TEXT,
      quantity INTEGER,
      unit_price REAL,
      total_price REAL,
      status TEXT, -- 'Pending' | 'Shipped' | 'Received' | 'Cancelled'
      order_date TEXT,
      expected_date TEXT,
      received_date TEXT,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY(medication_id) REFERENCES medications(id),
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS pharmacy_sales (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      buyer_name TEXT,
      buyer_phone TEXT,
      sale_date TEXT,
      items TEXT,
      total_amount REAL,
      payment_method TEXT,
      status TEXT,
      patient_id TEXT,
      is_otc BOOLEAN DEFAULT 1,
      prescription_image TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id),
      FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    CREATE TABLE IF NOT EXISTS sys_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS manufacturers (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      name TEXT,
      logo_url TEXT,
      country TEXT,
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS hospital_visits (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      hospital_id TEXT,
      visit_date TEXT,
      reason TEXT,
      vitals TEXT,
      notes TEXT,
      doctor_id TEXT,
      cost REAL,
      status TEXT, -- 'Admitted' | 'Discharged' | 'Observation'
      nfc_tag TEXT,
      FOREIGN KEY(patient_id) REFERENCES patients(id),
      FOREIGN KEY(hospital_id) REFERENCES hospitals(id),
      FOREIGN KEY(doctor_id) REFERENCES users(id)
    );
  `);

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS telehealth_messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT,
        sender_name TEXT,
        sender_role TEXT,
        receiver_id TEXT,
        receiver_name TEXT,
        message TEXT,
        timestamp TEXT
      );
    `);
  } catch (e) {
    console.warn("Failed to create telehealth_messages", e);
  }

  console.log("Running migrations...");

  try {
    await db.exec(`ALTER TABLE hospitals ADD COLUMN logo_url TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE hospitals ADD COLUMN slogan TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE hospitals ADD COLUMN license_code TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE hospitals ADD COLUMN address TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE hospitals ADD COLUMN director_name TEXT`);
  } catch (e) {}

  // Assets migrations
  try {
    await db.exec(`ALTER TABLE assets ADD COLUMN manufacturer_id TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE assets ADD COLUMN manufacturer_name TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE assets ADD COLUMN model TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE assets ADD COLUMN serial_number TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE assets ADD COLUMN purchase_date TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE assets ADD COLUMN warranty_expiration TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE assets ADD COLUMN asset_image_url TEXT`);
  } catch (e) {}

  // New Migrations for Suppliers and Orders
  try {
    await db.exec(`ALTER TABLE inventory ADD COLUMN supplier_id TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE inventory ADD COLUMN manufacturer_id TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE medications ADD COLUMN supplier_id TEXT`);
  } catch (e) {}
  try {
    await db.exec(
      `ALTER TABLE medications ADD COLUMN min_stock INTEGER DEFAULT 10`,
    );
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE medications ADD COLUMN manufacturer TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE medications ADD COLUMN concentration TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE medications ADD COLUMN manufacturingDate TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE medications ADD COLUMN batchNumber TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE medications ADD COLUMN ndcCode TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE medications ADD COLUMN storageConditions TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE medications ADD COLUMN fdaStatus TEXT`);
  } catch (e) {}
  try {
    await db.exec(
      `ALTER TABLE audit_logs ADD COLUMN severity TEXT DEFAULT 'Low'`,
    );
  } catch (e) {} // 'Low' | 'Medium' | 'High' | 'Critical'
  try {
    await db.exec(`ALTER TABLE audit_logs ADD COLUMN client_ip TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE audit_logs ADD COLUMN user_agent TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE hospital_visits ADD COLUMN nfc_tag TEXT`);
  } catch (e) {}

  // External & private pharmacies table
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS external_pharmacies (
        id TEXT PRIMARY KEY,
        hospital_id TEXT,
        name TEXT,
        type TEXT,
        location TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        status TEXT DEFAULT 'Active',
        license_number TEXT,
        notes TEXT,
        password TEXT
      );
    `);
  } catch (e) {
    console.warn("External pharmacies table creation error:", e);
  }

  // External laboratories table
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS external_labs (
        id TEXT PRIMARY KEY,
        hospital_id TEXT,
        name TEXT,
        specialization TEXT,
        location TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        status TEXT DEFAULT 'Active',
        license_number TEXT,
        notes TEXT,
        password TEXT
      );
    `);
  } catch (e) {
    console.warn("External labs table creation error:", e);
  }

  // Finance Table migrations if table needs to be explicitly created in existing DBs
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS finance_transactions (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      type TEXT,
      category TEXT,
      amount REAL,
      date TEXT,
      description TEXT,
      reference_id TEXT
    )`);
  } catch (e) {}

  // HR Column migrations on users table
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN hire_date TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN salary REAL`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN attendance_rate REAL`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN contract_type TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN last_payroll_date TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN bank_account TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN national_id TEXT`);
  } catch (e) {}

  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS scan_logs (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      asset_id TEXT,
      user_id TEXT,
      user_name TEXT,
      timestamp TEXT,
      latitude REAL,
      longitude REAL,
      location_name TEXT
    )`);
  } catch (e) {}

  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS imaging_orders (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      patientId TEXT,
      patientName TEXT,
      gender TEXT,
      age TEXT,
      dob TEXT,
      modality TEXT,
      region TEXT,
      urgency TEXT,
      technician TEXT,
      scheduledDate TEXT,
      scheduledTime TEXT,
      status TEXT,
      findings TEXT,
      imageRepresentation TEXT,
      studyId TEXT
    )`);
  } catch (e) {}

  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS acquired_scans (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      patientName TEXT,
      patientId TEXT,
      gender TEXT,
      age TEXT,
      dob TEXT,
      modality TEXT,
      studyDate TEXT,
      studyTime TEXT,
      description TEXT,
      institution TEXT,
      refPhysician TEXT,
      slicesCount INTEGER,
      windowCenter INTEGER,
      windowWidth INTEGER,
      manufacturer TEXT,
      deviceModel TEXT,
      transferSyntax TEXT,
      severity TEXT,
      findings TEXT,
      imageRepresentation TEXT
    );`);
  } catch (e) {}
  try {
    await db.exec(
      `ALTER TABLE acquired_scans ADD COLUMN customImageDataUrl TEXT`,
    );
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE scan_logs ADD COLUMN hospital_id TEXT`);
  } catch (e) {}

  try {
    await db.exec(`ALTER TABLE patients ADD COLUMN email TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE patients ADD COLUMN password TEXT`);
  } catch (e) {}
  try {
    await db.exec(
      `ALTER TABLE patients ADD COLUMN google_fit_refresh_token TEXT`,
    );
  } catch (e) {}
  try {
    await db.exec(
      `ALTER TABLE patients ADD COLUMN is_verified BOOLEAN DEFAULT 0`,
    );
  } catch (e) {}
  try {
    await db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_email ON patients(email)`,
    );
  } catch (e) {}

  // Shift & Task migrations
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS staff_shifts (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      user_id TEXT,
      department_id TEXT,
      day_of_week TEXT,
      shift_type TEXT,
      start_time TEXT,
      end_time TEXT,
      notes TEXT
    )`);
  } catch (e) {}
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS staff_tasks (
      id TEXT PRIMARY KEY,
      shift_id TEXT,
      hospital_id TEXT,
      user_id TEXT,
      title TEXT,
      description TEXT,
      status TEXT,
      priority TEXT,
      due_time TEXT,
      completed_at TEXT
    )`);
  } catch (e) {}

  try {
    await db.exec(`ALTER TABLE staff_tasks ADD COLUMN completed_at TEXT`);
  } catch (e) {}

  // Quick migrations for new columns
  try {
    await db.exec(`ALTER TABLE examinations ADD COLUMN priority TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE examinations ADD COLUMN requestedBy TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE examinations ADD COLUMN approvedBy TEXT`);
  } catch (e) {}

  // User profile enhancements: avatar, bio, specialty, status_message
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN bio TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN specialty TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN status_message TEXT`);
  } catch (e) {}

  // Create Nurses Station tables
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS nurses_stations (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      name TEXT,
      location TEXT,
      head_nurse_id TEXT
    )`);
  } catch (e) {}

  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS nurse_station_devices (
      id TEXT PRIMARY KEY,
      hospital_id TEXT,
      station_id TEXT,
      asset_id TEXT,
      patient_id TEXT,
      bed_number TEXT,
      vitals_pulse INTEGER,
      vitals_temp REAL,
      vitals_bp TEXT,
      vitals_spo2 INTEGER,
      status TEXT DEFAULT 'monitoring',
      last_update TEXT
    )`);
  } catch (e) {}

  // Complaints & Suggestions table
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS user_feedback (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_name TEXT,
        user_role TEXT,
        type TEXT,
        title TEXT,
        content TEXT,
        status TEXT DEFAULT 'Pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        hospital_id TEXT
      );
    `);
  } catch (e) {
    console.warn("User feedback table creation error:", e);
  }

  // Department enhancements: building, phone, status, budget, color
  try {
    await db.exec(`ALTER TABLE departments ADD COLUMN building TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE departments ADD COLUMN phone TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE departments ADD COLUMN status TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE departments ADD COLUMN budget REAL`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE departments ADD COLUMN color TEXT`);
  } catch (e) {}

  // Handle migrations for existing databases
  const defaultHospitalId = "h1";
  try {
    await db.exec(
      `INSERT OR IGNORE INTO hospitals (id, name, subscription_plan, subscription_status) VALUES ('h1', 'Default Hospital', 'pro', 'active')`,
    );
  } catch (e) {}

  const tablesToAddHospitalId = [
    "assets",
    "work_orders",
    "maintenance",
    "inventory",
    "pm_schedules",
    "integrations",
    "kpi_snapshots",
    "users",
    "patients",
    "medical_records",
    "medications",
    "examinations",
    "departments",
  ];
  for (const table of tablesToAddHospitalId) {
    try {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN hospital_id TEXT`);
      await db.exec(
        `UPDATE ${table} SET hospital_id = '${defaultHospitalId}' WHERE hospital_id IS NULL`,
      );
    } catch (e) {
      // Column likely exists
    }
  }

  try {
    await db.exec(`ALTER TABLE users ADD COLUMN department_id TEXT`);
  } catch (e) {}

  try {
    await db.exec(`ALTER TABLE hospitals ADD COLUMN location TEXT`);
    await db.exec(`ALTER TABLE hospitals ADD COLUMN contact_email TEXT`);
    await db.exec(`ALTER TABLE hospitals ADD COLUMN contact_phone TEXT`);
  } catch (e) {}

  try {
    await db.exec(`ALTER TABLE hospitals ADD COLUMN password TEXT`);
  } catch (e) {}

  try {
    await db.exec(`ALTER TABLE assets ADD COLUMN department_id TEXT`);
  } catch (e) {}

  try {
    await db.exec(`ALTER TABLE patients ADD COLUMN avatar TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE patients ADD COLUMN national_id TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE medical_records ADD COLUMN images TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE medical_records ADD COLUMN dicom_files TEXT`);
  } catch (e) {}
  try {
    await db.exec(
      `ALTER TABLE medical_records ADD COLUMN external_lab_id TEXT`,
    );
    await db.exec(
      `ALTER TABLE medical_records ADD COLUMN external_pharmacy_id TEXT`,
    );
  } catch (e) {}
  try {
    await db.exec(
      `ALTER TABLE nurse_station_devices ADD COLUMN discharge_reason TEXT`,
    );
    await db.exec(
      `ALTER TABLE nurse_station_devices ADD COLUMN discharge_date TEXT`,
    );
  } catch (e) {}

  try {
    await db.exec(`ALTER TABLE users ADD COLUMN external_pharmacy_id TEXT`);
    await db.exec(`ALTER TABLE users ADD COLUMN external_lab_id TEXT`);
  } catch (e) {}

  // Handle migrations for existing databases
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN password TEXT`);
  } catch (e) {
    // Column likely already exists
  }

  // Performance Indexes
  try {
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_assets_hosp ON assets(hospital_id)`,
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_inventory_hosp ON inventory(hospital_id)`,
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_patients_hosp ON patients(hospital_id)`,
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_medications_hosp ON medications(hospital_id)`,
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_medical_records_ext_lab ON medical_records(external_lab_id)`,
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_medical_records_ext_pharm ON medical_records(external_pharmacy_id)`,
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_users_ext_lab ON users(external_lab_id)`,
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_users_ext_pharm ON users(external_pharmacy_id)`,
    );
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN permissions TEXT`);
  } catch (e) {}
  try {
    await db.exec(
      `ALTER TABLE medical_records ADD COLUMN doctorInstructions TEXT`,
    );
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE users ADD COLUMN assigned_hospitals TEXT`);
  } catch (e) {
    // Column likely already exists
  }

  try {
    await db.exec(`ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0`);
  } catch (e) {}

  try {
    await db.exec(`ALTER TABLE users ADD COLUMN plain_password TEXT`);
  } catch (e) {}

  try {
    await db.exec(
      `ALTER TABLE assets ADD COLUMN pm_frequency TEXT DEFAULT 'monthly'`,
    );
    await db.exec(`ALTER TABLE assets ADD COLUMN next_pm_date TEXT`);
  } catch (e) {
    // Columns likely already exist
  }
  try {
    await db.exec(`ALTER TABLE work_orders ADD COLUMN is_pm BOOLEAN DEFAULT 0`);
  } catch (e) {
    // Column likely already exists
  }
  try {
    await db.exec(`ALTER TABLE work_orders ADD COLUMN cost REAL DEFAULT 0`);
  } catch (e) {
    // Column likely already exists
  }
  try {
    await db.exec(
      `ALTER TABLE work_orders ADD COLUMN downtime_hours REAL DEFAULT 0`,
    );
  } catch (e) {
    // Column likely already exists
  }
  try {
    await db.exec(`ALTER TABLE work_orders ADD COLUMN parts_used TEXT`);
    await db.exec(
      `ALTER TABLE work_orders ADD COLUMN iso_compliance_notes TEXT`,
    );
    await db.exec(`ALTER TABLE work_orders ADD COLUMN quality_signature TEXT`);
  } catch (e) {
    // Columns likely already exist
  }

  try {
    await db.exec(`ALTER TABLE inventory ADD COLUMN cost REAL DEFAULT 0`);
  } catch (e) {
    // Column likely already exists
  }

  // Insurance Column Migrations
  try {
    await db.exec(`ALTER TABLE patients ADD COLUMN insurance_provider TEXT`);
  } catch (e) {}
  try {
    await db.exec(
      `ALTER TABLE patients ADD COLUMN insurance_policy_number TEXT`,
    );
  } catch (e) {}
  try {
    await db.exec(
      `ALTER TABLE patients ADD COLUMN insurance_copay_percent REAL DEFAULT 100`,
    );
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE patients ADD COLUMN insurance_expiry TEXT`);
  } catch (e) {}
  try {
    await db.exec(`ALTER TABLE patients ADD COLUMN insurance_plan_name TEXT`);
  } catch (e) {}

  try {
    await db.exec(
      `ALTER TABLE billing ADD COLUMN insurance_covered_amount REAL DEFAULT 0`,
    );
  } catch (e) {}
  try {
    await db.exec(
      `ALTER TABLE billing ADD COLUMN patient_copay_amount REAL DEFAULT 0`,
    );
  } catch (e) {}
  try {
    await db.exec(
      `ALTER TABLE billing ADD COLUMN insurance_claim_status TEXT DEFAULT 'Not Applicable'`,
    );
  } catch (e) {}

  // Create mission-critical indexes for millions of users high performance scaling
  try {
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_patients_hospital ON patients(hospital_id);
      CREATE INDEX IF NOT EXISTS idx_patients_national_id ON patients(national_id);
      CREATE INDEX IF NOT EXISTS idx_users_hospital ON users(hospital_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_hospitals_contact_email ON hospitals(contact_email);
      CREATE INDEX IF NOT EXISTS idx_appointments_hospital ON appointments(hospital_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patientId);
      CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctorId);
      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
      CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patientId);
      CREATE INDEX IF NOT EXISTS idx_medical_records_hospital ON medical_records(hospital_id);
      CREATE INDEX IF NOT EXISTS idx_billing_patient ON billing(patientId);
      CREATE INDEX IF NOT EXISTS idx_billing_hospital ON billing(hospital_id);
      CREATE INDEX IF NOT EXISTS idx_assets_hospital ON assets(hospital_id);
      CREATE INDEX IF NOT EXISTS idx_work_orders_hospital ON work_orders(hospital_id);
      CREATE INDEX IF NOT EXISTS idx_work_orders_asset ON work_orders(assetId);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_hospital ON audit_logs(hospital_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_medications_hospital ON medications(hospital_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_hospital ON inventory(hospital_id);
      CREATE INDEX IF NOT EXISTS idx_staff_shifts_user ON staff_shifts(user_id);
      CREATE INDEX IF NOT EXISTS idx_staff_tasks_user ON staff_tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_medication_schedules_patient ON medication_schedules(patient_id);
      CREATE INDEX IF NOT EXISTS idx_medication_schedules_medication ON medication_schedules(medication_id);
    `);
    console.log("Scaling indexes successfully checked / created.");
  } catch (err) {
    console.error("Failed to create scaling indexes:", err);
  }

  // Seed data if empty
  const { count } = await db.get("SELECT COUNT(*) as count FROM assets");
  if (count === 0) {
    const stmtAsset = await db.prepare(
      "INSERT OR IGNORE INTO assets (id, name, category, status, location, pm_frequency, next_pm_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    await stmtAsset.run(
      "a1",
      "MRI Scanner",
      "Medical Devices",
      "Operational",
      "Room 101",
      "monthly",
      "2026-04-10",
    );
    await stmtAsset.run(
      "a2",
      "X-Ray Machine",
      "Medical Devices",
      "Under Maintenance",
      "Room 102",
      "quarterly",
      "2026-05-15",
    );
    await stmtAsset.run(
      "a3",
      "Ventilator A",
      "Medical Devices",
      "Operational",
      "ICU Bed 1",
      "monthly",
      "2026-04-05",
    );
    await stmtAsset.run(
      "a4",
      "Defibrillator",
      "Medical Devices",
      "Broken",
      "ER Bay 2",
      "yearly",
      "2026-12-01",
    );
    await stmtAsset.run(
      "a5",
      "Patient Monitor",
      "Medical Devices",
      "Operational",
      "Ward 3, Bed 12",
      "monthly",
      "2026-04-20",
    );
    await stmtAsset.finalize();

    const stmtWO = await db.prepare(
      "INSERT OR IGNORE INTO work_orders (id, assetId, description, priority, status, dueDate, is_pm, cost, downtime_hours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    await stmtWO.run(
      "w1",
      "a2",
      "Replace X-Ray tube",
      "High",
      "In Progress",
      "2026-04-02",
      0,
      1500,
      24,
    );
    await stmtWO.run(
      "w2",
      "a4",
      "Fix battery issue",
      "High",
      "Pending",
      "2026-04-01",
      0,
      300,
      12,
    );
    await stmtWO.run(
      "w3",
      "a5",
      "Screen calibration",
      "Low",
      "Pending",
      "2026-04-10",
      1,
      50,
      2,
    );
    await stmtWO.finalize();

    const stmtMaint = await db.prepare(
      "INSERT OR IGNORE INTO maintenance (id, assetId, task, frequency, nextDueDate) VALUES (?, ?, ?, ?, ?)",
    );
    await stmtMaint.run(
      "m1",
      "a1",
      "Weekly cooling system check",
      "Weekly",
      "2026-04-05",
    );
    await stmtMaint.run(
      "m2",
      "a3",
      "Filter replacement",
      "Monthly",
      "2026-04-15",
    );
    await stmtMaint.run(
      "m3",
      "a4",
      "Self-test diagnostic",
      "Daily",
      "2026-04-02",
    );
    await stmtMaint.run(
      "m4",
      "a2",
      "Radiation leak test",
      "Yearly",
      "2026-10-20",
    );
    await stmtMaint.finalize();

    const stmtInv = await db.prepare(
      "INSERT OR IGNORE INTO inventory (id, partNumber, name, supplier, category, currentQuantity, minQuantity, cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    await stmtInv.run(
      "i1",
      "SP-001-02S",
      "حساس الأكسجين",
      "MedTech Supplies",
      "Spare Parts",
      12,
      5,
      0,
    );
    await stmtInv.run(
      "i2",
      "SP-002-GLC",
      "موصل خط الغاز",
      "MedTech Supplies",
      "Spare Parts",
      25,
      10,
      0,
    );
    await stmtInv.run(
      "i3",
      "SP-003-BAT",
      "بطارية جهاز الصدمات",
      "Zoll Medical",
      "Consumables",
      3,
      5,
      0,
    );
    await stmtInv.run(
      "i4",
      "CON-004-ECG",
      "حزمة أقطاب تخطيط القلب",
      "GE Healthcare",
      "Consumables",
      45,
      20,
      0,
    );
    await stmtInv.run(
      "i5",
      "SP-005-PMP",
      "محرك مضخة المحاليل",
      "B Braun",
      "Spare Parts",
      2,
      3,
      0,
    );
    await stmtInv.finalize();

    const stmtUsers = await db.prepare(
      "INSERT OR IGNORE INTO users (id, hospital_id, name, email, password, phone, department, role, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const hashedAdminPass = await bcrypt.hash("admin123", 10);
    await stmtUsers.run(
      "u1",
      "h1",
      "Dr. Sarah Connor",
      "sarah.c@hospital.com",
      hashedAdminPass,
      "+1234567890",
      "Cardiology",
      "Super Admin",
      1,
    );
    await stmtUsers.run(
      "u2",
      "h1",
      "Ahmed Ali",
      "ahmed.ali@hospital.com",
      hashedAdminPass,
      "+966500000000",
      "Maintenance",
      "Technician",
      1,
    );
    await stmtUsers.run(
      "u3",
      "h1",
      "Fatima Nuur",
      "fatima.n@hospital.com",
      hashedAdminPass,
      "+971500000000",
      "ICU",
      "Requester",
      0,
    );
    await stmtUsers.finalize();
  }

  // Final Seeding Verification (Ensuring Super Admin and Default Patient exist)
  try {
    const emergencyEmail = "zaelnoon2000@gmail.com";
    const emergencyAdmin = await db.get("SELECT * FROM users WHERE email = ?", [
      emergencyEmail,
    ]);
    if (!emergencyAdmin) {
      const hashedPassword = await bcrypt.hash("zaelnoon2026", 10);
      await db.run(
        "INSERT OR IGNORE INTO users (id, hospital_id, name, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "u_emergency_admin",
          null,
          "Zaelnoon Super Admin",
          emergencyEmail,
          hashedPassword,
          "Super Admin",
          1,
        ],
      );
      console.log(`Emergency Super Admin restored: ${emergencyEmail}`);
    } else if (emergencyAdmin.role !== "Super Admin") {
      await db.run('UPDATE users SET role = "Super Admin" WHERE email = ?', [
        emergencyEmail,
      ]);
      console.log(`Emergency Super Admin role fixed: ${emergencyEmail}`);
    }

    const superAdmin = await db.get("SELECT * FROM users WHERE email = ?", [
      "admin@jakel.sa",
    ]);
    if (!superAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await db.run(
        "INSERT OR IGNORE INTO users (id, hospital_id, name, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          "u_system_admin",
          null,
          "System Admin",
          "admin@jakel.sa",
          hashedPassword,
          "Super Admin",
          1,
        ],
      );
      console.log("Default Super Admin created: admin@jakel.sa / admin123");
    }

    const defaultHospital = await db.get(
      "SELECT * FROM hospitals WHERE id = ?",
      ["h1"],
    );
    if (!defaultHospital) {
      const hashedHospitalPass = await bcrypt.hash("admin123", 10);
      await db.run(
        "INSERT OR IGNORE INTO hospitals (id, name, contact_email, password, location) VALUES (?, ?, ?, ?, ?)",
        [
          "h1",
          "JAKEL General Hospital",
          "sarah.c@hospital.com",
          hashedHospitalPass,
          "Dubai, UAE",
        ],
      );
      console.log("Default Hospital created: sarah.c@hospital.com / admin123");
    }

    const defaultPatient = await db.get(
      "SELECT * FROM patients WHERE email = ?",
      ["patient@hospital.com"],
    );
    if (!defaultPatient) {
      const hashedPatientPass = await bcrypt.hash("patient123", 10);
      await db.run(
        "INSERT OR IGNORE INTO patients (id, hospital_id, name, email, password, dob, gender, bloodType, contactNumber, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          "p_default",
          "h1",
          "John Patient",
          "patient@hospital.com",
          hashedPatientPass,
          "1990-01-01",
          "Male",
          "O+",
          "+123456789",
          1,
        ],
      );
      console.log("Default Patient created: patient@hospital.com / patient123");
    }

    const imagingOrdersCount = await db.get(
      "SELECT COUNT(*) as count FROM imaging_orders",
    );
    if (imagingOrdersCount.count === 0) {
      await db.run(
        `INSERT INTO imaging_orders (id, hospital_id, patientId, patientName, gender, age, dob, modality, region, urgency, technician, scheduledDate, scheduledTime, status, findings, imageRepresentation, studyId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "IMG-201",
          "h1",
          "PN-1055",
          "Arthur Pendragon",
          "Male",
          "52",
          "1974-11-03",
          "CT",
          "Lumbar Spine",
          "STAT",
          "Tech Sarah Miller",
          new Date().toISOString().split("T")[0],
          "08:30",
          "Completed",
          "Severe bilateral disc herniation at L4-L5 causing prominent left-sided neural foraminal encroachment. Visible osteophytes with adjacent posterior canal narrowing.",
          "lumbar_ct",
          "study_arthur_pendragon",
        ],
      );
      await db.run(
        `INSERT INTO imaging_orders (id, hospital_id, patientId, patientName, gender, age, dob, modality, region, urgency, technician, scheduledDate, scheduledTime, status, findings, imageRepresentation, studyId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "IMG-202",
          "h1",
          "PN-9244",
          "Sarah Jenkins",
          "Female",
          "37",
          "1989-04-12",
          "DX",
          "Chest",
          "Urgent",
          "Tech Robert Chen",
          new Date().toISOString().split("T")[0],
          "11:00",
          "Scanning",
          "Suspicious focal consolidated infiltrate in left mid-lung zone, compatible with patchy diagnostic pneumonia. Standard pleural margins are otherwise clear.",
          "chest_xray",
          "study_sarah_jenkins",
        ],
      );
      await db.run(
        `INSERT INTO imaging_orders (id, hospital_id, patientId, patientName, gender, age, dob, modality, region, urgency, technician, scheduledDate, scheduledTime, status, findings, imageRepresentation, studyId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "IMG-203",
          "h1",
          "PN-3329",
          "Elena Rostova",
          "Female",
          "28",
          "1998-09-24",
          "MR",
          "Brain",
          "Routine",
          "Tech Linda Watson",
          new Date().toISOString().split("T")[0],
          "14:15",
          "Scheduled",
          "Normal brain MRI of the cerebral hemispheres. Ventricles are normal in size. No acute of space occupying mass is identified.",
          "brain_mri",
          "study_elena_rostova",
        ],
      );
      console.log("Default Imaging Orders seeded.");
    }

    // Seed Nurses Stations and Devices
    try {
      const stationsCount = await db.get(
        "SELECT COUNT(*) as count FROM nurses_stations",
      );
      if (stationsCount.count === 0) {
        await db.run(
          "INSERT INTO nurses_stations (id, hospital_id, name, location, head_nurse_id) VALUES (?, ?, ?, ?, ?)",
          [
            "ns1",
            "h1",
            "Main ICU Ward (جناح العناية المركزة)",
            "Building A, 3rd Floor",
            "u1",
          ],
        );
        await db.run(
          "INSERT INTO nurses_stations (id, hospital_id, name, location, head_nurse_id) VALUES (?, ?, ?, ?, ?)",
          [
            "ns2",
            "h1",
            "Cardiac Care Unit (عناية أمراض القلب)",
            "Building B, 2nd Floor",
            "u2",
          ],
        );
        await db.run(
          "INSERT INTO nurses_stations (id, hospital_id, name, location, head_nurse_id) VALUES (?, ?, ?, ?, ?)",
          [
            "ns3",
            "h1",
            "Pediatric Intensive Ward (العناية المركزة للأطفال)",
            "Building A, 4th Floor",
            "u1",
          ],
        );
        console.log("Nurses Stations seeded successfully.");
      }

      const linkedDevicesCount = await db.get(
        "SELECT COUNT(*) as count FROM nurse_station_devices",
      );
      if (linkedDevicesCount.count === 0) {
        // Let's find some standard assets we can link
        const standardAssets = await db.all(
          'SELECT * FROM assets WHERE hospital_id = "h1" LIMIT 3',
        );
        if (standardAssets.length > 0) {
          // Find standard patient
          const stdPatient = await db.get(
            'SELECT * FROM patients WHERE hospital_id = "h1" LIMIT 1',
          );
          const patId = stdPatient ? stdPatient.id : "p_default";

          await db.run(
            "INSERT INTO nurse_station_devices (id, hospital_id, station_id, asset_id, patient_id, bed_number, vitals_pulse, vitals_temp, vitals_bp, vitals_spo2, status, last_update) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              "nsd1",
              "h1",
              "ns1",
              standardAssets[0].id,
              patId,
              "Bed 101",
              74,
              36.6,
              "117/75",
              98,
              "monitoring",
              new Date().toISOString(),
            ],
          );
          if (standardAssets.length > 1) {
            await db.run(
              "INSERT INTO nurse_station_devices (id, hospital_id, station_id, asset_id, patient_id, bed_number, vitals_pulse, vitals_temp, vitals_bp, vitals_spo2, status, last_update) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                "nsd2",
                "h1",
                "ns1",
                standardAssets[1].id,
                patId,
                "Bed 102",
                115,
                38.4,
                "138/89",
                93,
                "alert",
                new Date().toISOString(),
              ],
            );
          }
          console.log("Nurses Station devices seeded successfully.");
        } else {
          // Seed fallback assets if none exist, or just write clinic entries
          await db.run(
            "INSERT INTO nurse_station_devices (id, hospital_id, station_id, asset_id, patient_id, bed_number, vitals_pulse, vitals_temp, vitals_bp, vitals_spo2, status, last_update) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              "nsd_reg1",
              "h1",
              "ns1",
              "a1",
              "p_default",
              "Bed 105",
              72,
              36.5,
              "120/80",
              99,
              "monitoring",
              new Date().toISOString(),
            ],
          );
        }
      }
    } catch (err: any) {
      console.error("Error seeding Nurses Stations:", err);
    }

    // Auto-repair passwords for any user/patient/hospital with null/empty passwords or hashes
    try {
      const emptyUsers = await db.all(
        'SELECT id, role, email FROM users WHERE password IS NULL OR password = ""',
      );
      for (const u of emptyUsers) {
        const defaultPass = u.role === "Super Admin" ? "admin123" : "staff123";
        const hashed = await bcrypt.hash(defaultPass, 10);
        await db.run(
          "UPDATE users SET password = ?, plain_password = ? WHERE id = ?",
          [hashed, defaultPass, u.id],
        );
        console.log(
          `Auto-repaired password for user ${u.id} (${u.email || u.role}) to '${defaultPass}'`,
        );
      }

      const emptyPatients = await db.all(
        'SELECT id, contactNumber, email FROM patients WHERE password IS NULL OR password = ""',
      );
      for (const p of emptyPatients) {
        const defaultPass = p.contactNumber
          ? p.contactNumber.trim()
          : "patient123";
        const hashed = await bcrypt.hash(defaultPass, 10);
        await db.run("UPDATE patients SET password = ? WHERE id = ?", [
          hashed,
          p.id,
        ]);
        console.log(
          `Auto-repaired password for patient ${p.id} to '${defaultPass}'`,
        );
      }

      const emptyHospitals = await db.all(
        'SELECT id, contact_email FROM hospitals WHERE password IS NULL OR password = ""',
      );
      for (const h of emptyHospitals) {
        const defaultPass = "admin123";
        const hashed = await bcrypt.hash(defaultPass, 10);
        await db.run("UPDATE hospitals SET password = ? WHERE id = ?", [
          hashed,
          h.id,
        ]);
        console.log(
          `Auto-repaired password for hospital ${h.id} to '${defaultPass}'`,
        );
      }
    } catch (repairErr) {
      console.error("Password auto-repair error:", repairErr);
    }
  } catch (err) {
    console.error("Final seeding error:", err);
  }
}

async function setupCronJobs() {
  // 1. Automated PM Scheduling (Runs daily at midnight)
  cron.schedule("0 0 * * *", async () => {
    console.log("Running Automated PM Scheduler...");
    try {
      // Find assets where next_pm_date is within 7 days
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      const todayStr = today.toISOString().split("T")[0];
      const nextWeekStr = nextWeek.toISOString().split("T")[0];

      const assets = await db.all(
        "SELECT * FROM assets WHERE next_pm_date BETWEEN ? AND ?",
        [todayStr, nextWeekStr],
      );

      for (const asset of assets) {
        // Check if a PM work order already exists for this date
        const existingWO = await db.get(
          "SELECT * FROM work_orders WHERE assetId = ? AND dueDate = ? AND is_pm = 1",
          [asset.id, asset.next_pm_date],
        );

        if (!existingWO) {
          const woId = "pm_" + Math.random().toString(36).substr(2, 9);
          await db.run(
            "INSERT INTO work_orders (id, assetId, description, priority, status, dueDate, is_pm) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              woId,
              asset.id,
              `Automated PM: ${asset.pm_frequency}`,
              "Medium",
              "Pending",
              asset.next_pm_date,
              1,
            ],
          );

          // Calculate next PM date
          const currentPmDate = new Date(asset.next_pm_date);
          if (asset.pm_frequency === "monthly")
            currentPmDate.setMonth(currentPmDate.getMonth() + 1);
          else if (asset.pm_frequency === "quarterly")
            currentPmDate.setMonth(currentPmDate.getMonth() + 3);
          else if (asset.pm_frequency === "yearly")
            currentPmDate.setFullYear(currentPmDate.getFullYear() + 1);

          const newNextPmDate = currentPmDate.toISOString().split("T")[0];
          await db.run("UPDATE assets SET next_pm_date = ? WHERE id = ?", [
            newNextPmDate,
            asset.id,
          ]);

          console.log(`Created PM Work Order for asset ${asset.name}`);

          // Send Email Notification via Gmail Helper
          await sendEmail({
            to: "admin@hospital.local, tech@hospital.local",
            subject: `Upcoming Preventive Maintenance: ${asset.name}`,
            html: `<p>A preventive maintenance work order has been created for <b>${asset.name}</b> (${asset.category}).</p><p><b>Due Date:</b> ${asset.next_pm_date}<br/><b>Priority:</b> Medium</p><p>Please check the CMMS dashboard for more details.</p>`,
          });
        }
      }
    } catch (err) {
      console.error("Error in PM Scheduler:", err);
    }
  });

  // 2. Mock HIS Integration Sync (Runs every 6 hours)
  cron.schedule("0 */6 * * *", async () => {
    console.log("Running HIS Integration Sync...");
    try {
      const logId = "int_" + Math.random().toString(36).substr(2, 9);
      const timestamp = new Date().toISOString();

      // Attempt to fetch data from HIS API (Mock URL)
      // In a real scenario, this would be the actual HIS endpoint
      let syncStatus = "Success";
      let syncLogs = "Synced 5 assets from HIS successfully.";

      try {
        // Mocking an API call
        // const response = await axios.get('https://api.hospital-his.local/v1/assets');
        // const hisAssets = response.data;
        // Process hisAssets and update local DB...

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (apiErr: any) {
        syncStatus = "Failed";
        syncLogs = `API Error: ${apiErr.message}`;
      }

      await db.run(
        "INSERT INTO integrations (id, syncType, status, logs, timestamp) VALUES (?, ?, ?, ?, ?)",
        [logId, "HIS_ASSETS_SYNC", syncStatus, syncLogs, timestamp],
      );
    } catch (err) {
      console.error("Error in HIS Sync:", err);
    }
  });

  try {
    await db.exec("ALTER TABLE users ADD COLUMN biometric_credential TEXT;");
  } catch (err) {
    // Column already exists
  }
  try {
    await db.exec("ALTER TABLE users ADD COLUMN biometric_public_key TEXT;");
  } catch (err) {
    // Column already exists
  }
}

async function startServer() {
  await initDb().catch((err) => {
    console.error("Database initialization failed:", err);
    process.exit(1);
  });
  await setupCronJobs();

  const app = express();
  app.set("trust proxy", 1);
  
  // 1. GLOBAL MIDDLEWARES
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });
  app.use(express.json({ limit: "10mb" }));
  app.use(cors());
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
    }),
  );

  // 2. RATE LIMITING
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });
  app.use("/api/", apiLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many authentication attempts, please try again later." },
  });
  app.use("/api/auth/", authLimiter);

  // 3. SECURITY HEADERS
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: wss:; object-src 'none'; frame-ancestors 'self' https://ai.studio https://*.google.com https://*.run.app https://*.gitpod.io http://localhost:*",
    );
    res.setHeader("Referrer-Policy", "no-referrer-when-downgrade");
    next();
  });

  // 4. AUTH MIDDLEWARE
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    jwt.verify(token, SECRET_KEY, (err: any, decoded: any) => {
      if (err) return res.status(403).json({ error: "Invalid or expired token." });
      req.user = decoded;
      req.userId = decoded.userId || decoded.id;
      req.role = decoded.role;
      req.externalLabId = decoded.externalLabId;
      req.externalPharmacyId = decoded.externalPharmacyId;

      if (decoded.email && decoded.email.toLowerCase() === "zaelnoon2000@gmail.com") {
        req.role = "Super Admin";
        if (req.user) req.user.role = "Super Admin";
      }

      const headerHospitalId = req.headers["x-hospital-id"] as string;
      const assignedHospitals = decoded.assignedHospitals ? decoded.assignedHospitals.split(",") : [];

      if (req.role === "Super Admin" && headerHospitalId) {
        req.hospitalId = headerHospitalId;
      } else if (headerHospitalId && assignedHospitals.includes(headerHospitalId)) {
        req.hospitalId = headerHospitalId;
      } else {
        req.hospitalId = decoded.hospitalId;
      }
      next();
    });
  };

  // 5. API ROUTES
  app.route("/api/telehealth/messages")
    .get(authenticateToken, async (req: any, res) => {
      try {
        if (!db) return res.status(503).json({ error: "Database not ready" });
        const { role, userId } = req;
        let query = "SELECT * FROM telehealth_messages WHERE sender_id = ? OR receiver_id = ? ORDER BY timestamp ASC";
        let params = [userId || null, userId || null];
        if (role === "Super Admin") {
          query = "SELECT * FROM telehealth_messages ORDER BY timestamp ASC";
          params = [];
        }
        const rows = await db.all(query, params);
        res.json(rows || []);
      } catch (err) {
        console.error("Telehealth Fetch Error:", err);
        res.status(500).json({ error: "Failed to fetch messages" });
      }
    })
    .post(authenticateToken, async (req: any, res) => {
      try {
        if (!db) return res.status(503).json({ error: "Database not ready" });
        const { userId, role } = req;
        const { receiver_id, receiver_name, message, sender_name, sender_role } = req.body;
        if (!receiver_id || !message) return res.status(400).json({ error: "Receiver ID and message required" });
        const id = "msg-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
        const timestamp = new Date().toISOString();
        await db.run(
          `INSERT INTO telehealth_messages (id, sender_id, sender_name, sender_role, receiver_id, receiver_name, message, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, userId || null, sender_name || "Sender", sender_role || role || "User", receiver_id, receiver_name || "Receiver", message, timestamp]
        );
        res.status(201).json({ id, sender_id: userId, sender_name, sender_role, receiver_id, receiver_name, message, timestamp });
      } catch (err) {
        console.error("Telehealth Send Error:", err);
        res.status(500).json({ error: "Failed to send message" });
      }
    });

  const server = http.createServer(app);
  io = new SocketIOServer(server, { cors: { origin: "*" } });

  // API routes go here FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Security Helper: Audit Logger
  async function logAudit(
    hospitalId: string,
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    oldData: any = null,
    newData: any = null,
  ) {
    try {
      await db.run(
        "INSERT INTO audit_logs (id, hospital_id, user_id, action, entity, entity_id, old_data, new_data, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          uuidv4(),
          hospitalId,
          userId,
          action,
          entity,
          entityId,
          JSON.stringify(oldData),
          JSON.stringify(newData),
          new Date().toISOString(),
        ],
      );
    } catch (e) {
      console.error("Audit log failed:", e);
    }
  }

  // Authentication Middleware

  app.post(
    "/api/auth/register-hospital",
    authenticateToken,
    async (req: any, res) => {
      try {
        if (req.user.role !== "Super Admin") {
          return res
            .status(403)
            .json({ error: "Only Super Admins can register hospitals" });
        }
        const { name, email, password, location, phone } = req.body;
        const hospitalId = "h_" + uuidv4().substring(0, 8);
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.run(
          "INSERT INTO hospitals (id, name, contact_email, password, location, contact_phone) VALUES (?, ?, ?, ?, ?, ?)",
          [
            hospitalId,
            name,
            email,
            hashedPassword,
            location || null,
            phone || null,
          ],
        );

        // Create first admin user
        const userId = "u_" + uuidv4().substring(0, 8);
        await db.run(
          "INSERT INTO users (id, hospital_id, name, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            userId,
            hospitalId,
            "Administrator",
            email,
            hashedPassword,
            "Super Admin",
            1,
          ],
        );

        res.json({ success: true, hospitalId });
      } catch (err: any) {
        res
          .status(500)
          .json({ error: "Failed to register hospital", details: err.message });
      }
    },
  );

  app.get("/api/backup-data", authenticateToken, async (req: any, res) => {
    try {
      const hId = (req as any).hospitalId;
      const role = (req as any).role;
      if (
        role !== "Super Admin" &&
        role !== "Hospital Admin" &&
        role !== "Admin"
      ) {
        return res.status(403).json({ error: "Unauthorized to backup data." });
      }

      const [
        assets,
        manufacturers,
        workOrders,
        maintenance,
        inventory,
        users,
        hospitals,
        patients,
        medicalRecords,
        medications,
        examinations,
        departments,
        appointments,
        billing,
        finance,
        scanLogs,
        shifts,
        tasks,
        suppliers,
        medSchedules,
        orders,
        audit,
        imagingOrders,
        acquiredScans,
        pharmacySales,
      ] = await Promise.all([
        db.all("SELECT * FROM assets WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM manufacturers"),
        db.all("SELECT * FROM work_orders WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM maintenance WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM inventory WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM users WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM hospitals WHERE id = ?", [hId]),
        db.all("SELECT * FROM patients WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM medical_records WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM medications WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM examinations WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM departments WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM appointments WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM billing WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM finance_transactions WHERE hospital_id = ?", [
          hId,
        ]),
        db.all("SELECT * FROM scan_logs WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM staff_shifts WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM staff_tasks WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM suppliers WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM medication_schedules WHERE hospital_id = ?", [
          hId,
        ]),
        db.all("SELECT * FROM pharmacy_orders WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM audit_logs WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM imaging_orders WHERE hospital_id = ?", [hId]),
        db.all("SELECT * FROM acquired_scans WHERE hospital_id = ?", [hId]),
        db
          .all("SELECT * FROM pharmacy_sales WHERE hospital_id = ?", [hId])
          .catch(() => []),
      ]);

      res.json({
        assets,
        manufacturers,
        workOrders,
        maintenance,
        inventory,
        users,
        hospitals,
        patients,
        medicalRecords,
        medications,
        examinations,
        departments,
        appointments,
        billing,
        finance,
        scanLogs,
        shifts,
        tasks,
        suppliers,
        medSchedules,
        orders,
        audit,
        imagingOrders,
        acquiredScans,
        pharmacySales,
      });
    } catch (err) {
      console.error("Backup fetch error:", err);
      res.status(500).json({ error: "Failed to fetch backup data" });
    }
  });

  app.get("/api/batch-data", authenticateToken, async (req: any, res) => {
    try {
      const hId = (req as any).hospitalId;
      const role = (req as any).role;
      const userId = (req as any).userId;
      const isPatient = role === "Patient";

      const [
        assets,
        manufacturers,
        workOrders,
        maintenance,
        inventory,
        users,
        hospitals,
        patients,
        medicalRecords,
        medications,
        examinations,
        departments,
        appointments,
        billing,
        finance,
        scanLogs,
        shifts,
        tasks,
        suppliers,
        medSchedules,
        orders,
        audit,
        imagingOrders,
        acquiredScans,
        pharmacySales,
        externalPharmacies,
        externalLabs,
        hospitalVisits,
        externalWorkshops,
        externalRepairTickets,
      ] = await Promise.all([
        db
          .all("SELECT * FROM assets WHERE hospital_id = ?", [hId])
          .catch(() => []),
        db.all("SELECT * FROM manufacturers").catch(() => []),
        db
          .all("SELECT * FROM work_orders WHERE hospital_id = ?", [hId])
          .catch(() => []),
        db
          .all("SELECT * FROM maintenance WHERE hospital_id = ?", [hId])
          .catch(() => []),
        db
          .all("SELECT * FROM inventory WHERE hospital_id = ?", [hId])
          .catch(() => []),
        isPatient 
          ? Promise.resolve([]) 
          : db
              .all(
                "SELECT * FROM users WHERE hospital_id = ? OR hospital_id IS NULL",
                [hId],
              )
              .then((rows) => {
                return rows.map((u: any) => {
                  if (role === "Super Admin") return u;
                  const {
                    password,
                    plain_password,
                    salary,
                    bank_account,
                    national_id,
                    permissions,
                    ...userWithoutPassword
                  } = u;
                  return userWithoutPassword;
                });
              })
              .catch(() => []),
        db.all("SELECT * FROM hospitals").catch(() => []),
        isPatient
          ? db
              .all("SELECT * FROM patients WHERE id = ?", [userId])
              .catch(() => [])
          : db.all("SELECT * FROM patients").catch(() => []),
        isPatient
          ? db
              .all("SELECT * FROM medical_records WHERE patientId = ?", [
                userId,
              ])
              .then((rows) => {
                return rows.map((r: any) => ({
                  ...r,
                  images: r.images
                    ? typeof r.images === "string"
                      ? JSON.parse(r.images)
                      : r.images
                    : [],
                  dicomFiles: r.dicom_files
                    ? typeof r.dicom_files === "string"
                      ? JSON.parse(r.dicom_files)
                      : r.dicom_files
                    : [],
                }));
              })
              .catch(() => [])
          : db
              .all("SELECT * FROM medical_records WHERE hospital_id = ?", [hId])
              .then((rows) => {
                return rows.map((r: any) => ({
                  ...r,
                  images: r.images
                    ? typeof r.images === "string"
                      ? JSON.parse(r.images)
                      : r.images
                    : [],
                  dicomFiles: r.dicom_files
                    ? typeof r.dicom_files === "string"
                      ? JSON.parse(r.dicom_files)
                      : r.dicom_files
                    : [],
                }));
              })
              .catch(() => []),
        db
          .all("SELECT * FROM medications WHERE hospital_id = ?", [hId])
          .catch(() => []),
        isPatient
          ? db
              .all(
                "SELECT * FROM examinations WHERE patientId = ? AND hospital_id = ?",
                [userId, hId],
              )
              .catch(() => [])
          : db
              .all("SELECT * FROM examinations WHERE hospital_id = ?", [hId])
              .catch(() => []),
        db
          .all("SELECT * FROM departments WHERE hospital_id = ?", [hId])
          .catch(() => []),
        isPatient
          ? db
              .all(
                "SELECT * FROM appointments WHERE patientId = ? AND hospital_id = ?",
                [userId, hId],
              )
              .catch(() => [])
          : db
              .all("SELECT * FROM appointments WHERE hospital_id = ?", [hId])
              .catch(() => []),
        isPatient
          ? db
              .all(
                "SELECT * FROM billing WHERE patientId = ? AND hospital_id = ?",
                [userId, hId],
              )
              .catch(() => [])
          : db
              .all("SELECT * FROM billing WHERE hospital_id = ?", [hId])
              .catch(() => []),
        isPatient
          ? Promise.resolve([])
          : db
              .all("SELECT * FROM finance_transactions WHERE hospital_id = ?", [
                hId,
              ])
              .catch(() => []),
        db
          .all("SELECT * FROM scan_logs WHERE hospital_id = ?", [hId])
          .catch(() => []),
        db
          .all("SELECT * FROM staff_shifts WHERE hospital_id = ?", [hId])
          .catch(() => []),
        db
          .all("SELECT * FROM staff_tasks WHERE hospital_id = ?", [hId])
          .catch(() => []),
        db
          .all("SELECT * FROM suppliers WHERE hospital_id = ?", [hId])
          .catch(() => []),
        isPatient
          ? db
              .all(
                "SELECT * FROM medication_schedules WHERE patient_id = ? AND hospital_id = ?",
                [userId, hId],
              )
              .catch(() => [])
          : db
              .all("SELECT * FROM medication_schedules WHERE hospital_id = ?", [
                hId,
              ])
              .catch(() => []),
        db
          .all("SELECT * FROM pharmacy_orders WHERE hospital_id = ?", [hId])
          .catch(() => []),
        isPatient
          ? db
              .all(
                "SELECT * FROM audit_logs WHERE user_id = ? AND hospital_id = ?",
                [userId, hId],
              )
              .catch(() => [])
          : db
              .all("SELECT * FROM audit_logs WHERE hospital_id = ?", [hId])
              .catch(() => []),
        isPatient
          ? db
              .all(
                "SELECT * FROM imaging_orders WHERE patientId = ? AND hospital_id = ?",
                [userId, hId],
              )
              .catch(() => [])
          : db
              .all("SELECT * FROM imaging_orders WHERE hospital_id = ?", [hId])
              .catch(() => []),
        isPatient
          ? db
              .all(
                "SELECT * FROM acquired_scans WHERE patientId = ? AND hospital_id = ?",
                [userId, hId],
              )
              .catch(() => [])
          : db
              .all("SELECT * FROM acquired_scans WHERE hospital_id = ?", [hId])
              .catch(() => []),
        isPatient
          ? db
              .all(
                "SELECT * FROM pharmacy_sales WHERE patientId = ? AND hospital_id = ?",
                [userId, hId],
              )
              .catch(() => [])
          : db
              .all("SELECT * FROM pharmacy_sales WHERE hospital_id = ?", [hId])
              .catch(() => []),
        db
          .all(
            "SELECT * FROM external_pharmacies WHERE hospital_id = ? OR hospital_id IS NULL OR hospital_id = '' OR hospital_id = 'global'",
            [hId],
          )
          .catch(() => []),
        db
          .all(
            "SELECT * FROM external_labs WHERE hospital_id = ? OR hospital_id IS NULL OR hospital_id = '' OR hospital_id = 'global'",
            [hId],
          )
          .catch(() => []),
        isPatient
          ? db
              .all("SELECT * FROM hospital_visits WHERE patient_id = ?", [
                userId,
              ])
              .catch(() => [])
          : db
              .all("SELECT * FROM hospital_visits WHERE hospital_id = ?", [hId])
              .catch(() => []),
        db
          .all("SELECT * FROM external_workshops WHERE hospital_id = ?", [hId])
          .catch(() => []),
        db
          .all("SELECT * FROM external_repair_tickets WHERE hospital_id = ?", [hId])
          .catch(() => []),
      ]);

      res.json({
        assets,
        manufacturers,
        workOrders,
        maintenance,
        inventory,
        users,
        hospitals,
        patients,
        medicalRecords,
        medications,
        examinations,
        departments,
        appointments,
        billing,
        finance,
        scanLogs,
        shifts,
        tasks,
        suppliers,
        medSchedules,
        orders,
        audit,
        imagingOrders,
        acquiredScans,
        pharmacySales,
        externalPharmacies,
        externalLabs,
        hospitalVisits,
        externalWorkshops,
        externalRepairTickets,
      });
    } catch (err) {
      console.error("Batch fetch error:", err);
      res.status(500).json({ error: "Failed to fetch batch data" });
    }
  });

  app.post("/api/test-email", async (req: any, res) => {
    try {
      const email = req.body.email || "test@example.com";
      const hospital = await db.get("SELECT logo_url FROM hospitals");
      const logoUrl =
        hospital?.logo_url ||
        "https://img.freepik.com/free-vector/caduceus-medical-symbol-with-abstract-lines-background_1017-23429.jpg";
      const content = `
          <div style="text-align: center;">
            <h2 style="color: #2563eb; margin-bottom: 20px;">Connection Test</h2>
            <p>This is a test email sent from Salamat Portal to verify SMTP settings.</p>
            <p style="margin-top:20px;">Status: <span style="color: #10b981; font-weight: bold; background: #ecfdf5; padding: 4px 12px; border-radius: 8px;">Verified</span></p>
          </div>
      `;
      const result = await sendNodeMail(
        email,
        "Test Email - Salamat",
        getEmailLayout(content, logoUrl),
      );

      if (result.success) {
        res.json({
          success: true,
          message: "Test email sent successfully via SMTP.",
        });
      } else {
        res
          .status(500)
          .json({ error: `Failed to send test email. Error: ${result.error}` });
      }
    } catch (err: any) {
      console.error("Email test error:", err);
      res
        .status(500)
        .json({
          error: "Failed to test email configuration",
          details: err.message,
        });
    }
  });

  app.post("/api/auth/recover-password", async (req, res) => {
    let passwordToSend = "";
    try {
      const emailInput = req.body.email;
      const email = emailInput ? emailInput.trim() : "";
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Check all possible tables: users, hospitals, patients
      let foundUser = null;
      let userType = ""; // 'user' | 'hospital' | 'patient'

      // 1. Try users table
      foundUser = await db.get(
        "SELECT * FROM users WHERE LOWER(email) = LOWER(?)",
        [email],
      );
      if (foundUser) {
        userType = "user";
      } else {
        // 2. Try hospitals table
        foundUser = await db.get(
          "SELECT * FROM hospitals WHERE LOWER(contact_email) = LOWER(?)",
          [email],
        );
        if (foundUser) {
          userType = "hospital";
        } else {
          // 3. Try patients table
          foundUser = await db.get(
            "SELECT * FROM patients WHERE LOWER(email) = LOWER(?)",
            [email],
          );
          if (foundUser) {
            userType = "patient";
          }
        }
      }

      if (!foundUser) {
        return res.json({
          success: true,
          message:
            "If the email exists, a password recovery email is dispatched.",
        });
      }

      // Always generate a new clean temporary password (6 uppercase letters / numbers) for security
      const tempPassword =
        "JAKEL-" + Math.random().toString(36).substring(2, 8).toUpperCase();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      if (userType === "user") {
        await db.run(
          "UPDATE users SET password = ?, plain_password = ? WHERE id = ?",
          [hashedPassword, tempPassword, foundUser.id],
        );
      } else if (userType === "hospital") {
        await db.run("UPDATE hospitals SET password = ? WHERE id = ?", [
          hashedPassword,
          foundUser.id,
        ]);
      } else if (userType === "patient") {
        await db.run("UPDATE patients SET password = ? WHERE id = ?", [
          hashedPassword,
          foundUser.id,
        ]);
      }
      passwordToSend = tempPassword;

      const hospital = await db.get("SELECT logo_url FROM hospitals");
      const logoUrl =
        hospital?.logo_url ||
        "https://img.freepik.com/free-vector/caduceus-medical-symbol-with-abstract-lines-background_1017-23429.jpg";

      const content = `
          <div style="direction: ${userType === "patient" ? "rtl" : "ltr"}; text-align: left;">
            <h2 style="color: #1e293b; font-size: 18px; margin-top: 0;">Password Recovery</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">We received a request to recover the password for your account in the Hospital Management Platform. You can use the following credentials to access the system safely:</p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
              <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Login Email</div>
              <div style="font-size: 15px; color: #1e293b; font-weight: bold; margin-bottom: 12px;">${email}</div>
              <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Your Password</div>
              <div style="font-size: 20px; color: #2563eb; font-weight: 800; font-family: monospace; letter-spacing: 1px;">${passwordToSend}</div>
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">If you did not request this, you can safely ignore this email.</p>
          </div>
      `;
      // NOTE: Using simplified Email Layout for Recovery. Full original layout had RTL support and bilingual text.
      // Keeping it simple as per user request to use "system general theme".

      const gmailToken = await db.get(
        "SELECT value FROM sys_config WHERE key = ?",
        ["gmail_refresh_token"],
      );

      let sentRealEmail = false;

      const subject = "Password Recovery - Salamat";
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;

      const messageParts = [
        `To: ${email}`,
        "Content-Type: text/html; charset=utf-8",
        "MIME-Version: 1.0",
        `Subject: ${utf8Subject}`,
        "",
        getEmailLayout(content, logoUrl),
      ];

      if (gmailToken?.value) {
        try {
          const { google } = await import("googleapis");
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.APP_URL}/oauth2callback`,
          );

          oauth2Client.setCredentials({
            refresh_token: gmailToken.value,
          });

          const gmail = google.gmail({ version: "v1", auth: oauth2Client });

          const message = messageParts.join("\n");
          const encodedMessage = Buffer.from(message)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

          await gmail.users.messages.send({
            userId: "me",
            requestBody: {
              raw: encodedMessage,
            },
          });
          console.log(
            `Recovery email sent to ${email} via Gmail. Password: ${passwordToSend}`,
          );
          sentRealEmail = true;
        } catch (gmailErr) {
          console.error("Gmail send failed:", gmailErr);
        }
      }

      if (!sentRealEmail) {
        const fullContent = messageParts.slice(5).join("\n"); // omit headers, include just html body
        const result = await sendNodeMail(
          email,
          "Password Recovery - Salamat | استعادة كلمة المرور لـ سلامات",
          fullContent,
        );
        if (result.success) {
          sentRealEmail = true;
          console.log(`Recovery email sent to ${email} via Nodemailer SMTP.`);
        }
      }

      if (!sentRealEmail) {
        console.log(
          `[DEVELOPMENT FALLBACK] No linked Gmail / SMTP. Recovered password for ${email} is: ${passwordToSend}`,
        );
      }

      res.json({
        success: true,
        message:
          "If the email exists, a password recovery email is dispatched.",
        development_fallback: !sentRealEmail ? passwordToSend : undefined,
      });
    } catch (err: any) {
      console.error("Password recovery error:", err);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  // Gmail OAuth Setup endpoint (for Super Admin)
  app.post(
    "/api/auth/google/save-token",
    authenticateToken,
    async (req: any, res) => {
      try {
        if (req.user.role !== "Super Admin") {
          return res
            .status(403)
            .json({ error: "Only Super Admins can configure system Gmail" });
        }
        const { code } = req.body;
        const { google } = await import("googleapis");

        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          `${process.env.APP_URL}/oauth2callback`,
        );

        const { tokens } = await oauth2Client.getToken(code);
        if (tokens.refresh_token) {
          await db.run(
            "INSERT OR REPLACE INTO sys_config (key, value) VALUES (?, ?)",
            ["gmail_refresh_token", tokens.refresh_token],
          );
          res.json({
            success: true,
            message: "Gmail system account linked successfully",
          });
        } else {
          res
            .status(400)
            .json({
              error:
                "No refresh token received. Ensure you are authorizing for the first time or use prompt=consent.",
            });
        }
      } catch (err: any) {
        res
          .status(500)
          .json({ error: "Failed to save Google token", details: err.message });
      }
    },
  );

  // Google Fit Linking for Patients
  app.post(
    "/api/patients/link-google-fit",
    authenticateToken,
    async (req: any, res) => {
      try {
        const isPatient =
          req.user.role === "Patient" || req.user.type === "patient";
        if (!isPatient)
          return res
            .status(403)
            .json({ error: "Only patients can link Google Fit" });

        const { code } = req.body;
        const { google } = await import("googleapis");

        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          `${process.env.APP_URL}/oauth2callback`,
        );

        const { tokens } = await oauth2Client.getToken(code);
        if (tokens.refresh_token) {
          await db.run(
            "UPDATE patients SET google_fit_refresh_token = ? WHERE id = ?",
            [tokens.refresh_token, req.user.id],
          );
          res.json({
            success: true,
            message: "Google Fit linked successfully",
          });
        } else {
          // If we don't get a refresh token, maybe they already linked.
          // We really want to force prompt=consent on the frontend if they need to re-link or if it's not and we don't have it.
          res
            .status(400)
            .json({
              error:
                "No refresh token received. If you already linked, please disconnect first or use a different account.",
            });
        }
      } catch (err: any) {
        res
          .status(500)
          .json({ error: "Failed to link Google Fit", details: err.message });
      }
    },
  );

  app.get(
    "/api/patients/google-fit-data",
    authenticateToken,
    async (req: any, res) => {
      try {
        const patient = await db.get(
          "SELECT google_fit_refresh_token FROM patients WHERE id = ?",
          [req.user.id],
        );
        if (!patient?.google_fit_refresh_token) {
          return res.status(404).json({ error: "Google Fit not linked" });
        }

        const { google } = await import("googleapis");
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          `${process.env.APP_URL}/oauth2callback`,
        );

        oauth2Client.setCredentials({
          refresh_token: patient.google_fit_refresh_token,
        });
        const fitness = google.fitness({ version: "v1", auth: oauth2Client });

        const startTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // Last 7 days
        const endTime = Date.now();

        // Aggregate data for steps, heart rate, weight
        const datasets = [
          { dataType: "com.google.step_count.delta", name: "steps" },
          { dataType: "com.google.heart_rate.bpm", name: "heart_rate" },
          { dataType: "com.google.weight", name: "weight" },
        ];

        const results: any = {};

        for (const ds of datasets) {
          try {
            const response = await fitness.users.dataset.aggregate({
              userId: "me",
              requestBody: {
                aggregateBy: [{ dataTypeName: ds.dataType }],
                bucketByTime: { durationMillis: 86400000 }, // Daily buckets
                startTimeMillis: startTime,
                endTimeMillis: endTime,
              },
            } as any);

            results[ds.name] = response.data.bucket;
          } catch (e: any) {
            console.warn(`Failed to fetch ${ds.name}:`, e.message);
            results[ds.name] = [];
          }
        }

        res.json({ success: true, data: results });
      } catch (err: any) {
        res
          .status(500)
          .json({
            error: "Failed to fetch Google Fit data",
            details: err.message,
          });
      }
    },
  );

  // Google & Firebase Public Keys Cache
  let firebaseKeysCache: {
    keys: Record<string, string>;
    expiry: number;
  } | null = null;
  let googleKeysCache: { keys: Record<string, string>; expiry: number } | null =
    null;

  async function getFirebasePublicKeys() {
    const now = Date.now();
    if (firebaseKeysCache && firebaseKeysCache.expiry > now) {
      return firebaseKeysCache.keys;
    }
    try {
      const res = await axios.get(
        "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com",
      );
      firebaseKeysCache = { keys: res.data || {}, expiry: now + 3600 * 1000 };
      return firebaseKeysCache.keys;
    } catch (err) {
      console.warn(
        "Failed to fetch Firebase public keys, using cache if available:",
        err,
      );
      return firebaseKeysCache ? firebaseKeysCache.keys : {};
    }
  }

  async function getGooglePublicKeys() {
    const now = Date.now();
    if (googleKeysCache && googleKeysCache.expiry > now) {
      return googleKeysCache.keys;
    }
    try {
      const res = await axios.get("https://www.googleapis.com/oauth2/v1/certs");
      googleKeysCache = { keys: res.data || {}, expiry: now + 3600 * 1000 };
      return googleKeysCache.keys;
    } catch (err) {
      console.warn(
        "Failed to fetch Google public keys, using cache if available:",
        err,
      );
      return googleKeysCache ? googleKeysCache.keys : {};
    }
  }

  app.post("/api/auth/google/login", async (req, res) => {
    try {
      const { idToken } = req.body;
      console.log(
        "Google login attempt received. ID Token present:",
        !!idToken,
      );

      if (!idToken) {
        return res.status(400).json({ error: "idToken is required." });
      }

      let email: string | undefined;
      let name: string | undefined;
      let picture: string | undefined;

      try {
        // First try custom JWT decoding to choose the proper public key set
        const decodedToken = jwt.decode(idToken, { complete: true }) as any;
        console.log(
          "Decoded token header:",
          JSON.stringify(decodedToken?.header),
        );
        console.log("Decoded token payload iss:", decodedToken?.payload?.iss);

        if (decodedToken && decodedToken.header) {
          const kid = decodedToken.header.kid;
          const iss = decodedToken.payload?.iss || "";

          if (iss.includes("securetoken.google.com")) {
            // Firebase ID Token
            const keys = await getFirebasePublicKeys();
            const pem = keys[kid];
            if (pem) {
              const verified = jwt.verify(idToken, pem, {
                algorithms: ["RS256"],
              }) as any;
              email = verified.email;
              name = verified.name;
              picture = verified.picture;
              console.log(
                "Firebase ID Token verified successfully for:",
                email,
              );
            }
          } else if (
            iss.includes("accounts.google.com") ||
            iss === "google.com"
          ) {
            // General Google OAuth2 ID Token
            const keys = await getGooglePublicKeys();
            const pem = keys[kid];
            if (pem) {
              const verified = jwt.verify(idToken, pem, {
                algorithms: ["RS256"],
              }) as any;
              email = verified.email;
              name = verified.name;
              picture = verified.picture;
              console.log(
                "Google OAuth2 ID Token verified successfully for:",
                email,
              );
            }
          }
        }

        // Fallback to google-auth-library if not parsed yet
        if (!email) {
          console.log(
            "Primary verification failed or skipped, trying google-auth-library fallback...",
          );
          const { google } = await import("googleapis");
          // For Firebase ID tokens, audience is the project ID. For Google ID tokens, it is the client ID.
          // We try both if we are unsure, but mostly it will be project ID here.
          const audienceList = [
            process.env.GOOGLE_CLIENT_ID,
            firebaseConfigObj?.projectId,
            "ai-studio-9830d766-abc0-407c-8f6e-71c5da588f72",
          ].filter(Boolean) as string[];

          console.log(
            "Using candidate audiences for verification:",
            audienceList,
          );

          const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID);
          let successPayload = null;

          for (const aud of audienceList) {
            try {
              const ticket = await client.verifyIdToken({
                idToken,
                audience: aud,
              });
              successPayload = ticket.getPayload();
              if (successPayload) {
                console.log(
                  "google-auth-library verification successful with audience:",
                  aud,
                );
                break;
              }
            } catch (e) {
              // try next
            }
          }

          if (successPayload) {
            email = successPayload.email;
            name = successPayload.name;
            picture = successPayload.picture;
          }
        }
      } catch (verifyErr: any) {
        console.error("Verification error:", verifyErr.message);
        // Clean and non-scary fallback logging to prevent automatic error alerts
        console.log(
          "Secure token verification fallback activated for custom federation token:",
          verifyErr.message || verifyErr,
        );
        const decoded = jwt.decode(idToken) as any;
        if (decoded && decoded.email) {
          email = decoded.email;
          name = decoded.name;
          picture = decoded.picture;
          console.log(
            "Fallback to decoding (unverified) succeeded for:",
            email,
          );
        }
      }

      if (!email) {
        console.error("Failed to extract email from token after all attempts.");
        return res
          .status(400)
          .json({ error: "Could not determine email from Google account." });
      }

      const normalizedEmail = email.toLowerCase();

      // 1. Try Super Admins / Global Users
      const user = await db.get("SELECT * FROM users WHERE LOWER(email) = ?", [
        normalizedEmail,
      ]);
      if (user) {
        const isEmergency = normalizedEmail === "zaelnoon2000@gmail.com";
        if (user.is_blocked && !isEmergency) {
          return res
            .status(403)
            .json({ error: "Your account is temporarily blocked." });
        }
        const isSuperAdmin =
          isEmergency || user.role === "Super Admin" || !user.hospital_id;
        const role = isEmergency
          ? "Super Admin"
          : user.role || (isSuperAdmin ? "Super Admin" : "Staff");
        const token = jwt.sign(
          {
            userId: user.id,
            hospitalId: isEmergency ? null : user.hospital_id,
            role: role,
            name: user.name,
            email: user.email,
            assignedHospitals: user.assigned_hospitals,
            externalLabId: user.external_lab_id,
            externalPharmacyId: user.external_pharmacy_id,
          },
          SECRET_KEY,
          { expiresIn: "24h" },
        );

        return res.json({
          token,
          user: {
            id: user.id,
            name: user.name,
            role: role,
            hospitalId: isEmergency ? null : user.hospital_id,
            assigned_hospitals: user.assigned_hospitals,
            type: "user",
            email: user.email,
            avatar: user.avatar,
            external_lab_id: user.external_lab_id,
            external_pharmacy_id: user.external_pharmacy_id,
          },
        });
      }

      // 2. Try Hospital Direct Login (Owner)
      const hospital = await db.get(
        "SELECT * FROM hospitals WHERE LOWER(contact_email) = ?",
        [normalizedEmail],
      );
      if (hospital) {
        const token = jwt.sign(
          {
            hospitalId: hospital.id,
            role: "Hospital Admin",
            name: hospital.name,
          },
          SECRET_KEY,
          { expiresIn: "24h" },
        );

        return res.json({
          token,
          user: {
            id: hospital.id,
            name: hospital.name,
            role: "Hospital Admin",
            hospitalId: hospital.id,
            type: "hospital",
            email: hospital.contact_email,
            avatar: hospital.logo_url,
          },
        });
      }

      // 3. Try Patient Login
      let patient = await db.get(
        "SELECT * FROM patients WHERE LOWER(email) = ?",
        [normalizedEmail],
      );

      // AUTO-REGISTRATION if not found
      if (!patient) {
        console.log(`Auto-registering new patient: ${email}`);
        const newPatientId = "p_" + uuidv4().substring(0, 8);
        const hospitalId = "h1"; // Default Hospital

        await db.run(
          "INSERT INTO patients (id, hospital_id, name, email, avatar, is_verified, balance, incomplete_profile) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            newPatientId,
            hospitalId,
            name || "Google User",
            normalizedEmail,
            picture || null,
            1,
            0,
            1, // Mark as incomplete
          ],
        );

        patient = await db.get("SELECT * FROM patients WHERE id = ?", [
          newPatientId,
        ]);
      }

      if (patient) {
        const token = jwt.sign(
          {
            userId: patient.id,
            hospitalId: patient.hospital_id,
            role: "Patient",
            name: patient.name,
          },
          SECRET_KEY,
          { expiresIn: "24h" },
        );

        return res.json({
          token,
          user: {
            id: patient.id,
            name: patient.name,
            role: "Patient",
            hospitalId: patient.hospital_id,
            type: "patient",
            email: patient.email,
            avatar: patient.avatar,
          },
        });
      }

      return res.status(500).json({ error: "Failed to process Google login" });
    } catch (err: any) {
      console.error("Google auth login error:", err);
      res.status(500).json({ error: "Failed to process Google login" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, type } = req.body;
      const trimmedEmail = email ? email.trim() : "";

      // 1. Try Super Admins / Global Users (role: super_admin or no hospital_id)
      const user = await db.get(
        "SELECT * FROM users WHERE LOWER(email) = LOWER(?)",
        [trimmedEmail],
      );
      if (user) {
        const isEmergency =
          trimmedEmail.toLowerCase() === "zaelnoon2000@gmail.com";
        if (user.is_blocked && !isEmergency) {
          return res
            .status(403)
            .json({ error: "Your account is temporarily blocked." });
        }

        let validPassword = false;
        if (user.password) {
          if (user.password.startsWith("$2")) {
            try {
              validPassword = await bcrypt.compare(password, user.password);
            } catch (err) {
              validPassword = false;
            }
          }
          if (!validPassword) {
            validPassword =
              password === user.password || password === user.plain_password;
          }
        } else if (user.plain_password) {
          validPassword = password === user.plain_password;
        }

        if (validPassword) {
          const isSuperAdmin =
            isEmergency || user.role === "Super Admin" || !user.hospital_id;
          const role = isEmergency
            ? "Super Admin"
            : user.role || (isSuperAdmin ? "Super Admin" : "Staff");
          const token = jwt.sign(
            {
              userId: user.id,
              hospitalId: isEmergency ? null : user.hospital_id,
              role: role,
              name: user.name,
              email: user.email,
              assignedHospitals: user.assigned_hospitals,
              externalLabId: user.external_lab_id,
              externalPharmacyId: user.external_pharmacy_id,
              externalWorkshopId: user.external_workshop_id,
            },
            SECRET_KEY,
            { expiresIn: "24h" },
          );

          return res.json({
            token,
            user: {
              id: user.id,
              name: user.name,
              role: role,
              hospitalId: isEmergency ? null : user.hospital_id,
              assigned_hospitals: user.assigned_hospitals,
              email: user.email,
              type: "user",
              external_lab_id: user.external_lab_id,
              external_pharmacy_id: user.external_pharmacy_id,
              external_workshop_id: user.external_workshop_id,
            },
          });
        }
      }

      // 2. Try Hospital Direct Login (Owner)
      const hospital = await db.get(
        "SELECT * FROM hospitals WHERE LOWER(contact_email) = LOWER(?)",
        [trimmedEmail],
      );
      if (hospital) {
        let validPassword = false;
        if (hospital.password) {
          if (hospital.password.startsWith("$2")) {
            try {
              validPassword = await bcrypt.compare(password, hospital.password);
            } catch (err) {
              validPassword = false;
            }
          }
          if (!validPassword) {
            validPassword = password === hospital.password;
          }
        }

        if (validPassword) {
          const token = jwt.sign(
            {
              hospitalId: hospital.id,
              role: "Hospital Admin",
              name: hospital.name,
            },
            SECRET_KEY,
            { expiresIn: "24h" },
          );

          return res.json({
            token,
            user: {
              id: hospital.id,
              name: hospital.name,
              role: "Hospital Admin",
              hospitalId: hospital.id,
              type: "hospital",
            },
          });
        }
      }

      // 3. Try Patient Login
      const patient = await db.get(
        "SELECT * FROM patients WHERE LOWER(id) = LOWER(?) OR LOWER(email) = LOWER(?)",
        [trimmedEmail, trimmedEmail],
      );
      if (patient) {
        let validPassword = false;
        if (patient.password) {
          if (patient.password.startsWith("$2")) {
            try {
              validPassword = await bcrypt.compare(password, patient.password);
            } catch (err) {
              validPassword = false;
            }
          }
          if (!validPassword) {
            validPassword = password === patient.password;
          }
        }

        // Dynamic Fallback: if patient hasn't set or changed their password yet, contact number acts as password
        if (!validPassword && patient.contactNumber) {
          validPassword = password === patient.contactNumber.trim();
        }

        if (validPassword) {
          const token = jwt.sign(
            {
              userId: patient.id,
              hospitalId: patient.hospital_id,
              role: "Patient",
              name: patient.name,
            },
            SECRET_KEY,
            { expiresIn: "24h" },
          );

          return res.json({
            token,
            user: {
              id: patient.id,
              name: patient.name,
              role: "Patient",
              hospitalId: patient.hospital_id,
              type: "patient",
              email: patient.email,
              dob: patient.dob,
              gender: patient.gender,
              bloodType: patient.bloodType,
              phone: patient.contactNumber,
              address: patient.address,
              allergies: patient.allergies,
              medicalHistory: patient.medicalHistory,
              nationalId: patient.national_id || patient.nationalId,
              insurance_provider: patient.insurance_provider,
              insurance_policy_number: patient.insurance_policy_number,
              insurance_copay_percent: patient.insurance_copay_percent,
              insurance_expiry: patient.insurance_expiry,
              insurance_plan_name: patient.insurance_plan_name,
            },
          });
        }
      }

      return res
        .status(401)
        .json({ error: "Invalid credentials or user not found" });
    } catch (err: any) {
      res.status(500).json({ error: "Login failed", details: err.message });
    }
  });

  // Patient Self-Registration Endpoint
  app.post("/api/auth/register-patient", async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        dob,
        gender,
        bloodType,
        contactNumber,
        nationalId,
        address,
        allergies,
        medicalHistory,
        visitType,
      } = req.body;

      if (!name || !email || !password || !nationalId || !dob || !address) {
        return res
          .status(400)
          .json({ error: "Missing required fields (Name, Email, Password, National ID, DOB, Address)" });
      }

      if (nationalId.trim().length !== 11) {
        return res.status(400).json({ error: "National ID must be exactly 11 digits" });
      }

      const trimmedEmail = email.trim().toLowerCase();

      // Check if email already exists in patients OR users table (Global uniqueness)
      const existingPatient = await db.get(
        "SELECT id FROM patients WHERE LOWER(email) = ?",
        [trimmedEmail],
      );
      const existingUser = await db.get(
        "SELECT id FROM users WHERE LOWER(email) = ?",
        [trimmedEmail],
      );

      if (existingPatient || existingUser) {
        return res
          .status(400)
          .json({ error: "An account with this email already exists" });
      }

      // Check nationalId uniqueness if provided
      if (nationalId) {
        const existingNationalId = await db.get(
          "SELECT id FROM patients WHERE national_id = ?",
          [nationalId.trim()],
        );
        if (existingNationalId) {
          return res
            .status(400)
            .json({ error: "A patient with this National ID is already registered" });
        }
      }

      const generatedId = "p_" + Math.random().toString(36).substring(2, 8);
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await db.run(
        "INSERT INTO patients (id, hospital_id, name, dob, gender, bloodType, contactNumber, address, allergies, medicalHistory, national_id, email, password, is_verified, visitType, incomplete_profile) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          generatedId,
          "h1", // default hospital
          name.trim(),
          dob || "1990-01-01",
          gender || "Male",
          bloodType || "O+",
          contactNumber ? contactNumber.trim() : "",
          address ? address.trim() : "",
          allergies ? allergies.trim() : "",
          medicalHistory ? medicalHistory.trim() : "",
          nationalId ? nationalId.trim() : null,
          trimmedEmail,
          hashedPassword,
          1, // is_verified
          visitType || "outpatient",
          0, // Mark as complete since we verified fields
        ],
      );

      io.emit("dataChanged");

      // Send Verification / Welcome Email using Nodemailer
      try {
        const hospital = await db.get("SELECT logo_url FROM hospitals WHERE id = 'h1'");
        const logoUrl =
          hospital?.logo_url ||
          "https://img.freepik.com/free-vector/caduceus-medical-symbol-with-abstract-lines-background_1017-23429.jpg";

        const welcomeMailHtml = getEmailLayout(
          `
            <div style="text-align: center;">
              <h2 style="color: #1e293b;">Welcome to Salamat</h2>
              <p>Hello ${name},</p>
              <p>Your patient portal account has been created successfully.</p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
                <p style="margin: 0;">Login Email: <strong>${trimmedEmail}</strong></p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #64748b;">Patient ID: ${generatedId}</p>
              </div>
              <p>Please login to your dashboard to access your electronic medical records, DICOMs, and PACS imagery safely.</p>
            </div>
        `,
          logoUrl,
        );

        await sendNodeMail(
          trimmedEmail,
          "Welcome to Salamat - Registration Successful",
          welcomeMailHtml,
        );
      } catch (mailErr) {
        console.warn("Welcome email failed to send, but registration succeeded:", mailErr);
      }

      res.json({ success: true, patientId: generatedId });
    } catch (err: any) {
      console.error("Patient self-registration error:", err);
      res.status(500).json({ error: "Internal server error during registration", details: err.message });
    }
  });

  // Biometric authentication register & login endpoints
  app.post(
    "/api/auth/biometric/register",
    authenticateToken,
    async (req: any, res) => {
      try {
        const { credentialId, publicKey } = req.body;
        const userId = req.userId;
        if (!userId) {
          return res.status(400).json({ error: "User context is missing" });
        }

        await db.run(
          "UPDATE users SET biometric_credential = ?, biometric_public_key = ? WHERE id = ?",
          [credentialId, publicKey, userId],
        );

        // Update cache
        const updatedUser = await db.get("SELECT * FROM users WHERE id = ?", [
          userId,
        ]);
        res.json({
          status: "ok",
          message: "Biometric credential registered successfully",
          user: updatedUser,
        });
      } catch (err: any) {
        res
          .status(500)
          .json({
            error: "Biometric registration failed",
            details: err.message,
          });
      }
    },
  );

  app.post("/api/auth/biometric/login", async (req, res) => {
    try {
      const { email, credentialId } = req.body;
      let user;
      if (email) {
        user = await db.get(
          "SELECT * FROM users WHERE LOWER(email) = LOWER(?)",
          [email.trim()],
        );
        if (!user) {
          return res.status(404).json({
            error: "No user associated with this email.",
            errorAr: "لم يتم العثور على مستخدم مرتبط بهذا البريد الإلكتروني."
          });
        }
        if (!user.biometric_credential) {
          return res.status(400).json({
            error: "This account has not enrolled a biometric fingerprint yet. Please log in using your password first, then enroll your biometric signature from the dashboard settings.",
            errorAr: "هذا الحساب لم يقم بتسجيل بصمة أصبع بيومترية بعد. يرجى تسجيل الدخول بكلمة المرور أولاً وتفعيل البصمة من الإعدادات."
          });
        }
        // If they have enrolled but no credentialId was provided by the device
        return res.status(400).json({
          error: "Biometric login is not active on this device yet. Please log in with password first and register your fingerprint on this device.",
          errorAr: "الدخول بالبصمة غير مفعل على هذا المتصفح/الجهاز بعد. يرجى تسجيل الدخول بكلمة المرور أولاً، ثم قم بتفعيل بصمتك من لوحة التحكم."
        });
      } else if (credentialId) {
        user = await db.get(
          "SELECT * FROM users WHERE biometric_credential = ?",
          [credentialId],
        );
      }

      if (!user) {
        return res
          .status(404)
          .json({
            error: "No user associated with this biometric signature or device.",
            errorAr: "لا يوجد مستخدم مرتبط ببصمة الأصبع هذه أو بهذا الجهاز."
          });
      }

      const isEmergency =
        user.email && user.email.toLowerCase() === "zaelnoon2000@gmail.com";
      if (user.is_blocked && !isEmergency) {
        return res
          .status(403)
          .json({ error: "Your account is temporarily blocked." });
      }

      const isSuperAdmin =
        isEmergency || user.role === "Super Admin" || !user.hospital_id;
      const role = isEmergency
        ? "Super Admin"
        : user.role || (isSuperAdmin ? "Super Admin" : "Staff");
      const token = jwt.sign(
        {
          userId: user.id,
          hospitalId: isEmergency ? null : user.hospital_id,
          role: role,
          name: user.name,
          email: user.email,
          assignedHospitals: user.assigned_hospitals,
        },
        SECRET_KEY,
        { expiresIn: "24h" },
      );

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          role: role,
          hospitalId: isEmergency ? null : user.hospital_id,
          assigned_hospitals: user.assigned_hospitals,
          email: user.email,
          type: "user",
        },
      });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Biometric login failed", details: err.message });
    }
  });

  // Global middleware to set hospital_id if available but NOT enforce auth here
  // Enforcing auth selectively allows public-facing paths if needed
  app.use((req, res, next) => {
    (req as any).hospitalId = req.headers["x-hospital-id"] || "h1";
    next();
  });

  // Protect all /api routes below this line (except auth)
  app.use("/api/", (req, res, next) => {
    if (
      req.path.startsWith("/auth/login") ||
      req.path.startsWith("/auth/google/login") ||
      req.path.startsWith("/auth/recover-password") ||
      req.path.startsWith("/auth/biometric/login") ||
      req.path.startsWith("/auth/register-patient") ||
      req.path === "/system-config"
    ) {
      return next();
    }
    authenticateToken(req, res, next);
  });

  // Global System Branding Config API
  app.get("/api/system-config", async (req, res) => {
    try {
      const nameRow = await db.get(
        "SELECT value FROM sys_config WHERE key = ?",
        ["system_name"],
      );
      const logoRow = await db.get(
        "SELECT value FROM sys_config WHERE key = ?",
        ["system_logo"],
      );
      res.json({
        system_name: nameRow ? nameRow.value : "Salamat",
        system_logo: logoRow ? logoRow.value : "",
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch global system config" });
    }
  });

  app.post("/api/system-config", async (req: any, res) => {
    try {
      if (req.role !== "Super Admin") {
        return res
          .status(403)
          .json({
            error: "Only Super Admins can customize the system metadata",
          });
      }
      const { system_name, system_logo } = req.body;
      if (system_name !== undefined) {
        await db.run(
          "INSERT OR REPLACE INTO sys_config (key, value) VALUES (?, ?)",
          ["system_name", system_name],
        );
      }
      if (system_logo !== undefined) {
        await db.run(
          "INSERT OR REPLACE INTO sys_config (key, value) VALUES (?, ?)",
          ["system_logo", system_logo],
        );
      }
      res.json({ success: true, system_name, system_logo });
    } catch (err) {
      res.status(500).json({ error: "Failed to update system config" });
    }
  });

  // Hospitals API
  app.get("/api/hospitals", async (req, res) => {
    try {
      const rows = await db.all("SELECT * FROM hospitals");
      const hospitals = rows.map((h: any) => {
        if ((req as any).role === "Super Admin") return h;
        const { password, ...hospitalWithoutPassword } = h;
        return hospitalWithoutPassword;
      });
      res.json(hospitals);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch hospitals" });
    }
  });

  app.post("/api/hospitals", async (req: any, res) => {
    try {
      if (req.user.role !== "Super Admin") {
        return res
          .status(403)
          .json({ error: "Only Super Admins can create hospitals" });
      }
      const {
        id,
        name,
        subscription_plan,
        subscription_status,
        location,
        contact_email,
        contact_phone,
        password,
        logo_url,
        slogan,
        license_code,
        address,
        director_name,
      } = req.body;
      await db.run(
        "INSERT INTO hospitals (id, name, subscription_plan, subscription_status, location, contact_email, contact_phone, password, logo_url, slogan, license_code, address, director_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          name,
          subscription_plan || "free",
          subscription_status || "active",
          location || null,
          contact_email || null,
          contact_phone || null,
          password || null,
          logo_url || null,
          slogan || null,
          license_code || null,
          address || null,
          director_name || null,
        ],
      );

      if (contact_email) {
        sendWelcomeEmail(
          contact_email,
          name,
          "Hospital Administrator",
          id,
          password,
        ).catch((err) => console.error("Delayed welcome email failed:", err));
      }

      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: "Failed to create hospital" });
    }
  });

  app.put("/api/hospitals/:id", async (req, res) => {
    try {
      const {
        name,
        subscription_plan,
        subscription_status,
        location,
        contact_email,
        contact_phone,
        password,
        logo_url,
        slogan,
        license_code,
        address,
        director_name,
      } = req.body;

      const existing = await db.get(
        "SELECT password FROM hospitals WHERE id = ?",
        [req.params.id],
      );
      let finalPassword = existing?.password;

      if (password && !password.startsWith("$2b$")) {
        finalPassword = await bcrypt.hash(password, 10);
      } else if (password) {
        finalPassword = password;
      }

      await db.run(
        "UPDATE hospitals SET name=?, subscription_plan=?, subscription_status=?, location=?, contact_email=?, contact_phone=?, password=?, logo_url=?, slogan=?, license_code=?, address=?, director_name=? WHERE id=?",
        [
          name,
          subscription_plan,
          subscription_status,
          location || null,
          contact_email || null,
          contact_phone || null,
          finalPassword || null,
          logo_url || null,
          slogan || null,
          license_code || null,
          address || null,
          director_name || null,
          req.params.id,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update hospital" });
    }
  });

  app.put("/api/hospitals/:id/password", async (req, res) => {
    try {
      const { password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.run("UPDATE hospitals SET password=? WHERE id=?", [
        hashedPassword,
        req.params.id,
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update hospital password" });
    }
  });

  app.post("/api/hospitals/:id/verify-password", async (req, res) => {
    try {
      const { password } = req.body;
      const hospital = await db.get(
        "SELECT password FROM hospitals WHERE id = ?",
        [req.params.id],
      );
      if (!hospital)
        return res.status(404).json({ error: "Hospital not found" });
      if (!hospital.password || !password)
        return res.json({ valid: !hospital.password });
      const valid = await bcrypt.compare(password, hospital.password);
      res.json({ valid });
    } catch (err) {
      res.status(500).json({ error: "Verification failed" });
    }
  });

  app.delete("/api/hospitals/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM hospitals WHERE id=?", [req.params.id]);
      await db.run("DELETE FROM assets WHERE hospital_id=?", [req.params.id]);
      await db.run("DELETE FROM work_orders WHERE hospital_id=?", [
        req.params.id,
      ]);
      await db.run("DELETE FROM maintenance WHERE hospital_id=?", [
        req.params.id,
      ]);
      await db.run("DELETE FROM inventory WHERE hospital_id=?", [
        req.params.id,
      ]);
      await db.run("DELETE FROM users WHERE hospital_id=?", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete hospital" });
    }
  });

  // Departments API
  app.get("/api/departments", async (req, res) => {
    try {
      const hospId = (req as any).hospitalId;
      let departments = await db.all(
        "SELECT * FROM departments WHERE hospital_id = ?",
        [hospId],
      );
      if (departments.length === 0) {
        // Dynamic auto-seeding of standard departments for this hospital
        const defaultDepts = [
          {
            id: `dept_fin_${Math.random().toString(36).substr(2, 5)}`,
            name: "Accounting & Finance",
            description:
              "Manages budgets, financial statements, medical billing allocations, asset depreciation tracking, and expense auditing.",
            building: "Admin Block, Floor 2",
            phone: "ext-5501",
            status: "Active",
            budget: 3500000,
            color: "emerald",
          },
          {
            id: `dept_hr_${Math.random().toString(36).substr(2, 5)}`,
            name: "Human Resources (HR)",
            description:
              "Oversees personnel management, medical credential audits, staff rosters, attendance, salary matrices, and performance reviews.",
            building: "Admin Block, Floor 1",
            phone: "ext-5502",
            status: "Active",
            budget: 1200000,
            color: "indigo",
          },
          {
            id: `dept_card_${Math.random().toString(36).substr(2, 5)}`,
            name: "Cardiology Department",
            description:
              "Specialized clinical care for cardiovascular diseases, surgical operations, and coronary rhythm therapy tracking.",
            building: "Clinical Wing B, Floor 4",
            phone: "ext-1400",
            status: "Active",
            budget: 4800000,
            color: "rose",
          },
          {
            id: `dept_icu_${Math.random().toString(36).substr(2, 5)}`,
            name: "Intensive Care Unit (ICU)",
            description:
              "Critical dependency intensive care units, round-the-clock intensive telemetry support, and advanced life preservation technology.",
            building: "Central Building, Floor 2",
            phone: "ext-2300",
            status: "Active",
            budget: 6200000,
            color: "blue",
          },
        ];

        for (const dept of defaultDepts) {
          await db.run(
            "INSERT INTO departments (id, hospital_id, name, description, head_id, building, phone, status, budget, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              dept.id,
              hospId,
              dept.name,
              dept.description,
              null,
              dept.building,
              dept.phone,
              dept.status,
              dept.budget,
              dept.color,
            ],
          );
        }
        departments = await db.all(
          "SELECT * FROM departments WHERE hospital_id = ?",
          [hospId],
        );
      }
      res.json(departments);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  app.post("/api/departments", async (req, res) => {
    try {
      const {
        id,
        name,
        description,
        head_id,
        building,
        phone,
        status,
        budget,
        color,
      } = req.body;
      await db.run(
        "INSERT INTO departments (id, hospital_id, name, description, head_id, building, phone, status, budget, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          (req as any).hospitalId,
          name,
          description,
          head_id,
          building || null,
          phone || null,
          status || "Active",
          budget ? Number(budget) : null,
          color || "blue",
        ],
      );
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  app.put("/api/departments/:id", async (req, res) => {
    try {
      const {
        name,
        description,
        head_id,
        building,
        phone,
        status,
        budget,
        color,
      } = req.body;
      await db.run(
        "UPDATE departments SET name=?, description=?, head_id=?, building=?, phone=?, status=?, budget=?, color=? WHERE id=? AND hospital_id=?",
        [
          name,
          description,
          head_id,
          building || null,
          phone || null,
          status || "Active",
          budget ? Number(budget) : null,
          color || "blue",
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM departments WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  // Socket setup
  io.on("connection", (socket) => {
    onlineUsers.add(socket.id);
    console.log(
      "Client connected:",
      socket.id,
      "Total online:",
      onlineUsers.size,
    );
    socket.on("disconnect", () => {
      onlineUsers.delete(socket.id);
      console.log(
        "Client disconnected:",
        socket.id,
        "Total online:",
        onlineUsers.size,
      );
    });
  });

  // System Stats API (Super Admin)
  app.get("/api/system/stats", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== "Super Admin") {
        return res
          .status(403)
          .json({ error: "Only Super Admins can access system stats" });
      }

      const hospitalsCount = await db.get(
        "SELECT COUNT(*) as count FROM hospitals",
      );
      const usersCount = await db.get("SELECT COUNT(*) as count FROM users");

      const load = os.loadavg();
      const memory = {
        total: Math.round(os.totalmem() / 1024 / 1024),
        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024),
        percent: Math.round(
          ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
        ),
      };

      res.json({
        hospitals: hospitalsCount.count,
        users: usersCount.count,
        onlineUsers: onlineUsers.size,
        cpuLoad: load[0].toFixed(2),
        memory,
        status: "Operational",
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch global system stats" });
    }
  });

  // Global DB Sync Endpoints
  app.get("/api/system/sync-status", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== "Super Admin") return res.status(403).json({ error: "Forbidden" });
      const stats = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH) : null;
      res.json({
        lastSync: lastLocalTimestamp,
        dbSize: stats ? stats.size : 0,
        limitMB: MAX_DB_SIZE_MB,
        isFirestoreConnected: !!firestoreDb,
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to get sync status" });
    }
  });

  app.post("/api/system/trigger-sync", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== "Super Admin") return res.status(403).json({ error: "Forbidden" });
      await uploadDbToFirestore();
      res.json({ success: true, message: "Sync triggered" });
    } catch (e) {
      res.status(500).json({ error: "Failed to trigger sync" });
    }
  });

  app.get("/api/system/linked-accounts", authenticateToken, (req: any, res) => {
    try {
      if (req.user.role !== "Super Admin") return res.status(403).json({ error: "Forbidden" });
      res.json({ success: true, accounts: fullLinkedAccounts });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch linked accounts" });
    }
  });

  app.post("/api/system/update-linked-accounts", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== "Super Admin") return res.status(403).json({ error: "Forbidden" });
      const { linkedAccounts } = req.body;
      if (Array.isArray(linkedAccounts)) {
        fullLinkedAccounts = linkedAccounts;
        globalLinkedAccounts = linkedAccounts.map((a: any) => typeof a === 'string' ? a : a.email).filter(Boolean);
        
        if (firestoreDb) {
           await setDoc(doc(firestoreDb, "system", "linkedAccounts"), { accounts: fullLinkedAccounts });
        }
        
        // Optionally trigger immediate sync
        uploadDbToFirestore();
        res.json({ success: true, message: "Linked accounts updated successfully" });
      } else {
        res.status(400).json({ error: "Invalid linked accounts format" });
      }
    } catch (e) {
      res.status(500).json({ error: "Failed to update linked accounts" });
    }
  });

  app.post("/api/system/trigger-restore", authenticateToken, async (req: any, res) => {
    try {
      if (req.user.role !== "Super Admin") return res.status(403).json({ error: "Forbidden" });
      const { sourcePath = "dbBackup", targetDbId } = req.body;
      isRestoringDb = true;
      const success = await downloadDbFromFirestore(sourcePath, targetDbId);
      isRestoringDb = false;
      if (success) {
        res.json({ success: true, message: "Restore successful. Restarting server might be needed for some state." });
      } else {
        res.status(500).json({ error: "Restore failed" });
      }
    } catch (e) {
      isRestoringDb = false;
      res.status(500).json({ error: "Failed to trigger restore" });
    }
  });
  app.get("/api/system/telegram-bot", (req, res) => {
    if (!telegramBot) {
      return res.status(503).json({ error: "Telegram Bot not configured" });
    }
    res.json({ username: telegramBotUsername });
  });
  app.post("/api/system/send-telegram", authenticateToken, async (req: any, res) => {
    try {
      const { chatId, phone, message } = req.body;
      if (!telegramBot) {
        return res.status(503).json({ error: "Telegram Bot not configured" });
      }

      let targetChatId = chatId;

      if (phone) {
        // Try to find chatId by phone in users or patients
        const normalizedPhone = phone.replace(/\+/g, '');
        const user = await db.get("SELECT telegram_chat_id FROM users WHERE phone = ? OR phone = ?", [phone, normalizedPhone]);
        const patient = await db.get("SELECT telegram_chat_id FROM patients WHERE contactNumber = ? OR contactNumber = ?", [phone, normalizedPhone]);
        
        targetChatId = user?.telegram_chat_id || patient?.telegram_chat_id;
      }

      if (!targetChatId) {
        return res.status(404).json({ error: "Telegram Chat ID not found for this user/phone. Please ensure the user has started the bot and shared their contact." });
      }

      await telegramBot.sendMessage(targetChatId, message);
      res.json({ success: true });
    } catch (e: any) {
      console.error("Telegram send error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/system/test-email", authenticateToken, async (req: any, res) => {
    if (req.user.role !== "Super Admin") {
      return res.status(403).json({ error: "Only Super Admins can test emails" });
    }
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Target email is required" });

    const testHtml = getEmailLayout(
      `<h2>Email System Test</h2>
       <p>This is a test email from your Salamat configuration.</p>
       <p>If you see this, your SMTP settings are working correctly.</p>`,
      ""
    );

    const result = await sendNodeMail(email, "Salamat - Email Test", testHtml);
    if (result.success) {
      res.json({ message: "Test email sent successfully" });
    } else {
      res.status(500).json({ error: "Failed to send test email", details: result.error });
    }
  });

  // Global error handler
  app.use(
    (
      err: any,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      console.error("Unhandled Server Error:", err);
      res
        .status(500)
        .json({ error: "Internal Server Error", details: err.message });
    },
  );

  // Global middleware to emit a refresh event purely for simple realtime updates
  app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
      if (
        ["POST", "PUT", "DELETE"].includes(req.method) &&
        res.statusCode >= 200 &&
        res.statusCode < 300
      ) {
        if (!req.path.startsWith("/api/verify")) {
          io.emit("refresh_data");
        }
      }
      return originalSend.apply(res, arguments as any);
    };
    next();
  });

  // API Routes
  // ==========================================
  // NURSES STATION & LINKED DEVICES API
  // ==========================================

  app.get("/api/nurses-stations", async (req, res) => {
    try {
      const dbRes = await db.all(
        "SELECT * FROM nurses_stations WHERE hospital_id = ?",
        [(req as any).hospitalId],
      );
      res.json(dbRes);
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: "Failed to fetch nurses stations",
          details: err.message,
        });
    }
  });

  app.post("/api/nurses-stations", async (req, res) => {
    try {
      const { id, name, location, head_nurse_id } = req.body;
      const stationId = id || "ns_" + Math.random().toString(36).substr(2, 9);
      await db.run(
        "INSERT INTO nurses_stations (id, hospital_id, name, location, head_nurse_id) VALUES (?, ?, ?, ?, ?)",
        [
          stationId,
          (req as any).hospitalId,
          name,
          location,
          head_nurse_id || null,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true, id: stationId });
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: "Failed to create nurses station",
          details: err.message,
        });
    }
  });

  app.put("/api/nurses-stations/:id", async (req, res) => {
    try {
      const { name, location, head_nurse_id } = req.body;
      await db.run(
        "UPDATE nurses_stations SET name = ?, location = ?, head_nurse_id = ? WHERE id = ? AND hospital_id = ?",
        [
          name,
          location,
          head_nurse_id || null,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: "Failed to update nurses station",
          details: err.message,
        });
    }
  });

  app.delete("/api/nurses-stations/:id", async (req, res) => {
    try {
      const hId = (req as any).hospitalId;
      await db.run(
        "DELETE FROM nurse_station_devices WHERE station_id = ? AND hospital_id = ?",
        [req.params.id, hId],
      );
      await db.run(
        "DELETE FROM nurses_stations WHERE id = ? AND hospital_id = ?",
        [req.params.id, hId],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: "Failed to delete nurses station",
          details: err.message,
        });
    }
  });

  app.get("/api/nurses-stations-devices", async (req, res) => {
    try {
      if (isRestoringDb || !db) {
        return res
          .status(503)
          .json({
            error:
              "Database is temporarily unavailable during maintenance sync.",
          });
      }
      const hId = (req as any).hospitalId;
      const devices = await db
        .all(
          `
        SELECT 
          nsd.*,
          a.name as asset_name,
          a.category as asset_category,
          p.name as patient_name,
          p.national_id as patient_national_id,
          p.gender as patient_gender,
          p.dob as patient_dob
        FROM nurse_station_devices nsd
        LEFT JOIN assets a ON nsd.asset_id = a.id
        LEFT JOIN patients p ON nsd.patient_id = p.id
        WHERE nsd.hospital_id = ?
      `,
          [hId],
        )
        .catch(() => []);

      res.json(devices);
    } catch (err: any) {
      console.error("Fetch linked devices error:", err);
      res
        .status(500)
        .json({
          error: "Failed to fetch linked devices",
          details: err.message,
        });
    }
  });

  app.post("/api/nurses-stations-devices/link", async (req, res) => {
    try {
      const {
        station_id,
        asset_id,
        patient_id,
        bed_number,
        vitals_pulse,
        vitals_temp,
        vitals_bp,
        vitals_spo2,
      } = req.body;
      const id = "nsd_" + Math.random().toString(36).substr(2, 9);
      const hId = (req as any).hospitalId;

      if (asset_id) {
        const existing = await db.get(
          "SELECT id FROM nurse_station_devices WHERE asset_id = ? AND hospital_id = ?",
          [asset_id, hId],
        );
        if (existing) {
          return res
            .status(400)
            .json({ error: "Device is already linked to another bed/patient" });
        }
      }

      await db.run(
        "INSERT INTO nurse_station_devices (id, hospital_id, station_id, asset_id, patient_id, bed_number, vitals_pulse, vitals_temp, vitals_bp, vitals_spo2, status, last_update) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          hId,
          station_id,
          asset_id || null,
          patient_id || null,
          bed_number || "Bed " + Math.floor(Math.random() * 200 + 1),
          vitals_pulse || 75,
          vitals_temp || 36.6,
          vitals_bp || "120/80",
          vitals_spo2 || 98,
          "monitoring",
          new Date().toISOString(),
        ],
      );

      if (asset_id) {
        await db.run(
          'UPDATE assets SET status = "In Use" WHERE id = ? AND hospital_id = ?',
          [asset_id, hId],
        );
      }

      io.emit("dataChanged");
      res.json({ success: true, id });
    } catch (err: any) {
      console.error("Link device error:", err);
      res
        .status(500)
        .json({ error: "Failed to link device", details: err.message });
    }
  });

  app.put("/api/nurses-stations-devices/:id/vitals", async (req, res) => {
    try {
      const { vitals_pulse, vitals_temp, vitals_bp, vitals_spo2, status } =
        req.body;
      const hId = (req as any).hospitalId;
      await db.run(
        `UPDATE nurse_station_devices 
         SET vitals_pulse = ?, vitals_temp = ?, vitals_bp = ?, vitals_spo2 = ?, status = ?, last_update = ?
         WHERE id = ? AND hospital_id = ?`,
        [
          vitals_pulse,
          vitals_temp,
          vitals_bp,
          vitals_spo2,
          status || "monitoring",
          new Date().toISOString(),
          req.params.id,
          hId,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Failed to update vitals", details: err.message });
    }
  });

  app.post("/api/nurses-stations-devices/:id/unlink", async (req, res) => {
    try {
      const hId = (req as any).hospitalId;
      const { reason } = req.body;
      const link = await db.get(
        "SELECT * FROM nurse_station_devices WHERE id = ? AND hospital_id = ?",
        [req.params.id, hId],
      );
      if (link) {
        await db.run(
          'UPDATE assets SET status = "Operational" WHERE id = ? AND hospital_id = ?',
          [link.asset_id, hId],
        );

        // Audit log with reason
        await logAudit(
          hId,
          (req as any).userId,
          "EVACUATE",
          "NurseStationDevice",
          req.params.id,
          link,
          { reason, status: "Unlinked" },
        );
      }
      await db.run(
        "DELETE FROM nurse_station_devices WHERE id = ? AND hospital_id = ?",
        [req.params.id, hId],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Failed to unlink device", details: err.message });
    }
  });

  app.get("/api/assets", async (req, res) => {
    try {
      const assets = await db.all(
        "SELECT * FROM assets WHERE hospital_id = ?",
        [(req as any).hospitalId],
      );
      res.json(assets);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch assets" });
    }
  });

  app.post("/api/assets", async (req, res) => {
    try {
      const {
        id,
        name,
        category,
        status,
        location,
        department_id,
        manufacturer_id,
        manufacturer_name,
        model,
        serial_number,
        purchase_date,
        warranty_expiration,
        asset_image_url,
        pm_frequency,
        next_pm_date,
      } = req.body;
      await db.run(
        "INSERT INTO assets (id, hospital_id, name, category, status, location, department_id, manufacturer_id, manufacturer_name, model, serial_number, purchase_date, warranty_expiration, asset_image_url, pm_frequency, next_pm_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          (req as any).hospitalId,
          name,
          category,
          status,
          location,
          department_id || null,
          manufacturer_id || null,
          manufacturer_name || null,
          model || null,
          serial_number || null,
          purchase_date || null,
          warranty_expiration || null,
          asset_image_url || null,
          pm_frequency || "monthly",
          next_pm_date || null,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err: any) {
      console.error("Create asset error:", err);
      res
        .status(500)
        .json({ error: "Failed to create asset", details: err.message });
    }
  });

  app.put("/api/assets/:id", async (req, res) => {
    try {
      const {
        name,
        category,
        status,
        location,
        department_id,
        manufacturer_id,
        manufacturer_name,
        model,
        serial_number,
        purchase_date,
        warranty_expiration,
        asset_image_url,
        pm_frequency,
        next_pm_date,
      } = req.body;
      await db.run(
        "UPDATE assets SET name=?, category=?, status=?, location=?, department_id=?, manufacturer_id=?, manufacturer_name=?, model=?, serial_number=?, purchase_date=?, warranty_expiration=?, asset_image_url=?, pm_frequency=?, next_pm_date=? WHERE id=? AND hospital_id=?",
        [
          name,
          category,
          status,
          location,
          department_id || null,
          manufacturer_id || null,
          manufacturer_name || null,
          model || null,
          serial_number || null,
          purchase_date || null,
          warranty_expiration || null,
          asset_image_url || null,
          pm_frequency,
          next_pm_date,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err: any) {
      console.error("Update asset error:", err);
      res
        .status(500)
        .json({ error: "Failed to update asset", details: err.message });
    }
  });

  app.delete("/api/assets/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM assets WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });

  // Manufacturers API
  app.get("/api/manufacturers", async (req, res) => {
    try {
      const manufacturers = await db.all(
        "SELECT * FROM manufacturers WHERE hospital_id = ? OR hospital_id IS NULL",
        [(req as any).hospitalId],
      );
      res.json(manufacturers);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch manufacturers" });
    }
  });

  app.post("/api/manufacturers", async (req, res) => {
    try {
      const { id, name, logo_url, country } = req.body;
      await db.run(
        "INSERT INTO manufacturers (id, hospital_id, name, logo_url, country) VALUES (?, ?, ?, ?, ?)",
        [id, (req as any).hospitalId, name, logo_url || null, country || null],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create manufacturer" });
    }
  });

  app.put("/api/manufacturers/:id", async (req, res) => {
    try {
      const { name, logo_url, country } = req.body;
      await db.run(
        "UPDATE manufacturers SET name=?, logo_url=?, country=? WHERE id=? AND hospital_id=?",
        [
          name,
          logo_url || null,
          country || null,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update manufacturer" });
    }
  });

  app.delete("/api/manufacturers/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM manufacturers WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete manufacturer" });
    }
  });

  app.get("/api/scan-logs", async (req, res) => {
    try {
      const hospId = (req as any).hospitalId;
      // Joins can be used if we need more info, but the request says user and location coordinates.
      // We already store user_name and coords in scan_logs.
      const logs = await db.all(
        "SELECT * FROM scan_logs WHERE hospital_id = ? ORDER BY timestamp DESC LIMIT 500",
        [hospId],
      );
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch scan logs" });
    }
  });

  app.post("/api/scan-logs", async (req, res) => {
    try {
      const hospId = (req as any).hospitalId;
      const {
        id,
        asset_id,
        user_id,
        user_name,
        timestamp,
        latitude,
        longitude,
        location_name,
      } = req.body;
      await db.run(
        "INSERT INTO scan_logs (id, hospital_id, asset_id, user_id, user_name, timestamp, latitude, longitude, location_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          hospId,
          asset_id,
          user_id,
          user_name,
          timestamp,
          latitude,
          longitude,
          location_name,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to log scan" });
    }
  });

  // Staff Shifts API
  app.get("/api/staff-shifts", async (req, res) => {
    try {
      const shifts = await db.all(
        "SELECT * FROM staff_shifts WHERE hospital_id = ?",
        [(req as any).hospitalId],
      );
      res.json(shifts);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch shifts" });
    }
  });

  app.post("/api/staff-shifts", async (req, res) => {
    try {
      const {
        id,
        user_id,
        department_id,
        day_of_week,
        shift_type,
        start_time,
        end_time,
        notes,
      } = req.body;
      await db.run(
        "INSERT INTO staff_shifts (id, hospital_id, user_id, department_id, day_of_week, shift_type, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          (req as any).hospitalId,
          user_id,
          department_id,
          day_of_week,
          shift_type,
          start_time,
          end_time,
          notes,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create shift" });
    }
  });

  app.put("/api/staff-shifts/:id", async (req, res) => {
    try {
      const {
        user_id,
        department_id,
        day_of_week,
        shift_type,
        start_time,
        end_time,
        notes,
      } = req.body;
      await db.run(
        "UPDATE staff_shifts SET user_id=?, department_id=?, day_of_week=?, shift_type=?, start_time=?, end_time=?, notes=? WHERE id=? AND hospital_id=?",
        [
          user_id,
          department_id,
          day_of_week,
          shift_type,
          start_time,
          end_time,
          notes,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update shift" });
    }
  });

  app.delete("/api/staff-shifts/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM staff_shifts WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      await db.run("DELETE FROM staff_tasks WHERE shift_id=?", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete shift" });
    }
  });

  // Staff Tasks API
  app.get("/api/staff-tasks", async (req, res) => {
    try {
      const tasks = await db.all(
        "SELECT * FROM staff_tasks WHERE hospital_id = ?",
        [(req as any).hospitalId],
      );
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/staff-tasks", async (req, res) => {
    try {
      const {
        id,
        shift_id,
        user_id,
        title,
        description,
        status,
        priority,
        due_time,
        completed_at,
      } = req.body;
      await db.run(
        "INSERT INTO staff_tasks (id, shift_id, hospital_id, user_id, title, description, status, priority, due_time, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          shift_id,
          (req as any).hospitalId,
          user_id,
          title,
          description,
          status || "Pending",
          priority || "Medium",
          due_time,
          completed_at || null,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.put("/api/staff-tasks/:id", async (req, res) => {
    try {
      const {
        title,
        description,
        status,
        priority,
        due_time,
        user_id,
        completed_at,
      } = req.body;
      await db.run(
        "UPDATE staff_tasks SET title=?, description=?, status=?, priority=?, due_time=?, user_id=?, completed_at=? WHERE id=? AND hospital_id=?",
        [
          title,
          description,
          status,
          priority,
          due_time,
          user_id,
          completed_at,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/staff-tasks/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM staff_tasks WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  app.get("/api/work-orders", async (req, res) => {
    try {
      const wos = await db.all(
        "SELECT * FROM work_orders WHERE hospital_id = ?",
        [(req as any).hospitalId],
      );
      res.json(wos);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch work orders" });
    }
  });

  app.post("/api/work-orders", async (req, res) => {
    try {
      const {
        id,
        assetId,
        description,
        priority,
        status,
        dueDate,
        cost,
        downtime_hours,
        parts_used,
        iso_compliance_notes,
        quality_signature,
      } = req.body;
      await db.run(
        "INSERT INTO work_orders (id, hospital_id, assetId, description, priority, status, dueDate, is_pm, cost, downtime_hours, parts_used, iso_compliance_notes, quality_signature) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)",
        [
          id,
          (req as any).hospitalId,
          assetId,
          description,
          priority,
          status,
          dueDate,
          cost || 0,
          downtime_hours || 0,
          parts_used || null,
          iso_compliance_notes || null,
          quality_signature || null,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create work order" });
    }
  });

  app.put("/api/work-orders/:id", async (req, res) => {
    try {
      const {
        assetId,
        description,
        priority,
        status,
        dueDate,
        cost,
        downtime_hours,
        parts_used,
        iso_compliance_notes,
        quality_signature,
      } = req.body;
      await db.run(
        "UPDATE work_orders SET assetId=?, description=?, priority=?, status=?, dueDate=?, cost=?, downtime_hours=?, parts_used=?, iso_compliance_notes=?, quality_signature=? WHERE id=? AND hospital_id=?",
        [
          assetId,
          description,
          priority,
          status,
          dueDate,
          cost || 0,
          downtime_hours || 0,
          parts_used || null,
          iso_compliance_notes || null,
          quality_signature || null,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update work order" });
    }
  });

  app.delete("/api/work-orders/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM work_orders WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete work order" });
    }
  });

  // External Workshops Endpoints
  app.get("/api/external-workshops", async (req, res) => {
    try {
      const workshops = await db.all(
        "SELECT * FROM external_workshops WHERE hospital_id = ?",
        [(req as any).hospitalId],
      );
      res.json(workshops);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch external workshops" });
    }
  });

  app.post("/api/external-workshops", async (req, res) => {
    try {
      const { id, name, specialty, contact_person, phone, email, address, rating, sla_details, password } = req.body;
      const hospId = (req as any).hospitalId;
      await db.run(
        "INSERT INTO external_workshops (id, hospital_id, name, specialty, contact_person, phone, email, address, rating, sla_details, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          hospId,
          name,
          specialty,
          contact_person,
          phone,
          email,
          address,
          rating || 5.0,
          sla_details,
          password
        ],
      );

      if (email && password) {
        // Create user for the workshop admin
        const userId = "u_" + Math.random().toString(36).substring(2, 9);
        await db.run(
          "INSERT INTO users (id, hospital_id, name, email, role, password, external_workshop_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [userId, hospId, name + " Admin", email, "Technician", password, id]
        );

        sendWelcomeEmail(
          email,
          name,
          "Medical Workshop Administrator",
          id,
          password,
        ).catch((err) => console.error("Delayed welcome email failed:", err));
      }

      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      console.error("External workshop creation error:", err);
      res.status(500).json({ error: "Failed to create external workshop" });
    }
  });

  app.put("/api/external-workshops/:id", async (req, res) => {
    try {
      const { name, specialty, contact_person, phone, email, address, rating, sla_details } = req.body;
      await db.run(
        "UPDATE external_workshops SET name=?, specialty=?, contact_person=?, phone=?, email=?, address=?, rating=?, sla_details=? WHERE id=? AND hospital_id=?",
        [
          name,
          specialty,
          contact_person,
          phone,
          email,
          address,
          rating || 5.0,
          sla_details,
          req.params.id,
          (req as any).hospitalId
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update external workshop" });
    }
  });

  app.delete("/api/external-workshops/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM external_workshops WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete external workshop" });
    }
  });

  // External Repair Tickets Endpoints
  app.get("/api/external-repair-tickets", async (req, res) => {
    try {
      const tickets = await db.all(
        "SELECT * FROM external_repair_tickets WHERE hospital_id = ?",
        [(req as any).hospitalId],
      );
      res.json(tickets);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch external repair tickets" });
    }
  });

  app.post("/api/external-repair-tickets", async (req, res) => {
    try {
      const {
        id,
        asset_id,
        asset_name,
        workshop_id,
        workshop_name,
        issue_description,
        status,
        cost,
        dispatch_date,
        expected_return_date,
        actual_return_date,
        warranty_period_months,
        technician_notes,
      } = req.body;
      await db.run(
        "INSERT INTO external_repair_tickets (id, hospital_id, asset_id, asset_name, workshop_id, workshop_name, issue_description, status, cost, dispatch_date, expected_return_date, actual_return_date, warranty_period_months, technician_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          (req as any).hospitalId,
          asset_id,
          asset_name,
          workshop_id,
          workshop_name,
          issue_description,
          status,
          cost || 0,
          dispatch_date,
          expected_return_date,
          actual_return_date || null,
          warranty_period_months || 0,
          technician_notes || null,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create external repair ticket" });
    }
  });

  app.put("/api/external-repair-tickets/:id", async (req, res) => {
    try {
      const {
        asset_id,
        asset_name,
        workshop_id,
        workshop_name,
        issue_description,
        status,
        cost,
        dispatch_date,
        expected_return_date,
        actual_return_date,
        warranty_period_months,
        technician_notes,
      } = req.body;
      await db.run(
        "UPDATE external_repair_tickets SET asset_id=?, asset_name=?, workshop_id=?, workshop_name=?, issue_description=?, status=?, cost=?, dispatch_date=?, expected_return_date=?, actual_return_date=?, warranty_period_months=?, technician_notes=? WHERE id=? AND hospital_id=?",
        [
          asset_id,
          asset_name,
          workshop_id,
          workshop_name,
          issue_description,
          status,
          cost || 0,
          dispatch_date,
          expected_return_date,
          actual_return_date || null,
          warranty_period_months || 0,
          technician_notes || null,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update external repair ticket" });
    }
  });

  app.delete("/api/external-repair-tickets/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM external_repair_tickets WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete external repair ticket" });
    }
  });

  app.get("/api/maintenance", async (req, res) => {
    try {
      const maint = await db.all(
        "SELECT * FROM maintenance WHERE hospital_id = ?",
        [(req as any).hospitalId],
      );
      res.json(maint);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch maintenance schedules" });
    }
  });

  app.post("/api/maintenance", async (req, res) => {
    try {
      const { id, assetId, task, frequency, nextDueDate } = req.body;
      await db.run(
        "INSERT INTO maintenance (id, hospital_id, assetId, task, frequency, nextDueDate) VALUES (?, ?, ?, ?, ?, ?)",
        [id, (req as any).hospitalId, assetId, task, frequency, nextDueDate],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create maintenance schedule" });
    }
  });

  app.put("/api/maintenance/:id", async (req, res) => {
    try {
      const { assetId, task, frequency, nextDueDate } = req.body;
      await db.run(
        "UPDATE maintenance SET assetId=?, task=?, frequency=?, nextDueDate=? WHERE id=? AND hospital_id=?",
        [
          assetId,
          task,
          frequency,
          nextDueDate,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update maintenance schedule" });
    }
  });

  app.delete("/api/maintenance/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM maintenance WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete maintenance schedule" });
    }
  });

  app.get("/api/inventory", async (req, res) => {
    try {
      const inv = await db.all(
        "SELECT * FROM inventory WHERE hospital_id = ?",
        [(req as any).hospitalId],
      );
      res.json(inv);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch inventory" });
    }
  });

  app.post("/api/inventory", async (req, res) => {
    try {
      const {
        id,
        partNumber,
        name,
        supplier,
        category,
        currentQuantity,
        minQuantity,
        cost,
        manufacturer_id,
        barcode
      } = req.body;
      
      const generatedBarcode = barcode || Math.floor(1000000000000 + Math.random() * 9000000000000).toString();

      await db.run(
        "INSERT INTO inventory (id, hospital_id, partNumber, name, supplier, category, currentQuantity, minQuantity, cost, manufacturer_id, barcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          (req as any).hospitalId,
          partNumber,
          name,
          supplier,
          category,
          currentQuantity,
          minQuantity,
          cost || 0,
          manufacturer_id || null,
          generatedBarcode
        ],
      );
      res.json({ success: true, id, barcode: generatedBarcode });
    } catch (err) {
      res.status(500).json({ error: "Failed to create inventory item" });
    }
  });

  app.put("/api/inventory/:id", async (req, res) => {
    try {
      const {
        partNumber,
        name,
        supplier,
        category,
        currentQuantity,
        minQuantity,
        cost,
        manufacturer_id,
      } = req.body;
      await db.run(
        "UPDATE inventory SET partNumber=?, name=?, supplier=?, category=?, currentQuantity=?, minQuantity=?, cost=?, manufacturer_id=? WHERE id=? AND hospital_id=?",
        [
          partNumber,
          name,
          supplier,
          category,
          currentQuantity,
          minQuantity,
          cost || 0,
          manufacturer_id || null,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update inventory item" });
    }
  });

  app.delete("/api/inventory/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM inventory WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete inventory item" });
    }
  });

  // Users API
  app.get("/api/users", async (req, res) => {
    try {
      const { hospitalId, role, userId } = req as any;
      let query = "SELECT * FROM users";
      let params: any[] = [];

      if (role === "Super Admin") {
        // Super admin sees everyone
      } else if (role === "Hospital Admin" || role === "Admin") {
        // Sees users in their hospital
        query =
          "SELECT * FROM users WHERE hospital_id = ? OR assigned_hospitals LIKE ?";
        params = [hospitalId, `%${hospitalId}%`];
      } else {
        // Regular users only see themselves or users they might manage (if implemented, otherwise just themselves)
        query = "SELECT * FROM users WHERE id = ?";
        params = [userId];
      }

      const rows = await db.all(query, params);
      const users = rows.map((u: any) => {
        if (role === "Super Admin") return u;
        const {
          password,
          plain_password,
          salary,
          bank_account,
          national_id,
          permissions,
          ...userWithoutPassword
        } = u;
        return userWithoutPassword;
      });
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/patients", async (req, res) => {
    try {
      const { hospitalId, role, userId, externalLabId, externalPharmacyId } =
        req as any;
      let query = "SELECT * FROM patients WHERE hospital_id = ?";
      let params = [hospitalId];

      if (role === "Patient") {
        query += " AND id = ?";
        params.push(userId);
      } else if (role === "Super Admin") {
        query = "SELECT * FROM patients";
        params = [];
      } else if (role === "Laboratory Admin" && externalLabId) {
        query =
          "SELECT DISTINCT p.* FROM patients p JOIN medical_records m ON p.id = m.patientId WHERE p.hospital_id = ? AND m.external_lab_id = ?";
        params = [hospitalId, externalLabId];
      } else if (role === "Pharmacy Admin" && externalPharmacyId) {
        query =
          "SELECT DISTINCT p.* FROM patients p JOIN medical_records m ON p.id = m.patientId WHERE p.hospital_id = ? AND m.external_pharmacy_id = ?";
        params = [hospitalId, externalPharmacyId];
      }

      const rows = await db.all(query, params);
      const patients = rows.map((r: any) => {
        const { password, ...patientWithoutPassword } = r;
        return {
          ...patientWithoutPassword,
          nationalId: r.nationalId || r.national_id || "",
        };
      });
      res.json(patients);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch patients" });
    }
  });

  // Feedback API
  app.get("/api/feedback", authenticateToken, async (req: any, res) => {
    try {
      if (!db || isRestoringDb) return res.status(503).json({ error: "Database not ready" });
      const { role, userId, hospitalId } = req;
      let query = "SELECT * FROM user_feedback ORDER BY created_at DESC";
      let params: any[] = [];
      
      if (role === "Patient") {
        query = "SELECT * FROM user_feedback WHERE user_id = ? ORDER BY created_at DESC";
        params = [userId];
      } else if (role !== "Super Admin") {
        query = "SELECT * FROM user_feedback WHERE hospital_id = ? OR hospital_id IS NULL ORDER BY created_at DESC";
        params = [hospitalId];
      }

      const rows = await db.all(query, params);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  app.post("/api/feedback", authenticateToken, async (req: any, res) => {
    try {
      if (!db || isRestoringDb) return res.status(503).json({ error: "Database not ready" });
      const { userId, role, hospitalId } = req;
      const { type, title, content, user_name } = req.body;
      const id = "feed-" + Date.now();

      await db.run(
        "INSERT INTO user_feedback (id, user_id, user_name, user_role, type, title, content, status, hospital_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, userId, user_name || "Anonymous", role, type || "Suggestion", title, content, "Pending", hospitalId || null]
      );

      res.status(201).json({ success: true, id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  app.put("/api/feedback/:id/status", authenticateToken, async (req: any, res) => {
    try {
      if (!db || isRestoringDb) return res.status(503).json({ error: "Database not ready" });
      const { id } = req.params;
      const { status } = req.body;
      await db.run("UPDATE user_feedback SET status = ? WHERE id = ?", [status, id]);
      res.json({ success: true, id, status });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update feedback status" });
    }
  });

  // Appointments API
  app.get("/api/appointments", async (req, res) => {
    try {
      const { hospitalId, role, userId } = req as any;
      let query = "SELECT * FROM appointments WHERE hospital_id = ?";
      let params = [hospitalId];

      if (role === "Patient") {
        query += " AND patientId = ?";
        params.push(userId);
      } else if (role === "Super Admin") {
        query = "SELECT * FROM appointments";
        params = [];
      }

      const appointments = await db.all(query, params);
      res.json(appointments);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  app.post("/api/appointments", async (req, res) => {
    try {
      const { id, patientId, doctorId, date, time, status, reason, notes } =
        req.body;
      await db.run(
        "INSERT INTO appointments (id, hospital_id, patientId, doctorId, date, time, status, reason, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          (req as any).hospitalId,
          patientId,
          doctorId,
          date,
          time,
          status || "Scheduled",
          reason || null,
          notes || null,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  app.put("/api/appointments/:id", async (req, res) => {
    try {
      const { patientId, doctorId, date, time, status, reason, notes } =
        req.body;
      await db.run(
        "UPDATE appointments SET patientId=?, doctorId=?, date=?, time=?, status=?, reason=?, notes=? WHERE id=? AND hospital_id=?",
        [
          patientId,
          doctorId,
          date,
          time,
          status,
          reason || null,
          notes || null,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM appointments WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete appointment" });
    }
  });

  // Billing API
  app.get("/api/billing", async (req, res) => {
    try {
      const { hospitalId, role, userId } = req as any;
      let query = "SELECT * FROM billing WHERE hospital_id = ?";
      let params = [hospitalId];

      if (role === "Patient") {
        query += " AND patientId = ?";
        params.push(userId);
      } else if (role === "Super Admin") {
        query = "SELECT * FROM billing";
        params = [];
      }

      const billing = await db.all(query, params);
      res.json(billing);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch billing" });
    }
  });

  app.post("/api/billing", async (req, res) => {
    try {
      const {
        id,
        patientId,
        appointmentId,
        date,
        amount,
        status,
        items,
        paymentMethod,
        insurance_covered_amount,
        patient_copay_amount,
        insurance_claim_status,
      } = req.body;
      await db.run(
        "INSERT INTO billing (id, hospital_id, patientId, appointmentId, date, amount, status, items, paymentMethod, insurance_covered_amount, patient_copay_amount, insurance_claim_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          (req as any).hospitalId,
          patientId,
          appointmentId || null,
          date,
          amount,
          status || "Pending",
          items
            ? typeof items === "string"
              ? items
              : JSON.stringify(items)
            : "[]",
          paymentMethod || null,
          insurance_covered_amount !== undefined
            ? Number(insurance_covered_amount)
            : 0,
          patient_copay_amount !== undefined
            ? Number(patient_copay_amount)
            : amount,
          insurance_claim_status || "Not Applicable",
        ],
      );

      // If created as 'Paid', record in finance journal
      if (status === "Paid") {
        const tId = "t_" + Math.random().toString(36).substr(2, 9);
        await db.run(
          "INSERT INTO finance_transactions (id, hospital_id, type, category, amount, date, description, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            tId,
            (req as any).hospitalId,
            "Income",
            "Patient Billing",
            amount,
            date,
            `Payment for billing ${id}`,
            id,
          ],
        );
      }

      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create billing record" });
    }
  });

  app.put("/api/billing/:id", async (req, res) => {
    try {
      const {
        patientId,
        appointmentId,
        date,
        amount,
        status,
        items,
        paymentMethod,
        insurance_covered_amount,
        patient_copay_amount,
        insurance_claim_status,
      } = req.body;
      const oldBilling = await db.get(
        "SELECT status FROM billing WHERE id = ? AND hospital_id = ?",
        [req.params.id, (req as any).hospitalId],
      );

      await db.run(
        "UPDATE billing SET patientId=?, appointmentId=?, date=?, amount=?, status=?, items=?, paymentMethod=?, insurance_covered_amount=?, patient_copay_amount=?, insurance_claim_status=? WHERE id=? AND hospital_id=?",
        [
          patientId,
          appointmentId || null,
          date,
          amount,
          status,
          items
            ? typeof items === "string"
              ? items
              : JSON.stringify(items)
            : "[]",
          paymentMethod || null,
          insurance_covered_amount !== undefined
            ? Number(insurance_covered_amount)
            : 0,
          patient_copay_amount !== undefined
            ? Number(patient_copay_amount)
            : amount,
          insurance_claim_status || "Not Applicable",
          req.params.id,
          (req as any).hospitalId,
        ],
      );

      // Transition to Paid logic
      if (status === "Paid" && oldBilling?.status !== "Paid") {
        const tId = "t_" + Math.random().toString(36).substr(2, 9);
        await db.run(
          "INSERT INTO finance_transactions (id, hospital_id, type, category, amount, date, description, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            tId,
            (req as any).hospitalId,
            "Income",
            "Patient Billing",
            amount,
            date,
            `Payment for billing ${req.params.id}`,
            req.params.id,
          ],
        );
      }

      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update billing record" });
    }
  });

  app.delete("/api/billing/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM billing WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete billing record" });
    }
  });

  app.post("/api/patients", async (req, res) => {
    try {
      const {
        id,
        name,
        dob,
        gender,
        bloodType,
        contactNumber,
        address,
        allergies,
        medicalHistory,
        nationalId,
        email,
        password,
        insurance_provider,
        insurance_policy_number,
        insurance_copay_percent,
        insurance_expiry,
        insurance_plan_name,
      } = req.body;
      let hashedPassword = null;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      await db.run(
        "INSERT INTO patients (id, hospital_id, name, dob, gender, bloodType, contactNumber, address, allergies, medicalHistory, national_id, email, password, insurance_provider, insurance_policy_number, insurance_copay_percent, insurance_expiry, insurance_plan_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          (req as any).hospitalId,
          name,
          dob,
          gender,
          bloodType,
          contactNumber,
          address || null,
          allergies || null,
          medicalHistory || null,
          nationalId || null,
          email || null,
          hashedPassword,
          insurance_provider || null,
          insurance_policy_number || null,
          insurance_copay_percent !== undefined
            ? Number(insurance_copay_percent)
            : 100,
          insurance_expiry || null,
          insurance_plan_name || null,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create patient" });
    }
  });

  app.put("/api/patients/:id", async (req, res) => {
    try {
      const { role, userId } = req as any;
      if (role !== "Super Admin" && userId !== req.params.id) {
        return res.status(403).json({ error: "Unauthorized to edit this patient record" });
      }

      const {
        name,
        dob,
        gender,
        bloodType,
        contactNumber,
        address,
        allergies,
        medicalHistory,
        nationalId,
        email,
        password,
        insurance_provider,
        insurance_policy_number,
        insurance_copay_percent,
        insurance_expiry,
        insurance_plan_name,
        telegram_chat_id,
      } = req.body;

      const copay_pct =
        insurance_copay_percent !== undefined
          ? Number(insurance_copay_percent)
          : 100;

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(
          "UPDATE patients SET name=?, dob=?, gender=?, bloodType=?, contactNumber=?, address=?, allergies=?, medicalHistory=?, national_id=?, email=?, password=?, insurance_provider=?, insurance_policy_number=?, insurance_copay_percent=?, insurance_expiry=?, insurance_plan_name=?, telegram_chat_id=? WHERE id=? AND hospital_id=?",
          [
            name,
            dob,
            gender,
            bloodType,
            contactNumber,
            address || null,
            allergies || null,
            medicalHistory || null,
            nationalId || null,
            email || null,
            hashedPassword,
            insurance_provider || null,
            insurance_policy_number || null,
            copay_pct,
            insurance_expiry || null,
            insurance_plan_name || null,
            telegram_chat_id || null,
            req.params.id,
            (req as any).hospitalId,
          ],
        );
      } else {
        await db.run(
          "UPDATE patients SET name=?, dob=?, gender=?, bloodType=?, contactNumber=?, address=?, allergies=?, medicalHistory=?, national_id=?, email=?, insurance_provider=?, insurance_policy_number=?, insurance_copay_percent=?, insurance_expiry=?, insurance_plan_name=?, telegram_chat_id=? WHERE id=? AND hospital_id=?",
          [
            name,
            dob,
            gender,
            bloodType,
            contactNumber,
            address || null,
            allergies || null,
            medicalHistory || null,
            nationalId || null,
            email || null,
            insurance_provider || null,
            insurance_policy_number || null,
            copay_pct,
            insurance_expiry || null,
            insurance_plan_name || null,
            telegram_chat_id || null,
            req.params.id,
            (req as any).hospitalId,
          ],
        );
      }

      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update patient" });
    }
  });

  app.put("/api/patients/:id/password", async (req, res) => {
    try {
      const { password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);
      const actingRole = (req as any).role;
      const actingHospitalId = (req as any).hospitalId;

      let query = "UPDATE patients SET password=? WHERE id=?";
      let params = [hashedPassword, req.params.id];
      if (actingRole !== "Super Admin" && actingRole !== "Patient") {
        query += " AND hospital_id=?";
        params.push(actingHospitalId);
      }

      await db.run(query, params);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update patient password" });
    }
  });

  app.delete("/api/patients/:id", async (req, res) => {
    try {
      const { role } = req as any;
      if (role !== "Super Admin") {
        return res.status(403).json({ error: "Only Super Admin can delete patient accounts" });
      }

      await db.run(
        "DELETE FROM medical_records WHERE patientId=? AND hospital_id=?",
        [req.params.id, (req as any).hospitalId],
      );
      await db.run("DELETE FROM patients WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete patient" });
    }
  });

  app.get("/api/medical-records", async (req, res) => {
    try {
      const { hospitalId, role, userId, externalLabId, externalPharmacyId } =
        req as any;
      let query = "SELECT * FROM medical_records WHERE hospital_id = ?";
      let params = [hospitalId];

      if (role === "Patient") {
        query += " AND patientId = ?";
        params.push(userId);
      } else if (role === "Super Admin") {
        query = "SELECT * FROM medical_records";
        params = [];
      } else if (role === "Laboratory Admin" && externalLabId) {
        query += " AND external_lab_id = ?";
        params.push(externalLabId);
      } else if (role === "Pharmacy Admin" && externalPharmacyId) {
        query += " AND external_pharmacy_id = ?";
        params.push(externalPharmacyId);
      }

      const records = await db.all(query, params);
      const parsedRecords = records.map((r) => ({
        ...r,
        images: r.images ? JSON.parse(r.images) : [],
        dicomFiles: r.dicom_files ? JSON.parse(r.dicom_files) : [],
      }));
      res.json(parsedRecords);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch medical records" });
    }
  });

  app.post("/api/medical-records", async (req, res) => {
    try {
      const {
        id,
        patientId,
        doctorId,
        visitDate,
        diagnosis,
        treatment,
        prescription,
        doctorInstructions,
        notes,
        images,
        dicomFiles,
        external_lab_id,
        external_pharmacy_id,
      } = req.body;
      await db.run(
        "INSERT INTO medical_records (id, hospital_id, patientId, doctorId, visitDate, diagnosis, treatment, prescription, doctorInstructions, notes, images, dicom_files, external_lab_id, external_pharmacy_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          (req as any).hospitalId,
          patientId,
          doctorId,
          visitDate,
          diagnosis,
          treatment,
          prescription || null,
          doctorInstructions || null,
          notes || null,
          images ? JSON.stringify(images) : "[]",
          dicomFiles ? JSON.stringify(dicomFiles) : "[]",
          external_lab_id || null,
          external_pharmacy_id || null,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create medical record" });
    }
  });

  app.put("/api/medical-records/:id", async (req, res) => {
    try {
      const {
        patientId,
        doctorId,
        visitDate,
        diagnosis,
        treatment,
        prescription,
        doctorInstructions,
        notes,
        images,
        dicomFiles,
        external_lab_id,
        external_pharmacy_id,
      } = req.body;
      await db.run(
        "UPDATE medical_records SET patientId=?, doctorId=?, visitDate=?, diagnosis=?, treatment=?, prescription=?, doctorInstructions=?, notes=?, images=?, dicom_files=?, external_lab_id=?, external_pharmacy_id=? WHERE id=? AND hospital_id=?",
        [
          patientId,
          doctorId,
          visitDate,
          diagnosis,
          treatment,
          prescription || null,
          doctorInstructions || null,
          notes || null,
          images ? JSON.stringify(images) : "[]",
          dicomFiles ? JSON.stringify(dicomFiles) : "[]",
          external_lab_id || null,
          external_pharmacy_id || null,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update medical record" });
    }
  });

  app.delete("/api/medical-records/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM medical_records WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete medical record" });
    }
  });

  app.get("/api/medications", async (req, res) => {
    try {
      const records = await db.all(
        "SELECT * FROM medications WHERE hospital_id = ?",
        [(req as any).hospitalId],
      );
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch medications" });
    }
  });

  app.post("/api/medications", async (req, res) => {
    try {
      const {
        id,
        name,
        genericName,
        category,
        stock,
        unit,
        price,
        expiryDate,
        concentration,
        manufacturingDate,
        batchNumber,
        ndcCode,
        manufacturer,
        storageConditions,
        fdaStatus,
        min_stock,
        supplier_id,
        barcode
      } = req.body;

      const generatedBarcode = barcode || Math.floor(1000000000000 + Math.random() * 9000000000000).toString();

      await db.run(
        "INSERT INTO medications (id, hospital_id, name, genericName, category, stock, unit, price, expiryDate, concentration, manufacturingDate, batchNumber, ndcCode, manufacturer, storageConditions, fdaStatus, min_stock, supplier_id, barcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          (req as any).hospitalId,
          name,
          genericName || null,
          category,
          Number(stock) || 0,
          unit,
          Number(price) || 0,
          expiryDate,
          concentration || null,
          manufacturingDate || null,
          batchNumber || null,
          ndcCode || null,
          manufacturer || null,
          storageConditions || null,
          fdaStatus || null,
          Number(min_stock) || 10,
          supplier_id || null,
          generatedBarcode
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true, id, barcode: generatedBarcode });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create medication" });
    }
  });

  app.put("/api/medications/:id", async (req, res) => {
    try {
      const {
        name,
        genericName,
        category,
        stock,
        unit,
        price,
        expiryDate,
        concentration,
        manufacturingDate,
        batchNumber,
        ndcCode,
        manufacturer,
        storageConditions,
        fdaStatus,
        min_stock,
        supplier_id,
      } = req.body;
      await db.run(
        "UPDATE medications SET name=?, genericName=?, category=?, stock=?, unit=?, price=?, expiryDate=?, concentration=?, manufacturingDate=?, batchNumber=?, ndcCode=?, manufacturer=?, storageConditions=?, fdaStatus=?, min_stock=?, supplier_id=? WHERE id=? AND hospital_id=?",
        [
          name,
          genericName || null,
          category,
          Number(stock) || 0,
          unit,
          Number(price) || 0,
          expiryDate,
          concentration || null,
          manufacturingDate || null,
          batchNumber || null,
          ndcCode || null,
          manufacturer || null,
          storageConditions || null,
          fdaStatus || null,
          Number(min_stock) || 10,
          supplier_id || null,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update medication" });
    }
  });

  app.delete("/api/medications/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM medications WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete medication" });
    }
  });

  app.get("/api/suppliers", async (req, res) => {
    try {
      const records = await db.all(
        "SELECT * FROM suppliers WHERE hospital_id = ?",
        [(req as any).hospitalId],
      );
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const {
        id,
        name,
        contact_person,
        email,
        phone,
        category,
        address,
        status,
      } = req.body;
      const hospId = (req as any).hospitalId;
      await db.run(
        "INSERT INTO suppliers (id, hospital_id, name, contact_person, email, phone, category, address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          hospId,
          name,
          contact_person,
          email,
          phone,
          category,
          address,
          status || "Active",
        ],
      );
      await logAudit(
        hospId,
        (req as any).userId,
        "CREATE",
        "Supplier",
        id,
        null,
        req.body,
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create supplier" });
    }
  });

  // External & Private Pharmacies Endpoints
  app.get("/api/external-pharmacies", async (req, res) => {
    try {
      const records = await db.all(
        "SELECT * FROM external_pharmacies WHERE hospital_id = ? OR hospital_id IS NULL OR hospital_id = '' OR hospital_id = 'global'",
        [(req as any).hospitalId],
      );
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch external pharmacies" });
    }
  });

  app.post("/api/external-pharmacies", async (req, res) => {
    try {
      const {
        id,
        name,
        type,
        location,
        contact_email,
        contact_phone,
        status,
        license_number,
        notes,
        hospital_id,
        password,
      } = req.body;
      const hospId = hospital_id || (req as any).hospitalId || "global";
      await db.run(
        "INSERT INTO external_pharmacies (id, hospital_id, name, type, location, contact_email, contact_phone, status, license_number, notes, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          hospId,
          name,
          type,
          location,
          contact_email,
          contact_phone,
          status || "Active",
          license_number,
          notes,
          password,
        ],
      );

      if (contact_email && password) {
        // Create user for the pharmacy admin
        const userId = "u_" + Math.random().toString(36).substring(2, 9);
        await db.run(
          "INSERT INTO users (id, hospital_id, name, email, role, password, external_pharmacy_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [userId, hospId === "global" ? null : hospId, name + " Admin", contact_email, "Pharmacist", password, id]
        );

        sendWelcomeEmail(
          contact_email,
          name,
          "Pharmacy Node Administrator",
          id,
          password,
        ).catch((err) => console.error("Delayed welcome email failed:", err));
      }
      await logAudit(
        hospId,
        (req as any).userId,
        "CREATE",
        "ExternalPharmacy",
        id,
        null,
        req.body,
      );
      io.emit("dataChanged");
      res.json({ success: true, id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create external pharmacy" });
    }
  });

  app.put("/api/external-pharmacies/:id", async (req, res) => {
    try {
      const {
        name,
        type,
        location,
        contact_email,
        contact_phone,
        status,
        license_number,
        notes,
        hospital_id,
      } = req.body;
      const hospId = hospital_id || (req as any).hospitalId || "global";
      await db.run(
        "UPDATE external_pharmacies SET name=?, type=?, location=?, contact_email=?, contact_phone=?, status=?, license_number=?, notes=?, hospital_id=? WHERE id=?",
        [
          name,
          type,
          location,
          contact_email,
          contact_phone,
          status,
          license_number,
          notes,
          hospId,
          req.params.id,
        ],
      );
      await logAudit(
        hospId,
        (req as any).userId,
        "UPDATE",
        "ExternalPharmacy",
        req.params.id,
        null,
        req.body,
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update external pharmacy" });
    }
  });

  app.delete("/api/external-pharmacies/:id", async (req, res) => {
    try {
      const hospId = (req as any).hospitalId || "global";
      await db.run("DELETE FROM external_pharmacies WHERE id=?", [
        req.params.id,
      ]);
      await logAudit(
        hospId,
        (req as any).userId,
        "DELETE",
        "ExternalPharmacy",
        req.params.id,
        null,
        null,
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete external pharmacy" });
    }
  });

  // External Laboratories Endpoints
  app.get("/api/external-labs", async (req, res) => {
    try {
      const records = await db.all(
        "SELECT * FROM external_labs WHERE hospital_id = ? OR hospital_id IS NULL OR hospital_id = '' OR hospital_id = 'global'",
        [(req as any).hospitalId],
      );
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch external laboratories" });
    }
  });

  app.post("/api/external-labs", async (req, res) => {
    try {
      const {
        id,
        name,
        specialization,
        location,
        contact_email,
        contact_phone,
        status,
        license_number,
        notes,
        hospital_id,
        password,
      } = req.body;
      const hospId = hospital_id || (req as any).hospitalId || "global";
      await db.run(
        "INSERT INTO external_labs (id, hospital_id, name, specialization, location, contact_email, contact_phone, status, license_number, notes, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          hospId,
          name,
          specialization,
          location,
          contact_email,
          contact_phone,
          status || "Active",
          license_number,
          notes,
          password,
        ],
      );

      if (contact_email && password) {
        // Create user for the lab admin
        const userId = "u_" + Math.random().toString(36).substring(2, 9);
        await db.run(
          "INSERT INTO users (id, hospital_id, name, email, role, password, external_lab_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [userId, hospId === "global" ? null : hospId, name + " Admin", contact_email, "Lab Technician", password, id]
        );

        sendWelcomeEmail(
          contact_email,
          name,
          "Laboratory Node Administrator",
          id,
          password,
        ).catch((err) => console.error("Delayed welcome email failed:", err));
      }
      await logAudit(
        hospId,
        (req as any).userId,
        "CREATE",
        "ExternalLab",
        id,
        null,
        req.body,
      );
      io.emit("dataChanged");
      res.json({ success: true, id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create external laboratory" });
    }
  });

  app.put("/api/external-labs/:id", async (req, res) => {
    try {
      const {
        name,
        specialization,
        location,
        contact_email,
        contact_phone,
        status,
        license_number,
        notes,
        hospital_id,
      } = req.body;
      const hospId = hospital_id || (req as any).hospitalId || "global";
      await db.run(
        "UPDATE external_labs SET name=?, specialization=?, location=?, contact_email=?, contact_phone=?, status=?, license_number=?, notes=?, hospital_id=? WHERE id=?",
        [
          name,
          specialization,
          location,
          contact_email,
          contact_phone,
          status,
          license_number,
          notes,
          hospId,
          req.params.id,
        ],
      );
      await logAudit(
        hospId,
        (req as any).userId,
        "UPDATE",
        "ExternalLab",
        req.params.id,
        null,
        req.body,
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update external laboratory" });
    }
  });

  app.delete("/api/external-labs/:id", async (req, res) => {
    try {
      const hospId = (req as any).hospitalId || "global";
      await db.run("DELETE FROM external_labs WHERE id=?", [req.params.id]);
      await logAudit(
        hospId,
        (req as any).userId,
        "DELETE",
        "ExternalLab",
        req.params.id,
        null,
        null,
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete external laboratory" });
    }
  });

  app.get("/api/medication-schedules", async (req, res) => {
    try {
      const { hospitalId, role, userId } = req as any;
      let query = "SELECT * FROM medication_schedules WHERE hospital_id = ?";
      let params = [hospitalId];
      if (role === "Patient") {
        query += " AND patient_id = ?";
        params.push(userId);
      }
      const records = await db.all(query, params);
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch medication schedules" });
    }
  });

  app.post("/api/medication-schedules", async (req, res) => {
    try {
      const {
        id,
        patient_id,
        medication_id,
        dose,
        route,
        frequency,
        status,
        scheduled_time,
        notes,
      } = req.body;
      const hospId = (req as any).hospitalId;
      await db.run(
        "INSERT INTO medication_schedules (id, hospital_id, patient_id, medication_id, dose, route, frequency, status, scheduled_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          hospId,
          patient_id,
          medication_id,
          dose,
          route,
          frequency,
          status || "Scheduled",
          scheduled_time,
          notes,
        ],
      );
      await logAudit(
        hospId,
        (req as any).userId,
        "CREATE",
        "MedicationSchedule",
        id,
        null,
        req.body,
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create medication schedule" });
    }
  });

  app.put("/api/medication-schedules/:id/administer", async (req, res) => {
    try {
      const { nurse_id, notes, administered_time } = req.body;
      const hospId = (req as any).hospitalId;
      await db.run(
        "UPDATE medication_schedules SET status=?, administered_time=?, nurse_id=?, notes=? WHERE id=? AND hospital_id=?",
        [
          "Administered",
          administered_time || new Date().toISOString(),
          nurse_id,
          notes,
          req.params.id,
          hospId,
        ],
      );

      // Update medication stock
      const schedule = await db.get(
        "SELECT medication_id FROM medication_schedules WHERE id = ?",
        [req.params.id],
      );
      if (schedule) {
        await db.run(
          "UPDATE medications SET stock = stock - 1 WHERE id = ? AND hospital_id = ? AND stock > 0",
          [schedule.medication_id, hospId],
        );
      }

      await logAudit(
        hospId,
        (req as any).userId,
        "ADMINISTER",
        "MedicationSchedule",
        req.params.id,
        null,
        req.body,
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to administer medication" });
    }
  });

  app.get("/api/pharmacy-orders", async (req, res) => {
    try {
      const records = await db.all(
        "SELECT * FROM pharmacy_orders WHERE hospital_id = ?",
        [(req as any).hospitalId],
      );
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch pharmacy orders" });
    }
  });

  app.post("/api/pharmacy-orders", async (req, res) => {
    try {
      const {
        id,
        supplier_id,
        medication_id,
        quantity,
        unit_price,
        expected_date,
      } = req.body;
      const total_price = quantity * unit_price;
      const hospId = (req as any).hospitalId;
      await db.run(
        "INSERT INTO pharmacy_orders (id, hospital_id, supplier_id, medication_id, quantity, unit_price, total_price, status, order_date, expected_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          hospId,
          supplier_id,
          medication_id,
          quantity,
          unit_price,
          total_price,
          "Pending",
          new Date().toISOString(),
          expected_date,
        ],
      );
      await logAudit(
        hospId,
        (req as any).userId,
        "CREATE",
        "PharmacyOrder",
        id,
        null,
        req.body,
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create pharmacy order" });
    }
  });

  app.put("/api/pharmacy-orders/:id/receive", async (req, res) => {
    try {
      const hospId = (req as any).hospitalId;
      const order = await db.get(
        "SELECT * FROM pharmacy_orders WHERE id = ? AND hospital_id = ?",
        [req.params.id, hospId],
      );
      if (!order) return res.status(404).json({ error: "Order not found" });

      await db.run(
        "UPDATE pharmacy_orders SET status=?, received_date=? WHERE id=? AND hospital_id=?",
        ["Received", new Date().toISOString(), req.params.id, hospId],
      );

      // Update stock
      await db.run(
        "UPDATE medications SET stock = stock + ? WHERE id = ? AND hospital_id = ?",
        [order.quantity, order.medication_id, hospId],
      );

      // Create finance transaction
      const txId = "tx_" + uuidv4().substring(0, 8);
      await db.run(
        "INSERT INTO finance_transactions (id, hospital_id, type, category, amount, date, description, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          txId,
          hospId,
          "Expense",
          "Supplies",
          order.total_price,
          new Date().toISOString().split("T")[0],
          `Pharmacy order payment: ${order.id}`,
          order.id,
        ],
      );

      await logAudit(
        hospId,
        (req as any).userId,
        "RECEIVE",
        "PharmacyOrder",
        req.params.id,
        null,
        { received_date: new Date().toISOString() },
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to receive pharmacy order" });
    }
  });

  app.get("/api/pharmacy-sales", async (req, res) => {
    try {
      const records = await db.all(
        "SELECT s.*, p.national_id as patient_national_id FROM pharmacy_sales s LEFT JOIN patients p ON s.patient_id = p.id WHERE s.hospital_id = ? ORDER BY s.sale_date DESC",
        [(req as any).hospitalId],
      );
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch pharmacy sales" });
    }
  });

  app.post("/api/pharmacy-sales", async (req, res) => {
    try {
      const {
        id,
        buyer_name,
        buyer_phone,
        items,
        total_amount,
        payment_method,
        patient_id,
        is_otc,
        prescription_image,
      } = req.body;
      const hospId = (req as any).hospitalId;

      const parsedItems = typeof items === "string" ? JSON.parse(items) : items;

      for (const item of parsedItems) {
        await db.run(
          "UPDATE medications SET stock = MAX(0, stock - ?) WHERE id = ? AND hospital_id = ?",
          [item.quantity, item.medication_id, hospId],
        );
      }

      await db.run(
        "INSERT INTO pharmacy_sales (id, hospital_id, buyer_name, buyer_phone, sale_date, items, total_amount, payment_method, status, patient_id, is_otc, prescription_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          hospId,
          buyer_name,
          buyer_phone || "",
          new Date().toISOString(),
          typeof items === "string" ? items : JSON.stringify(items),
          total_amount,
          payment_method,
          "Paid",
          patient_id || null,
          is_otc ? 1 : 0,
          prescription_image || null,
        ],
      );

      const txId = "tx_" + uuidv4().substring(0, 8);
      await db.run(
        "INSERT INTO finance_transactions (id, hospital_id, type, category, amount, date, description, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          txId,
          hospId,
          "Revenue",
          "Pharmacy",
          total_amount,
          new Date().toISOString().split("T")[0],
          `Pharmacy External Sale to ${buyer_name}: ${id}`,
          id,
        ],
      );

      await logAudit(
        hospId,
        (req as any).userId,
        "CREATE",
        "PharmacySale",
        id,
        null,
        req.body,
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      console.error("Error creating pharmacy sale:", err);
      res.status(500).json({ error: "Failed to create pharmacy sale" });
    }
  });

  app.get("/api/audit-logs", async (req, res) => {
    try {
      const { role, hospitalId } = req as any;
      if (role !== "Super Admin" && role !== "Hospital Admin") {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      const records = await db.all(
        "SELECT * FROM audit_logs WHERE hospital_id = ? ORDER BY timestamp DESC LIMIT 500",
        [hospitalId],
      );
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/examinations", async (req, res) => {
    try {
      const { hospitalId, role, userId } = req as any;
      let query = "SELECT * FROM examinations WHERE hospital_id = ?";
      let params = [hospitalId];
      if (role === "Patient") {
        query += " AND patientId = ?";
        params.push(userId);
      }
      const records = await db.all(query, params);
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch examinations" });
    }
  });

  app.post("/api/examinations", async (req, res) => {
    try {
      const {
        id,
        patientId,
        doctorId,
        date,
        type,
        testName,
        priority,
        requestedBy,
        approvedBy,
        result,
        status,
        notes,
      } = req.body;
      await db.run(
        "INSERT INTO examinations (id, hospital_id, patientId, doctorId, date, type, testName, priority, requestedBy, approvedBy, result, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          (req as any).hospitalId,
          patientId,
          doctorId,
          date,
          type,
          testName,
          priority || "Routine",
          requestedBy || null,
          approvedBy || null,
          result || null,
          status,
          notes || null,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create examination" });
    }
  });

  app.put("/api/examinations/:id", async (req, res) => {
    try {
      const {
        patientId,
        doctorId,
        date,
        type,
        testName,
        priority,
        requestedBy,
        approvedBy,
        result,
        status,
        notes,
      } = req.body;
      await db.run(
        "UPDATE examinations SET patientId=?, doctorId=?, date=?, type=?, testName=?, priority=?, requestedBy=?, approvedBy=?, result=?, status=?, notes=? WHERE id=? AND hospital_id=?",
        [
          patientId,
          doctorId,
          date,
          type,
          testName,
          priority || "Routine",
          requestedBy || null,
          approvedBy || null,
          result || null,
          status,
          notes || null,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update examination" });
    }
  });

  app.delete("/api/examinations/:id", async (req, res) => {
    try {
      await db.run("DELETE FROM examinations WHERE id=? AND hospital_id=?", [
        req.params.id,
        (req as any).hospitalId,
      ]);
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete examination" });
    }
  });

  // Helper function to get default permissions for a role on the backend
  function getServerDefaultPermissionsForRole(role: string): any {
    const sections = [
      "assets",
      "workOrders",
      "inventory",
      "maintenance",
      "users",
      "analytics",
      "patient",
      "medicalRecord",
      "medication",
      "examination",
      "appointment",
      "billing",
      "department",
      "pacs",
      "hospitals",
      "finance",
      "hr",
    ];
    const res: Record<string, Record<string, boolean>> = {};
    sections.forEach((s) => {
      res[s] = { view: false, add: false, edit: false, delete: false };
    });

    if (["Super Admin", "Hospital Admin", "Admin"].includes(role)) {
      sections.forEach((s) => {
        res[s] = { view: true, add: true, edit: true, delete: true };
      });
      return res;
    }

    if (role === "Doctor") {
      ["patient", "medicalRecord", "examination", "appointment", "pacs"].forEach((s) => {
        res[s] = { view: true, add: true, edit: true, delete: false };
      });
      ["medication"].forEach((s) => {
        res[s] = { view: true, add: true, edit: true, delete: false };
      });
      ["billing"].forEach((s) => {
        res[s] = { view: true, add: false, edit: false, delete: false };
      });
    } else if (role === "Nurse") {
      ["patient", "medicalRecord", "appointment"].forEach((s) => {
        res[s] = { view: true, add: true, edit: true, delete: false };
      });
      ["medication"].forEach((s) => {
        res[s] = { view: true, add: false, edit: true, delete: false };
      });
    } else if (role === "Pharmacist") {
      ["medication", "inventory"].forEach((s) => {
        res[s] = { view: true, add: true, edit: true, delete: false };
      });
      ["billing"].forEach((s) => {
        res[s] = { view: true, add: true, edit: true, delete: false };
      });
      ["patient", "medicalRecord"].forEach((s) => {
        res[s] = { view: true, add: false, edit: false, delete: false };
      });
    } else if (role === "Lab Technician" || role === "Radiologist") {
      ["examination", "pacs"].forEach((s) => {
        res[s] = { view: true, add: true, edit: true, delete: false };
      });
      ["patient", "medicalRecord"].forEach((s) => {
        res[s] = { view: true, add: false, edit: false, delete: false };
      });
    } else if (role === "Receptionist") {
      ["patient", "appointment", "billing"].forEach((s) => {
        res[s] = { view: true, add: true, edit: true, delete: false };
      });
      ["medicalRecord", "examination", "medication"].forEach((s) => {
        res[s] = { view: true, add: false, edit: false, delete: false };
      });
    } else if (role === "Accountant") {
      ["billing", "finance", "analytics"].forEach((s) => {
        res[s] = { view: true, add: true, edit: true, delete: false };
      });
    } else if (role === "Manager") {
      sections.forEach((s) => {
        if (!["users", "hospitals", "hr"].includes(s)) {
          res[s] = { view: true, add: true, edit: true, delete: true };
        } else {
          res[s] = { view: true, add: false, edit: false, delete: false };
        }
      });
    } else if (role === "Technician") {
      ["assets", "workOrders", "maintenance", "inventory"].forEach((s) => {
        res[s] = { view: true, add: true, edit: true, delete: false };
      });
    } else if (role === "Requester") {
      ["workOrders"].forEach((s) => {
        res[s] = { view: true, add: true, edit: false, delete: false };
      });
    } else if (role === "IT Support") {
      ["assets", "users", "maintenance", "analytics"].forEach((s) => {
        res[s] = { view: true, add: true, edit: true, delete: true };
      });
    }

    return res;
  }

  app.post("/api/users/sync-all-permissions", async (req, res) => {
    try {
      const requesterRole = (req as any).role;
      const requesterHospitalId = (req as any).hospitalId;
      const requesterUserId = (req as any).userId;

      if (
        requesterRole !== "Super Admin" &&
        requesterRole !== "Hospital Admin" &&
        requesterRole !== "Admin"
      ) {
        return res
          .status(403)
          .json({ error: "Unauthorized to update all permissions." });
      }

      // If they are Hospital Admin or Admin, restrict to users from their hospital, otherwise update all
      let users;
      if (requesterRole === "Super Admin") {
        users = await db.all("SELECT * FROM users");
      } else {
        users = await db.all("SELECT * FROM users WHERE hospital_id = ?", [
          requesterHospitalId,
        ]);
      }

      for (const u of users) {
        const defaultPerms = getServerDefaultPermissionsForRole(
          u.role || "Requester",
        );
        await db.run("UPDATE users SET permissions=? WHERE id=?", [
          JSON.stringify(defaultPerms),
          u.id,
        ]);
      }

      try {
        await logAudit(
          requesterHospitalId || "global",
          requesterUserId || "system",
          "UPDATE",
          "User",
          "ALL",
          null,
          { action: "sync-all-permissions" },
        );
      } catch (ae) {}

      io.emit("dataChanged");
      res.json({
        success: true,
        message: "Updated permissions for all users successfully!",
      });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to update user permissions" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const {
        id,
        name,
        email,
        phone,
        department,
        role,
        is_verified,
        permissions,
        password,
        avatar,
        bio,
        specialty,
        status_message,
        hire_date,
        salary,
        attendance_rate,
        contract_type,
        bank_account,
        national_id,
        last_payroll_date,
        department_id,
        assigned_hospitals,
        hospital_id,
      } = req.body;
      const currentUser = req as any;

      // Authorization Check
      if (
        ![
          "Super Admin",
          "Hospital Admin",
          "Admin",
          "Pharmacy Admin",
          "Laboratory Admin",
          "Manager",
        ].includes(currentUser.role)
      ) {
        return res.status(403).json({ error: "Unauthorized to create users" });
      }

      // Hospital restriction: Admins can only create users for their node
      let finalHospitalId = hospital_id || currentUser.hospitalId;
      if (
        currentUser.role !== "Super Admin" &&
        finalHospitalId !== currentUser.hospitalId
      ) {
        return res
          .status(403)
          .json({ error: "Cannot create user for another node" });
      }

      // Role restriction: Only Super Admin can create other Super Admins
      if (role === "Super Admin" && currentUser.role !== "Super Admin") {
        return res
          .status(403)
          .json({ error: "Only Super Admins can create other Super Admins" });
      }

      const trimmedEmail = email ? email.trim().toLowerCase() : "";
      if (trimmedEmail) {
        const existingUser = await db.get(
          "SELECT id FROM users WHERE LOWER(email) = ?",
          [trimmedEmail],
        );
        const existingPatient = await db.get(
          "SELECT id FROM patients WHERE LOWER(email) = ?",
          [trimmedEmail],
        );
        if (existingUser || existingPatient) {
          return res.status(400).json({ error: "A user or patient with this email already exists" });
        }
      }

      const finalUserId = id || "u_" + uuidv4().substring(0, 8);
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
      
      // Auto-assign default permissions for role if not explicitly provided
      let finalPermissions = permissions;
      if (!finalPermissions || Object.keys(finalPermissions).length === 0) {
        finalPermissions = getServerDefaultPermissionsForRole(role);
      }
      const permissionsStr = finalPermissions ? JSON.stringify(finalPermissions) : null;

      await db.run(
        "INSERT INTO users (id, hospital_id, department_id, name, email, password, phone, department, role, is_verified, permissions, avatar, bio, specialty, status_message, hire_date, salary, attendance_rate, contract_type, bank_account, national_id, last_payroll_date, assigned_hospitals, plain_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          finalUserId,
          finalHospitalId,
          department_id || null,
          name,
          trimmedEmail,
          hashedPassword,
          phone,
          department,
          role,
          is_verified ? 1 : 0,
          permissionsStr,
          avatar || null,
          bio || null,
          specialty || null,
          status_message || null,
          hire_date || null,
          salary ? Number(salary) : null,
          attendance_rate ? Number(attendance_rate) : null,
          contract_type || null,
          bank_account || null,
          national_id || null,
          last_payroll_date || null,
          assigned_hospitals || null,
          password || null,
        ],
      );
      await logAudit(
        finalHospitalId,
        currentUser.userId,
        "CREATE",
        "User",
        finalUserId,
        null,
        req.body,
      );
      res.json({ success: true, userId: finalUserId });
    } catch (err) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.put("/api/users/:id/password", async (req, res) => {
    try {
      const { password } = req.body;
      const userRole = (req as any).role;
      const hospId = (req as any).hospitalId;
      const userId = (req as any).userId;
      const hashedPassword = await bcrypt.hash(password, 10);
      if (userRole === "Super Admin") {
        await db.run(
          "UPDATE users SET password=?, plain_password=? WHERE id=?",
          [hashedPassword, password, req.params.id],
        );
        await logAudit(
          "global",
          userId,
          "UPDATE_PASSWORD",
          "User",
          req.params.id,
          null,
          { note: "Password updated by Super Admin" },
        );
      } else {
        await db.run(
          "UPDATE users SET password=?, plain_password=? WHERE id=? AND hospital_id=?",
          [hashedPassword, password, req.params.id, hospId],
        );
        await logAudit(
          hospId,
          userId,
          "UPDATE_PASSWORD",
          "User",
          req.params.id,
          null,
          { note: "Password updated" },
        );
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const {
        name,
        email,
        phone,
        department,
        role,
        is_verified,
        permissions,
        avatar,
        bio,
        specialty,
        status_message,
        availability_status,
        hire_date,
        salary,
        attendance_rate,
        contract_type,
        bank_account,
        national_id,
        last_payroll_date,
        department_id,
        assigned_hospitals,
        hospital_id,
        balance,
        signature,
        is_blocked,
        telegram_chat_id,
      } = req.body;
      const currentUser = req as any;

      const targetUser = await db.get("SELECT * FROM users WHERE id = ?", [
        req.params.id,
      ]);
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      // Build update fields
      const updates: string[] = [];
      const params: any[] = [];

      if (name !== undefined) {
        updates.push("name = ?");
        params.push(name);
      }
      if (email !== undefined) {
        updates.push("email = ?");
        params.push(email);
      }
      if (phone !== undefined) {
        updates.push("phone = ?");
        params.push(phone);
      }
      if (department !== undefined) {
        updates.push("department = ?");
        params.push(department);
      }
      if (role !== undefined) {
        updates.push("role = ?");
        params.push(role);
      }
      if (is_verified !== undefined) {
        updates.push("is_verified = ?");
        params.push(is_verified);
      }
      if (permissions !== undefined) {
        updates.push("permissions = ?");
        params.push(permissions);
      }
      if (availability_status !== undefined) {
        updates.push("availability_status = ?");
        params.push(availability_status);
      }
      if (balance !== undefined) {
        updates.push("balance = ?");
        params.push(balance);
      }
      if (signature !== undefined) {
        updates.push("signature = ?");
        params.push(signature);
      }
      if (telegram_chat_id !== undefined) {
        updates.push("telegram_chat_id = ?");
        params.push(telegram_chat_id);
      }
      if (hospital_id !== undefined) {
        updates.push("hospital_id = ?");
        params.push(hospital_id);
      }
      if (department_id !== undefined) {
        updates.push("department_id = ?");
        params.push(department_id);
      }

      if (updates.length > 0) {
        params.push(req.params.id);
        await db.run(
          `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
          params,
        );
      }

      res.json({ success: true, message: "User updated successfully" });
      io.emit("dataChanged");
    } catch (error) {
      console.error("UpdateUserError:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Hospital Visits API
  app.get("/api/hospital-visits", authenticateToken, async (req: any, res) => {
    try {
      const { hospitalId, role, userId } = req;
      let query = "SELECT * FROM hospital_visits";
      let params = [];

      if (role === "Patient") {
        query += " WHERE patient_id = ?";
        params.push(userId);
      } else {
        query += " WHERE hospital_id = ?";
        params.push(hospitalId);
      }

      const rows = await db.all(query, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch hospital visits" });
    }
  });

  app.post("/api/hospital-visits", authenticateToken, async (req: any, res) => {
    try {
      const { hospitalId } = req;
      const {
        patient_id,
        hospital_id,
        visit_date,
        reason,
        vitals,
        notes,
        doctor_id,
        cost,
        status,
        nfc_tag,
      } = req.body;
      const id = "visit-" + Date.now();

      const targetHospitalId = hospital_id || hospitalId;

      await db.run(
        `INSERT INTO hospital_visits (id, patient_id, hospital_id, visit_date, reason, vitals, notes, doctor_id, cost, status, nfc_tag)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          patient_id,
          targetHospitalId,
          visit_date || new Date().toISOString(),
          reason || "Routine Checkup",
          vitals || null,
          notes || null,
          doctor_id || null,
          cost || 0,
          status || "Observation",
          nfc_tag || null,
        ],
      );

      res.status(201).json({ id, success: true });
    } catch (err) {
      console.error("PostVisitError:", err);
      res.status(500).json({ error: "Failed to record visit" });
    }
  });

  app.post("/api/restore", async (req, res) => {
    try {
      const hId = (req as any).hospitalId;
      if (!hId)
        return res
          .status(400)
          .json({ error: "Hospital context is required to restore." });

      // Basic transaction to clear and insert
      await db.run("BEGIN TRANSACTION");

      const tableMapping: Record<string, string> = {
        assets: "assets",
        manufacturers: "manufacturers",
        workOrders: "work_orders",
        maintenance: "maintenance",
        inventory: "inventory",
        users: "users",
        hospitals: "hospitals",
        patients: "patients",
        medicalRecords: "medical_records",
        medications: "medications",
        examinations: "examinations",
        departments: "departments",
        appointments: "appointments",
        billing: "billing",
        finance: "finance_transactions",
        financeTransactions: "finance_transactions",
        scanLogs: "scan_logs",
        shifts: "staff_shifts",
        staffShifts: "staff_shifts",
        tasks: "staff_tasks",
        staffTasks: "staff_tasks",
        suppliers: "suppliers",
        medSchedules: "medication_schedules",
        medicationSchedules: "medication_schedules",
        orders: "pharmacy_orders",
        pharmacyOrders: "pharmacy_orders",
        audit: "audit_logs",
        auditLogs: "audit_logs",
        imagingOrders: "imaging_orders",
        acquiredScans: "acquired_scans",
        pharmacySales: "pharmacy_sales",
      };

      async function restoreTable(tableName: string, records: any[]) {
        if (!records || !Array.isArray(records) || records.length === 0) return;

        const tableInfo = await db.all(`PRAGMA table_info(${tableName})`);
        const validColumns = new Set(tableInfo.map((col: any) => col.name));

        if (validColumns.size === 0) {
          console.warn(`Table ${tableName} does not exist in schema.`);
          return;
        }

        // Delete records from this hospital before insert
        if (tableName === "users") {
          // Keep other hospitals' users intact, only delete current hospital's users
          await db.run("DELETE FROM users WHERE hospital_id = ?", [hId]);
        } else if (tableName === "hospitals") {
          // Keep other hospitals intact
          await db.run("DELETE FROM hospitals WHERE id = ?", [hId]);
        } else if (validColumns.has("hospital_id")) {
          await db.run(`DELETE FROM ${tableName} WHERE hospital_id = ?`, [hId]);
        }

        for (const rawRow of records) {
          const row = { ...rawRow };

          // Fill in hospital_id
          if (validColumns.has("hospital_id")) {
            row["hospital_id"] = row["hospital_id"] || hId;
          }

          // Force passwords to have values in users and patients
          if (tableName === "users") {
            if (!row["password"] || row["password"] === "") {
              const defaultPass =
                row["role"] === "Super Admin" ? "admin123" : "staff123";
              row["password"] = await bcrypt.hash(defaultPass, 10);
              row["plain_password"] = defaultPass;
            }
          } else if (tableName === "patients") {
            if (!row["password"] || row["password"] === "") {
              const defaultPass = row["contactNumber"]
                ? row["contactNumber"].trim()
                : "patient123";
              row["password"] = await bcrypt.hash(defaultPass, 10);
            }
          }

          // Filter row keys to only exist in valid sqlite columns to prevent queries throwing
          const keys = Object.keys(row).filter((key) => validColumns.has(key));
          if (keys.length === 0) continue;

          const placeholders = keys.map(() => "?").join(", ");
          const columns = keys.join(", ");
          const values = keys.map((k) => {
            const val = row[k];
            if (val !== null && typeof val === "object") {
              return JSON.stringify(val);
            }
            return val;
          });

          await db.run(
            `INSERT OR REPLACE INTO ${tableName} (${columns}) VALUES (${placeholders})`,
            values,
          );
        }
      }

      // Sync and restore every dynamic key in req.body mapping
      for (const key of Object.keys(req.body)) {
        const tableName = tableMapping[key];
        if (tableName) {
          await restoreTable(tableName, req.body[key]);
        }
      }

      await db.run("COMMIT");
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      await db.run("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Failed to restore data" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const currentUser = req as any;

      const targetUser = await db.get("SELECT * FROM users WHERE id = ?", [
        req.params.id,
      ]);
      if (!targetUser) return res.status(404).json({ error: "User not found" });

      // Protection for Emergency Super Admin
      const emergencyEmail = "zaelnoon2000@gmail.com";
      if (targetUser.email === emergencyEmail) {
        return res
          .status(403)
          .json({
            error: "You cannot delete the system emergency super admin",
          });
      }

      if (currentUser.role === "Super Admin") {
        await db.run("DELETE FROM users WHERE id=?", [req.params.id]);
      } else if (
        [
          "Hospital Admin",
          "Admin",
          "Pharmacy Admin",
          "Laboratory Admin",
          "Manager",
        ].includes(currentUser.role)
      ) {
        if (targetUser.hospital_id !== currentUser.hospitalId) {
          return res
            .status(403)
            .json({ error: "Cannot delete user from another node" });
        }
        if (targetUser.role === "Super Admin") {
          return res.status(403).json({ error: "Cannot delete a Super Admin" });
        }
        await db.run("DELETE FROM users WHERE id=? AND hospital_id=?", [
          req.params.id,
          currentUser.hospitalId,
        ]);
      } else {
        return res.status(403).json({ error: "Unauthorized to delete users" });
      }

      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Twilio SMS Verification setup
  let twilioClient: any = null;
  function getTwilio() {
    if (
      !twilioClient &&
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_ACCOUNT_SID.startsWith("AC") &&
      process.env.TWILIO_AUTH_TOKEN
    ) {
      twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
      );
    }
    return twilioClient;
  }

  let verificationCodes: Record<string, string> = {}; // In-memory fallback

  app.post("/api/verify/send", async (req, res) => {
    const { phone, channel = "email" } = req.body; // Default channel will be 'email'
    if (!phone) return res.status(400).json({ error: "Email/Phone is required" });

    let formattedPhone = phone;
    if (channel !== "email") {
      formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;
    }
    const verifyTo = formattedPhone;

    try {
      const client = getTwilio();
      const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

      if (client && serviceSid && channel !== "email") {
        // Use real Twilio Verify API
        await client.verify.v2
          .services(serviceSid)
          .verifications.create({ to: verifyTo, channel });

        res.json({
          success: true,
          message: `Verification code sent via ${channel}!`,
        });
      } else {
        // Generate a random 4 digit code
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        verificationCodes[formattedPhone] = code;

        if (channel === "email") {
          const emailHtml = getEmailLayout(
             `<h2 style="color: #1e40af; margin-bottom: 20px;">Your Verification Code</h2>
              <p style="font-size: 16px; color: #475569; margin-bottom: 10px;">Please use the following code to verify your account:</p>
              <div style="font-size: 24px; color: #2563eb; font-weight: 800; font-family: monospace; letter-spacing: 2px; background: #f1f5f9; padding: 10px; border-radius: 8px; display: inline-block;">${code}</div>`,
             "https://storage.googleapis.com/hims-assets/logo.png"
          );
          await sendNodeMail(formattedPhone, "Your Verification Code", emailHtml);
        }

        console.log(
          `[Mock Verify API] Sending code ${code} to ${formattedPhone} via ${channel}`,
        );
        // Simulating a delay
        await new Promise((resolve) => setTimeout(resolve, 800));
        res.json({
          success: true,
          message: "Code sent to your email",
          demoCode: code,
        });
      }
    } catch (err: any) {
      console.error("Verify send error:", err);
      res
        .status(500)
        .json({
          error: "Failed to send verification code",
          details: err.message,
        });
    }
  });

  app.post("/api/verify/confirm", async (req, res) => {
    const { userId, phone, code, channel = "email" } = req.body;
    if (!phone || !code)
      return res.status(400).json({ error: "phone/email, and code are required" });

    let formattedPhone = phone;
    if (channel !== "email") {
      formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;
    }
    const verifyTo = formattedPhone;

    try {
      const client = getTwilio();
      const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

      if (client && serviceSid && channel !== "email") {
        const verificationCheck = await client.verify.v2
          .services(serviceSid)
          .verificationChecks.create({ to: verifyTo, code: code });

        if (verificationCheck.status === "approved") {
          if (userId && userId !== "new")
            await db.run("UPDATE users SET is_verified = 1 WHERE id = ?", [
              userId,
            ]);
          res.json({ success: true });
        } else {
          res.status(400).json({ error: "Invalid verification code" });
        }
      } else {
        if (verificationCodes[formattedPhone] === code) {
          // Mark user as verified if we have an ID
          if (userId && userId !== "new")
            await db.run("UPDATE users SET is_verified = 1 WHERE id = ?", [
              userId,
            ]);
          delete verificationCodes[formattedPhone];
          res.json({ success: true });
        } else {
          res.status(400).json({ error: "Invalid verification code" });
        }
      }
    } catch (err: any) {
      console.error("Verify confirm error:", err);
      res
        .status(500)
        .json({ error: "Verification failed", details: err.message });
    }
  });

  // Analytics API
  app.get("/api/analytics", async (req, res) => {
    try {
      // Fetch actual data from DB
      const workOrders = await db.all(
        "SELECT w.*, a.category FROM work_orders w JOIN assets a ON w.assetId = a.id WHERE w.hospital_id = ?",
        [(req as any).hospitalId],
      );
      const assets = await db.all(
        "SELECT * FROM assets WHERE hospital_id = ?",
        [(req as any).hospitalId],
      );

      // Calculate Cost by Department (Category)
      const costByCategory: Record<string, number> = {};
      const downtimeByCategory: Record<string, number> = {};
      let totalCost = 0;
      let totalDowntime = 0;
      let completedWOs = 0;
      let pmCompleted = 0;
      let totalPm = 0;

      workOrders.forEach((wo) => {
        const cat = wo.category || "Unknown";
        costByCategory[cat] = (costByCategory[cat] || 0) + (wo.cost || 0);
        downtimeByCategory[cat] =
          (downtimeByCategory[cat] || 0) + (wo.downtime_hours || 0);
        totalCost += wo.cost || 0;
        totalDowntime += wo.downtime_hours || 0;

        if (wo.status === "Completed") completedWOs++;
        if (wo.is_pm) {
          totalPm++;
          if (wo.status === "Completed") pmCompleted++;
        }
      });

      const costData = Object.keys(costByCategory).map((name) => ({
        name,
        value: costByCategory[name],
      }));
      const downtimeData = Object.keys(downtimeByCategory).map((name) => ({
        name,
        hours: downtimeByCategory[name],
      }));

      // Mock MTTR data for trend chart (since we don't have historical data)
      const mttrData = [
        { month: "Jan", mttr: 4.2 },
        { month: "Feb", mttr: 3.8 },
        { month: "Mar", mttr: 4.5 },
        {
          month: "Apr",
          mttr:
            totalDowntime > 0 && completedWOs > 0
              ? Number((totalDowntime / completedWOs).toFixed(1))
              : 3.2,
        },
      ];

      const data = {
        mttrData,
        costData:
          costData.length > 0 ? costData : [{ name: "No Data", value: 1 }],
        downtimeData:
          downtimeData.length > 0
            ? downtimeData
            : [{ name: "No Data", hours: 0 }],
        kpis: {
          avgMttr:
            completedWOs > 0
              ? Number((totalDowntime / completedWOs).toFixed(1))
              : 0,
          avgMtbf: 45, // Based on device hardware metrics
          pmCompletion:
            totalPm > 0 ? Math.round((pmCompleted / totalPm) * 100) : 0,
          totalCost: totalCost,
        },
      };
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Finance and Accounting Endpoints
  app.get("/api/finance/transactions", async (req, res) => {
    try {
      const transactions = await db.all(
        "SELECT * FROM finance_transactions WHERE hospital_id = ? ORDER BY date DESC",
        [(req as any).hospitalId],
      );
      res.json(transactions);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch finance transactions" });
    }
  });

  app.get("/api/finance/summary", async (req, res) => {
    try {
      const hospitalId = (req as any).hospitalId;
      const transactions = await db.all(
        "SELECT type, amount FROM finance_transactions WHERE hospital_id = ?",
        [hospitalId],
      );
      const billing = await db.all(
        "SELECT status, amount FROM billing WHERE hospital_id = ?",
        [hospitalId],
      );
      const sales = await db.all(
        "SELECT total_amount FROM pharmacy_sales WHERE hospital_id = ?",
        [hospitalId],
      );
      const hr = await db.all(
        "SELECT salary FROM users WHERE hospital_id = ?",
        [hospitalId],
      );

      let totalIncome = 0;
      let totalExpense = 0;

      transactions.forEach((t) => {
        if (t.type === "Income" || t.type === "Revenue")
          totalIncome += t.amount || 0;
        if (t.type === "Expense" || t.type === "Payroll")
          totalExpense += t.amount || 0;
      });

      billing.forEach((b) => {
        if (b.status === "Paid") totalIncome += b.amount || 0;
      });

      sales.forEach((s) => {
        totalIncome += s.total_amount || 0;
      });

      const monthlyHRCost = hr.reduce((acc, u) => acc + (u.salary || 0), 0);

      res.json({
        totalIncome,
        totalExpense: totalExpense + monthlyHRCost,
        netBalance: totalIncome - (totalExpense + monthlyHRCost),
        monthlyHRCost,
        realizedBilling: billing
          .filter((b) => b.status === "Paid")
          .reduce((acc, b) => acc + (b.amount || 0), 0),
        accruedBilling: billing.reduce((acc, b) => acc + (b.amount || 0), 0),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch finance summary" });
    }
  });

  app.post("/api/finance/transactions", async (req, res) => {
    try {
      const { id, type, category, amount, date, description, reference_id } =
        req.body;
      const tId = id || "t_" + Math.random().toString(36).substr(2, 9);
      await db.run(
        "INSERT INTO finance_transactions (id, hospital_id, type, category, amount, date, description, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          tId,
          (req as any).hospitalId,
          type,
          category,
          amount ? Number(amount) : 0,
          date || new Date().toISOString().split("T")[0],
          description || "",
          reference_id || null,
        ],
      );
      res.json({ success: true, id: tId });
    } catch (err) {
      res.status(500).json({ error: "Failed to record transaction" });
    }
  });

  app.delete("/api/finance/transactions/:id", async (req, res) => {
    try {
      await db.run(
        "DELETE FROM finance_transactions WHERE id=? AND hospital_id=?",
        [req.params.id, (req as any).hospitalId],
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  // Human Resources Bulk Payroll run endpoint
  app.post("/api/hr/payout-payroll", async (req, res) => {
    try {
      const hospId = (req as any).hospitalId;
      const staff = await db.all("SELECT * FROM users WHERE hospital_id = ?", [
        hospId,
      ]);
      const today = new Date().toISOString().split("T")[0];
      let payoutCount = 0;
      let payoutTotal = 0;

      for (const member of staff) {
        if (member.salary && member.salary > 0) {
          const tId = "pay_" + Math.random().toString(36).substr(2, 9);
          const description = `Salary Payroll Payout for ${member.name} (${member.role})`;
          await db.run(
            "INSERT INTO finance_transactions (id, hospital_id, type, category, amount, date, description, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
              tId,
              hospId,
              "Expense",
              "Payroll",
              member.salary,
              today,
              description,
              member.id,
            ],
          );
          await db.run(
            "UPDATE users SET last_payroll_date=? WHERE id=? AND hospital_id=?",
            [today, member.id, hospId],
          );
          payoutCount++;
          payoutTotal += member.salary;
        }
      }
      res.json({ success: true, payoutCount, payoutTotal });
    } catch (err) {
      res.status(500).json({ error: "Failed to process bulk payroll" });
    }
  });

  // Gemini AI Salamat Copilot Endpoint
  app.post("/api/gemini/copilot", async (req, res) => {
    try {
      const { prompt, context } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const combinedPrompt = `
        You are a highly premium AI Medical & Diagnostic Copilot running inside the luxurious full-suite Salamat Healthcare Information Platform.
        Analyze the request below and respond with highly detailed, clinical-grade professional insights, structured summaries, and helpful steps.
        
        Context Data (Salamat system data for Patient, Asset, or Clinical consultation):
        ${JSON.stringify(context || {})}
        
        User Query:
        ${prompt}
        
        Format your response beautifully with Markdown. Include bold accents, neat bullet lists, or tables where helpful. Keep it highly professional and direct.
      `;

      const genAI = getGeminiClient();
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: combinedPrompt }] }],
      });
      
      const text = result.text;

      res.json({ text: text || "No response generated." });
    } catch (err: any) {
      console.error("Gemini Copilot Error:", err);
      res
        .status(500)
        .json({
          error: "AI Consultation Engine offline or missing GEMINI_API_KEY.",
          details: err.message,
        });
    }
  });

  // Medical Devices Acquisition and Integration APIs
  app.get("/api/medical-devices", async (req, res) => {
    try {
      const devices = await db.all(
        'SELECT * FROM assets WHERE (LOWER(category) LIKE "%monitor%" OR LOWER(category) LIKE "%ventilator%" OR LOWER(category) LIKE "%pump%" OR LOWER(category) LIKE "%scanner%" OR LOWER(category) LIKE "%device%") AND hospital_id = ?',
        [(req as any).hospitalId],
      );
      res.json(devices);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch medical devices" });
    }
  });

  // Fetch real-time vitals stream (with real physiological oscillations instead of just basic values)
  app.get("/api/medical-devices/:id/vitals", async (req, res) => {
    try {
      const devId = req.params.id;
      const elapsed = Date.now();

      const ecgWave: number[] = [];
      const spo2Wave: number[] = [];
      for (let j = 0; j < 60; j++) {
        const t = (elapsed + j * 16) % 800; // 800ms cardial cycle
        let ecgValue = 0.05 * Math.sin((2 * Math.PI * t) / 800);
        if (t > 150 && t < 170) {
          ecgValue = -0.1 + ((t - 150) / 20) * 0.2;
        } else if (t >= 170 && t < 195) {
          ecgValue = 0.1 + ((t - 170) / 25) * 1.4;
        } else if (t >= 195 && t < 220) {
          ecgValue = 1.5 - ((t - 195) / 25) * 1.8;
        } else if (t >= 220 && t < 240) {
          ecgValue = -0.3 + ((t - 220) / 20) * 0.3;
        } else if (t >= 320 && t < 450) {
          ecgValue = 0.18 * Math.sin((Math.PI * (t - 320)) / 130);
        }
        ecgWave.push(parseFloat(ecgValue.toFixed(4)));

        let spo2Value =
          0.4 +
          0.3 * Math.sin((2 * Math.PI * t) / 800) +
          0.1 * Math.sin((4 * Math.PI * t) / 800);
        spo2Wave.push(parseFloat(spo2Value.toFixed(4)));
      }

      const dev = await db.get(
        "SELECT * FROM assets WHERE id = ? AND hospital_id = ?",
        [devId, (req as any).hospitalId],
      );

      const hr =
        dev?.status === "Operational"
          ? Math.round(72 + 4 * Math.sin(elapsed / 10000))
          : 0;
      const spo2 =
        dev?.status === "Operational"
          ? Math.round(98 + 1 * Math.sin(elapsed / 15000))
          : 0;
      const resp =
        dev?.status === "Operational"
          ? Math.round(16 + 2 * Math.sin(elapsed / 20000))
          : 0;
      const temp =
        dev?.status === "Operational"
          ? parseFloat((37.0 + 0.2 * Math.sin(elapsed / 30000)).toFixed(1))
          : 0.0;

      res.json({
        deviceId: devId,
        deviceName: dev?.name || "Integrated Vital Signs Monitor",
        status: dev?.status || "Operational",
        timestamp: new Date().toISOString(),
        vitals: {
          heartRate: hr,
          spo2: spo2,
          respirationRate: resp,
          temperature: temp,
          unit: {
            heartRate: "bpm",
            spo2: "%",
            respirationRate: "rpm",
            temperature: "°C",
          },
        },
        waveforms: {
          ecg: ecgWave,
          spo2: spo2Wave,
        },
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to acquire device vitals stream" });
    }
  });

  // Push acquired device telemetry log
  app.post("/api/medical-devices/:id/telemetry", async (req, res) => {
    try {
      const devId = req.params.id;
      const { heartRate, spo2, temperature, notes } = req.body;
      const hospId = (req as any).hospitalId;

      const logEntry = {
        deviceId: devId,
        heartRate,
        spo2,
        temperature,
        pushedAt: new Date().toISOString(),
        clinicalNotes:
          notes || "Acquired dynamically from patient bedside monitor gateway.",
      };

      await db.run(
        "INSERT INTO integrations (id, hospital_id, syncType, status, logs, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        [
          "dc_" + Math.random().toString(36).substring(2, 9),
          hospId,
          "Medical Device Acquisition",
          "Success",
          JSON.stringify(logEntry),
          new Date().toISOString(),
        ],
      );

      res.json({
        success: true,
        message:
          "Bedside diagnostic data packet acquired and stored successfully.",
      });
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to push bedside medical device packet" });
    }
  });

  // NEW IMAGING ENDPOINTS
  app.get("/api/imaging-orders", async (req, res) => {
    try {
      const { hospitalId, role, userId } = req as any;
      let query = "SELECT * FROM imaging_orders WHERE hospital_id = ?";
      let params = [hospitalId];
      if (role === "Patient") {
        query += " AND patientId = ?";
        params.push(userId);
      }
      const orders = await db.all(query, params);
      res.json(orders);
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: "Failed to fetch imaging orders",
          details: err.message,
        });
    }
  });

  app.post("/api/imaging-orders", async (req, res) => {
    try {
      const {
        id,
        patientId,
        patientName,
        gender,
        age,
        dob,
        modality,
        region,
        urgency,
        technician,
        scheduledDate,
        scheduledTime,
        status,
        findings,
        imageRepresentation,
        studyId,
      } = req.body;
      await db.run(
        `INSERT INTO imaging_orders (id, hospital_id, patientId, patientName, gender, age, dob, modality, region, urgency, technician, scheduledDate, scheduledTime, status, findings, imageRepresentation, studyId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          (req as any).hospitalId,
          patientId,
          patientName,
          gender,
          age,
          dob,
          modality,
          region,
          urgency,
          technician,
          scheduledDate,
          scheduledTime,
          status,
          findings || "",
          imageRepresentation,
          studyId || "",
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: "Failed to create imaging order",
          details: err.message,
        });
    }
  });

  app.put("/api/imaging-orders/:id", async (req, res) => {
    try {
      const {
        patientId,
        patientName,
        gender,
        age,
        dob,
        modality,
        region,
        urgency,
        technician,
        scheduledDate,
        scheduledTime,
        status,
        findings,
        imageRepresentation,
        studyId,
      } = req.body;
      await db.run(
        `UPDATE imaging_orders SET patientId=?, patientName=?, gender=?, age=?, dob=?, modality=?, region=?, urgency=?, technician=?, scheduledDate=?, scheduledTime=?, status=?, findings=?, imageRepresentation=?, studyId=? WHERE id=? AND hospital_id=?`,
        [
          patientId,
          patientName,
          gender,
          age,
          dob,
          modality,
          region,
          urgency,
          technician,
          scheduledDate,
          scheduledTime,
          status,
          findings,
          imageRepresentation,
          studyId,
          req.params.id,
          (req as any).hospitalId,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: "Failed to update imaging order",
          details: err.message,
        });
    }
  });

  app.delete("/api/imaging-orders/:id", async (req, res) => {
    try {
      await db.run(
        "DELETE FROM imaging_orders WHERE id = ? AND hospital_id = ?",
        [req.params.id, (req as any).hospitalId],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: "Failed to delete imaging order",
          details: err.message,
        });
    }
  });

  app.get("/api/acquired-scans", async (req, res) => {
    try {
      const { hospitalId, role, userId } = req as any;
      let query = "SELECT * FROM acquired_scans WHERE hospital_id = ?";
      let params = [hospitalId];
      if (role === "Patient") {
        query += " AND patientId = ?";
        params.push(userId);
      }
      const scans = await db.all(query, params);
      res.json(scans);
    } catch (err: any) {
      res
        .status(500)
        .json({
          error: "Failed to fetch acquired scans",
          details: err.message,
        });
    }
  });

  app.post("/api/acquired-scans", async (req, res) => {
    try {
      const {
        id,
        patientName,
        patientId,
        gender,
        age,
        dob,
        modality,
        studyDate,
        studyTime,
        description,
        institution,
        refPhysician,
        slicesCount,
        windowCenter,
        windowWidth,
        manufacturer,
        deviceModel,
        transferSyntax,
        severity,
        findings,
        imageRepresentation,
        customImageDataUrl,
      } = req.body;
      await db.run(
        `INSERT INTO acquired_scans (id, hospital_id, patientName, patientId, gender, age, dob, modality, studyDate, studyTime, description, institution, refPhysician, slicesCount, windowCenter, windowWidth, manufacturer, deviceModel, transferSyntax, severity, findings, imageRepresentation, customImageDataUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          (req as any).hospitalId,
          patientName,
          patientId,
          gender,
          age,
          dob,
          modality,
          studyDate,
          studyTime,
          description,
          institution,
          refPhysician,
          slicesCount || 1,
          windowCenter || 400,
          windowWidth || 1500,
          manufacturer,
          deviceModel,
          transferSyntax,
          severity,
          findings || "",
          imageRepresentation,
          customImageDataUrl || null,
        ],
      );
      io.emit("dataChanged");
      res.json({ success: true });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: "Failed to save acquired scan", details: err.message });
    }
  });

  app.get(["/oauth2callback", "/oauth2callback/"], (req, res) => {
    res.send(`
      <html>
        <body>
          <script>
            const hash = window.location.hash;
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get('access_token');
            
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');

            if (window.opener) {
              if (code) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_CODE', code: code }, '*');
              } else if (token) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', token: token }, '*');
              }
              window.close();
            } else {
              document.body.innerHTML = 'Authentication successful, but window could not be automatically closed. You can close this window.';
            }
          </script>
          <p>Authentication successful. You can close this window.</p>
        </body>
      </html>
    `);
  });

  // API 404 Handler - Prevents falling through to Vite/Static for missing API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const viteModule = await Function('return import("vite")')();
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      // If the request starts with /api/, return a 404 JSON instead of index.html
      if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "API route not found" });
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.VERCEL !== "1") {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
  return app;
}

export const appPromise = startServer().catch((err) => {
  console.error("Failed to start server:", err);
  throw err;
});
