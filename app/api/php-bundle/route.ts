import fs from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

const PHP_ROOT = path.join(process.cwd(), 'php-cpanel-app');

async function walkFiles(dir: string, relBase = ''): Promise<{ path: string; size: number }[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: { path: string; size: number }[] = [];
  for (const entry of entries) {
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkFiles(full, rel)));
    } else {
      const stat = await fs.stat(full);
      results.push({ path: rel, size: stat.size });
    }
  }
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedFile = searchParams.get('file');

  if (requestedFile) {
    const normalized = path.normalize(requestedFile).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(PHP_ROOT, normalized);
    if (!fullPath.startsWith(PHP_ROOT)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    try {
      if (/\.(jpg|jpeg|png|webp)$/i.test(fullPath)) {
        return NextResponse.json({
          path: normalized,
          content: `[Binary Image Asset: ${normalized}]`,
        });
      }
      const content = await fs.readFile(fullPath, 'utf8');
      return NextResponse.json({ path: normalized, content });
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  }

  const files = await walkFiles(PHP_ROOT);
  return NextResponse.json({ files });
}
