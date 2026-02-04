'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { saveAs } from 'file-saver';
import {
  analyzeZip,
  processZip,
  createZipFromFiles,
  DiagnosticReport,
  ProcessingOptions,
} from '@/lib/zip-processor';

type Mode = 'zip' | 'folder';
type Status = 'idle' | 'analyzing' | 'processing' | 'done' | 'error';
type Theme = 'light' | 'dark' | 'system';

const SUPPORTED_LANGS = ['ko', 'en', 'zh', 'ja', 'hi', 'fr', 'pt-br', 'de'] as const;
type Lang = typeof SUPPORTED_LANGS[number];

const LANGUAGE_LABELS: Record<Lang, string> = {
  ko: '한국어',
  en: 'English',
  zh: '中文',
  ja: '日本語',
  hi: 'हिन्दी',
  fr: 'Français',
  'pt-br': 'Português (BR)',
  de: 'Deutsch',
};

const LANGUAGE_ICONS: Record<Lang, string> = {
  ko: '🇰🇷',
  en: '🇺🇸',
  zh: '🇨🇳',
  ja: '🇯🇵',
  hi: '🇮🇳',
  fr: '🇫🇷',
  'pt-br': '🇧🇷',
  de: '🇩🇪',
};

type Messages = {
  title: string;
  subtitle: string;
  zipMode: string;
  folderMode: string;
  uploadZip: string;
  uploadFolder: string;
  uploadZipDesc: string;
  uploadFolderDesc: string;
  zipOnlyError: string;
  analyzeError: string;
  processError: string;
  selectedFolder: string;
  fileCount: (count: number) => string;
  encodingConfidenceLabel: string;
  macosArtifactsLabel: string;
  dsStoreLabel: string;
  encodingIssuesLabel: string;
  issuesTitle: string;
  moreIssues: (count: number) => string;
  issueTypeEncoding: string;
  issueTypeMacos: string;
  issueTypeDsStore: string;
  issueTypeHidden: string;
  optionsTitle: string;
  optionRemoveMac: string;
  optionRemoveDS: string;
  optionRemoveHidden: string;
  optionFixEncoding: string;
  buttonProcess: string;
  buttonDownload: string;
  statusAnalyzing: string;
  statusProcessing: string;
  feature1Title: string;
  feature1Desc: string;
  feature2Title: string;
  feature2Desc: string;
  feature3Title: string;
  feature3Desc: string;
  footer: string;
  themeLight: string;
  themeDark: string;
  themeSystem: string;
};

