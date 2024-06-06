import * as vscode from 'vscode';
import {ProviderResult, TreeItem, Uri} from 'vscode';
import Parser from 'web-tree-sitter';
import {Environment, parseProgram, SMLParser} from "./parsers/program";
import {ConfigurationError, ExecutorError, NotImplementedError, TimeoutError} from "./models/errors";
import {CounterExampleSearcher} from "./engine/counterExampleSearcher";
import {RecursiveFunctionNode} from "./models/symbolic_nodes";
import {FileDownloader, getApi} from "@microsoft/vscode-file-downloader-api";

const CONFIG_LOADED_WHEN = "smlbuddy.configLoaded"

interface SerializedSuite {
    name: string,
    program: string,
    functionNames: string[]
}

const isSerializedSuite = (obj: any): obj is SerializedSuite => {
    return obj.program && obj.functionNames && obj.name &&
        typeof obj.program === 'string' && typeof obj.name === 'string' &&
        Array.isArray(obj.functionNames) && obj.functionNames.every((name: any) => typeof name === 'string')
}

type CheckableFunctionState = "unverified" | "verifying" | "verified" | "timeout" | "counter-example" | "error"

class CheckableFunction {
    constructor(
        readonly name: string,
        readonly searcher: CounterExampleSearcher,
        public state: CheckableFunctionState = "unverified",
        public counterExample: string | null = null
    ) {
    }
}

class Suite {
    constructor(
        readonly name: string,
        readonly functions: CheckableFunction[]
    ) {
    }
}

type SMLBuddyTreeItem = Suite | CheckableFunction

export class SMLBuddyContext implements vscode.TreeDataProvider<SMLBuddyTreeItem> {
    readonly context: vscode.ExtensionContext
    readonly parser: Promise<SMLParser>
    readonly suits: Map<string, Suite>
    readonly fileDownloader: Promise<FileDownloader>


    private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event;

    constructor(context: vscode.ExtensionContext, parser: Promise<SMLParser>) {
        this.context = context
        this.parser = parser
        this.suits = new Map<string, Suite>()
        this.fileDownloader = getApi()
    }

    private static functionTypeConstructorName = (functionName: string) => `${functionName}_type___`;

    setWorkspaceConfigLoaded = async (value: boolean) => {
        await vscode.commands.executeCommand("setContext", CONFIG_LOADED_WHEN, value)
    };

    loadPersistentConfig = async () => {
        await this.setWorkspaceConfigLoaded(false)
        try {
            this.suits.clear()
            const configPath = this.getPersistentConfigPath()
            if (!configPath) {
                return
            }
            if (!await vscode.workspace.fs.stat(configPath).then(() => true, () => false)) {
                return
            }
            await this._loadConfigurationFile(configPath)
        } catch (e) {
            if (e instanceof ConfigurationError) {
                void vscode.window.showErrorMessage(e.message)
            }
            throw e
        } finally {
            await this.setWorkspaceConfigLoaded(true)
        }
    }

    addConfigurationByLink = async (uri: Uri) => {
        const fileDownloader = await this.fileDownloader
        const file = await fileDownloader.downloadFile(uri, "suites.smlbuddy", this.context)
        await this.addConfiguration(file)
    }

    addConfiguration = async (uri: Uri) => {
        try {
            await this._loadConfigurationFile(uri)
        } catch (e) {
            if (e instanceof ConfigurationError) {
                void vscode.window.showErrorMessage(e.message)
            }
            throw e
        }

        if (!await vscode.workspace.fs.stat(uri).then(() => true, () => false)) {
            await vscode.workspace.fs.copy(uri, this.getPersistentConfigPath()!)
        } else {
            // need to merge two files
            const newConfigRaw = await vscode.workspace.fs.readFile(uri)
            const oldConfigRaw = await vscode.workspace.fs.readFile(this.getPersistentConfigPath()!)

            const newConfig = JSON.parse(Buffer.from(newConfigRaw).toString('utf-8'))
            const oldConfig = JSON.parse(Buffer.from(oldConfigRaw).toString('utf-8'))

            const newConfigArray = Array.isArray(newConfig) ? newConfig : [newConfig]
            const oldConfigArray = Array.isArray(oldConfig) ? oldConfig : [oldConfig]

            const nameSet: Set<string> = new Set(newConfigArray.map((suite: SerializedSuite) => suite.name))
            const mergedConfig = newConfigArray

            for (const suite of oldConfigArray) {
                if (!nameSet.has(suite.name)) {
                    mergedConfig.push(suite)
                }
            }
            await vscode.workspace.fs.writeFile(this.getPersistentConfigPath()!, Buffer.from(JSON.stringify(mergedConfig)))
        }
        await this.setWorkspaceConfigLoaded(true)
    }

