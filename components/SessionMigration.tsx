'use client';
import { useEffect } from 'react';
export function SessionMigration() { useEffect(() => { try {
    localStorage.removeItem('gtv_xtream_credentials');
    sessionStorage.removeItem('gtv_xtream_credentials');
    if (localStorage.getItem('gtv_security_session_v2') !== '1') {
        for (const storage of [localStorage, sessionStorage]) {
            const remove: string[] = [];
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i);
                if (!key || !key.startsWith('gtv'))
                    continue;
                const raw = storage.getItem(key) || '';
                if (/"password"|"direct_source"|https?:\/\/[^\s/]+\/(live|movie|series)\/[^/]+\/[^/]+\//i.test(raw))
                    remove.push(key);
            }
            for (const key of remove)
                storage.removeItem(key);
        }
        localStorage.setItem('gtv_security_session_v2', '1');
    }
}
catch { /* Restricted browser storage must not block playback. */ } }, []); return null; }
