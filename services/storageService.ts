
import { Slide } from '../types';

const DB_NAME = 'BugSnapDB';
const STORE_NAME = 'slides';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveSlidesToDB = async (slides: Slide[]) => {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        // Clear existing to avoid stale data (simple sync)
        const clearReq = store.clear();
        
        clearReq.onsuccess = () => {
            if (slides.length === 0) {
                resolve();
                return;
            }
            
            let completed = 0;
            let errors = false;
            
            slides.forEach(slide => {
                const req = store.put(slide);
                req.onsuccess = () => {
                    completed++;
                    if (completed === slides.length) resolve();
                };
                req.onerror = () => {
                    console.error("Failed to save slide", slide.id, req.error);
                    errors = true;
                    // Try to continue saving others
                    completed++;
                    if (completed === slides.length) resolve();
                };
            });
        };
        
        clearReq.onerror = () => reject(clearReq.error);
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
      console.error("Database Save Error:", e);
  }
};

export const loadSlidesFromDB = async (): Promise<Slide[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => {
            const slides = request.result as Slide[];
            // Ensure they are sorted by creation time
            slides.sort((a, b) => a.createdAt - b.createdAt);
            resolve(slides);
        };
        request.onerror = () => reject(request.error);
    });
  } catch (e) {
      console.error("Database Load Error:", e);
      return [];
  }
};
