import { strict as assert } from 'node:assert';
import test from 'node:test';
import path from 'node:path';
import {
  createProfileEntries,
  findProjectForFile,
  runnableProfiles,
  resolveActiveProfileForFile,
  selectedForProject,
  splitCommandLineArgs,
  ProjectProfile,
} from '../src/profile-resolver';

const root = path.resolve(__dirname, 'fixtures', 'simple-web-api');

test('runnableProfiles returns only supported Project profiles', () => {
  const entries = createProfileEntries({
    launchSettingsPath: path.join(root, 'Properties', 'launchSettings.json'),
    projectPath: path.join(root, 'SimpleWebApi.csproj'),
    profiles: {
      Http: { commandName: 'Project' },
      Docker: { commandName: 'Docker' },
    },
  });

  const runnable = runnableProfiles(entries);

  assert.deepEqual(runnable.map(p => p.profileName), ['Http']);
  assert.equal(entries.find(e => e.profileName === 'Docker')?.status, 'unsupportedCommand');
});

test('splitCommandLineArgs preserves quoted values', () => {
  assert.deepEqual(splitCommandLineArgs('--name "Ada Lovelace" --flag'), ['--name', 'Ada Lovelace', '--flag']);
});

test('findProjectForFile returns the most specific owning project', () => {
  const parent = makeProfile('Parent', path.join(root, 'Parent.csproj'), root);
  const childDir = path.join(root, 'src', 'Child');
  const child = makeProfile('Child', path.join(childDir, 'Child.csproj'), childDir);

  const match = findProjectForFile([parent, child], path.join(childDir, 'Controllers', 'Home.cs'));

  assert.equal(match?.projectName, 'Child');
});

test('selectedForProject returns saved project profile or first project profile', () => {
  const profiles = [
    makeProfile('Http', path.join(root, 'SimpleWebApi.csproj'), root),
    makeProfile('Https', path.join(root, 'SimpleWebApi.csproj'), root),
  ];

  assert.equal(selectedForProject(profiles, profiles[0].projectPath, 'Https')?.profileName, 'Https');
  assert.equal(selectedForProject(profiles, profiles[0].projectPath, 'Missing')?.profileName, 'Http');
});

test('resolveActiveProfileForFile does not fall back to unrelated selected profile', () => {
  const profiles = [
    makeProfile('Http', path.join(root, 'SimpleWebApi.csproj'), root),
    makeProfile('Other', path.join(root, 'Other.csproj'), root),
  ];

  const result = resolveActiveProfileForFile(
    profiles,
    path.join(path.dirname(root), 'outside', 'Program.cs'),
    () => 'Other',
  );

  assert.equal(result.kind, 'noSupportedProject');
});

function makeProfile(profileName: string, projectPath: string, projectDir: string): ProjectProfile {
  return {
    projectPath,
    projectName: path.basename(projectPath, '.csproj'),
    projectDir,
    profileName,
    profile: { commandName: 'Project' },
    launchSettingsPath: path.join(projectDir, 'Properties', 'launchSettings.json'),
  };
}
