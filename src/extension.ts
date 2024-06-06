import * as vscode from 'vscode';
import {ProviderResult, TreeItem, Uri} from 'vscode';
import Parser from 'web-tree-sitter';
import {Environment, parseProgram, SMLParser} from "./parsers/program";
import {Type} from "./models/types";
import {ConfigurationError} from "./models/errors";
import {SymbolicNode} from "./models/symbolic_nodes";

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

class CheckableFunction {
    constructor(
        readonly name: string,
        readonly returnType: Type,
        readonly node: SymbolicNode,
        readonly env: Environment
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
    private workspaceConfigLoading: Promise<void>
    private _workspaceConfigLoading: (value: void) => void

    constructor(context: vscode.ExtensionContext, parser: Promise<SMLParser>) {
        this.context = context
        this.parser = parser
        this.suits = new Map<string, Suite>()
        this._workspaceConfigLoading = () => 0
        this.workspaceConfigLoading = new Promise<void>((resolve) => this._workspaceConfigLoading = resolve)
    }

    private static functionTypeConstructorName = (functionName: string) => `${functionName}_type___`;

    setWorkspaceConfigLoaded = async (value: boolean) => {
        await vscode.commands.executeCommand("setContext", CONFIG_LOADED_WHEN, value)
        if (value) {
            this._workspaceConfigLoading()
        } else {
            this.workspaceConfigLoading = new Promise<void>((resolve) => {
                const oldVal = this._workspaceConfigLoading
                this._workspaceConfigLoading = () => {
                    oldVal()
                    resolve()
                }
            })
        }
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
            await this._loadConfiguration(configPath)
        } catch (e) {
            if (e instanceof ConfigurationError) {
                void vscode.window.showErrorMessage(e.message)
            }
            throw e
        } finally {
            await this.setWorkspaceConfigLoaded(true)
        }
    }

    loadConfiguration = async (uri: Uri) => {
        try {
            await this._loadConfiguration(uri)
        } catch (e) {
            if (e instanceof ConfigurationError) {
                void vscode.window.showErrorMessage(e.message)
            }
            throw e
        }
        await vscode.workspace.fs.copy(uri, this.getPersistentConfigPath()!, {overwrite: true})
        await this.setWorkspaceConfigLoaded(true)
    }

    getPersistentConfigPath = () => {
        if (this.context.storageUri === undefined) {
            return undefined
        }
        return vscode.Uri.joinPath(this.context.storageUri, "suites.smlbuddy")
    };

    getChildren = (element?: SMLBuddyTreeItem): ProviderResult<SMLBuddyTreeItem[]> => {
        if (!element) {
            return new Promise<SMLBuddyTreeItem[]>(async (resolve) => {
                await this.workspaceConfigLoading
                resolve(Array.from(this.suits.values()))
            })
        }
        if (element instanceof Suite) {
            return element.functions
        }
        return []
    };

    getTreeItem = (element: SMLBuddyTreeItem): TreeItem | Thenable<TreeItem> => {
        if (element instanceof Suite) {
            return {
                label: element.name,
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                iconPath: new vscode.ThemeIcon("versions")
            }
        }
        return {
            label: element.name,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            iconPath: new vscode.ThemeIcon("debug-restart")
        }
    };

    private _loadConfiguration = async (uri: Uri) => {
        const rawData = await vscode.workspace.fs.readFile(uri)
        const data = Buffer.from(rawData).toString('utf-8')
        const config = JSON.parse(data)
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
            return new CheckableFunction(name, type, node, suiteEnv)
        })
        this.suits.set(config.name, new Suite(config.name, functions))
    };

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
        await smlBuddyContext.loadConfiguration(configFilePath)
    })
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        await smlBuddyContext.loadPersistentConfig()
    })

    const treeView = vscode.window.createTreeView("smlbuddyView", {
        treeDataProvider: smlBuddyContext
    })
    context.subscriptions.push(loadConfigFileCommand);
    context.subscriptions.push(treeView);

    void smlBuddyContext.loadPersistentConfig()
}

export function deactivate() {
}
