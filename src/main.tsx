import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA (Install as an App Support)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered in scope:', reg.scope);
        
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Dispatch event so React components can show "Update Available" notification
                window.dispatchEvent(new CustomEvent('app-update-available', { detail: newWorker }));
              }
            });
          }
        });

        // Expose manual check to window so settings panel can trigger it
        (window as any).pwaCheckForUpdates = async () => {
          console.log('[PWA] Manual update check triggered');
          try {
            let updateFoundFired = false;
            const onUpdateFound = () => {
              updateFoundFired = true;
            };
            reg.addEventListener('updatefound', onUpdateFound);
            
            await reg.update();
            
            // Wait brief time to see if updatefound triggers
            await new Promise((resolve) => setTimeout(resolve, 1500));
            reg.removeEventListener('updatefound', onUpdateFound);

            if (updateFoundFired) {
              return { success: true, updated: true };
            } else {
              window.dispatchEvent(new CustomEvent('app-no-update-found'));
              return { success: true, updated: false };
            }
          } catch (err: any) {
            console.error('[PWA] Manual update check failed:', err);
            window.dispatchEvent(new CustomEvent('app-update-error', { detail: err.message }));
            return { success: false, error: err.message };
          }
        };

        // Periodic background update checks every 5 minutes
        setInterval(() => {
          console.log('[PWA] Performing background update check...');
          reg.update().catch((err) => {
            console.warn('[PWA] Background update check failed:', err);
          });
        }, 5 * 60 * 1000);
      })
      .catch((err) => {
        console.error('[PWA] Service Worker registration failed:', err);
      });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
