import * as vscode from 'vscode';
import { BreakdownPanel } from './panel';

let sidebarPanel: BreakdownPanel | undefined;

function getSelectedText(editor: vscode.TextEditor): string | undefined {
  const texts = editor.selections
    .map(sel => editor.document.getText(sel).trim())
    .filter(t => t.length > 0);
  if (texts.length === 0) return undefined;
  return texts.length === 1
    ? texts[0]
    : texts.map((t, i) => `[Selection ${i + 1}]\n${t}`).join('\n\n');
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Bobby Breakdown activated');

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('bobbyBreakdown.openPanel', () => {
      const p = BreakdownPanel.createOrShow(context);
      if (!sidebarPanel) sidebarPanel = p;
    }),

    vscode.commands.registerCommand('bobbyBreakdown.breakdownSelection', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const text = getSelectedText(editor);
      if (!text) {
        vscode.window.showWarningMessage('Bobby Breakdown: Please select some text first.');
        return;
      }
      const p = BreakdownPanel.createOrShow(context);
      if (!sidebarPanel) sidebarPanel = p;
      p.sendBreakdownRequest(text);
    }),

    vscode.commands.registerCommand('bobbyBreakdown.processBook', async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'Text Files': ['txt', 'md', 'pdf'] },
        title: 'Select Book / Document to Process'
      });
      if (!uris || uris.length === 0) return;
      const uri = uris[0];
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(bytes).toString('utf8');
      const p = BreakdownPanel.createOrShow(context);
      if (!sidebarPanel) sidebarPanel = p;
      p.sendBookProcessRequest(content, uri.fsPath);
    }),

    vscode.commands.registerCommand('bobbyBreakdown.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your Anthropic API key',
        password: true,
        placeHolder: 'sk-ant-...'
      });
      if (key) {
        await vscode.workspace.getConfiguration('bobbyBreakdown').update('apiKey', key, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Bobby Breakdown: API key saved!');
      }
    }),

    vscode.commands.registerCommand('bobbyBreakdown.quickExplain', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const text = getSelectedText(editor);
      if (!text) {
        vscode.window.showWarningMessage('Bobby Breakdown: Please select some text first.');
        return;
      }
      const p = BreakdownPanel.createOrShow(context);
      if (!sidebarPanel) sidebarPanel = p;
      p.sendBreakdownRequest(text);
    }),

    vscode.commands.registerCommand('bobbyBreakdown.addCustomDomain', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Custom domain name (e.g., "DevOps", "Legal", "Healthcare")',
        placeHolder: 'Domain Name'
      });
      if (!name) return;
      const prompt = await vscode.window.showInputBox({
        prompt: 'Custom domain system prompt (describe the expert context)',
        placeHolder: 'You are an expert in...',
        value: `You are an expert in ${name}. Use appropriate terminology and reference real tools and concepts.`
      });
      if (!prompt) return;
      const config = vscode.workspace.getConfiguration('bobbyBreakdown');
      const customDomains: Array<{name: string; prompt: string}> = config.get('customDomains') || [];
      const existing = customDomains.findIndex(d => d.name === name);
      if (existing >= 0) {
        customDomains[existing] = { name, prompt };
      } else {
        customDomains.push({ name, prompt });
      }
      await config.update('customDomains', customDomains, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Bobby Breakdown: Custom domain "${name}" saved!`);
    })
  );

  // Register sidebar webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('bobbyBreakdown.mainView', {
      resolveWebviewView(webviewView) {
        webviewView.webview.options = { enableScripts: true };
        sidebarPanel = new BreakdownPanel(webviewView.webview, context);
        sidebarPanel.render();
      }
    })
  );
}

export function deactivate() {}
