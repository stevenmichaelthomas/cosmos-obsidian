import { Notice, Vault, TFile, parseYaml } from 'obsidian';
import { COSMOS_BASE_URL, createCosmosClient } from './settings';
import type { CosmosSettings } from './settings';
import type { BodyKind, ContentType, EntryContent, HaikuContent, NoteContent, OrbitalParams } from './types';
import { generateOrbital, contentToString } from './engine/orbital';
import { computeSecureSeed } from './engine/hash';

// ── Helpers ─────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Generate a random hex string for the meaningless passphrase hash */
function randomHash(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** Shape-correct empty content for a given type */
function emptyContent(type: ContentType): EntryContent {
  switch (type) {
    case 'haiku':     return { line1: '', line2: '', line3: '' };
    case 'memory':    return { title: '', description: '' };
    case 'place':     return { name: '' };
    case 'milestone': return { title: '' };
    case 'note':
    default:          return { text: '' };
  }
}

/** Extract date from filename like 2026-03-20.md or 2026-03-20-some-title.md */
function dateFromFilename(filename: string): string | null {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** A 5-7-5 haiku is exactly 3 short non-empty lines, all under ~40 chars */
function detectHaiku(body: string): HaikuContent | null {
  const lines = body.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length !== 3) return null;
  if (lines.some(l => l.length > 40)) return null;
  return { line1: lines[0], line2: lines[1], line3: lines[2] };
}

// ── Frontmatter parsing ─────────────────────────────────────────

interface Frontmatter {
  date?: string;
  type?: string;
  title?: string;
  name?: string;
  lat?: number;
  lng?: number;
}

function extractFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) return { frontmatter: {}, body: raw };
  try {
    const parsed = parseYaml(fmMatch[1]) as Frontmatter | null;
    return { frontmatter: parsed ?? {}, body: fmMatch[2] };
  } catch {
    return { frontmatter: {}, body: fmMatch[2] };
  }
}

// ── Parsed entry ────────────────────────────────────────────────

interface ParsedEntry {
  date: string;
  contentType: ContentType;
  content: EntryContent;
  filePath: string;
}

function parseFile(file: TFile, raw: string): ParsedEntry {
  const { frontmatter, body } = extractFrontmatter(raw);

  // Date priority: frontmatter -> filename -> file stat
  let date: string | null = null;
  if (frontmatter.date && typeof frontmatter.date === 'string') {
    date = frontmatter.date;
  }
  if (!date) date = dateFromFilename(file.name);
  if (!date) {
    // Use file creation time, fall back to modification time
    const ctime = file.stat.ctime;
    const mtime = file.stat.mtime;
    date = formatDate(ctime > 0 ? ctime : mtime);
  }

  // Content type: explicit frontmatter -> haiku detection -> note
  let contentType: ContentType = 'note';
  let content: EntryContent;

  const fmType = typeof frontmatter.type === 'string' ? frontmatter.type.toLowerCase() : null;
  const validTypes: ContentType[] = ['haiku', 'memory', 'place', 'note', 'milestone'];

  if (fmType && validTypes.includes(fmType as ContentType)) {
    contentType = fmType as ContentType;
  }

  if (contentType === 'haiku') {
    const h = detectHaiku(body);
    content = h ?? { line1: body.trim(), line2: '', line3: '' } as HaikuContent;
  } else if (contentType === 'note') {
    const h = detectHaiku(body);
    if (h) {
      contentType = 'haiku';
      content = h;
    } else {
      content = { text: body.trim() } satisfies NoteContent;
    }
  } else if (contentType === 'memory') {
    content = {
      title: typeof frontmatter.title === 'string' ? frontmatter.title : file.basename,
      description: body.trim(),
    };
  } else if (contentType === 'place') {
    content = {
      name: typeof frontmatter.name === 'string' ? frontmatter.name : file.basename,
      lat: typeof frontmatter.lat === 'number' ? frontmatter.lat : undefined,
      lng: typeof frontmatter.lng === 'number' ? frontmatter.lng : undefined,
    };
  } else {
    // milestone
    content = {
      title: typeof frontmatter.title === 'string' ? frontmatter.title : body.trim().split('\n')[0],
    };
  }

  return { date, contentType, content, filePath: file.path };
}

