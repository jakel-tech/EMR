import { Asset, WorkOrder, Maintenance } from './types';

export const initialAssets: Asset[] = [
  { id: 'a1', name: 'MRI Scanner', category: 'Radiology', status: 'Operational', location: 'Room 101' },
  { id: 'a2', name: 'X-Ray Machine', category: 'Radiology', status: 'Under Maintenance', location: 'Room 102' },
  { id: 'a3', name: 'Ventilator A', category: 'ICU', status: 'Operational', location: 'ICU Bed 1' },
  { id: 'a4', name: 'Defibrillator', category: 'ER', status: 'Broken', location: 'ER Bay 2' },
  { id: 'a5', name: 'Patient Monitor', category: 'Ward', status: 'Operational', location: 'Ward 3, Bed 12' },
];

export const initialWorkOrders: WorkOrder[] = [
  { id: 'w1', assetId: 'a2', description: 'Replace X-Ray tube', priority: 'High', status: 'In Progress', dueDate: '2026-04-02' },
  { id: 'w2', assetId: 'a4', description: 'Fix battery issue', priority: 'High', status: 'Pending', dueDate: '2026-04-01' },
  { id: 'w3', assetId: 'a5', description: 'Screen calibration', priority: 'Low', status: 'Pending', dueDate: '2026-04-10' },
];

export const initialMaintenance: Maintenance[] = [
  { id: 'm1', assetId: 'a1', task: 'Weekly cooling system check', frequency: 'Weekly', nextDueDate: '2026-04-05' },
  { id: 'm2', assetId: 'a3', task: 'Filter replacement', frequency: 'Monthly', nextDueDate: '2026-04-15' },
  { id: 'm3', assetId: 'a4', task: 'Self-test diagnostic', frequency: 'Daily', nextDueDate: '2026-04-02' },
  { id: 'm4', assetId: 'a2', task: 'Radiation leak test', frequency: 'Yearly', nextDueDate: '2026-10-20' },
];
