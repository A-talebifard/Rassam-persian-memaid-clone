'use client';

import { useState, useEffect, useCallback } from 'react';
import { isTauri } from '@/lib/tauri-download';

interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export function UpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdates = useCallback(async () => {
    // فقط در محیط Tauri بررسی کن
    if (!isTauri()) return;

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update) {
        setUpdateAvailable(true);
        setUpdateInfo({
          version: update.version,
          date: update.date,
          body: update.body,
        });
      }
    } catch (err) {
      console.error('خطا در بررسی آپدیت:', err);
    }
  }, []);

  // بررسی آپدیت هنگام بارگذاری کامپوننت
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  const handleDownloadAndInstall = async () => {
    if (!isTauri()) return;

    setDownloading(true);
    setDownloadProgress(0);
    setError(null);

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (!update) {
        setError('آپدیتی یافت نشد');
        setDownloading(false);
        return;
      }

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            setDownloadProgress(0);
            break;
          case 'Progress':
            if (event.data.contentLength) {
              const progress = (event.data.chunkLength / event.data.contentLength) * 100;
              setDownloadProgress(Math.round(progress));
            }
            break;
          case 'Finished':
            setDownloadProgress(100);
            break;
        }
      });

      // بعد از اتمام دانلود، اپ ری‌استارت می‌شود
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err: any) {
      console.error('خطا در دانلود آپدیت:', err);
      setError(err?.message || 'خطا در دانلود آپدیت');
      setDownloading(false);
    }
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-xl border border-blue-200 bg-white p-4 shadow-2xl dark:border-blue-800 dark:bg-gray-900"
      dir="rtl"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            آپدیت جدید موجود است!
          </h3>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            نسخه {updateInfo?.version} منتشر شده است
          </p>
          {updateInfo?.body && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500 line-clamp-2">
              {updateInfo.body}
            </p>
          )}

          {downloading && (
            <div className="mt-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                در حال دانلود... {downloadProgress}%
              </p>
            </div>
          )}

          {error && (
            <p className="mt-1 text-xs text-red-500">{error}</p>
          )}

          <div className="mt-3 flex gap-2">
            {!downloading ? (
              <>
                <button
                  onClick={handleDownloadAndInstall}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  دانلود و نصب
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                >
                  بعداً
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
