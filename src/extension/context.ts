import vscode, {
    DecorationOptions,
    ProviderResult,
    Range,
    TextDocument,
    TextDocumentContentChangeEvent,
    TextDocumentContentProvider,
    TreeItem,
    Uri
} from "vscode";
import {
    Environment,
    functionTypeConstructorName,
    getFunctionName,
    initLanguage,
    parseProgram,
    SMLParser
} from "../parsers/program";
import {FileDownloader, getApi} from "@microsoft/vscode-file-downloader-api";
import Parser from "web-tree-sitter";
import {ConfigurationError} from "../models/errors";
import {FUNCTION_DECLARATION} from "../parsers/const";
import {CounterExampleSearcher} from "../engine/counterExampleSearcher";
import {RecursiveFunctionNode} from "../models/symbolic_nodes";
import {CheckableFunction, isSerializedSuite, SerializedSuite, SMLBuddyTreeItem, Suite} from "./types";

const CONFIG_LOADED_WHEN = "smlbuddy.configLoaded";

const asPoint = (pos: vscode.Position): Parser.Point => ({row: pos.line, column: pos.character});

export class SMLBuddyContext implements vscode.TreeDataProvider<SMLBuddyTreeItem>, TextDocumentContentProvider {
    readonly context: vscode.ExtensionContext;
    readonly parser: Promise<SMLParser>;
    readonly suits: Map<string, Suite>;
    readonly fileDownloader: Promise<FileDownloader>;

    readonly trees: Map<string, Parser.Tree>;
    currentFrame: number;
    currentlyChecking: number;

    readonly verifiedDecorationHeader: vscode.TextEditorDecorationType;
    readonly verifiedDecorationBody: vscode.TextEditorDecorationType;

    readonly verifyingDecorationHeader: vscode.TextEditorDecorationType;
    readonly verifyingDecorationBody: vscode.TextEditorDecorationType[];

    readonly unverifiedDecorationHeader: vscode.TextEditorDecorationType;
    readonly unverifiedDecorationBody: vscode.TextEditorDecorationType;

    readonly errorDecorationHeader: vscode.TextEditorDecorationType;
    readonly errorDecorationBody: vscode.TextEditorDecorationType;
    readonly errorDecorationTrailer: vscode.TextEditorDecorationType;

    readonly counterExampleDecorationBody: vscode.TextEditorDecorationType;
    readonly counterExampleDecorationTrailer: vscode.TextEditorDecorationType;

    private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;
    private _onDidChange: vscode.EventEmitter<Uri> = new vscode.EventEmitter<Uri>();
    readonly onDidChange = this._onDidChange.event;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.parser = initLanguage(context.asAbsolutePath('dist/sml.wasm'));
        this.suits = new Map<string, Suite>();
        this.fileDownloader = getApi();
        this.trees = new Map<string, Parser.Tree>();

        this.currentFrame = 0;
        this.currentlyChecking = 0;

        setInterval(this.animate, 200);

