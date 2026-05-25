export interface ProjectTemplate {
  id: string;
  dotnetName: string;     // short name for `dotnet new <name>`
  label: string;          // displayed in sidebar
  type: string;           // shown in "Type:" field
  description: string;
  category: string;       // sidebar group header
  iconSvg: string;        // full <svg> HTML string
  languages: string[];    // supported language options
  options: {
    topLevel:      boolean;  // --use-program-main
    auth:          boolean;  // --auth choice
    https:         boolean;  // --no-https toggle
    openApi:       boolean;  // --no-openapi
    controllers:   boolean;  // --use-controllers vs minimal APIs
    interactivity: boolean;  // --interactivity (Blazor)
    emptyContent:  boolean;  // --empty (Blazor)
    aot:           boolean;  // --aot
    docker:        boolean;  // Dockerfile + Compose
  };
}

// SVG icon helpers (16×16, stroke-based, matches modal.css style)
const ic = (inner: string) =>
  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const ICONS: Record<string, string> = {
  console:  ic('<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M4 6.5l2.5 2-2.5 2M9 10.5h3"/>'),
  classlib: ic('<rect x="2" y="1.5" width="9" height="12" rx="1"/><path d="M4.5 5h4M4.5 7.5h4M4.5 10h2.5"/><rect x="5" y="2.5" width="9" height="12" rx="1" fill="var(--vscode-editorWidget-background,var(--vscode-editor-background))"/><rect x="5" y="2.5" width="9" height="12" rx="1"/><path d="M7.5 6h4M7.5 8.5h4M7.5 11h2.5"/>'),
  web:      ic('<circle cx="8" cy="8" r="5.5"/><path d="M8 2.5c-2 2.5-2 8.5 0 11M8 2.5c2 2.5 2 8.5 0 11M2.5 8h11"/>'),
  webapi:   ic('<path d="M2 5h8M2 8h6M2 11h4"/><path d="M12 9l2.5 2-2.5 2"/>'),
  grpc:     ic('<circle cx="4" cy="8" r="2"/><circle cx="12" cy="4" r="2"/><circle cx="12" cy="12" r="2"/><path d="M5.7 7.3l4.6-2.6M5.7 8.7l4.6 2.6"/>'),
  worker:   ic('<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>'),
  mstest:   ic('<path d="M5 1.5v5.5L2.5 13a1 1 0 00.9 1.5h9.2a1 1 0 00.9-1.5L11 7V1.5"/><path d="M5 1.5h6M4.5 9.5h7"/>'),
  xunit:    ic('<path d="M5 1.5v5.5L2.5 13a1 1 0 00.9 1.5h9.2a1 1 0 00.9-1.5L11 7V1.5"/><path d="M5 1.5h6M6 10l4-1.5M6 11.5l4-1.5"/>'),
  nunit:    ic('<path d="M5 1.5v5.5L2.5 13a1 1 0 00.9 1.5h9.2a1 1 0 00.9-1.5L11 7V1.5"/><path d="M5 1.5h6"/><circle cx="8" cy="10.5" r="1.5"/>'),
  blazor:   ic('<path d="M8 2C4.7 2 2 4.7 2 8s2.7 6 6 6c1.5 0 2-.8 2-2S9.5 10 11 10c1 0 1.5-.5 1.5-1.5C12.5 4.9 10.5 2 8 2z"/><circle cx="5.5" cy="7.5" r=".9" fill="currentColor" stroke="none"/><circle cx="9" cy="5.5" r=".9" fill="currentColor" stroke="none"/>'),
  mvc:      ic('<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="5.5" y="9" width="5" height="5" rx="1"/><path d="M4.5 7v1.5M11.5 7v1.5M8 7v2"/>'),
  razor:    ic('<path d="M3 4h10M3 8h7M3 12h5"/><path d="M12 8.5l2.5 2-2.5 2"/>'),
  aspire:   ic('<path d="M8 2l1.5 4.5H14l-3.8 2.7 1.4 4.5L8 11l-3.6 2.7 1.4-4.5L2 6.5h4.5z"/>'),
  azfunc:   ic('<path d="M9 2L5 9h4l-2 5 6-7H9l2-5z"/>'),
  maui:     ic('<rect x="4" y="1.5" width="8" height="13" rx="1.5"/><circle cx="8" cy="12.5" r=".7" fill="currentColor" stroke="none"/><path d="M6 3.5h4"/>'),
  database: ic('<ellipse cx="8" cy="5" rx="5.5" ry="2"/><path d="M2.5 5v6c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V5"/><path d="M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2"/>'),
  wpf:      ic('<rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 6h12M5 6v7"/><rect x="6" y="8" width="6" height="3" rx=".5"/>'),
};

// Shorthand for templates with no conditional options
const NO_OPTS = {
  topLevel: false, auth: false, https: false, openApi: false,
  controllers: false, interactivity: false, emptyContent: false,
  aot: false, docker: false,
} as const;

