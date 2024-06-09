import * as vscode from 'vscode';
import {SMLBuddyContext} from "./context";
import {
    getCopyCounterExampleCommand,
    getDeleteSuiteCommand,
    getLoadConfigFileCommand,
    getLoadConfigLinkCommand,
    getSearchCounterExampleCommand
} from "./commands";

export const activate = (context: vscode.ExtensionContext) => {
    const smlBuddyContext = new SMLBuddyContext(context);

    const loadConfigFileCommand = getLoadConfigFileCommand(smlBuddyContext);

    const loadConfigLinkCommand = getLoadConfigLinkCommand(smlBuddyContext);

    const searchCounterExampleCommand = getSearchCounterExampleCommand(smlBuddyContext);

    const copyCounterExampleCommand = getCopyCounterExampleCommand();

    const deleteSuiteCommand = getDeleteSuiteCommand(smlBuddyContext);

    const workspaceChangedHook = vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        await smlBuddyContext.loadPersistentConfig();
    });

    const visibleTextEditorsChangeHook = vscode.window.onDidChangeVisibleTextEditors(async () => {
        await smlBuddyContext.initAllDocuments();
    });

    const textChangedHook = vscode.workspace.onDidChangeTextDocument(async (edit: vscode.TextDocumentChangeEvent) => {
        if (edit.document.languageId !== "sml") {
            return;
        }
        await smlBuddyContext.updateDocument(edit.document, edit.contentChanges);
    });

    const documentClosedHook = vscode.workspace.onDidCloseTextDocument(async (doc: vscode.TextDocument) => {
        if (doc.languageId !== "sml") {
            return;
        }
        smlBuddyContext.removeDocument(doc);
    });

    const treeView = vscode.window.createTreeView("smlbuddyView", {
        treeDataProvider: smlBuddyContext
    });

    const counterExampleProvider = vscode.workspace.registerTextDocumentContentProvider("smlbuddy", smlBuddyContext);

    context.subscriptions.push(loadConfigFileCommand);
    context.subscriptions.push(loadConfigLinkCommand);
    context.subscriptions.push(searchCounterExampleCommand);
    context.subscriptions.push(copyCounterExampleCommand);
    context.subscriptions.push(deleteSuiteCommand);

    context.subscriptions.push(workspaceChangedHook);
    context.subscriptions.push(visibleTextEditorsChangeHook);
    context.subscriptions.push(documentClosedHook);
    context.subscriptions.push(textChangedHook);

    context.subscriptions.push(treeView);
    context.subscriptions.push(counterExampleProvider);

    smlBuddyContext.loadPersistentConfig().then(() => smlBuddyContext.initAllDocuments());
};

export function deactivate() {
}
