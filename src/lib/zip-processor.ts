import JSZip from 'jszip';

export interface DiagnosticIssue {
  type: 'encoding' | 'macos_artifact' | 'ds_store' | 'hidden_file';
  originalPath: string;
  fixedPath?: string;
  description: string;
}

export interface DiagnosticReport {
  totalFiles: number;
  issues: DiagnosticIssue[];
  macosArtifacts: number;
  dsStoreFiles: number;
  encodingIssues: number;
  hiddenFiles: number;
  encodingConfidence: number; // 0-100
}

export interface ProcessingOptions {
  removeMAcOSArtifacts: boolean;
  removeDSStore: boolean;
  removeHiddenFiles: boolean;
  fixEncoding: boolean;
}

const DEFAULT_OPTIONS: ProcessingOptions = {
  removeMAcOSArtifacts: true,
  removeDSStore: true,
  removeHiddenFiles: false,
  fixEncoding: true,
};

// EUC-KR (CP949) decoding table for common Korean characters
// This is a simplified approach - we detect if bytes look like EUC-KR
function isLikelyEUCKR(bytes: Uint8Array): boolean {
  let eucKrPairs = 0;
  for (let i = 0; i < bytes.length - 1; i++) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1];
    // EUC-KR uses bytes in range 0x81-0xFE for first byte, 0x41-0xFE for second
    if (b1 >= 0x81 && b1 <= 0xFE && b2 >= 0x41 && b2 <= 0xFE) {
      eucKrPairs++;
      i++; // Skip the second byte
    }
  }
  return eucKrPairs > 0;
}

// Check if a string contains replacement characters or looks corrupted
function hasEncodingIssues(str: string): boolean {
  // Check for replacement character
  if (str.includes('\uFFFD')) return true;

  // Check for common patterns of misencoded text
  // These are patterns that appear when EUC-KR is read as UTF-8
  const suspiciousPatterns = [
    /[\x80-\x9F]/, // Control characters that shouldn't appear in filenames
    /[\uFFFE\uFFFF]/, // Non-characters
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(str)) return true;
  }

  return false;
}

function isByteString(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 0xff) return false;
  }
  return true;
}

