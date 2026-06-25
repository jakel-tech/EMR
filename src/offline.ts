export interface OfflineRequest {
  id: string;
  url: string;
  method: string;
  headers: any;
  body?: string;
  timestamp: number;
}

const QUEUE_KEY = 'offline_sync_queue';

export const getOfflineQueue = (): OfflineRequest[] => {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const addToOfflineQueue = (request: Omit<OfflineRequest, 'id' | 'timestamp'>) => {
  const queue = getOfflineQueue();
  const newRequest: OfflineRequest = {
    ...request,
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now()
  };
  queue.push(newRequest);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const clearOfflineQueue = () => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify([]));
};

export const removeFromOfflineQueue = (id: string) => {
  const queue = getOfflineQueue();
  const updated = queue. filter(req => req.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
};
