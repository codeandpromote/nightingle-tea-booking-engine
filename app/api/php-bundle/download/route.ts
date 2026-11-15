import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { NextResponse } from 'next/server';

const PHP_ROOT = path.join(process.cwd(), 'php-cpanel-app');

async function addDirToZip(zip: JSZip, dir: string, relBase = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await addDirToZip(zip, full, rel);
    } else {
      const buf = await fs.readFile(full);
      zip.file(rel, buf);
    }
  }
}

export async function GET() {
  const zip = new JSZip();
  await addDirToZip(zip, PHP_ROOT);
  const archive = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return new NextResponse(Buffer.from(archive), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="nightingale-booking-php-cpanel.zip"',
      'Cache-Control': 'no-store',
    },
  });
}
