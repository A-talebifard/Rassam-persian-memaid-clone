#!/usr/bin/env node

/**
 * اسکریپت تولید فایل latest.json برای آپدیت خودکار Tauri
 *
 * این فایل باید به هر Release در GitHub اضافه شود.
 * Tauri Updater این فایل را بررسی می‌کند تا آپدیت جدید را شناسایی کند.
 *
 * نحوه استفاده:
 *   node generate-latest-json.js <version> <release-date>
 *
 * مثال:
 *   node generate-latest-json.js 1.1.0 2025-06-13
 */

const fs = require('fs');
const path = require('path');

const version = process.argv[2];
const date = process.argv[3] || new Date().toISOString().split('T')[0];
const notes = process.argv[4] || `نسخه ${version} رسام منتشر شد`;

if (!version) {
  console.error('خطا: نسخه را مشخص کنید. مثال: node generate-latest-json.js 1.1.0');
  process.exit(1);
}

// حذف v از ابتدای نسخه اگر وجود دارد
const cleanVersion = version.startsWith('v') ? version.slice(1) : version;

const latestJson = {
  version: cleanVersion,
  date: date,
  notes: notes,
  platforms: {
    // مسیر فایل NSIS installer در GitHub Releases
    // Tauri به صورت خودکار URL دانلود را از این مسیر می‌سازد
    'windows-x86_64': {
      url: `https://github.com/A-talebifard/Rassam-persian-memaid-clone/releases/download/v${cleanVersion}/Rassam_${cleanVersion}_x64-setup.exe`,
      // اگر فایل را امضا می‌کنید، امضا را اینجا قرار دهید
      signature: '',
    },
  },
};

const outputPath = path.join(__dirname, 'latest.json');
fs.writeFileSync(outputPath, JSON.stringify(latestJson, null, 2));

console.log(`فایل latest.json تولید شد: ${outputPath}`);
console.log('\nمحتوا:');
console.log(JSON.stringify(latestJson, null, 2));
console.log('\n⚠️  این فایل را به عنوان asset به GitHub Release اضافه کنید.');
