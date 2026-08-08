const svg = (body: string, vb = "0 0 16 16") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="16" height="16" fill="none">${body}</svg>`;

const filled = (body: string, vb = "0 0 16 16") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="16" height="16">${body}</svg>`;

// ── Navigation ──────────────────────────────────────────────

export const chevron = svg(
  `<path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
);

// ── Nodes ───────────────────────────────────────────────────

export const folder = filled(
  `<path fill="#C09553" d="M1.5 2A1.5 1.5 0 000 3.5v9A1.5 1.5 0 001.5 14h13a1.5 1.5 0 001.5-1.5V5.5A1.5 1.5 0 0014.5 4H8L6.854 2.146A.5.5 0 006.5 2H1.5z"/>`,
);

export const folderOpen = filled(
  `<path fill="#DCAD6A" d="M.5 4A1.5 1.5 0 012 2.5h4.5a.5.5 0 01.354.146L8.207 4H14a1.5 1.5 0 011.5 1.5V6H2.5A1.5 1.5 0 001 7.5V4.5A.5.5 0 00.5 4z"/>
   <path fill="#C09553" d="M1 7.5A1.5 1.5 0 012.5 6h12a1.5 1.5 0 011.45 1.12l-1.5 6A1.5 1.5 0 0113 14H2.5A1.5 1.5 0 011 12.5v-5z"/>`,
);

export const file = svg(
  `<path d="M3 1.5A1.5 1.5 0 014.5 0h4.879a1.5 1.5 0 011.06.44l2.122 2.12A1.5 1.5 0 0113 3.622V14.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 14.5v-13z" fill="currentColor" opacity="0.3"/>
   <path d="M9 0v3.5A1.5 1.5 0 0010.5 5H13" stroke="currentColor" stroke-width="0.8" opacity="0.5"/>`,
);

// ── File type icons ─────────────────────────────────────────

function fileTypeBadge(text: string, color: string): string {
  return filled(
    `<path d="M3 1.5A1.5 1.5 0 014.5 0h4.879a1.5 1.5 0 011.06.44l2.122 2.12A1.5 1.5 0 0113 3.622V14.5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 14.5v-13z" fill="currentColor" opacity="0.15"/>
     <text x="8" y="11.5" text-anchor="middle" font-family="system-ui,sans-serif" font-size="5.5" font-weight="700" fill="${color}">${text}</text>`,
  );
}

export const fileTs = fileTypeBadge("TS", "#3178C6");
export const fileJs = fileTypeBadge("JS", "#F0DB4F");
export const fileTsx = fileTypeBadge("TX", "#3178C6");
export const fileJsx = fileTypeBadge("JX", "#61DAFB");
export const fileHtml = fileTypeBadge("H", "#E44D26");
export const fileCss = fileTypeBadge("C", "#264DE4");
export const fileScss = fileTypeBadge("S", "#CD6799");
export const fileJson = fileTypeBadge("{}", "#A4A4A4");
export const fileMd = fileTypeBadge("M", "#519ABA");
export const fileYaml = fileTypeBadge("Y", "#CB171E");
export const fileSvg = fileTypeBadge("SV", "#FFB13B");
export const filePng = fileTypeBadge("Im", "#A074C4");
export const fileJpg = fileTypeBadge("Im", "#A074C4");
export const fileGif = fileTypeBadge("Im", "#A074C4");
export const fileWebp = fileTypeBadge("Im", "#A074C4");
export const filePy = fileTypeBadge("Py", "#3776AB");
export const fileRb = fileTypeBadge("Rb", "#CC342D");
export const fileRs = fileTypeBadge("Rs", "#DEA584");
export const fileGo = fileTypeBadge("Go", "#00ADD8");
export const fileJava = fileTypeBadge("Ja", "#ED8B00");
export const filePhp = fileTypeBadge("P", "#777BB4");
export const fileSh = fileTypeBadge("$", "#89E051");
export const fileSql = fileTypeBadge("Q", "#F29111");
export const fileXml = fileTypeBadge("X", "#E44D26");
export const fileToml = fileTypeBadge("T", "#9C4121");
export const fileLock = fileTypeBadge("lk", "#888");
export const fileEnv = fileTypeBadge(".e", "#ECD53F");
export const fileVue = fileTypeBadge("V", "#42B883");
export const fileTxt = fileTypeBadge("tx", "#A4A4A4");

// ── Toolbar icons ───────────────────────────────────────────

export const newFile = svg(
  `<path d="M9 1H4.5A1.5 1.5 0 003 2.5v11A1.5 1.5 0 004.5 15h7a1.5 1.5 0 001.5-1.5V5L9 1z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
   <path d="M9 1v4h4M8 9v4M6 11h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);

export const newFolder = svg(
  `<path d="M1.5 3A1.5 1.5 0 013 1.5h3l1.5 1.5H13A1.5 1.5 0 0114.5 4.5v7A1.5 1.5 0 0113 13H3A1.5 1.5 0 011.5 11.5v-8.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
   <path d="M8 7v4M6 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);

export const expandAllIcon = svg(
  `<rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
   <path d="M8 5.5v5M5.5 8h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);

export const collapseAllIcon = svg(
  `<rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
   <path d="M5.5 8h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);

export const editIcon = svg(
  `<path d="M11.5 1.5a2.121 2.121 0 013 3L5.5 13.5 1 15l1.5-4.5 9-9z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);

export const trashIcon = svg(
  `<path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);

export const copyIcon = svg(
  `<rect x="5" y="5" width="9" height="10" rx="1" stroke="currentColor" stroke-width="1.2"/>
   <path d="M3 11V3a1 1 0 011-1h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
);

export const cutIcon = svg(
  `<circle cx="5" cy="4" r="2" stroke="currentColor" stroke-width="1.2"/>
   <circle cx="5" cy="12" r="2" stroke="currentColor" stroke-width="1.2"/>
   <path d="M6.5 5.5L14 13M6.5 10.5L14 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`,
);

export const pasteIcon = svg(
  `<rect x="4" y="3" width="9" height="12" rx="1" stroke="currentColor" stroke-width="1.2"/>
   <path d="M6 3V1.5h5V3M6.5 8l2 2 3-3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);

// ── Icon Registry ───────────────────────────────────────────

export const defaultIconMap: Record<string, string> = {
  ts: fileTs,
  tsx: fileTsx,
  js: fileJs,
  jsx: fileJsx,
  mjs: fileJs,
  cjs: fileJs,
  html: fileHtml,
  htm: fileHtml,
  css: fileCss,
  scss: fileScss,
  sass: fileScss,
  less: fileCss,
  json: fileJson,
  md: fileMd,
  mdx: fileMd,
  markdown: fileMd,
  yaml: fileYaml,
  yml: fileYaml,
  svg: fileSvg,
  png: filePng,
  jpg: fileJpg,
  jpeg: fileJpg,
  gif: fileGif,
  webp: fileWebp,
  py: filePy,
  rb: fileRb,
  rs: fileRs,
  go: fileGo,
  java: fileJava,
  php: filePhp,
  sh: fileSh,
  bash: fileSh,
  zsh: fileSh,
  sql: fileSql,
  xml: fileXml,
  toml: fileToml,
  lock: fileLock,
  env: fileEnv,
  vue: fileVue,
  txt: fileTxt,
  log: fileTxt,
};

/** Special name-based icons (entire filename match). */
export const defaultNameIconMap: Record<string, string> = {
  ".gitignore": fileTypeBadge("gi", "#F05032"),
  ".npmignore": fileTypeBadge("ni", "#CB3837"),
  ".env": fileEnv,
  ".env.local": fileEnv,
  ".env.production": fileEnv,
  ".env.development": fileEnv,
  Dockerfile: fileTypeBadge("D", "#2496ED"),
  Makefile: fileTypeBadge("Mk", "#427819"),
  LICENSE: fileTypeBadge("Li", "#DA2128"),
  "README.md": fileTypeBadge("R", "#519ABA"),
};
