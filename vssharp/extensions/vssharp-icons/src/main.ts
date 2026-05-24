import * as vscode from 'vscode';
import { IconResolver, IconPair } from './icon-resolver';

export type { IconPair };

export interface IconsApi {
  resolveKind(kind: 'solution' | 'project' | 'solution-folder'): IconPair | undefined;
  resolveFolder(name: string): IconPair | undefined;
  resolveFile(name: string): IconPair | undefined;
}

export async function activate(ctx: vscode.ExtensionContext): Promise<IconsApi> {
  const resolver = new IconResolver(ctx.extensionUri);
  await resolver.load();
  return resolver;
}

export function deactivate(): void { /* no-op */ }
