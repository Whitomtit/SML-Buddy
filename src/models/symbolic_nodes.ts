import {PolymorphicType, Type} from "./types";
import {Pattern} from "../parsers/pattern";
import {Bindings, Environment} from "../parsers/program";

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
    readonly opped: boolean

    constructor(name: string, opped: boolean = false) {
        this.name = name
        this.opped = opped
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

export class ApplicationNode implements SymbolicNode {
    readonly nodes: SymbolicNode[];

    constructor(nodes: SymbolicNode[]) {
        this.nodes = nodes
    }

    holesNumber(): number {
        return 0;
    }

    size(): number {
        return 0;
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

export type Clause = {
    patterns: Pattern[],
    body: SymbolicNode,
    subBindings: Bindings
}

export class FunctionNode implements SymbolicNode {
    readonly clauses: Clause[];
    readonly closure: Environment;

    constructor(clauses: Clause[], closure: Environment) {
        this.clauses = clauses
        this.closure = closure
    }

    size(): number {
        return 1 + this.clauses.reduce((acc, clause) => acc + clause.body.size(), 0);
    }

    holesNumber(): number {
        return this.clauses.reduce((acc, clause) => acc + clause.body.holesNumber(), 0);
    }

}

export class TestFunctionNode implements SymbolicNode {
    private static argCount = 0;

    readonly argName: string;
    readonly body: SymbolicNode;

    static freshArgName() {
        return 'arg' + TestFunctionNode.argCount++;
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

export class PatternMatchNode implements SymbolicNode {
    readonly cases: { pattern: Pattern, body: SymbolicNode }[];

    constructor(cases: { pattern: Pattern, body: SymbolicNode }[]) {
        this.cases = cases
    }

    holesNumber(): number {
        return 0;
    }

    size(): number {
        return 0;
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