        this.verifiedDecorationBody = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.context.asAbsolutePath('resources/gutter/verified.png'),
            gutterIconSize: 'contain'
        });
        this.verifiedDecorationHeader = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.context.asAbsolutePath('resources/gutter/header/verified.svg'),
            gutterIconSize: 'contain'
        });

        this.verifyingDecorationHeader = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.context.asAbsolutePath('resources/gutter/header/verifying.svg'),
            gutterIconSize: 'contain'
        });
        this.verifyingDecorationBody = [
            vscode.window.createTextEditorDecorationType({
                gutterIconPath: this.context.asAbsolutePath('resources/gutter/verifying.png'),
                gutterIconSize: 'contain'
            }),
            vscode.window.createTextEditorDecorationType({
                gutterIconPath: this.context.asAbsolutePath('resources/gutter/verifying-2.png'),
                gutterIconSize: 'contain'
            })
        ]

        this.unverifiedDecorationBody = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.context.asAbsolutePath('resources/gutter/unverified.png'),
            gutterIconSize: 'contain'
        });
        this.unverifiedDecorationHeader = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.context.asAbsolutePath('resources/gutter/header/unverified.svg'),
            gutterIconSize: 'contain'
        });

        this.errorDecorationBody = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.context.asAbsolutePath('resources/gutter/error.png'),
            gutterIconSize: 'contain'
        });
        this.errorDecorationHeader = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.context.asAbsolutePath('resources/gutter/header/error.svg'),
            gutterIconSize: 'contain'
        });
        this.errorDecorationTrailer = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.context.asAbsolutePath('resources/gutter/trailer/error.png'),
            gutterIconSize: 'contain'
        });

        this.counterExampleDecorationBody = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.context.asAbsolutePath('resources/gutter/counter-example.png'),
            gutterIconSize: 'contain'
        });
        this.counterExampleDecorationTrailer = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.context.asAbsolutePath('resources/gutter/trailer/counter-example.png'),
            gutterIconSize: 'contain'
        });
    }

    // Configuration management

    setWorkspaceConfigLoaded = async (value: boolean) => {
        await vscode.commands.executeCommand("setContext", CONFIG_LOADED_WHEN, value);
    };

    loadPersistentConfig = async () => {
        await this.setWorkspaceConfigLoaded(false);
        try {
            this.suits.clear();
            const configPath = this.getPersistentConfigPath();
            if (!configPath) {
                return;
            }
            if (!await vscode.workspace.fs.stat(configPath).then(() => true, () => false)) {
                return;
            }
            await this._loadConfigurationFile(configPath);
        } catch (e) {
            if (e instanceof ConfigurationError) {
                void vscode.window.showErrorMessage(e.message);
            }
            throw e;
        } finally {
            await this.setWorkspaceConfigLoaded(true);
        }
    };

    getPersistentConfigPath = () => {
        if (this.context.storageUri === undefined) {
            return undefined;
        }
        return vscode.Uri.joinPath(this.context.storageUri, "suites.smlbuddy");
    };

    addConfigurationByLink = async (uri: Uri) => {
        const fileDownloader = await this.fileDownloader;
        const file = await fileDownloader.downloadFile(uri, "suites.smlbuddy", this.context);
        await this.addConfiguration(file);
    };

    addConfiguration = async (uri: Uri) => {
        try {
            await this._loadConfigurationFile(uri);
        } catch (e) {
            if (e instanceof ConfigurationError) {
                void vscode.window.showErrorMessage(e.message);
            }
            throw e;
        }

        if (await vscode.workspace.fs.stat(this.getPersistentConfigPath()!).then(() => true, () => false)) {
            // need to merge two files
            const newConfigRaw = await vscode.workspace.fs.readFile(uri);
            const oldConfigRaw = await vscode.workspace.fs.readFile(this.getPersistentConfigPath()!);

            const newConfig = JSON.parse(Buffer.from(newConfigRaw).toString('utf-8'));
            const oldConfig = JSON.parse(Buffer.from(oldConfigRaw).toString('utf-8'));

            const newConfigArray = Array.isArray(newConfig) ? newConfig : [newConfig];
            const oldConfigArray = Array.isArray(oldConfig) ? oldConfig : [oldConfig];

            const nameSet: Set<string> = new Set(newConfigArray.map((suite: SerializedSuite) => suite.name));
            const mergedConfig = newConfigArray;

            for (const suite of oldConfigArray) {
                if (!nameSet.has(suite.name)) {
                    mergedConfig.push(suite);
                }
            }
            await vscode.workspace.fs.writeFile(this.getPersistentConfigPath()!, Buffer.from(JSON.stringify(mergedConfig)));
        } else {
            await vscode.workspace.fs.copy(uri, this.getPersistentConfigPath()!);
        }
        await this.setWorkspaceConfigLoaded(true);
        await this.initAllDocuments();
        await this.refresh();
    };

    removeSuite = async (suite: Suite) => {
        this.suits.delete(suite.name);
        const rawData = await vscode.workspace.fs.readFile(this.getPersistentConfigPath()!);
        const data = Buffer.from(rawData).toString('utf-8');

        const config = JSON.parse(data);
        const configArray = Array.isArray(config) ? config : [config];

        const newConfig = configArray.filter((s: SerializedSuite) => s.name !== suite.name);

        await vscode.workspace.fs.writeFile(this.getPersistentConfigPath()!, Buffer.from(JSON.stringify(newConfig)));
        this.refresh();
    };

    getChildren = (element?: SMLBuddyTreeItem): ProviderResult<SMLBuddyTreeItem[]> => {
        if (!element) {
            return Array.from(this.suits.values());
        }
        if (element instanceof Suite) {
            return element.functions;
        }
        return [];
    };

    getTreeItem = (element: SMLBuddyTreeItem): TreeItem | Thenable<TreeItem> => {
        if (element instanceof Suite) {
            return {
                label: element.name,
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                iconPath: new vscode.ThemeIcon("versions"),
                contextValue: "suite",
            };
        }
        // it's a function

        if (element.state === "verified") {
            return {
                label: `${element.name} - verified`,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                iconPath: new vscode.ThemeIcon("check-all", new vscode.ThemeColor("testing.runAction")),
                contextValue: "function-verified",
                tooltip: "Function has been completely verified"
            };
        }
        if (element.state === "timeout") {
            return {
                label: `${element.name} - verified`,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                iconPath: new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.runAction")),
                contextValue: "function-timeout",
                tooltip: "No counter-example found in the time limit"
            };
        }
        if (element.state === "verifying") {
            return {
                label: `${element.name} - verifying`,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                iconPath: new vscode.ThemeIcon("sync~spin"),
                contextValue: "function-verifying",
                tooltip: "Searching for counter-example..."
            };
        }
        if (element.state === "counter-example") {
            return {
                label: `${element.name} - counter-example found`,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                iconPath: new vscode.ThemeIcon("alert", new vscode.ThemeColor("notificationsWarningIcon.foreground")),
                contextValue: "function-counter-example",
                tooltip: "Counter-example found"
            };
        }
        if (element.state === "error") {
            return {
                label: `${element.name} - error`,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                iconPath: new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed")),
                contextValue: "function-error",
                tooltip: "An error occurred while verifying the function"
            };
        }
        return {
            label: `${element.name} - unverified`,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            iconPath: new vscode.ThemeIcon("circle-outline"),
            contextValue: "function-unverified",
            tooltip: "Function has not been verified yet"
        };
    };

    // TreeDataProvider implementation

    refresh = (document?: TextDocument): void => {
        this._onDidChangeTreeData.fire();
        if (document) {
            void this.gutterUpdate(document);
        }
    };

    provideTextDocumentContent = (uri: Uri): ProviderResult<string> => {
        const func = Array.from(this.suits.values()).flatMap((suite) => suite.functions).find((func) => func.name === uri.path.slice(1));
        if (!func) {
            return "Function not found";
        }
        if (!func.counterExample) {
            return "No counter-example found";
        }

        return `Input:\n${func.counterExample.input}\n\nExpected output:\n${func.counterExample.expectedOutput}\n\nActual output:\n${func.counterExample.output}`;
    };

    updateVirtualDocument = async (uri: Uri) => {
        this._onDidChange.fire(uri);
    }

    // TextDocumentContentProvider implementation

    async initAllDocuments() {
        await Promise.all(
            vscode.window.visibleTextEditors.map(async (editor) => this.initDocument(editor.document))
        );
    }

    initDocument = async (document: TextDocument) => {
        if (document.languageId !== "sml") {
            return;
        }
        const parser = await this.parser;
        const tree = parser.parse(document.getText());
        this.trees.set(document.uri.toString(), tree);
        await this.gutterUpdate(document);
    };

    // Document event handlers

    updateDocument = async (document: TextDocument, contentChanges: readonly TextDocumentContentChangeEvent[]) => {
        if (contentChanges.length !== 0) {
            const old_tree = this.trees.get(document.uri.toString());
            if (!old_tree) {
                return await this.initDocument(document);
            }
            for (let change of contentChanges) {
                const startIndex = change.rangeOffset;
                const oldEndIndex = change.rangeOffset + change.rangeLength;
                const newEndIndex = change.rangeOffset + change.text.length;
                const startPos = document.positionAt(startIndex);
                const oldEndPos = document.positionAt(oldEndIndex);
                const newEndPos = document.positionAt(newEndIndex);
                const startPosition = asPoint(startPos);
                const oldEndPosition = asPoint(oldEndPos);
                const newEndPosition = asPoint(newEndPos);
                const delta = {startIndex, oldEndIndex, newEndIndex, startPosition, oldEndPosition, newEndPosition};
                old_tree.edit(delta);
            }
            const parser = await this.parser;
            this.trees.set(document.uri.toString(), parser.parse(document.getText(), old_tree));
            await this.gutterUpdate(document);
        }
    };

    removeDocument = (document: TextDocument) => {
        this.trees.delete(document.uri.toString());
    };

    gutterUpdate = async (document: TextDocument) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) {
            return;
        }
        const tree = this.trees.get(document.uri.toString());
        if (!tree) {
            return;
        }
        const root = tree.rootNode, functionNodes = root.namedChildren
            .filter((node) => node.type === FUNCTION_DECLARATION), checkableFunctions = Array.from(this.suits.values())
            .flatMap((suite) => suite.functions);
        const checkableFunctionsMap = new Map(checkableFunctions.map((func) => [func.name, func])),
            verifiedHeader: Range[] = [], verifiedBody: Range[] = [], unverifiedHeader: Range[] = [],
            verifyingHeader: Range[] = [], verifyingBody: Range[] = [],
            unverifiedBody: Range[] = [], errorHeader: Range[] = [], errorBody: Range[] = [],
            errorTrailer: Range[] = [], counterExampleBody: Range[] = [], counterExampleTrailer: Range[] = [];


        functionNodes.forEach((node) => {
            const funcName = getFunctionName(node);
            if (!funcName) {
                return;
            }

            const func = checkableFunctionsMap.get(funcName);
            if (!func) {
                return;
            }

            const startPos = document.positionAt(node.startIndex);
            const endPos = document.positionAt(node.endIndex);

            let targetHeader: Range[], targetBody: Range[], targetTrailer: Range[];
            switch (func.state) {
                case "verified":
                    targetHeader = verifiedHeader;
                    targetBody = verifiedBody;
                    targetTrailer = verifiedBody;
                    break;
                case "unverified":
                    targetHeader = unverifiedHeader;
                    targetBody = unverifiedBody;
                    targetTrailer = unverifiedBody;
                    break;
                case "verifying":
                    targetHeader = verifyingHeader;
                    targetBody = verifyingBody;
                    targetTrailer = verifyingBody;
                    break;
                case "timeout":
                    targetHeader = verifiedHeader;
                    targetBody = verifiedBody;
                    targetTrailer = verifiedBody;
                    break;
                case "counter-example":
                    targetHeader = errorHeader;
                    targetBody = counterExampleBody;
                    targetTrailer = counterExampleTrailer;
                    break;
                case "error":
                    targetHeader = errorHeader;
                    targetBody = errorBody;
                    targetTrailer = errorTrailer;
                    break;
            }

            targetHeader.push(new vscode.Range(
                startPos,
                new vscode.Position(startPos.line, startPos.character + 1)
            ));

            if (startPos.line !== endPos.line) {
                targetTrailer.push(new vscode.Range(
                    endPos,
                    new vscode.Position(endPos.line, endPos.character + 1)
                ));
            }
            if (endPos.line - startPos.line > 1) {
                targetBody.push(new vscode.Range(
                    new vscode.Position(startPos.line + 1, 0),
                    new vscode.Position(endPos.line - 1, 0),
                ));
            }
        });
        editor.setDecorations(this.verifiedDecorationHeader, verifiedHeader.map((range): DecorationOptions => ({
            range,
            hoverMessage: "Function has been verified"
        })));
        editor.setDecorations(this.verifiedDecorationBody, verifiedBody);

        editor.setDecorations(this.verifyingDecorationHeader, verifyingHeader.map((range): DecorationOptions => ({
            range,
            hoverMessage: "Searching for counter-example..."
        })));
        if (this.currentFrame === 0) {
            editor.setDecorations(this.verifyingDecorationBody[0], verifyingBody);
            editor.setDecorations(this.verifyingDecorationBody[1], []);
        } else {
            editor.setDecorations(this.verifyingDecorationBody[0], []);
            editor.setDecorations(this.verifyingDecorationBody[1], verifyingBody);
        }

        editor.setDecorations(this.unverifiedDecorationHeader, unverifiedHeader.map((range): DecorationOptions => ({
            range,
            hoverMessage: "Function has not been verified yet"
        })));
        editor.setDecorations(this.unverifiedDecorationBody, unverifiedBody);

        editor.setDecorations(this.errorDecorationHeader, errorHeader.map((range): DecorationOptions => ({
            range,
            hoverMessage: "An error occurred while verifying the function"
        })));
        editor.setDecorations(this.errorDecorationBody, errorBody);
        editor.setDecorations(this.errorDecorationTrailer, errorTrailer);

        editor.setDecorations(this.counterExampleDecorationBody, counterExampleBody.map((range): DecorationOptions => ({
            range,
            hoverMessage: "Counter-example found"
        })));
        editor.setDecorations(this.counterExampleDecorationTrailer, counterExampleTrailer);
    };

    animate = async () => {
        this.currentFrame = (this.currentFrame + 1) % 2;
        if (this.currentlyChecking === 0) {
            return
        }
        vscode.window.visibleTextEditors.forEach((editor) => {
            this.gutterUpdate(editor.document);
        })
    }

    private _loadConfigurationFile = async (uri: Uri) => {
        const rawData = await vscode.workspace.fs.readFile(uri);
        const data = Buffer.from(rawData).toString('utf-8');
        const config = JSON.parse(data);

        if (Array.isArray(config)) {
            for (const suite of config) {
                await this._loadConfiguration(suite);
            }
        } else {
            await this._loadConfiguration(config);
        }
    };

    private _loadConfiguration = async (config: any) => {
        if (!isSerializedSuite(config)) {
            throw new ConfigurationError("Not a configuration file");
        }
        const parser = await this.parser;
        let suiteEnv: Environment;
        try {
            suiteEnv = parseProgram(parser, config.program);
        } catch (e) {
            throw new ConfigurationError("Invalid program in the configuration file");
        }

        const functions = config.functionNames.map((name: string): CheckableFunction => {
            const node = suiteEnv.bindings.get(name);
            if (!node) {
                throw new ConfigurationError(`Function ${name} not found in the configuration file`);
            }
            const type = suiteEnv.constructors.get(functionTypeConstructorName(name));
            if (!type) {
                throw new ConfigurationError(`Type for function ${name} not found in the configuration file`);
            }
            return new CheckableFunction(name, new CounterExampleSearcher(name, type.argType, suiteEnv, node as RecursiveFunctionNode));
        });
        this.suits.set(config.name, new Suite(config.name, functions));
        this.refresh();
    };
}