import * as path from 'path';

export interface LaunchProfile {
  commandName: 'Project' | 'Executable' | 'IISExpress' | 'IIS' | 'Docker' | string;
  executablePath?: string;
  commandLineArgs?: string;
  workingDirectory?: string;
  launchBrowser?: boolean;
  launchUrl?: string;
  applicationUrl?: string;
  environmentVariables?: Record<string, string>;
  dotnetRunMessages?: boolean;
}

export interface ProjectProfile {
  projectPath: string;
  projectName: string;
  projectDir: string;
  profileName: string;
  profile: LaunchProfile;
  launchSettingsPath: string;
}

export type ProfileStatus =
  | 'supported'
  | 'unsupportedCommand'
  | 'missingProjectFile'
  | 'invalidLaunchSettings';

export interface ProfileDiscoveryEntry {
  status: ProfileStatus;
  launchSettingsPath: string;
  reason?: string;
  profileName?: string;
  profile?: LaunchProfile;
  project?: ProjectProfile;
}

export interface CreateProfileEntriesInput {
  launchSettingsPath: string;
  projectPath?: string;
  profiles?: Record<string, LaunchProfile>;
  parseError?: unknown;
}

export type ActiveProfileResolution =
  | { kind: 'resolved'; profile: ProjectProfile }
  | { kind: 'noActiveFile' }
  | { kind: 'noSupportedProject' };

const SUPPORTED_COMMAND = 'Project';

export function createProfileEntries(input: CreateProfileEntriesInput): ProfileDiscoveryEntry[] {
  if (input.parseError) {
    return [{
      status: 'invalidLaunchSettings',
      launchSettingsPath: input.launchSettingsPath,
      reason: 'Invalid or unreadable launch settings.',
    }];
  }

  if (!input.projectPath) {
    return [{
      status: 'missingProjectFile',
      launchSettingsPath: input.launchSettingsPath,
      reason: 'Missing project file.',
    }];
  }

  const profiles = input.profiles ?? {};
  return Object.entries(profiles).map(([profileName, profile]) => {
    const status = validateProfile(profile);
    const project = status === 'supported'
      ? buildProjectProfile(input.launchSettingsPath, input.projectPath!, profileName, profile)
      : undefined;

    return {
      status,
      launchSettingsPath: input.launchSettingsPath,
      reason: reasonFor(status, profile),
      profileName,
      profile,
      project,
    };
  });
}

export function runnableProfiles(entries: readonly ProfileDiscoveryEntry[]): ProjectProfile[] {
  return entries
    .filter((entry): entry is ProfileDiscoveryEntry & { project: ProjectProfile } =>
      entry.status === 'supported' && !!entry.project)
    .map(entry => entry.project);
}

export function validateProfile(profile: LaunchProfile): ProfileStatus {
  return profile.commandName === SUPPORTED_COMMAND ? 'supported' : 'unsupportedCommand';
}

export function findProjectForFile(
  profiles: readonly ProjectProfile[],
  filePath: string,
): ProjectProfile | undefined {
  const normalizedFile = normalizePath(filePath);
  const matches = profiles.filter(p => {
    const projectDir = normalizePath(p.projectDir);
    return normalizedFile === projectDir || normalizedFile.startsWith(projectDir + path.sep);
  });
  if (matches.length === 0) return undefined;
  matches.sort((a, b) => normalizePath(b.projectDir).length - normalizePath(a.projectDir).length);
  return matches[0];
}

export function selectedForProject(
  profiles: readonly ProjectProfile[],
  projectPath: string,
  selectedProfileName?: string,
): ProjectProfile | undefined {
  const normalizedProjectPath = normalizePath(projectPath);
  const inProject = profiles.filter(p => normalizePath(p.projectPath) === normalizedProjectPath);
  if (selectedProfileName) {
    const hit = inProject.find(p => p.profileName === selectedProfileName);
    if (hit) return hit;
  }
  return inProject[0];
}

export function resolveActiveProfileForFile(
  profiles: readonly ProjectProfile[],
  activeFilePath: string | undefined,
  selectedProfileNameForProject: (projectPath: string) => string | undefined = () => undefined,
): ActiveProfileResolution {
  if (!activeFilePath) {
    return { kind: 'noActiveFile' };
  }

  const projectMatch = findProjectForFile(profiles, activeFilePath);
  if (!projectMatch) {
    return { kind: 'noSupportedProject' };
  }

  const selectedProfileName = selectedProfileNameForProject(projectMatch.projectPath);
  const profile = selectedForProject(profiles, projectMatch.projectPath, selectedProfileName);
  if (!profile) {
    return { kind: 'noSupportedProject' };
  }

  return { kind: 'resolved', profile };
}

export function splitCommandLineArgs(s?: string): string[] {
  if (!s) return [];
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out.push(m[1] ?? m[2]);
  return out;
}

function buildProjectProfile(
  launchSettingsPath: string,
  projectPath: string,
  profileName: string,
  profile: LaunchProfile,
): ProjectProfile {
  const projectDir = path.dirname(projectPath);
  return {
    projectPath,
    projectName: path.basename(projectPath, '.csproj'),
    projectDir,
    profileName,
    profile,
    launchSettingsPath,
  };
}

function reasonFor(status: ProfileStatus, profile?: LaunchProfile): string | undefined {
  switch (status) {
    case 'unsupportedCommand':
      return `Unsupported launch profile type: ${profile?.commandName ?? 'unknown'}.`;
    case 'missingProjectFile':
      return 'Missing project file.';
    case 'invalidLaunchSettings':
      return 'Invalid or unreadable launch settings.';
    case 'supported':
      return undefined;
  }
}

function normalizePath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