// ── Excluded dirs ───────────────────────────────────────────────

const EXCLUDED_DIRS = new Set([
  '.trash', '.git', 'node_modules', 'attachments', 'assets', 'media',
]);

function isExcluded(path: string, configDir: string): boolean {
  const parts = path.split('/');
  return parts.some(p => p === configDir || EXCLUDED_DIRS.has(p) || p.startsWith('.'));
}

// ── Owner hash ──────────────────────────────────────────────────

/** SHA-256 hex digest of the system secret — used as owner_secret_hash */
export async function computeOwnerHash(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

// ── Main sync ───────────────────────────────────────────────────

export async function syncVault(vault: Vault, settings: CosmosSettings): Promise<void> {
  // Validate settings
  if (!settings.systemName) {
    new Notice('Cosmos: please set a system name in settings.');
    return;
  }

  const notice = new Notice('Cosmos: starting sync...', 0);

  try {
    // Generate passphrase hash and system secret if missing
    if (!settings.passphraseHash) {
      settings.passphraseHash = randomHash();
    }
    if (!settings.systemSecret) {
      settings.systemSecret = randomHash();
      // Settings will be saved by caller after sync completes
    }

    const client = createCosmosClient();

    // Use persisted slug if available; otherwise derive from name
    const slug = settings.systemSlug || slugify(settings.systemName);

    // ── Get or create system ──────────────────────────────────

    const { data: existingRaw } = await client
      .from('solar_systems')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    const existing = existingRaw as { id: string } | null;

    let systemId: string;

    if (existing) {
      systemId = existing.id;
    } else {
      notice.setMessage('Cosmos: creating solar system...');
      const ownerHash = await computeOwnerHash(settings.systemSecret);
      const { data: newId, error } = await client.rpc<string>('create_solar_system', {
        p_name: settings.systemName,
        p_slug: slug,
        p_passphrase_hash: settings.passphraseHash,
        p_owner_secret_hash: ownerHash,
      });
      if (error || !newId) {
        throw new Error(`Failed to create system: ${error?.message || 'unknown error'}`);
      }
      systemId = newId as string;
    }

    // Persist slug so renames don't create a new system
    if (!settings.systemSlug) {
      settings.systemSlug = slug;
    }

    const ownerHash = await computeOwnerHash(settings.systemSecret);

    // ── Upsert star ───────────────────────────────────────────

    let starName = settings.starName;
    if (!starName) {
      // Auto-name: Sol 1, Sol 2, ... based on existing star count
      const { count } = await client
        .from('stars')
        .select('id', { count: 'exact', head: true })
        .eq('system_id', systemId);
      starName = `Sol ${(count ?? 0) + 1}`;
      settings.starName = starName;
    }

    const { data: starIdData, error: starErr } = await client.rpc<string>('upsert_star', {
      p_system_id: systemId,
      p_name: starName,
      p_position: 0,
      p_owner_secret_hash: ownerHash,
    });
    if (starErr || !starIdData) {
      throw new Error(`Failed to upsert star: ${starErr?.message || 'unknown error'}`);
    }
    const starId = starIdData as string;

    // ── Fetch existing entry IDs ──────────────────────────────

    const existingEntryIds = new Set<string>();
    const PAGE_SIZE = 1000;
    let offset = 0;
    while (true) {
      const { data, error: entriesErr } = await client
        .rpc<{ orbital_meta: { id?: string } | null }>('get_entries_public', { p_system_id: systemId })
        .range(offset, offset + PAGE_SIZE - 1);
      if (entriesErr) {
        throw new Error(`Failed to load existing entries: ${entriesErr.message}`);
      }
      const page = (data ?? []) as { orbital_meta: { id?: string } | null }[];
      for (const e of page) {
        if (e.orbital_meta?.id) existingEntryIds.add(e.orbital_meta.id);
      }
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // ── Walk vault files ──────────────────────────────────────

    notice.setMessage('Cosmos: reading vault...');

    const configDir = vault.configDir;
    const mdFiles = vault.getMarkdownFiles().filter(f => {
      if (isExcluded(f.path, configDir)) return false;
      if (settings.syncFolder) {
        return f.path.startsWith(settings.syncFolder + '/') || f.path === settings.syncFolder;
      }
      return true;
    });

    // Parse all files
    const parsed: ParsedEntry[] = [];
    for (const file of mdFiles) {
      const raw = await vault.cachedRead(file);
      parsed.push(parseFile(file, raw));
    }

    // Sort by date for stable body indices
    parsed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    notice.setMessage(`Cosmos: computing orbits for ${parsed.length} files...`);

    // Generate orbital metadata in parallel batches
    const BATCH_SIZE = 200;
    const enriched: { entry: ParsedEntry; meta: { kind: BodyKind; orbital: OrbitalParams; id: string } }[] = [];
    for (let batchStart = 0; batchStart < parsed.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, parsed.length);
      const batch = parsed.slice(batchStart, batchEnd);
      const seeds = await Promise.all(
        batch.map(entry => computeSecureSeed(
          settings.systemSecret,
          entry.date,
          contentToString(entry.content, entry.contentType),
        ))
      );
      for (let j = 0; j < batch.length; j++) {
        const idx = batchStart + j;
        const meta = generateOrbital(batch[j].contentType, batch[j].content, batch[j].date, idx, seeds[j], parsed.length);
        enriched.push({ entry: batch[j], meta });
      }
      if (batchStart > 0 && batchStart % 2000 === 0) {
        notice.setMessage(`Cosmos: computing orbits... ${batchStart}/${parsed.length}`);
      }
    }

    // Filter to new entries
    const newEntries = enriched.filter(({ meta }) => !existingEntryIds.has(meta.id));
    const skipped = enriched.length - newEntries.length;

    if (newEntries.length === 0) {
      notice.hide();
      const frag = createFragment();
      frag.appendText(`Cosmos: up to date (${skipped} entries synced). `);
      const link = createEl('a', { href: `${COSMOS_BASE_URL}/s/${slug}`, text: 'View your galaxy →', cls: 'cosmos-notice-link' });
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(link.href, '_blank');
      });
      frag.appendChild(link);
      new Notice(frag, 6000);
      return;
    }

    // ── Insert new entries ────────────────────────────────────

    notice.setMessage(`Cosmos: syncing ${newEntries.length} new entries...`);

    // Insert in parallel batches for performance
    const INSERT_BATCH = 20;
    let inserted = 0;
    for (let i = 0; i < newEntries.length; i += INSERT_BATCH) {
      const batch = newEntries.slice(i, i + INSERT_BATCH);
      const results = await Promise.all(
        batch.map(({ entry, meta }) => {
          const storedContent = emptyContent(entry.contentType);
          return client.rpc('add_entry', {
            p_system_id: systemId,
            p_star_id: starId,
            p_content_type: entry.contentType,
            p_content: storedContent,
            p_date: entry.date,
            p_orbital_meta: meta,
            p_owner_secret_hash: ownerHash,
          });
        })
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].error) {
          throw new Error(`add_entry failed for ${batch[j].entry.filePath}: ${results[j].error!.message}`);
        }
      }
      inserted += batch.length;
      notice.setMessage(`Cosmos: synced ${inserted}/${newEntries.length}...`);
    }

    notice.hide();
    const frag = createFragment();
    frag.appendText(`Cosmos: synced ${inserted} new entries (${skipped} already synced). `);
    const link = createEl('a', { href: `${COSMOS_BASE_URL}/s/${slug}`, text: 'View your galaxy →', cls: 'cosmos-notice-link' });
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(link.href, '_blank');
    });
    frag.appendChild(link);
    new Notice(frag, 8000);

  } catch (err) {
    notice.hide();
    const msg = err instanceof Error ? err.message : String(err);
    new Notice(`Cosmos sync failed: ${msg}`, 10000);
    console.error('Cosmos sync error:', err);
  }
}