    getPersistentConfigPath = () => {
        if (this.context.storageUri === undefined) {
            return undefined
        }
        return vscode.Uri.joinPath(this.context.storageUri, "suites.smlbuddy")
    };

    removeSuite = async (suite: Suite) => {
        this.suits.delete(suite.name)
        const rawData = await vscode.workspace.fs.readFile(this.getPersistentConfigPath()!)
        const data = Buffer.from(rawData).toString('utf-8')

        const config = JSON.parse(data)
        const configArray = Array.isArray(config) ? config : [config]

        const newConfig = configArray.filter((s: SerializedSuite) => s.name !== suite.name)

        await vscode.workspace.fs.writeFile(this.getPersistentConfigPath()!, Buffer.from(JSON.stringify(newConfig)))
        this.refresh()
    }

    getChildren = (element?: SMLBuddyTreeItem): ProviderResult<SMLBuddyTreeItem[]> => {
        if (!element) {
            return Array.from(this.suits.values())
        }
        if (element instanceof Suite) {
            return element.functions
        }
        return []
    };

    private _loadConfigurationFile = async (uri: Uri) => {
        const rawData = await vscode.workspace.fs.readFile(uri)
        const data = Buffer.from(rawData).toString('utf-8')
        const config = JSON.parse(data)

        if (Array.isArray(config)) {
            for (const suite of config) {
                await this._loadConfiguration(suite)
            }
        } else {
            await this._loadConfiguration(config)
        }
    }

    private _loadConfiguration = async (config: any) => {
        if (!isSerializedSuite(config)) {
            throw new ConfigurationError("Not a configuration file")
        }
        const parser = await this.parser
        let suiteEnv: Environment
        try {
            suiteEnv = parseProgram(parser, config.program)
        } catch (e) {
            throw new ConfigurationError("Invalid program in the configuration file")
        }

        const functions = config.functionNames.map((name: string): CheckableFunction => {
            const node = suiteEnv.bindings.get(name)
            if (!node) {
                throw new ConfigurationError(`Function ${name} not found in the configuration file`)
            }
            const type = suiteEnv.constructors.get(SMLBuddyContext.functionTypeConstructorName(name))
            if (!type) {
                throw new ConfigurationError(`Type for function ${name} not found in the configuration file`)
            }
            return new CheckableFunction(name, new CounterExampleSearcher(name, type.argType, suiteEnv, node as RecursiveFunctionNode))
        })
        this.suits.set(config.name, new Suite(config.name, functions))
        this.refresh()
    }

    getTreeItem = (element: SMLBuddyTreeItem): TreeItem | Thenable<TreeItem> => {
        if (element instanceof Suite) {
            return {
                label: element.name,
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                iconPath: new vscode.ThemeIcon("versions"),
                contextValue: "suite",
            }
        }
        // it's a function

        if (element.state === "verified") {
            return {
                label: `${element.name} - verified`,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                iconPath: new vscode.ThemeIcon("check-all", new vscode.ThemeColor("testing.runAction")),
                contextValue: "function-verified",
                tooltip: "Function has been completely verified"
            }
        }
        if (element.state === "timeout") {
            return {
                label: `${element.name} - verified`,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                iconPath: new vscode.ThemeIcon("check", new vscode.ThemeColor("testing.runAction")),
                contextValue: "function-timeout",
                tooltip: "No counter-example found in the time limit"
            }
        }
        if (element.state === "verifying") {
            return {
                label: `${element.name} - verifying`,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                iconPath: new vscode.ThemeIcon("sync~spin"),
                contextValue: "function-verifying",
                tooltip: "Searching for counter-example..."
            }
        }
        if (element.state === "counter-example") {
            return {
                label: `${element.name} - counter-example found`,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                iconPath: new vscode.ThemeIcon("alert", new vscode.ThemeColor("notificationsWarningIcon.foreground")),
                contextValue: "function-counter-example",
                tooltip: "Counter-example found"
            }
        }
        if (element.state === "error") {
            return {
                label: `${element.name} - error`,
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                iconPath: new vscode.ThemeIcon("error", new vscode.ThemeColor("testing.iconFailed")),
                contextValue: "function-error",
                tooltip: "An error occurred while verifying the function"
            }
        }
        return {
            label: `${element.name} - unverified`,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            iconPath: new vscode.ThemeIcon("circle-outline"),
            contextValue: "function-unverified",
            tooltip: "Function has not been verified yet"
        }
    };

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}

const initLanguage = async (context: vscode.ExtensionContext): Promise<SMLParser> => {
    const wasmPath = context.asAbsolutePath('dist/sml.wasm');

    await Parser.init();
    const parser = new Parser();

    const lang = await Parser.Language.load(wasmPath);
    parser.setLanguage(lang);
    return parser as SMLParser
}

