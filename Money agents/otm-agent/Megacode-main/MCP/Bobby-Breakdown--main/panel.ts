import * as vscode from 'vscode';
import { AnthropicClient, Domain, DevMode, BreakdownFormat, ConversationMessage } from './anthropicClient';
import { getPanelHtml } from './panelHtml';

export class BreakdownPanel {
  private webview: vscode.Webview;
  private context: vscode.ExtensionContext;
  private client: AnthropicClient;

  constructor(webview: vscode.Webview, context: vscode.ExtensionContext) {
    this.webview = webview;
    this.context = context;
    this.client = new AnthropicClient();
    this.setupMessageHandler();
  }

  static createOrShow(context: vscode.ExtensionContext): BreakdownPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    const panel = vscode.window.createWebviewPanel(
      'bobbyBreakdown',
      '⚡ Bobby Breakdown',
      column,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    const bp = new BreakdownPanel(panel.webview, context);
    bp.render();
    return bp;
  }

  render() {
    this.webview.html = getPanelHtml();
  }

  sendBreakdownRequest(text: string) {
    this.webview.postMessage({ type: 'prefill', text });
  }

  sendBookProcessRequest(content: string, filename: string) {
    this.webview.postMessage({ type: 'book', content, filename });
  }

  private setupMessageHandler() {
    this.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'fastscan':
          await this.handleFastScan(message);
          break;
        case 'breakdown':
          await this.handleBreakdown(message);
          break;
        case 'book':
          await this.handleBook(message);
          break;
        case 'comparison':
          await this.handleComparison(message);
          break;
        case 'followup':
          await this.handleFollowup(message);
          break;
        case 'copy':
          await vscode.env.clipboard.writeText(message.text);
          vscode.window.showInformationMessage('Bobby Breakdown: Copied to clipboard!');
          break;
        case 'saveGuide':
          await this.saveGuide(message.text, message.filename);
          break;
        case 'exportMarkdown':
          await this.exportMarkdown(message.text, message.filename);
          break;
        case 'saveSnippet':
          await this.saveSnippet(message.text, message.query, message.language);
          break;
        case 'openSettings':
          vscode.commands.executeCommand('workbench.action.openSettings', 'bobbyBreakdown');
          break;
      }
    });
  }

  private async handleBreakdown(message: any) {
    this.webview.postMessage({ type: 'startStream', mode: 'breakdown' });

    const hasCustomDomain = !!message.customDomainPrompt;

    await this.client.stream(
      {
        text: message.text,
        domain: hasCustomDomain ? 'custom' : message.domain as Domain,
        format: message.format as BreakdownFormat,
        mode: 'breakdown',
        devMode: message.devMode as DevMode | undefined,
        customDomainName: message.customDomainName,
        customDomainPrompt: message.customDomainPrompt
      },
      (chunk) => this.webview.postMessage({ type: 'chunk', text: chunk }),
      () => this.webview.postMessage({ type: 'done' }),
      (err) => this.webview.postMessage({ type: 'error', message: err })
    );
  }

  private async handleBook(message: any) {
    this.webview.postMessage({ type: 'startStream', mode: 'book' });

    await this.client.stream(
      {
        text: message.content,
        domain: message.domain as Domain,
        format: 'structured',
        mode: 'book',
        filename: message.filename
      },
      (chunk) => this.webview.postMessage({ type: 'chunk', text: chunk }),
      () => this.webview.postMessage({ type: 'done' }),
      (err) => this.webview.postMessage({ type: 'error', message: err })
    );
  }

  private async handleComparison(message: any) {
    this.webview.postMessage({ type: 'startStream', mode: 'comparison' });

    const hasCustomDomain = !!message.customDomainPrompt;

    await this.client.stream(
      {
        text: message.conceptA,
        compareText: message.conceptB,
        domain: hasCustomDomain ? 'custom' : message.domain as Domain,
        format: 'structured',
        mode: 'comparison',
        devMode: message.devMode as DevMode | undefined,
        customDomainName: message.customDomainName,
        customDomainPrompt: message.customDomainPrompt
      },
      (chunk) => this.webview.postMessage({ type: 'chunk', text: chunk }),
      () => this.webview.postMessage({ type: 'done' }),
      (err) => this.webview.postMessage({ type: 'error', message: err })
    );
  }

  private async handleFollowup(message: any) {
    const hasCustomDomain = !!message.customDomainPrompt;
    const history: ConversationMessage[] = message.conversationHistory || [];

    await this.client.stream(
      {
        text: message.question,
        domain: hasCustomDomain ? 'custom' : message.domain as Domain,
        format: 'structured',
        mode: 'followup',
        devMode: message.devMode as DevMode | undefined,
        customDomainName: message.customDomainName,
        customDomainPrompt: message.customDomainPrompt,
        conversationHistory: history
      },
      (chunk) => this.webview.postMessage({ type: 'followupChunk', text: chunk }),
      () => this.webview.postMessage({ type: 'followupDone' }),
      (err) => this.webview.postMessage({ type: 'error', message: err })
    );
  }

  private async handleFastScan(message: any) {
    this.webview.postMessage({ type: 'startStream', mode: 'fastscan' });

    await this.client.stream(
      {
        text: message.text,
        domain: (message.domain as Domain) || 'coding',
        format: 'structured',
        mode: 'fastscan',
        devMode: message.devMode as DevMode | undefined
      },
      (chunk) => this.webview.postMessage({ type: 'chunk', text: chunk }),
      () => this.webview.postMessage({ type: 'done' }),
      (err) => this.webview.postMessage({ type: 'error', message: err })
    );
  }

  private async saveGuide(text: string, suggestedName: string) {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(suggestedName || 'llm-guide.md'),
      filters: { 'Markdown': ['md'], 'Text': ['txt'] }
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf8'));
      vscode.window.showInformationMessage(`Bobby Breakdown: Guide saved to ${uri.fsPath}`);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    }
  }

  private async exportMarkdown(text: string, suggestedName: string) {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(suggestedName || 'breakdown.md'),
      filters: { 'Markdown': ['md'], 'Text': ['txt'] }
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf8'));
      vscode.window.showInformationMessage(`Bobby Breakdown: Exported to ${uri.fsPath}`);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    }
  }

  private async saveSnippet(text: string, query: string, language: string) {
    const prefix = await vscode.window.showInputBox({
      prompt: 'Enter snippet prefix (trigger shortcut)',
      placeHolder: 'e.g., bobby-breakdown',
      value: 'bobby-' + query.toLowerCase().replace(/\s+/g, '-').slice(0, 20)
    });
    if (!prefix) return;

    const snippets: Record<string, unknown> = {};
    const snippetName = query.slice(0, 60) || 'Bobby Breakdown';
    snippets[snippetName] = {
      prefix,
      body: text.split('\n'),
      description: `Bobby Breakdown: ${snippetName}`
    };

    const snippetsUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${prefix}.code-snippets`),
      filters: { 'VS Code Snippets': ['code-snippets'] },
      title: 'Save Snippet File'
    });

    if (snippetsUri) {
      await vscode.workspace.fs.writeFile(
        snippetsUri,
        Buffer.from(JSON.stringify(snippets, null, 2), 'utf8')
      );
      vscode.window.showInformationMessage(
        `Bobby Breakdown: Snippet saved! Place in your VS Code snippets folder and use prefix "${prefix}".`
      );
    }
  }
}
