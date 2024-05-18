import {PolymorphicType, Type} from "./types";
import {Pattern, tryMatch} from "../parsers/pattern";
import {Bindings, Environment, getTupleConstructorName} from "../parsers/program";

export interface SymbolicNode {
    size(): number;

    toString(): string;

    holesNumber(): number;

    evaluate(env: Environment): SymbolicNode;
}

export interface ApplicableNode {
    apply(argument: SymbolicNode): SymbolicNode;
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

    evaluate(env: Environment): SymbolicNode {
        return this;
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

    evaluate(env: Environment): SymbolicNode {
        return this;
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

    evaluate(env: Environment): SymbolicNode {
        const constructor = env.constructors.get(this.name)
        if (constructor) {
            if (constructor.argType) return new ConstructorNode([], this.name)
            return new BuiltInFunctionNode((args) =>
                new ConstructorNode([args], this.name))
        }
        const value = env.bindings.get(this.name)
        if (!value) throw new Error(`Variable ${this.name} not found in environment`)
        return value
    }
}

// TODO deprecated
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

    evaluate(env: Environment): SymbolicNode {
        throw new Error("Method not implemented.");
    }
}

// TODO deprecated
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

    evaluate(env: Environment): SymbolicNode {
        throw new Error("Method not implemented.");
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

    isInfix(node: SymbolicNode, env: Environment): boolean {
        return node instanceof VariableNode && !node.opped && env.infixData.has(node.name)
    }

    evaluate(env: Environment): SymbolicNode {
        const inputStack = [...this.nodes].reverse()
        const workStack: SymbolicNode[] = []

        // always have at least one node in input stack for lookahead
        while (inputStack.length !== 0) {
            const node = inputStack.pop()
            const lookahead = inputStack[inputStack.length - 1]

            // push infix to work stack if no reduce
            if (this.isInfix(node, env)) {
                if (workStack.length >= 3) {
                    const leftInfix = env.infixData.get((<VariableNode>workStack[workStack.length - 2]).name)
                    const rightInfix = env.infixData.get((<VariableNode>node).name)

                    if (leftInfix.precedence > rightInfix.precedence ||
                        (leftInfix.precedence === rightInfix.precedence && leftInfix.infix === "Left")) {
                        const rightArg = workStack.pop()
                        const func = <ApplicableNode><unknown>workStack.pop().evaluate(env)
                        const leftArg = workStack.pop()
                        workStack.push(func.apply(new ConstructorNode([leftArg, rightArg], getTupleConstructorName(2))))
                        // return input
                        inputStack.push(node)
                        continue
                    }
                }
                workStack.push(node)
                continue
            }

            // if work stack is empty just evaluate
            if (workStack.length === 0) {
                workStack.push(node.evaluate(env))
                continue
            }

            const workTop = workStack[workStack.length - 1]
            // if previous node is not infix, it's applicable and has higher precedence than infix
            if (!this.isInfix(workTop, env)) {
                const func = <ApplicableNode><unknown>workStack.pop()
                workStack.push(func.apply(node.evaluate(env)))
                continue
            }
            // if previous node is infix and the next node is not, we skip
            if (!this.isInfix(lookahead, env)) {
                workStack.push(node.evaluate(env))
                continue
            }
            // both lookahead and work top are infix, thus compare precedence
            const leftInfix = env.infixData.get((<VariableNode>workTop).name)
            const rightInfix = env.infixData.get((<VariableNode>lookahead).name)

            if (leftInfix.precedence > rightInfix.precedence ||
                (leftInfix.precedence === rightInfix.precedence && leftInfix.infix === "Left")) {
                const func = <ApplicableNode><unknown>workStack.pop().evaluate(env)
                const leftArg = workStack.pop()
                const rightArg = node.evaluate(env)
                workStack.push(func.apply(new ConstructorNode([leftArg, rightArg], getTupleConstructorName(2))))
                continue
            }
            workStack.push(node.evaluate(env))
        }
        while (workStack.length > 1) {
            const rightArg = workStack.pop()
            const func = <ApplicableNode><unknown>workStack.pop().evaluate(env)
            const leftArg = workStack.pop()
            workStack.push(func.apply(new ConstructorNode([leftArg, rightArg], getTupleConstructorName(2))))
        }
        return workStack[0]
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

    evaluate(env: Environment): SymbolicNode {
        return new ConstructorNode(this.args.map(arg => arg.evaluate(env)), this.name)
    }
}

export type Clause = {
    patterns: Pattern[],
    body: SymbolicNode,
    subBindings: Bindings
}

export class FunctionNode implements SymbolicNode, ApplicableNode {
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

    apply(argument: SymbolicNode): SymbolicNode {
        if (this.clauses[0].patterns.length === 1) {
            for (const clause of this.clauses) {
                const parameterBind = tryMatch(() => clause.patterns[0](argument))
                if (parameterBind !== null) {
                    const env: Environment = {
                        bindings: new Map([...this.closure.bindings, ...clause.subBindings, ...parameterBind]),
                        constructors: this.closure.constructors,
                        infixData: this.closure.infixData
                    }
                    return clause.body.evaluate(env)
                }
            }
            throw new Error("Pattern match not exhaustive")
        }

        let newClauses: Clause[] = []
        for (const clause of this.clauses) {
            const parameterBind = tryMatch(() => clause.patterns[0](argument))
            if (parameterBind !== null) {
                newClauses.push({
                    patterns: clause.patterns.slice(1),
                    body: clause.body,
                    subBindings: new Map([...clause.subBindings, ...parameterBind])
                })
            }
        }
        if (newClauses.length === 0) throw new Error("Pattern match not exhaustive")
        return new FunctionNode(newClauses, this.closure)
    }

    evaluate(env: Environment): SymbolicNode {
        throw new Error("Method not implemented.");
    }
}

export class BuiltInFunctionNode implements SymbolicNode, ApplicableNode {
    readonly func: (args: SymbolicNode) => SymbolicNode;

    constructor(func: (args: SymbolicNode) => SymbolicNode) {
        this.func = func;
    }

    size(): number {
        return 1;
    }

    holesNumber(): number {
        return 0;
    }

    apply(argument: SymbolicNode): SymbolicNode {
        return this.func(argument)
    }

    evaluate(env: Environment): SymbolicNode {
        throw new Error("Unexpected evaluation of built-in function")
    }
}

export class BuiltInBinopNode extends BuiltInFunctionNode {
    constructor(func: (a: number, b: number) => number) {
        super((node) => {
            if (!(node instanceof ConstructorNode) || node.name !== getTupleConstructorName(2)) {
                throw new Error("Expected tuple with two elements")
            }
            const [a, b] = node.args
            if (!(a instanceof IntegerNode) || !(b instanceof IntegerNode)) {
                throw new Error("Expected two integers")
            }
            return new IntegerNode(func(a.value, b.value))
        });
    }
}

// TODO deprecated
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

    evaluate(env: Environment): SymbolicNode {
        throw new Error("Method not implemented.");
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

    evaluate(env: Environment): SymbolicNode {
        throw new Error("Method not implemented.");
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

    evaluate(env: Environment): SymbolicNode {
        throw new Error("Not supposed to happen");
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

    evaluate(env: Environment): SymbolicNode {
        throw new Error("Not supposed to happen");
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

    evaluate(env: Environment): SymbolicNode {
        throw new Error("Not supposed to happen");
    }
}