const MESSAGES: Record<Lang, Messages> = {
  ko: {
    title: 'ZIP 인코딩 픽서',
    subtitle: '맥에서 만든 ZIP 파일을 윈도우에서 깨지지 않게 변환합니다',
    zipMode: 'ZIP 파일 수정',
    folderMode: '폴더 → ZIP 생성',
    uploadZip: 'ZIP 파일을 드래그하거나 클릭하여 선택',
    uploadFolder: '클릭하여 폴더 선택',
    uploadZipDesc: '파일명 인코딩 문제를 자동으로 감지하고 수정합니다',
    uploadFolderDesc: '선택한 폴더를 윈도우 호환 ZIP으로 만듭니다',
    zipOnlyError: 'ZIP 파일만 업로드할 수 있습니다.',
    analyzeError: 'ZIP 파일 분석 중 오류가 발생했습니다.',
    processError: '처리 중 오류가 발생했습니다.',
    selectedFolder: '선택된 폴더',
    fileCount: (count) => `${count}개 파일`,
    encodingConfidenceLabel: '인코딩 이슈 가능성',
    macosArtifactsLabel: '__MACOSX 파일',
    dsStoreLabel: '.DS_Store 파일',
    encodingIssuesLabel: '인코딩 문제 파일',
    issuesTitle: '감지된 이슈',
    moreIssues: (count) => `외 ${count}개 이슈...`,
    issueTypeEncoding: '인코딩',
    issueTypeMacos: 'MACOSX',
    issueTypeDsStore: 'DS_Store',
    issueTypeHidden: '숨김',
    optionsTitle: '변환 옵션',
    optionRemoveMac: '__MACOSX 폴더 제거',
    optionRemoveDS: '.DS_Store 파일 제거',
    optionRemoveHidden: '숨김 파일 제거 (. 으로 시작하는 파일)',
    optionFixEncoding: '파일명 인코딩 자동 수정',
    buttonProcess: '윈도우 호환 ZIP으로 변환',
    buttonDownload: '수정된 ZIP 다운로드',
    statusAnalyzing: '분석 중...',
    statusProcessing: '변환 중...',
    feature1Title: '인코딩 자동 수정',
    feature1Desc: 'EUC-KR, Shift-JIS, GBK 등 다양한 인코딩을 감지하고 UTF-8로 자동 변환합니다.',
    feature2Title: '불필요 파일 제거',
    feature2Desc: '__MACOSX, .DS_Store 등 macOS 특유의 메타데이터 파일을 자동으로 제거합니다.',
    feature3Title: '브라우저에서 처리',
    feature3Desc: '모든 처리가 브라우저에서 이루어져 파일이 서버로 전송되지 않습니다.',
    footer: '모든 파일 처리는 브라우저 내에서 이루어지며, 서버에 업로드되지 않습니다.',
    themeLight: '라이트',
    themeDark: '다크',
    themeSystem: '시스템',
  },
  en: {
    title: 'ZIP Encoding Fixer',
    subtitle: 'Fix macOS ZIP filenames so they display correctly on Windows.',
    zipMode: 'Fix ZIP file',
    folderMode: 'Folder → ZIP',
    uploadZip: 'Drag a ZIP file here or click to select',
    uploadFolder: 'Click to select a folder',
    uploadZipDesc: 'Detect and fix filename encoding issues automatically.',
    uploadFolderDesc: 'Create a Windows-compatible ZIP from the selected folder.',
    zipOnlyError: 'Only ZIP files are supported.',
    analyzeError: 'An error occurred while analyzing the ZIP.',
    processError: 'An error occurred during processing.',
    selectedFolder: 'Selected folder',
    fileCount: (count) => `${count} files`,
    encodingConfidenceLabel: 'Encoding issue likelihood',
    macosArtifactsLabel: '__MACOSX files',
    dsStoreLabel: '.DS_Store files',
    encodingIssuesLabel: 'Files with encoding issues',
    issuesTitle: 'Detected Issues',
    moreIssues: (count) => `${count} more issues...`,
    issueTypeEncoding: 'Encoding',
    issueTypeMacos: 'MACOSX',
    issueTypeDsStore: 'DS_Store',
    issueTypeHidden: 'Hidden',
    optionsTitle: 'Conversion Options',
    optionRemoveMac: 'Remove __MACOSX folder',
    optionRemoveDS: 'Remove .DS_Store files',
    optionRemoveHidden: 'Remove hidden files (starting with .)',
    optionFixEncoding: 'Auto-fix filename encoding',
    buttonProcess: 'Convert to Windows-compatible ZIP',
    buttonDownload: 'Download fixed ZIP',
    statusAnalyzing: 'Analyzing...',
    statusProcessing: 'Converting...',
    feature1Title: 'Automatic encoding fix',
    feature1Desc: 'Detects EUC-KR, Shift-JIS, GBK, and more and converts to UTF-8.',
    feature2Title: 'Remove unnecessary files',
    feature2Desc: 'Automatically removes macOS metadata like __MACOSX and .DS_Store.',
    feature3Title: 'Browser-only processing',
    feature3Desc: 'All processing happens in the browser; files are not uploaded.',
    footer: 'All processing happens in your browser and files are not uploaded.',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
  },
  zh: {
    title: 'ZIP 编码修复器',
    subtitle: '修复 macOS 生成的 ZIP 文件名，使其在 Windows 上正常显示。',
    zipMode: '修复 ZIP 文件',
    folderMode: '文件夹 → ZIP',
    uploadZip: '拖拽 ZIP 文件或点击选择',
    uploadFolder: '点击选择文件夹',
    uploadZipDesc: '自动检测并修复文件名编码问题。',
    uploadFolderDesc: '将所选文件夹生成兼容 Windows 的 ZIP。',
    zipOnlyError: '仅支持 ZIP 文件。',
    analyzeError: '分析 ZIP 时发生错误。',
    processError: '处理过程中发生错误。',
    selectedFolder: '已选择的文件夹',
    fileCount: (count) => `${count} 个文件`,
    encodingConfidenceLabel: '编码问题可能性',
    macosArtifactsLabel: '__MACOSX 文件',
    dsStoreLabel: '.DS_Store 文件',
    encodingIssuesLabel: '编码问题文件',
    issuesTitle: '检测到的问题',
    moreIssues: (count) => `还有 ${count} 个问题...`,
    issueTypeEncoding: '编码',
    issueTypeMacos: 'MACOSX',
    issueTypeDsStore: 'DS_Store',
    issueTypeHidden: '隐藏',
    optionsTitle: '转换选项',
    optionRemoveMac: '移除 __MACOSX 文件夹',
    optionRemoveDS: '移除 .DS_Store 文件',
    optionRemoveHidden: '移除隐藏文件（以 . 开头）',
    optionFixEncoding: '自动修复文件名编码',
    buttonProcess: '转换为 Windows 兼容 ZIP',
    buttonDownload: '下载修复后的 ZIP',
    statusAnalyzing: '分析中...',
    statusProcessing: '转换中...',
    feature1Title: '自动修复编码',
    feature1Desc: '检测 EUC-KR、Shift-JIS、GBK 等并转换为 UTF-8。',
    feature2Title: '移除多余文件',
    feature2Desc: '自动移除 macOS 元数据，如 __MACOSX 和 .DS_Store。',
    feature3Title: '浏览器内处理',
    feature3Desc: '所有处理都在浏览器内完成，文件不会上传。',
    footer: '所有处理均在浏览器内完成，文件不会上传。',
    themeLight: '浅色',
    themeDark: '深色',
    themeSystem: '系统',
  },
  ja: {
    title: 'ZIP文字化け修正',
    subtitle: 'macOSで作成したZIPをWindowsで正しく表示させます。',
    zipMode: 'ZIPファイル修正',
    folderMode: 'フォルダ → ZIP',
    uploadZip: 'ZIPファイルをドラッグするかクリックして選択',
    uploadFolder: 'クリックしてフォルダを選択',
    uploadZipDesc: 'ファイル名の文字化けを自動検出・修正します。',
    uploadFolderDesc: '選択したフォルダをWindows互換ZIPにします。',
    zipOnlyError: 'ZIPファイルのみアップロードできます。',
    analyzeError: 'ZIPの解析中にエラーが発生しました。',
    processError: '処理中にエラーが発生しました。',
    selectedFolder: '選択されたフォルダ',
    fileCount: (count) => `${count} 件のファイル`,
    encodingConfidenceLabel: '文字化けの可能性',
    macosArtifactsLabel: '__MACOSX ファイル',
    dsStoreLabel: '.DS_Store ファイル',
    encodingIssuesLabel: '文字化けファイル',
    issuesTitle: '検出された問題',
    moreIssues: (count) => `他 ${count} 件...`,
    issueTypeEncoding: '文字化け',
    issueTypeMacos: 'MACOSX',
    issueTypeDsStore: 'DS_Store',
    issueTypeHidden: '隠し',
    optionsTitle: '変換オプション',
    optionRemoveMac: '__MACOSX フォルダを削除',
    optionRemoveDS: '.DS_Store ファイルを削除',
    optionRemoveHidden: '隠しファイルを削除（.で始まる）',
    optionFixEncoding: 'ファイル名の自動修正',
    buttonProcess: 'Windows互換ZIPに変換',
    buttonDownload: '修正済みZIPをダウンロード',
    statusAnalyzing: '解析中...',
    statusProcessing: '変換中...',
    feature1Title: '文字化け自動修正',
    feature1Desc: 'EUC-KR、Shift-JIS、GBKなどを検出してUTF-8へ変換します。',
    feature2Title: '不要ファイルの削除',
    feature2Desc: '__MACOSXや.DS_StoreなどmacOS特有のメタデータを削除します。',
    feature3Title: 'ブラウザ内で処理',
    feature3Desc: 'すべてブラウザ内で処理され、ファイルはアップロードされません。',
    footer: 'すべての処理はブラウザ内で行われ、ファイルはアップロードされません。',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    themeSystem: 'システム',
  },
  hi: {
    title: 'ZIP एन्कोडिंग फिक्सर',
    subtitle: 'macOS से बनी ZIP फ़ाइलों के नाम Windows पर सही दिखें।',
    zipMode: 'ZIP फ़ाइल ठीक करें',
    folderMode: 'फ़ोल्डर → ZIP',
    uploadZip: 'ZIP फ़ाइल को ड्रैग करें या क्लिक करके चुनें',
    uploadFolder: 'क्लिक करके फ़ोल्डर चुनें',
    uploadZipDesc: 'फ़ाइल नाम एन्कोडिंग समस्याएँ स्वतः पहचानकर ठीक करता है।',
    uploadFolderDesc: 'चुने गए फ़ोल्डर से Windows-संगत ZIP बनाता है।',
    zipOnlyError: 'केवल ZIP फ़ाइलें समर्थित हैं।',
    analyzeError: 'ZIP का विश्लेषण करते समय त्रुटि हुई।',
    processError: 'प्रोसेसिंग के दौरान त्रुटि हुई।',
    selectedFolder: 'चुना गया फ़ोल्डर',
    fileCount: (count) => `${count} फ़ाइलें`,
    encodingConfidenceLabel: 'एन्कोडिंग समस्या की संभावना',
    macosArtifactsLabel: '__MACOSX फ़ाइलें',
    dsStoreLabel: '.DS_Store फ़ाइलें',
    encodingIssuesLabel: 'एन्कोडिंग समस्या वाली फ़ाइलें',
    issuesTitle: 'पाई गई समस्याएँ',
    moreIssues: (count) => `अतिरिक्त ${count} समस्याएँ...`,
    issueTypeEncoding: 'एन्कोडिंग',
    issueTypeMacos: 'MACOSX',
    issueTypeDsStore: 'DS_Store',
    issueTypeHidden: 'छिपा',
    optionsTitle: 'कन्वर्ज़न विकल्प',
    optionRemoveMac: '__MACOSX फ़ोल्डर हटाएँ',
    optionRemoveDS: '.DS_Store फ़ाइल हटाएँ',
    optionRemoveHidden: 'छिपी फ़ाइलें हटाएँ ( . से शुरू )',
    optionFixEncoding: 'फ़ाइल नाम एन्कोडिंग स्वतः ठीक करें',
    buttonProcess: 'Windows-संगत ZIP में बदलें',
    buttonDownload: 'ठीक की गई ZIP डाउनलोड करें',
    statusAnalyzing: 'विश्लेषण हो रहा है...',
    statusProcessing: 'बदल रहा है...',
    feature1Title: 'ऑटो एन्कोडिंग फिक्स',
    feature1Desc: 'EUC-KR, Shift-JIS, GBK आदि पहचानकर UTF-8 में बदलता है।',
    feature2Title: 'अनावश्यक फ़ाइलें हटाएँ',
    feature2Desc: '__MACOSX और .DS_Store जैसी macOS मेटाडेटा फ़ाइलें हटाता है।',
    feature3Title: 'ब्राउज़र में प्रोसेसिंग',
    feature3Desc: 'सारी प्रोसेसिंग ब्राउज़र में होती है; फ़ाइलें अपलोड नहीं होतीं।',
    footer: 'सारी प्रोसेसिंग ब्राउज़र में होती है और फ़ाइलें अपलोड नहीं होतीं।',
    themeLight: 'लाइट',
    themeDark: 'डार्क',
    themeSystem: 'सिस्टम',
  },
  fr: {
    title: 'Correcteur d’encodage ZIP',
    subtitle: 'Corrige les ZIP créés sur macOS pour qu’ils s’affichent correctement sous Windows.',
    zipMode: 'Corriger un ZIP',
    folderMode: 'Dossier → ZIP',
    uploadZip: 'Glissez un ZIP ou cliquez pour sélectionner',
    uploadFolder: 'Cliquez pour sélectionner un dossier',
    uploadZipDesc: 'Détecte et corrige automatiquement l’encodage des noms de fichiers.',
    uploadFolderDesc: 'Crée un ZIP compatible Windows à partir du dossier sélectionné.',
    zipOnlyError: 'Seuls les fichiers ZIP sont pris en charge.',
    analyzeError: 'Une erreur est survenue lors de l’analyse du ZIP.',
    processError: 'Une erreur est survenue pendant le traitement.',
    selectedFolder: 'Dossier sélectionné',
    fileCount: (count) => `${count} fichiers`,
    encodingConfidenceLabel: 'Probabilité de problème d’encodage',
    macosArtifactsLabel: 'Fichiers __MACOSX',
    dsStoreLabel: 'Fichiers .DS_Store',
    encodingIssuesLabel: 'Fichiers avec problème d’encodage',
    issuesTitle: 'Problèmes détectés',
    moreIssues: (count) => `${count} problèmes supplémentaires...`,
    issueTypeEncoding: 'Encodage',
    issueTypeMacos: 'MACOSX',
    issueTypeDsStore: 'DS_Store',
    issueTypeHidden: 'Masqué',
    optionsTitle: 'Options de conversion',
    optionRemoveMac: 'Supprimer le dossier __MACOSX',
    optionRemoveDS: 'Supprimer les fichiers .DS_Store',
    optionRemoveHidden: 'Supprimer les fichiers cachés (commençant par .)',
    optionFixEncoding: 'Correction automatique des noms de fichiers',
    buttonProcess: 'Convertir en ZIP compatible Windows',
    buttonDownload: 'Télécharger le ZIP corrigé',
    statusAnalyzing: 'Analyse...',
    statusProcessing: 'Conversion...',
    feature1Title: 'Correction automatique d’encodage',
    feature1Desc: 'Détecte EUC-KR, Shift-JIS, GBK, etc., et convertit en UTF-8.',
    feature2Title: 'Suppression des fichiers inutiles',
    feature2Desc: 'Supprime automatiquement les métadonnées macOS comme __MACOSX et .DS_Store.',
    feature3Title: 'Traitement dans le navigateur',
    feature3Desc: 'Tout se fait dans le navigateur, aucun fichier n’est envoyé.',
    footer: 'Tout le traitement est effectué dans le navigateur, aucun fichier n’est envoyé.',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    themeSystem: 'Système',
  },
  'pt-br': {
    title: 'Corretor de codificação ZIP',
    subtitle: 'Corrige ZIPs do macOS para aparecerem corretamente no Windows.',
    zipMode: 'Corrigir ZIP',
    folderMode: 'Pasta → ZIP',
    uploadZip: 'Arraste um ZIP ou clique para selecionar',
    uploadFolder: 'Clique para selecionar uma pasta',
    uploadZipDesc: 'Detecta e corrige automaticamente a codificação do nome dos arquivos.',
    uploadFolderDesc: 'Cria um ZIP compatível com Windows a partir da pasta selecionada.',
    zipOnlyError: 'Apenas arquivos ZIP são suportados.',
    analyzeError: 'Ocorreu um erro ao analisar o ZIP.',
    processError: 'Ocorreu um erro durante o processamento.',
    selectedFolder: 'Pasta selecionada',
    fileCount: (count) => `${count} arquivos`,
    encodingConfidenceLabel: 'Probabilidade de problema de codificação',
    macosArtifactsLabel: 'Arquivos __MACOSX',
    dsStoreLabel: 'Arquivos .DS_Store',
    encodingIssuesLabel: 'Arquivos com problema de codificação',
    issuesTitle: 'Problemas detectados',
    moreIssues: (count) => `Mais ${count} problemas...`,
    issueTypeEncoding: 'Codificação',
    issueTypeMacos: 'MACOSX',
    issueTypeDsStore: 'DS_Store',
    issueTypeHidden: 'Oculto',
    optionsTitle: 'Opções de conversão',
    optionRemoveMac: 'Remover pasta __MACOSX',
    optionRemoveDS: 'Remover arquivo .DS_Store',
    optionRemoveHidden: 'Remover arquivos ocultos (iniciados com .)',
    optionFixEncoding: 'Corrigir codificação do nome do arquivo',
    buttonProcess: 'Converter para ZIP compatível com Windows',
    buttonDownload: 'Baixar ZIP corrigido',
    statusAnalyzing: 'Analisando...',
    statusProcessing: 'Convertendo...',
    feature1Title: 'Correção automática de codificação',
    feature1Desc: 'Detecta EUC-KR, Shift-JIS, GBK e converte para UTF-8.',
    feature2Title: 'Remover arquivos desnecessários',
    feature2Desc: 'Remove automaticamente metadados do macOS como __MACOSX e .DS_Store.',
    feature3Title: 'Processamento no navegador',
    feature3Desc: 'Todo o processamento ocorre no navegador; os arquivos não são enviados.',
    footer: 'Todo o processamento ocorre no navegador e os arquivos não são enviados.',
    themeLight: 'Claro',
    themeDark: 'Escuro',
    themeSystem: 'Sistema',
  },
  de: {
    title: 'ZIP-Encoding-Fixer',
    subtitle: 'Korrigiert ZIPs von macOS, damit sie unter Windows korrekt angezeigt werden.',
    zipMode: 'ZIP reparieren',
    folderMode: 'Ordner → ZIP',
    uploadZip: 'ZIP ziehen oder klicken, um auszuwählen',
    uploadFolder: 'Klicken, um einen Ordner auszuwählen',
    uploadZipDesc: 'Erkennt und behebt Dateinamen-Encoding automatisch.',
    uploadFolderDesc: 'Erstellt ein Windows-kompatibles ZIP aus dem Ordner.',
    zipOnlyError: 'Nur ZIP-Dateien werden unterstützt.',
    analyzeError: 'Beim Analysieren der ZIP ist ein Fehler aufgetreten.',
    processError: 'Beim Verarbeiten ist ein Fehler aufgetreten.',
    selectedFolder: 'Ausgewählter Ordner',
    fileCount: (count) => `${count} Dateien`,
    encodingConfidenceLabel: 'Wahrscheinlichkeit von Encoding-Problemen',
    macosArtifactsLabel: '__MACOSX-Dateien',
    dsStoreLabel: '.DS_Store-Dateien',
    encodingIssuesLabel: 'Dateien mit Encoding-Problemen',
    issuesTitle: 'Erkannte Probleme',
    moreIssues: (count) => `${count} weitere Probleme...`,
    issueTypeEncoding: 'Encoding',
    issueTypeMacos: 'MACOSX',
    issueTypeDsStore: 'DS_Store',
    issueTypeHidden: 'Versteckt',
    optionsTitle: 'Konvertierungsoptionen',
    optionRemoveMac: '__MACOSX-Ordner entfernen',
    optionRemoveDS: '.DS_Store-Datei entfernen',
    optionRemoveHidden: 'Versteckte Dateien entfernen (beginnend mit .)',
    optionFixEncoding: 'Dateinamen-Encoding automatisch korrigieren',
    buttonProcess: 'In Windows-kompatibles ZIP umwandeln',
    buttonDownload: 'Korrigiertes ZIP herunterladen',
    statusAnalyzing: 'Analysiere...',
    statusProcessing: 'Konvertiere...',
    feature1Title: 'Automatische Encoding-Korrektur',
    feature1Desc: 'Erkennt EUC-KR, Shift-JIS, GBK usw. und konvertiert zu UTF-8.',
    feature2Title: 'Unnötige Dateien entfernen',
    feature2Desc: 'Entfernt macOS-Metadaten wie __MACOSX und .DS_Store automatisch.',
    feature3Title: 'Verarbeitung im Browser',
    feature3Desc: 'Alle Verarbeitung läuft im Browser; Dateien werden nicht hochgeladen.',
    footer: 'Alle Verarbeitung erfolgt im Browser, Dateien werden nicht hochgeladen.',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    themeSystem: 'System',
  },
};

