import {SMLBuddyContext} from "./context";
import vscode from "vscode";
import {CheckableFunction, CheckableFunctionState, Suite} from "./types";
import {parseProgram} from "../parsers/program";
import {RecursiveFunctionNode} from "../models/symbolic_nodes";
import {ExecutorError, NotImplementedError, TimeoutError} from "../models/errors";

export const getLoadConfigFileCommand = (smlBuddyContext: SMLBuddyContext) => vscode.commands.registerCommand('smlbuddy.loadConfigFile', async () => {
    const userFileChoice = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
            'Config file': ["smlbuddy"]
        },
        title: "Choose configuration file"
    });
    if (!userFileChoice) {
        return;
    }
    const configFilePath = userFileChoice[0];
    await smlBuddyContext.addConfiguration(configFilePath);
});

export function getLoadConfigLinkCommand(smlBuddyContext: SMLBuddyContext) {
    return vscode.commands.registerCommand('smlbuddy.loadConfigLink', async () => {
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
        });
        if (!userLinkChoice) {
            return;
        }
        const uri = vscode.Uri.parse(userLinkChoice, true);
        await smlBuddyContext.addConfigurationByLink(uri);
    });
}

export function getSearchCounterExampleCommand(smlBuddyContext: SMLBuddyContext) {
    return vscode.commands.registerCommand('smlbuddy.searchCounterExample', async (func?: CheckableFunction): Promise<void> => {
        if (!func) {
            return;
        }
        func.counterExample = null;
        if (!vscode.window.activeTextEditor) {
            await vscode.window.showErrorMessage("Open a file with the function definition first");
            return;
        }
        const checkedCode = vscode.window.activeTextEditor.document.getText();
        func.state = "verifying";
        smlBuddyContext.refresh(vscode.window.activeTextEditor.document);

        let finalState: CheckableFunctionState = "unverified";
        smlBuddyContext.currentlyChecking++;
        try {
            const parser = await smlBuddyContext.parser;
            const checkedEnv = parseProgram(parser, checkedCode);
            const checkedFunc = checkedEnv.bindings.get(func.name);
            if (!checkedFunc) {
                finalState = "error";
                vscode.window.showErrorMessage(`Function ${func.name} not found in the code`);
                return;
            }
            vscode.window.showInformationMessage(`Searching counter-example for ${func.name}`);
            const counterExample = await func.searcher.search(checkedEnv, checkedFunc as RecursiveFunctionNode);
            if (counterExample) {
                finalState = "counter-example";
                vscode.window.showWarningMessage(`Counter-example found for ${func.name}!`);
                func.counterExample = counterExample;

                const url = vscode.Uri.parse(`smlbuddy://counter-example/${func.name}`);
                await smlBuddyContext.updateVirtualDocument(url);
                await vscode.commands.executeCommand('vscode.open', url);
                return;
            }
            vscode.window.showInformationMessage(`No counter-example found for ${func.name}`);
            finalState = "verified";
        } catch (e) {
            if (e instanceof TypeError || e instanceof ExecutorError) {
                finalState = "error";
                vscode.window.showErrorMessage(`Unexpected error occurred. Are you sure the program compiles and ${func.name} has the right type?`);
            } else if (e instanceof NotImplementedError) {
                finalState = "error";
                vscode.window.showErrorMessage(`You're trying to use a feature that is not implemented yet`);
            } else {
                finalState = "timeout";
                vscode.window.showInformationMessage(`No counter-example found for ${func.name}`);
                if (!(e instanceof TimeoutError)) {
                    throw e;
                }
            }
        } finally {
            func.state = finalState;
            smlBuddyContext.currentlyChecking--;
            smlBuddyContext.refresh(vscode.window.activeTextEditor.document);
        }
    });
}

export function getCopyCounterExampleCommand() {
    return vscode.commands.registerCommand('smlbuddy.copyCounterExample', async (func?: CheckableFunction) => {
        if (!func || func.state !== "counter-example") {
            return;
        }
        try {
            await vscode.env.clipboard.writeText(func.counterExample!.input);
            vscode.window.showInformationMessage('Copied to clipboard!');
        } catch (err) {
            vscode.window.showErrorMessage('Failed to copy to clipboard');
        }
    });
}

export function getDeleteSuiteCommand(smlBuddyContext: SMLBuddyContext) {
    return vscode.commands.registerCommand('smlbuddy.deleteSuite', async (suite?: Suite) => {
        if (!suite) {
            return;
        }
        await smlBuddyContext.removeSuite(suite);
    });
}