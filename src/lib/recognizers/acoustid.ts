import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export async function generateChromaprint(filePath: string): Promise<{ fingerprint: string, duration: number }> {
  const { stdout } = await execAsync(`fpcalc -json "${filePath}"`);
  const parsed = JSON.parse(stdout);
  return { fingerprint: parsed.fingerprint, duration: parsed.duration };
}

export async function recognizeWithAcoustID(fingerprint: string, duration: number = 10) {
  const client = process.env.ACOUSTID_API_KEY;
  const url = `https://api.acoustid.org/v2/lookup?client=${client}&meta=recordings+releasegroups+compress&duration=${duration}&fingerprint=${fingerprint}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  return json.results?.[0]?.recordings?.[0] ?? null;
}
