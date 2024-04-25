import {PolymorphicType, Type} from "./types";

export interface SymbolicNode {
    size(): number;

    toString(): string;

    holesNumber(): number;
}

export type Binop = '+' | '-' | '*' | 'div' | 'mod';
export const BINOPS: Binop[] = ['+', '-', '*', 'div', 'mod'];

export class IntegerNode implements SymbolicNode {
    readonly value: number;

    constructor(value: number) {
        this.value = value;
    }

    size(): number {
        return 1;
    }

    toString() {
        return this.value.toString();
    }

    holesNumber(): number {
        return 0;
    }
}

export class StringNode implements SymbolicNode {
    readonly value: string;

    constructor(value: string) {
        this.value = value;
    }

    size(): number {
        return 1;
    }

    toString() {
        return this.value;
    }

    holesNumber(): number {
        return 0;
    }
}

export class VariableNode implements SymbolicNode {
    readonly name: string

    constructor(name: string) {
        this.name = name
    }

    size(): number {
        return 1;
    }

    toString() {
        return this.name
    }

    holesNumber(): number {
        return 0;
    }
}

export class BinopNode implements SymbolicNode {
    readonly op: Binop;
    readonly left: SymbolicNode;
    readonly right: SymbolicNode;

    constructor(op: Binop, left: SymbolicNode, right: SymbolicNode) {
        this.op = op
        this.left = left
        this.right = right
    }

    size(): number {
        return 1 + this.left.size() + this.right.size();
    }

    toString() {
        return `(${this.left} ${this.op} ${this.right})`
    }

    holesNumber(): number {
        return this.left.holesNumber() + this.right.holesNumber();
    }
}

export class ConcatNode implements SymbolicNode {
    readonly left: SymbolicNode;
    readonly right: SymbolicNode;

    constructor(left: SymbolicNode, right: SymbolicNode) {
        this.left = left
        this.right = right
    }

    size(): number {
        return 1 + this.left.size() + this.right.size();
    }

    toString() {
        return `(${this.left} ^ ${this.right})`
    }

    holesNumber(): number {
        return this.left.holesNumber() + this.right.holesNumber();
    }
}

export class FunctionApplicationNode {
    readonly fn: SymbolicNode;
    readonly arg: SymbolicNode;

    constructor(fn: SymbolicNode, arg: SymbolicNode) {
        this.fn = fn
        this.arg = arg
    }
}

export class ConstructorNode implements SymbolicNode {
    readonly args: SymbolicNode[];
    readonly name: string

    constructor(args: SymbolicNode[], name: string) {
        this.args = args
        this.name = name
    }

    size(): number {
        return 1 + this.args.reduce((acc, arg) => acc + arg.size(), 0);
    }

    toString() {
        if (this.args.length === 0) return this.name
        if (this.args.length === 2) return `(${this.args[0]} ${this.name} ${this.args[1]})`
        return `${this.name}(${this.args.join(", ")})`
    }

    holesNumber(): number {
        return this.args.reduce((acc, arg) => acc + arg.holesNumber(), 0);
    }
}

export class FunctionNode implements SymbolicNode {
    private static argCount = 0;

    readonly argName: string;
    readonly body: SymbolicNode;

    static freshArgName() {
        return 'arg' + FunctionNode.argCount++;
    }

    constructor(argName: string, body: SymbolicNode) {
        this.argName = argName
        this.body = body
    }

    size(): number {
        return 1 + this.body.size();
    }

    toString() {
        return `λ${this.argName}.${this.body}`
    }

    holesNumber(): number {
        return this.body.holesNumber();
    }
}

export class LetNode {
    readonly varName: string;
    readonly value: SymbolicNode;
    readonly body: SymbolicNode;

    constructor(varName: string, value: SymbolicNode, body: SymbolicNode) {
        this.varName = varName
        this.value = value
        this.body = body
    }
}

export class RecursiveFunctionNode extends FunctionNode {
    readonly functionName: string;

    constructor(functionName: string, argName: string, body: SymbolicNode) {
        super(argName, body)
        this.functionName = functionName
    }
}

export class PatternMatchNode {
    readonly value: SymbolicNode;
    readonly cases: { pattern: SymbolicNode, body: SymbolicNode }[];

    constructor(value: SymbolicNode, cases: { pattern: SymbolicNode, body: SymbolicNode }[]) {
        this.value = value
        this.cases = cases
    }
}

export class PatternNode {
    readonly name: string;
    readonly args: string[];

    constructor(name: string, args: string[]) {
        this.name = name
        this.args = args
    }
}

export class HoleNode implements SymbolicNode {
    readonly type: Type;
    readonly env: Map<string, Type>;
    readonly substitution: Map<PolymorphicType, Type>;

    constructor(type: Type, env: Map<string, Type>, substitution: Map<PolymorphicType, Type>) {
        this.type = type;
        this.env = env;
        this.substitution = substitution;
    }

    size(): number {
        return 1;
    }

    toString() {
        return "_"
    }

    holesNumber(): number {
        return 1;
    }
}

export class IntegerSymbolNode implements SymbolicNode {
    size(): number {
        return 1;
    }

    toString() {
        return "I"
    }

    holesNumber(): number {
        return 0;
    }
}

export class StringSymbolNode implements SymbolicNode {
    size(): number {
        return 1;
    }

    toString() {
        return "S"
    }

    holesNumber(): number {
        return 0;
    }
}