// Decode bytes that might be EUC-KR encoded
function tryDecodeEUCKR(bytes: Uint8Array): string | null {
  try {
    const decoder = new TextDecoder('euc-kr', { fatal: true });
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

// Decode bytes that might be Shift-JIS encoded (for Japanese)
function tryDecodeShiftJIS(bytes: Uint8Array): string | null {
  try {
    const decoder = new TextDecoder('shift-jis', { fatal: true });
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

// Decode bytes that might be GB2312/GBK encoded (for Chinese)
function tryDecodeGBK(bytes: Uint8Array): string | null {
  try {
    const decoder = new TextDecoder('gbk', { fatal: true });
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

// Try to fix filename encoding
function fixFilenameEncoding(filename: string): { fixed: string; wasFixed: boolean } {
  // If we already have non-byte characters, treat it as valid Unicode and avoid "fixing" it.
  if (!isByteString(filename)) {
    return { fixed: filename, wasFixed: false };
  }

  // If the filename looks fine, return as is
  if (!hasEncodingIssues(filename)) {
    // But still check if it might be latin1-interpreted EUC-KR
    const bytes = new Uint8Array(filename.split('').map(c => c.charCodeAt(0)));

    if (isLikelyEUCKR(bytes)) {
      const decoded = tryDecodeEUCKR(bytes);
      if (decoded && !hasEncodingIssues(decoded)) {
        return { fixed: decoded, wasFixed: true };
      }
    }

    return { fixed: filename, wasFixed: false };
  }

  // Try to re-encode as various encodings
  const bytes = new TextEncoder().encode(filename);

  // Try EUC-KR first (most common for Korean)
  const eucKrDecoded = tryDecodeEUCKR(bytes);
  if (eucKrDecoded && !hasEncodingIssues(eucKrDecoded)) {
    return { fixed: eucKrDecoded, wasFixed: true };
  }

  // Try Shift-JIS for Japanese
  const shiftJisDecoded = tryDecodeShiftJIS(bytes);
  if (shiftJisDecoded && !hasEncodingIssues(shiftJisDecoded)) {
    return { fixed: shiftJisDecoded, wasFixed: true };
  }

  // Try GBK for Chinese
  const gbkDecoded = tryDecodeGBK(bytes);
  if (gbkDecoded && !hasEncodingIssues(gbkDecoded)) {
    return { fixed: gbkDecoded, wasFixed: true };
  }

  return { fixed: filename, wasFixed: false };
}

// Check if file is a macOS artifact
function isMacOSArtifact(path: string): boolean {
  return path.startsWith('__MACOSX/') || path.includes('/__MACOSX/');
}

// Check if file is .DS_Store
function isDSStore(path: string): boolean {
  return path.endsWith('.DS_Store') || path.includes('/.DS_Store');
}

// Check if file is hidden (starts with .)
function isHiddenFile(path: string): boolean {
  const parts = path.split('/');
  return parts.some(part => part.startsWith('.') && part !== '.DS_Store');
}

// Analyze ZIP file and generate diagnostic report
export async function analyzeZip(file: File): Promise<DiagnosticReport> {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);

  const issues: DiagnosticIssue[] = [];
  let macosArtifacts = 0;
  let dsStoreFiles = 0;
  let encodingIssues = 0;
  let hiddenFiles = 0;
  let totalFiles = 0;

  for (const [path, zipEntry] of Object.entries(contents.files)) {
    if (zipEntry.dir) continue;
    totalFiles++;

    // Check for macOS artifacts
    if (isMacOSArtifact(path)) {
      macosArtifacts++;
      issues.push({
        type: 'macos_artifact',
        originalPath: path,
        description: 'macOS 메타데이터 파일 (__MACOSX)',
      });
      continue;
    }

    // Check for .DS_Store
    if (isDSStore(path)) {
      dsStoreFiles++;
      issues.push({
        type: 'ds_store',
        originalPath: path,
        description: 'macOS 폴더 설정 파일 (.DS_Store)',
      });
      continue;
    }

    // Check for hidden files
    if (isHiddenFile(path)) {
      hiddenFiles++;
      issues.push({
        type: 'hidden_file',
        originalPath: path,
        description: '숨김 파일',
      });
    }

    // Check for encoding issues
    const { fixed, wasFixed } = fixFilenameEncoding(path);
    if (wasFixed) {
      encodingIssues++;
      issues.push({
        type: 'encoding',
        originalPath: path,
        fixedPath: fixed,
        description: '파일명 인코딩 문제 감지 (UTF-8로 변환 필요)',
      });
    }
  }

  // Calculate encoding confidence
  let encodingConfidence = 0;
  if (macosArtifacts > 0 || dsStoreFiles > 0) {
    encodingConfidence += 40; // macOS origin increases likelihood
  }
  if (encodingIssues > 0) {
    encodingConfidence += Math.min(60, encodingIssues * 15);
  }

  return {
    totalFiles,
    issues,
    macosArtifacts,
    dsStoreFiles,
    encodingIssues,
    hiddenFiles,
    encodingConfidence: Math.min(100, encodingConfidence),
  };
}

// Process ZIP file and create a fixed version
export async function processZip(
  file: File,
  options: Partial<ProcessingOptions> = {}
): Promise<{ blob: Blob; report: DiagnosticReport }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sourceZip = new JSZip();
  const targetZip = new JSZip();

  const contents = await sourceZip.loadAsync(file);
  const issues: DiagnosticIssue[] = [];
  let macosArtifacts = 0;
  let dsStoreFiles = 0;
  let encodingIssues = 0;
  let hiddenFiles = 0;
  let totalFiles = 0;
  let processedFiles = 0;

  for (const [path, zipEntry] of Object.entries(contents.files)) {
    if (zipEntry.dir) continue;
    totalFiles++;

    // Check for macOS artifacts
    if (isMacOSArtifact(path)) {
      macosArtifacts++;
      if (opts.removeMAcOSArtifacts) {
        issues.push({
          type: 'macos_artifact',
          originalPath: path,
          description: '삭제됨: macOS 메타데이터 파일',
        });
        continue;
      }
    }

    // Check for .DS_Store
    if (isDSStore(path)) {
      dsStoreFiles++;
      if (opts.removeDSStore) {
        issues.push({
          type: 'ds_store',
          originalPath: path,
          description: '삭제됨: .DS_Store 파일',
        });
        continue;
      }
    }

    // Check for hidden files
    if (isHiddenFile(path)) {
      hiddenFiles++;
      if (opts.removeHiddenFiles) {
        issues.push({
          type: 'hidden_file',
          originalPath: path,
          description: '삭제됨: 숨김 파일',
        });
        continue;
      }
    }

    // Fix encoding if needed
    let finalPath = path;
    if (opts.fixEncoding) {
      const { fixed, wasFixed } = fixFilenameEncoding(path);
      if (wasFixed) {
        encodingIssues++;
        issues.push({
          type: 'encoding',
          originalPath: path,
          fixedPath: fixed,
          description: '파일명 인코딩 수정됨',
        });
        finalPath = fixed;
      }
    }

    // Copy file to target ZIP
    const content = await zipEntry.async('uint8array');
    targetZip.file(finalPath, content);
    processedFiles++;
  }

  // Calculate encoding confidence
  let encodingConfidence = 0;
  if (macosArtifacts > 0 || dsStoreFiles > 0) {
    encodingConfidence += 40;
  }
  if (encodingIssues > 0) {
    encodingConfidence += Math.min(60, encodingIssues * 15);
  }

  const blob = await targetZip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    blob,
    report: {
      totalFiles,
      issues,
      macosArtifacts,
      dsStoreFiles,
      encodingIssues,
      hiddenFiles,
      encodingConfidence: Math.min(100, encodingConfidence),
    },
  };
}

// Create ZIP from files (for folder upload feature)
export async function createZipFromFiles(
  files: FileList | File[],
  options: Partial<ProcessingOptions> = {}
): Promise<{ blob: Blob; report: DiagnosticReport }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const zip = new JSZip();
  const issues: DiagnosticIssue[] = [];
  let dsStoreFiles = 0;
  let hiddenFiles = 0;
  let totalFiles = 0;
  let processedFiles = 0;

  const fileArray = Array.from(files);

  for (const file of fileArray) {
    // Get relative path from webkitRelativePath or use filename
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    totalFiles++;

    // Check for .DS_Store
    if (isDSStore(relativePath)) {
      dsStoreFiles++;
      if (opts.removeDSStore) {
        issues.push({
          type: 'ds_store',
          originalPath: relativePath,
          description: '제외됨: .DS_Store 파일',
        });
        continue;
      }
    }

    // Check for hidden files
    if (isHiddenFile(relativePath)) {
      hiddenFiles++;
      if (opts.removeHiddenFiles) {
        issues.push({
          type: 'hidden_file',
          originalPath: relativePath,
          description: '제외됨: 숨김 파일',
        });
        continue;
      }
    }

    // Read file content
    const content = await file.arrayBuffer();
    zip.file(relativePath, content);
    processedFiles++;
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    blob,
    report: {
      totalFiles,
      issues,
      macosArtifacts: 0,
      dsStoreFiles,
      encodingIssues: 0,
      hiddenFiles,
      encodingConfidence: 0,
    },
  };
}