// ── Template catalog ─────────────────────────────────────────────────────────
// Curated list — mirrors Rider's New Project sidebar (~6 primary + extras).
// dotnetName must match the Short Name column from `dotnet new list`.
// Remove an entry here to hide it from the modal regardless of installation.
export const TEMPLATE_CATALOG: ProjectTemplate[] = [

  // ── Project Type (primary — shown first, most common) ─────────────────────
  {
    id: 'console', dotnetName: 'console',
    label: 'Console', type: 'Console App',
    description: 'A project for creating a command-line application that can run on .NET on Windows, Linux and macOS.',
    category: 'Project Type',
    iconSvg: ICONS.console,
    languages: ['C#', 'F#', 'VB'],
    options: { ...NO_OPTS, topLevel: true, aot: true, docker: true },
  },
  {
    id: 'classlib', dotnetName: 'classlib',
    label: 'Class Library', type: 'Class Library',
    description: 'A project for creating a class library that targets .NET or .NET Standard.',
    category: 'Project Type',
    iconSvg: ICONS.classlib,
    languages: ['C#', 'F#', 'VB'],
    options: { ...NO_OPTS },
  },
  {
    id: 'web', dotnetName: 'webapp',
    label: 'Web', type: 'ASP.NET Core Web App',
    description: 'A project template for creating an ASP.NET Core application with Razor Pages.',
    category: 'Project Type',
    iconSvg: ICONS.web,
    languages: ['C#'],
    options: { ...NO_OPTS, auth: true, https: true, docker: true },
  },
  {
    id: 'webapi', dotnetName: 'webapi',
    label: 'Web API', type: 'ASP.NET Core Web API',
    description: 'A project template for creating a RESTful HTTP service with ASP.NET Core, supporting controllers or minimal APIs with optional OpenAPI.',
    category: 'Project Type',
    iconSvg: ICONS.webapi,
    languages: ['C#', 'F#'],
    options: { ...NO_OPTS, auth: true, https: true, openApi: true, controllers: true, docker: true },
  },
  {
    id: 'worker', dotnetName: 'worker',
    label: 'Services', type: 'Worker Service',
    description: 'A project template for creating a long-running Worker Service.',
    category: 'Project Type',
    iconSvg: ICONS.worker,
    languages: ['C#', 'F#'],
    options: { ...NO_OPTS, topLevel: true, aot: true, docker: true },
  },
  {
    id: 'mstest', dotnetName: 'mstest',
    label: 'Unit Test', type: 'MSTest Test Project',
    description: 'A project template for creating a MSTest unit test project.',
    category: 'Project Type',
    iconSvg: ICONS.mstest,
    languages: ['C#', 'F#', 'VB'],
    options: { ...NO_OPTS },
  },

  // ── Other (extended — only shown if installed) ─────────────────────────────
  {
    id: 'mvc', dotnetName: 'mvc',
    label: 'MVC', type: 'ASP.NET Core Web App (MVC)',
    description: 'A project template for creating an ASP.NET Core application with Model-View-Controller pattern.',
    category: 'Other',
    iconSvg: ICONS.mvc,
    languages: ['C#', 'F#'],
    options: { ...NO_OPTS, auth: true, https: true, docker: true },
  },
  {
    id: 'grpc', dotnetName: 'grpc',
    label: 'gRPC', type: 'ASP.NET Core gRPC Service',
    description: 'A project template for creating a gRPC service with ASP.NET Core.',
    category: 'Other',
    iconSvg: ICONS.grpc,
    languages: ['C#'],
    options: { ...NO_OPTS, topLevel: true, aot: true, docker: true },
  },
  {
    id: 'blazor', dotnetName: 'blazor',
    label: 'Blazor', type: 'Blazor Web App',
    description: 'A project template for creating a Blazor web app that supports server-side rendering and client interactivity.',
    category: 'Other',
    iconSvg: ICONS.blazor,
    languages: ['C#'],
    options: { ...NO_OPTS, auth: true, https: true, interactivity: true, emptyContent: true, docker: true },
  },
  {
    id: 'xunit', dotnetName: 'xunit',
    label: 'xUnit', type: 'xUnit Test Project',
    description: 'A project template for creating a xUnit unit test project.',
    category: 'Other',
    iconSvg: ICONS.xunit,
    languages: ['C#', 'F#', 'VB'],
    options: { ...NO_OPTS },
  },
  {
    id: 'nunit', dotnetName: 'nunit',
    label: 'NUnit', type: 'NUnit Test Project',
    description: 'A project template for creating a NUnit unit test project.',
    category: 'Other',
    iconSvg: ICONS.nunit,
    languages: ['C#', 'F#', 'VB'],
    options: { ...NO_OPTS },
  },
  {
    id: 'aspire-starter', dotnetName: 'aspire-starter',
    label: 'Aspire', type: '.NET Aspire Starter App',
    description: 'A project template for creating a .NET Aspire starter application.',
    category: 'Other',
    iconSvg: ICONS.aspire,
    languages: ['C#'],
    options: { ...NO_OPTS },
  },
  {
    id: 'azurefunctions', dotnetName: 'func',
    label: 'Azure Functions', type: 'Azure Functions',
    description: 'A project template for creating an Azure Functions project.',
    category: 'Other',
    iconSvg: ICONS.azfunc,
    languages: ['C#', 'F#'],
    options: { ...NO_OPTS },
  },
  {
    id: 'maui', dotnetName: 'maui',
    label: 'MAUI', type: '.NET MAUI App',
    description: 'A project template for creating a .NET MAUI app that runs on Android, iOS, macOS and Windows.',
    category: 'Other',
    iconSvg: ICONS.maui,
    languages: ['C#'],
    options: { ...NO_OPTS },
  },
  {
    id: 'wpf', dotnetName: 'wpf',
    label: 'WPF', type: 'WPF Application',
    description: 'A project template for creating a .NET WPF Application.',
    category: 'Other',
    iconSvg: ICONS.wpf,
    languages: ['C#', 'VB'],
    options: { ...NO_OPTS },
  },
  {
    id: 'winforms', dotnetName: 'winforms',
    label: 'Windows Forms', type: 'Windows Forms App',
    description: 'A project template for creating a .NET Windows Forms Application.',
    category: 'Other',
    iconSvg: ICONS.wpf,
    languages: ['C#', 'VB'],
    options: { ...NO_OPTS },
  },
];