export const activate = (context: vscode.ExtensionContext) => {
    const smlParser = initLanguage(context)
    const smlBuddyContext = new SMLBuddyContext(context, smlParser)

    const loadConfigFileCommand = vscode.commands.registerCommand('smlbuddy.loadConfigFile', async () => {
        const userFileChoice = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: {
                'Config file': ["smlbuddy"]
            },
            title: "Choose configuration file"
        })
        if (!userFileChoice) {
            return
        }
        const configFilePath = userFileChoice[0]
        await smlBuddyContext.addConfiguration(configFilePath)
    })

    const loadConfigLinkCommand = vscode.commands.registerCommand('smlbuddy.loadConfigLink', async () => {
        const userLinkChoice = await vscode.window.showInputBox({
            prompt: "Enter the link to the configuration file",
            placeHolder: "https://example.com/suites.smlbuddy",
            validateInput: (value: string) => {
                if (!value.trim()) {
                    return 'URL cannot be empty';
                }

                try {
                    // Attempt to create a URL object from the input
                    vscode.Uri.parse(value, true);
                } catch (error) {
                    return 'Please enter a valid URL';
                }
                // No validation errors
                return undefined;
            }
        })
        if (!userLinkChoice) {
            return
        }
        const uri = vscode.Uri.parse(userLinkChoice, true)
        await smlBuddyContext.addConfigurationByLink(uri)
    })

    const searchCounterExampleCommand = vscode.commands.registerCommand('smlbuddy.searchCounterExample', async (func?: CheckableFunction): Promise<void> => {
        if (!func) {
            return
        }
        func.counterExample = null
        if (!vscode.window.activeTextEditor) {
            await vscode.window.showErrorMessage("Open a file with the function definition first")
            return
        }
        const checkedCode = vscode.window.activeTextEditor.document.getText()
        func.state = "verifying"
        smlBuddyContext.refresh()

        let finalState: CheckableFunctionState = "unverified"
        try {
            const parser = await smlParser
            const checkedEnv = parseProgram(parser, checkedCode)
            const checkedFunc = checkedEnv.bindings.get(func.name)
            if (!checkedFunc) {
                finalState = "error"
                vscode.window.showErrorMessage(`Function ${func.name} not found in the code`)
                return
            }
            vscode.window.showInformationMessage(`Searching counter-example for ${func.name}`)
            const counterExample = await func.searcher.search(checkedEnv, checkedFunc as RecursiveFunctionNode)
            if (counterExample) {
                finalState = "counter-example"
                vscode.window.showWarningMessage(`Counter-example found for ${func.name}: ${counterExample}`)
                func.counterExample = counterExample
                return
            }
            vscode.window.showInformationMessage(`No counter-example found for ${func.name}`)
            finalState = "verified"
        } catch (e) {
            if (e instanceof TypeError || e instanceof ExecutorError) {
                finalState = "error"
                vscode.window.showErrorMessage(`Unexpected error occurred. Are you sure the program compiles and ${func.name} has the right type?`)
            } else if (e instanceof NotImplementedError) {
                finalState = "error"
                vscode.window.showErrorMessage(`You're trying to use a feature that is not implemented yet`)
            } else {
                finalState = "timeout"
                vscode.window.showInformationMessage(`No counter-example found for ${func.name}`)
                if (!(e instanceof TimeoutError)) {
                    throw e
                }
            }
        } finally {
            func.state = finalState
            smlBuddyContext.refresh()
        }
    })

    const copyCounterExampleCommand = vscode.commands.registerCommand('smlbuddy.copyCounterExample', async (func?: CheckableFunction) => {
        if (!func || func.state !== "counter-example") {
            return
        }
        try {
            await vscode.env.clipboard.writeText(func.counterExample!);
            vscode.window.showInformationMessage('Copied to clipboard!');
        } catch (err) {
            vscode.window.showErrorMessage('Failed to copy to clipboard');
        }
    })

    const deleteSuiteCommand = vscode.commands.registerCommand('smlbuddy.deleteSuite', async (suite?: Suite) => {
        if (!suite) {
            return
        }
        await smlBuddyContext.removeSuite(suite)
    })

    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        await smlBuddyContext.loadPersistentConfig()
    })

    const treeView = vscode.window.createTreeView("smlbuddyView", {
        treeDataProvider: smlBuddyContext
    })
    context.subscriptions.push(loadConfigFileCommand);
    context.subscriptions.push(loadConfigLinkCommand);
    context.subscriptions.push(searchCounterExampleCommand);
    context.subscriptions.push(copyCounterExampleCommand);
    context.subscriptions.push(deleteSuiteCommand);
    context.subscriptions.push(treeView);

    void smlBuddyContext.loadPersistentConfig()
}

export function deactivate() {
}
