import {CounterExampleSearcher} from "../engine/counterExampleSearcher";

export interface SerializedSuite {
    name: string,
    program: string,
    functionNames: string[]
}

export const isSerializedSuite = (obj: any): obj is SerializedSuite => {
    return obj.program && obj.functionNames && obj.name &&
        typeof obj.program === 'string' && typeof obj.name === 'string' &&
        Array.isArray(obj.functionNames) && obj.functionNames.every((name: any) => typeof name === 'string');
};
export type CheckableFunctionState = "unverified" | "verifying" | "verified" | "timeout" | "counter-example" | "error";

export class CheckableFunction {
    constructor(
        readonly name: string,
        readonly searcher: CounterExampleSearcher,
        public state: CheckableFunctionState = "unverified",
        public counterExample: CounterExample | null = null
    ) {
    }
}

export class Suite {
    constructor(
        readonly name: string,
        readonly functions: CheckableFunction[]
    ) {
    }
}

export type SMLBuddyTreeItem = Suite | CheckableFunction;

export type CounterExample = {
    input: string,
    output: string,
    expectedOutput: string,
}
