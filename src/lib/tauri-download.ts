/**
 * ابزار دانلود فایل سازگار با Tauri و مرورگر
 *
 * در محیط Tauri از دیالوگ ذخیره‌سازی بومی و نوشتن مستقیم فایل استفاده می‌کند.
 * در مرورگر از روش سنتی Blob URL + anchor download استفاده می‌کند.
 */

// بررسی اینکه آیا اپ در محیط Tauri اجرا می‌شود
export function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

/**
 * دریافت پسوند فایل از نام آن
 */
function getExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * دریافت نام فیلتر برای دیالوگ ذخیره‌سازی
 */
function getFilterName(ext: string): string {
  const filterMap: Record<string, string> = {
    svg: 'SVG',
    png: 'PNG Image',
    jpg: 'JPEG Image',
    jpeg: 'JPEG Image',
    pdf: 'PDF Document',
    json: 'JSON File',
    tiff: 'TIFF Image',
    bmp: 'BMP Image',
  };
  return filterMap[ext] || ext.toUpperCase();
}

export interface DownloadOptions {
  /** داده‌های فایل - می‌تواند Blob، Uint8Array یا رشته باشد */
  data: Blob | Uint8Array | string;
  /** نام فایل پیشنهادی */
  filename: string;
  /** نوع MIME فایل */
  mimeType: string;
}

/**
 * دانلود فایل - سازگار با Tauri و مرورگر
 *
 * @example
 * // دانلود فایل SVG
 * await downloadFile({
 *   data: svgString,
 *   filename: 'diagram.svg',
 *   mimeType: 'image/svg+xml'
 * });
 *
 * @example
 * // دانلود فایل PNG (از Blob)
 * await downloadFile({
 *   data: pngBlob,
 *   filename: 'diagram.png',
 *   mimeType: 'image/png'
 * });
 */
export async function downloadFile(options: DownloadOptions): Promise<boolean> {
  const { data, filename, mimeType } = options;

  if (isTauri()) {
    return downloadFileTauri(data, filename, mimeType);
  } else {
    return downloadFileBrowser(data, filename, mimeType);
  }
}

/**
 * دانلود در محیط Tauri - استفاده از دیالوگ بومی و نوشتن مستقیم فایل
 */
async function downloadFileTauri(
  data: Blob | Uint8Array | string,
  filename: string,
  mimeType: string
): Promise<boolean> {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');

    const ext = getExtension(filename);

    // نمایش دیالوگ "ذخیره به..."
    const filePath = await save({
      defaultPath: filename,
      filters: [
        {
          name: getFilterName(ext),
          extensions: [ext],
        },
      ],
    });

    // کاربر دیالوگ را لغو کرده است
    if (!filePath) {
      return false;
    }

    // تبدیل داده به Uint8Array
    let dataToWrite: Uint8Array;

    if (data instanceof Blob) {
      dataToWrite = new Uint8Array(await data.arrayBuffer());
    } else if (typeof data === 'string') {
      dataToWrite = new TextEncoder().encode(data);
    } else {
      dataToWrite = data;
    }

    // نوشتن فایل در مسیر انتخاب‌شده
    await writeFile(filePath, dataToWrite);

    return true;
  } catch (error) {
    console.error('خطا در ذخیره فایل با Tauri:', error);
    // در صورت خطا، به روش مرورگری پایش کن
    return downloadFileBrowser(data, filename, mimeType);
  }
}

/**
 * دانلود در مرورگر - روش سنتی Blob URL
 */
async function downloadFileBrowser(
  data: Blob | Uint8Array | string,
  filename: string,
  mimeType: string
): Promise<boolean> {
  try {
    let blob: Blob;

    if (data instanceof Blob) {
      blob = data;
    } else if (typeof data === 'string') {
      blob = new Blob([data], { type: mimeType });
    } else {
      blob = new Blob([data], { type: mimeType });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // آزادسازی حافظه بعد از کمی تأخیر
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return true;
  } catch (error) {
    console.error('خطا در دانلود فایل:', error);
    return false;
  }
}

/**
 * ذخیره فایل PDF از jsPDF
 * چون jsPDF متد save() خودش رو دارد، باید خروجی blob بگیریم و از دانلودر استفاده کنیم
 */
export async function savePdfDoc(
  pdfDoc: any,
  filename: string
): Promise<boolean> {
  try {
    if (isTauri()) {
      // در Tauri: خروجی blob از jsPDF و استفاده از دیالوگ بومی
      const blob: Blob = pdfDoc.output('blob');
      return downloadFile({
        data: blob,
        filename,
        mimeType: 'application/pdf',
      });
    } else {
      // در مرورگر: استفاده از متد save خود jsPDF
      pdfDoc.save(filename);
      return true;
    }
  } catch (error) {
    console.error('خطا در ذخیره PDF:', error);
    // پایش به روش blob
    try {
      const blob: Blob = pdfDoc.output('blob');
      return downloadFileBrowser(blob, filename, 'application/pdf');
    } catch {
      return false;
    }
  }
}
