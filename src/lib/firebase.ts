import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { toast } from 'sonner';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase services (with HTTP long polling to prevent idle connection stream cancellations in iframe environments)
const databaseId = (firebaseConfig as any).firestoreDatabaseId || "ai-studio-9830d766-abc0-407c-8f6e-71c5da588f72";
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, databaseId);
export const auth = getAuth(app);

// Initialize the Google Auth Provider with Google Drive scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.file');

// Separate provider for simple login (no extra scopes)
export const loginProvider = new GoogleAuthProvider();

// In-Memory Token & Auth flags
let isSigningIn = false;
let cachedAccessToken: string | null = sessionStorage.getItem('gdrive_access_token');

// Error Handling helper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Hardened Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Subscribe to Auth State Changes
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        const persistedToken = sessionStorage.getItem('gdrive_access_token');
        if (persistedToken) {
          cachedAccessToken = persistedToken;
          if (onAuthSuccess) onAuthSuccess(user, persistedToken);
        } else if (!isSigningIn) {
          cachedAccessToken = null;
          if (onAuthFailure) onAuthFailure();
        }
      }
    } else {
      cachedAccessToken = null;
      sessionStorage.removeItem('gdrive_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Google sign-in workflow (called on user interaction)
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not extract Google Access Token from Authentication Credential.');
    }
    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem('gdrive_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Firebase Auth sign-in failed:', error);
    if (error.code === 'auth/popup-closed-by-user' || error.message.includes('popup-closed-by-user')) {
      toast.error('The login popup was closed. If it is being blocked, please click the "Open App" button to use this app in a New Tab!', { duration: 6000 });
    } else {
      toast.error(`Authentication Failed: ${error.message}`);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || sessionStorage.getItem('gdrive_access_token');
};

export const googleSignInForAuth = async () => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, loginProvider);
    const idToken = await result.user.getIdToken();
    return { user: result.user, idToken };
  } catch (error: any) {
    console.error('Firebase Auth sign-in failed:', error);
    if (error.code === 'auth/popup-closed-by-user' || error.message.includes('popup-closed-by-user')) {
      toast.error('The login popup was closed. If it is being blocked, please click the "Open App" button to use this app in a New Tab! (الرجاء فتح التطبيق في نافذة جديدة إذا تم حظر النافذة المنبثقة)', { duration: 6000 });
    } else {
      toast.error(`Authentication Failed (فشل تسجيل الدخول): ${error.message}`);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const firebaseLogout = async () => {
  try {
    await signOut(auth);
    cachedAccessToken = null;
    sessionStorage.removeItem('gdrive_access_token');
  } catch (error) {
    console.error('Logout failed:', error);
  }
};

// Firestore Backups Logging Integration (ABAC Isolated per Hospital)
export interface BackupRecord {
  id: string;
  hospitalId: string;
  fileId: string;
  fileName: string;
  createdAt: any;
  createdBy: string;
  size: number;
  status: string;
  payload?: any;
}

export const logBackupToFirestore = async (hospitalId: string, record: Omit<BackupRecord, 'createdAt'>) => {
  const cleanedHospitalId = hospitalId.replace(/[^a-zA-Z0-9_\-]/g, '');
  const path = `hospitals/${cleanedHospitalId}/backups/${record.id}`;
  try {
    const docRef = doc(db, 'hospitals', cleanedHospitalId, 'backups', record.id);
    await setDoc(docRef, {
      ...record,
      createdAt: serverTimestamp()
    });
    console.log('Successfully saved backup record to Firestore ledger:', path);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getBackupsFromFirestore = async (hospitalId: string): Promise<any[]> => {
  const cleanedHospitalId = hospitalId.replace(/[^a-zA-Z0-9_\-]/g, '');
  const path = `hospitals/${cleanedHospitalId}/backups`;
  try {
    const collRef = collection(db, 'hospitals', cleanedHospitalId, 'backups');
    const q = query(collRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
};

export const deleteBackupFromFirestore = async (hospitalId: string, backupId: string) => {
  const cleanedHospitalId = hospitalId.replace(/[^a-zA-Z0-9_\-]/g, '');
  const path = `hospitals/${cleanedHospitalId}/backups/${backupId}`;
  try {
    const docRef = doc(db, 'hospitals', cleanedHospitalId, 'backups', backupId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};