function getLang(input: string): Lang | null {
  const normalized = input.toLowerCase();
  if (SUPPORTED_LANGS.includes(normalized as Lang)) {
    return normalized as Lang;
  }
  return null;
}

export default function Home() {
  const router = useRouter();
  const params = useParams();
  const paramLang = Array.isArray(params?.lang) ? params.lang[0] : params?.lang;
  const lang = getLang(paramLang ?? '');
  const t = MESSAGES[lang ?? 'ko'];
  const currentLang: Lang = lang ?? 'ko';

  const [theme, setTheme] = useState<Theme>('system');
  const [mode, setMode] = useState<Mode>('zip');
  const [status, setStatus] = useState<Status>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<FileList | null>(null);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ProcessingOptions>({
    removeMAcOSArtifacts: true,
    removeDSStore: true,
    removeHiddenFiles: false,
    fixEncoding: true,
  });

  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!lang) {
      router.replace('/ko');
    }
  }, [lang, router]);

  useEffect(() => {
    const stored = window.localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length === 0) return;

    const droppedFile = droppedFiles[0];
    if (!droppedFile.name.endsWith('.zip')) {
      setError(t.zipOnlyError);
      return;
    }

    await handleZipFile(droppedFile);
  }, [t.zipOnlyError]);

  const handleZipFile = async (zipFile: File) => {
    setFile(zipFile);
    setFiles(null);
    setError(null);
    setStatus('analyzing');
    setProcessedBlob(null);

    try {
      const diagnosticReport = await analyzeZip(zipFile);
      setReport(diagnosticReport);
      setStatus('idle');
    } catch (err) {
      setError(t.analyzeError);
      setStatus('error');
      console.error(err);
    }
  };

  const handleFolderSelect = async (fileList: FileList) => {
    setFiles(fileList);
    setFile(null);
    setError(null);
    setReport({
      totalFiles: fileList.length,
      issues: [],
      macosArtifacts: 0,
      dsStoreFiles: Array.from(fileList).filter(f =>
        f.name === '.DS_Store' || (f as File & { webkitRelativePath?: string }).webkitRelativePath?.includes('.DS_Store')
      ).length,
      encodingIssues: 0,
      hiddenFiles: Array.from(fileList).filter(f => {
        const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
        return path.split('/').some(p => p.startsWith('.') && p !== '.DS_Store');
      }).length,
      encodingConfidence: 0,
    });
    setStatus('idle');
  };

  const handleProcess = async () => {
    setStatus('processing');
    setError(null);

    try {
      if (mode === 'zip' && file) {
        const result = await processZip(file, options);
        setProcessedBlob(result.blob);
        setReport(result.report);
      } else if (mode === 'folder' && files) {
        const result = await createZipFromFiles(files, options);
        setProcessedBlob(result.blob);
        setReport(result.report);
      }
      setStatus('done');
    } catch (err) {
      setError(t.processError);
      setStatus('error');
      console.error(err);
    }
  };

  const handleDownload = () => {
    if (!processedBlob) return;

    const originalName = file?.name || 'archive';
    const baseName = originalName.replace('.zip', '');
    saveAs(processedBlob, `${baseName}_fixed.zip`);
  };

  const handleReset = () => {
    setFile(null);
    setFiles(null);
    setReport(null);
    setProcessedBlob(null);
    setError(null);
    setStatus('idle');
  };

  const issueTypeLabel = (type: string) => {
    if (type === 'encoding') return t.issueTypeEncoding;
    if (type === 'macos_artifact') return t.issueTypeMacos;
    if (type === 'ds_store') return t.issueTypeDsStore;
    return t.issueTypeHidden;
  };

  const handleLangChange = (nextLang: Lang) => {
    if (nextLang === currentLang) return;
    router.replace(`/${nextLang}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800">
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <nav className="flex items-center justify-between gap-4 mb-10">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t.title}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg bg-white dark:bg-slate-800 shadow-md shadow-slate-400/25 dark:shadow-md dark:shadow-black/25 border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setTheme('light')}
                aria-label={t.themeLight}
                aria-pressed={theme === 'light'}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  theme === 'light'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                ☀️
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                aria-label={t.themeDark}
                aria-pressed={theme === 'dark'}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                🌙
              </button>
              <button
                type="button"
                onClick={() => setTheme('system')}
                aria-label={t.themeSystem}
                aria-pressed={theme === 'system'}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  theme === 'system'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                🖥️
              </button>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800 shadow-md shadow-slate-400/25 dark:shadow-md dark:shadow-black/25 border border-slate-200 dark:border-slate-700 px-3 py-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">🌐</span>
              <select
                value={currentLang}
                onChange={(e) => handleLangChange(e.target.value as Lang)}
                className="bg-transparent text-sm text-slate-700 dark:text-slate-200 focus:outline-none"
                aria-label="Language"
              >
                {SUPPORTED_LANGS.map((code) => (
                  <option key={code} value={code} className="text-slate-900">
                    {LANGUAGE_ICONS[code]} {LANGUAGE_LABELS[code]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </nav>
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-800 dark:text-white mb-4">
            {t.title}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            {t.subtitle}
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => { setMode('zip'); handleReset(); }}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              mode === 'zip'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-md shadow-slate-400/25 dark:shadow-md dark:shadow-black/25 border border-slate-200 dark:border-slate-600/50 hover:bg-slate-50 dark:hover:bg-slate-600'
            }`}
          >
            {t.zipMode}
          </button>
          <button
            onClick={() => { setMode('folder'); handleReset(); }}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              mode === 'folder'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-md shadow-slate-400/25 dark:shadow-md dark:shadow-black/25 border border-slate-200 dark:border-slate-600/50 hover:bg-slate-50 dark:hover:bg-slate-600'
            }`}
          >
            {t.folderMode}
          </button>
        </div>

        {/* Upload Area */}
        {!file && !files && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer shadow-lg shadow-slate-400/20 dark:shadow-lg dark:shadow-black/25 ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/50 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-700/50'
            }`}
            onClick={() => mode === 'zip' ? zipInputRef.current?.click() : folderInputRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
                  {mode === 'zip' ? t.uploadZip : t.uploadFolder}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {mode === 'zip' ? t.uploadZipDesc : t.uploadFolderDesc}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Hidden inputs */}
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleZipFile(e.target.files[0])}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is not in React types
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFolderSelect(e.target.files)}
        />

        {/* Error Message */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* File Selected - Show Report */}
        {(file || files) && report && (
          <div className="mt-8 space-y-6">
            {/* File Info */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg shadow-slate-400/25 dark:shadow-lg dark:shadow-black/30 border border-slate-200/80 dark:border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 dark:text-white">
                      {file?.name || t.selectedFolder}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t.fileCount(report.totalFiles)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Reset"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Diagnostic Summary */}
              {mode === 'zip' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 shadow-sm shadow-slate-400/20 dark:shadow-md dark:shadow-black/20 border border-slate-200/80 dark:border-slate-700/50">
                    <p className="text-2xl font-bold text-orange-500">{report.encodingConfidence}%</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{t.encodingConfidenceLabel}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 shadow-sm shadow-slate-400/20 dark:shadow-md dark:shadow-black/20 border border-slate-200/80 dark:border-slate-700/50">
                    <p className="text-2xl font-bold text-purple-500">{report.macosArtifacts}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{t.macosArtifactsLabel}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 shadow-sm shadow-slate-400/20 dark:shadow-md dark:shadow-black/20 border border-slate-200/80 dark:border-slate-700/50">
                    <p className="text-2xl font-bold text-pink-500">{report.dsStoreFiles}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{t.dsStoreLabel}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 shadow-sm shadow-slate-400/20 dark:shadow-md dark:shadow-black/20 border border-slate-200/80 dark:border-slate-700/50">
                    <p className="text-2xl font-bold text-blue-500">{report.encodingIssues}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{t.encodingIssuesLabel}</p>
                  </div>
                </div>
              )}

              {/* Issues List */}
              {report.issues.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium text-slate-800 dark:text-white mb-3">{t.issuesTitle}</h3>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {report.issues.slice(0, 20).map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm p-2 bg-slate-50 dark:bg-slate-700/50 rounded shadow-sm shadow-slate-400/15 dark:shadow-sm dark:shadow-black/15 border border-slate-200/80 dark:border-slate-700/40">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          issue.type === 'encoding' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' :
                          issue.type === 'macos_artifact' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' :
                          issue.type === 'ds_store' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-900/50 dark:text-gray-300'
                        }`}>
                          {issueTypeLabel(issue.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-600 dark:text-slate-300 truncate">{issue.originalPath}</p>
                          {issue.fixedPath && (
                            <p className="text-green-600 dark:text-green-400 truncate">→ {issue.fixedPath}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {report.issues.length > 20 && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-2">
                        {t.moreIssues(report.issues.length - 20)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Options */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg shadow-slate-400/25 dark:shadow-lg dark:shadow-black/30 border border-slate-200/80 dark:border-slate-700/50">
              <h3 className="font-medium text-slate-800 dark:text-white mb-4">{t.optionsTitle}</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.removeMAcOSArtifacts}
                    onChange={(e) => setOptions({ ...options, removeMAcOSArtifacts: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300">{t.optionRemoveMac}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.removeDSStore}
                    onChange={(e) => setOptions({ ...options, removeDSStore: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300">{t.optionRemoveDS}</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.removeHiddenFiles}
                    onChange={(e) => setOptions({ ...options, removeHiddenFiles: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300">{t.optionRemoveHidden}</span>
                </label>
                {mode === 'zip' && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.fixEncoding}
                      onChange={(e) => setOptions({ ...options, fixEncoding: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700 dark:text-slate-300">{t.optionFixEncoding}</span>
                  </label>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              {status !== 'done' ? (
                <button
                  onClick={handleProcess}
                  disabled={status === 'processing' || status === 'analyzing'}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all flex items-center gap-2"
                >
                  {status === 'processing' || status === 'analyzing' ? (
                    <>
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {status === 'analyzing' ? t.statusAnalyzing : t.statusProcessing}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {t.buttonProcess}
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleDownload}
                  className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t.buttonDownload}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg shadow-slate-400/25 dark:shadow-lg dark:shadow-black/30 border border-slate-200/80 dark:border-slate-700/50">
            <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center mb-4 shadow-sm shadow-orange-200/50 dark:shadow-md dark:shadow-orange-900/30">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-white mb-2">{t.feature1Title}</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {t.feature1Desc}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg shadow-slate-400/25 dark:shadow-lg dark:shadow-black/30 border border-slate-200/80 dark:border-slate-700/50">
            <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-4 shadow-sm shadow-purple-200/50 dark:shadow-md dark:shadow-purple-900/30">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-white mb-2">{t.feature2Title}</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {t.feature2Desc}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg shadow-slate-400/25 dark:shadow-lg dark:shadow-black/30 border border-slate-200/80 dark:border-slate-700/50">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4 shadow-sm shadow-green-200/50 dark:shadow-md dark:shadow-green-900/30">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-white mb-2">{t.feature3Title}</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {t.feature3Desc}
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>{t.footer}</p>
        </footer>
      </main>
    </div>
  );
}
