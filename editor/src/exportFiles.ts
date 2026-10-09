import { linkProblems, problems, toFormat, type Project } from './format/model';

export interface ExportFile {
  name: string;
  text: string;
}

/** One format-v1 file per GUI of the project, named after the GUI id. */
export function exportFiles(project: Project): ExportFile[] {
  return project.guis.map((gui) => ({
    name: `${gui.id || 'gui'}.json`,
    text: JSON.stringify(toFormat(gui), null, 2) + '\n',
  }));
}

/** Problems across all GUIs. The export is blocked while this is not zero. */
export function projectProblemCount(project: Project): number {
  return project.guis.reduce((sum, gui) => sum + problems(gui).length + linkProblems(project, gui).length, 0);
}

interface WritableLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface FileHandleLike {
  createWritable(): Promise<WritableLike>;
}

interface DirectoryLike {
  getFileHandle(name: string, options: { create: boolean }): Promise<FileHandleLike>;
}

type DirectoryPicker = (options?: { mode?: 'readwrite' }) => Promise<DirectoryLike>;
type SavePicker = (options: { suggestedName: string; types: FileType[] }) => Promise<FileHandleLike>;
type OpenPicker = (options: { types: FileType[]; multiple: boolean }) => Promise<Array<{ getFile(): Promise<{ text(): Promise<string> }> }>>;

interface FileType {
  description: string;
  accept: Record<string, string[]>;
}

const JSON_TYPES: FileType[] = [{ description: 'GuiForge-Datei (JSON)', accept: { 'application/json': ['.json'] } }];

function fileApi() {
  return window as unknown as {
    showDirectoryPicker?: DirectoryPicker;
    showSaveFilePicker?: SavePicker;
    showOpenFilePicker?: OpenPicker;
  };
}

/** Folder access (File System Access API) is available in Chromium-based browsers. */
export function canPickFolder(): boolean {
  return typeof fileApi().showDirectoryPicker === 'function';
}

/** Save and open dialogs with a real file name and location (same browsers as above). */
export function canUseFileDialogs(): boolean {
  return typeof fileApi().showSaveFilePicker === 'function' && typeof fileApi().showOpenFilePicker === 'function';
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Writes all files into a folder the user picks, overwriting files with the same name.
 * Returns false when the user cancels the folder dialog.
 */
export async function saveToFolder(files: ExportFile[]): Promise<boolean> {
  const pick = fileApi().showDirectoryPicker;
  if (!pick) throw new Error('Ordnerzugriff wird von diesem Browser nicht unterstützt.');
  let dir: DirectoryLike;
  try {
    dir = await pick({ mode: 'readwrite' });
  } catch (err) {
    if (isAbort(err)) return false;
    throw err;
  }
  for (const file of files) {
    const handle = await dir.getFileHandle(file.name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file.text);
    await writable.close();
  }
  return true;
}

/** Saves one file through a save dialog. Without dialog support it downloads. False when cancelled. */
export async function saveFile(file: ExportFile): Promise<boolean> {
  const pick = fileApi().showSaveFilePicker;
  if (!pick) {
    download(file);
    return true;
  }
  try {
    const handle = await pick({ suggestedName: file.name, types: JSON_TYPES });
    const writable = await handle.createWritable();
    await writable.write(file.text);
    await writable.close();
    return true;
  } catch (err) {
    if (isAbort(err)) return false;
    throw err;
  }
}

/** Reads the text of a JSON file chosen in an open dialog. Null when cancelled. */
export async function pickJsonText(): Promise<string | null> {
  const pick = fileApi().showOpenFilePicker;
  if (!pick) throw new Error('Datei-Dialog wird von diesem Browser nicht unterstützt.');
  try {
    const [handle] = await pick({ types: JSON_TYPES, multiple: false });
    return await (await handle.getFile()).text();
  } catch (err) {
    if (isAbort(err)) return null;
    throw err;
  }
}

function download(file: ExportFile) {
  const blob = new Blob([file.text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Fallback without folder access: one download per file. The browser may ask once to allow several. */
export function downloadFiles(files: ExportFile[]) {
  files.forEach((file, i) => window.setTimeout(() => download(file), i * 250));
}
