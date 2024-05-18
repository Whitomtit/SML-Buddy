import {PolymorphicType, TupleType, Type} from "./types";
import {tryMatch} from "../parsers/pattern";
import {Environment, getTupleConstructorName} from "../parsers/program";
import {
    BuiltinOperationError,
    NotImplementedError,
    PatternMatchingNotExhaustiveError,
    UnexpectedError,
    VariableNotDefinedError
} from "./errors";
import {Clause} from "../parsers/declaration";
import {Constructor} from "./utils";

export abstract class SymbolicNode {
    size(): number {
        return 1;
    }

    holesNumber(): number {
        return 0;
    }

    isGround(): boolean {
        return this.holesNumber() === 0
    }

    abstract evaluate(env: Environment): SymbolicNode;
}

export interface ApplicableNode {
    apply(argument: SymbolicNode): SymbolicNode;
}

export interface ValuableNode<T> {
    readonly value: T
}

export class IntegerNode extends SymbolicNode implements ValuableNode<number> {
    readonly value: number;

    constructor(value: number) {
        super();
        this.value = value;
    }

    evaluate(env: Environment): SymbolicNode {
        return this;
    }

    toString() {
        return this.value.toString();
    }
}

export class StringNode extends SymbolicNode implements ValuableNode<string> {
    readonly value: string;

    constructor(value: string) {
        super();
        this.value = value;
    }

    evaluate(env: Environment): SymbolicNode {
        return this;
    }

    toString() {
        return this.value;
    }
}

export class IdentifierNode extends SymbolicNode {
    readonly name: string
    readonly opped: boolean

    constructor(name: string, opped: boolean = false) {
        super();
        this.name = name
        this.opped = opped
    }

    toString() {
        return this.name
    }

    evaluate(env: Environment): SymbolicNode {
        // name may be a constructor
        const constructor = env.constructors.get(this.name)
        if (constructor) {
            // special case for constructors with no arguments
            if (constructor.argType instanceof TupleType && constructor.argType.elementTypes.length === 0) {
                return new ConstructorNode([], this.name)
            }
            return new BuiltInFunctionNode((args) =>
                new ConstructorNode([args], this.name))
        }

        const value = env.bindings.get(this.name)
        if (!value) throw new VariableNotDefinedError(this.name)

        return value
    }
}

export class ApplicationNode extends SymbolicNode {
    constructor(nodes: SymbolicNode[]) {
        super();
        this.nodes = nodes
    }

    readonly nodes: SymbolicNode[];

    static isInfix(node: SymbolicNode, env: Environment): boolean {
        return node instanceof IdentifierNode && !node.opped && env.infixData.has(node.name)
    }

    size(): number {
        return 1 + this.nodes.reduce((acc, node) => acc + node.size(), 0);
    }

    holesNumber(): number {
        return this.nodes.reduce((acc, node) => acc + node.holesNumber(), 0);
    }

    evaluate(env: Environment): SymbolicNode {
        const inputStack = [...this.nodes].reverse()
        const workStack: SymbolicNode[] = []

        // always have at least one node in input stack for lookahead
        while (inputStack.length !== 0) {
            const node = inputStack.pop()
            const lookahead = inputStack[inputStack.length - 1]

            // push infix to work stack if no reduce
            if (ApplicationNode.isInfix(node, env)) {
                if (workStack.length >= 3) {
                    const leftInfix = env.infixData.get((<IdentifierNode>workStack[workStack.length - 2]).name)
                    const rightInfix = env.infixData.get((<IdentifierNode>node).name)

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
            if (!ApplicationNode.isInfix(workTop, env)) {
                const func = <ApplicableNode><unknown>workStack.pop()
                workStack.push(func.apply(node.evaluate(env)))
                continue
            }
            // if previous node is infix and the next node is not, we skip
            if (!ApplicationNode.isInfix(lookahead, env)) {
                workStack.push(node.evaluate(env))
                continue
            }
            // both lookahead and work top are infix, thus compare precedence
            const leftInfix = env.infixData.get((<IdentifierNode>workTop).name)
            const rightInfix = env.infixData.get((<IdentifierNode>lookahead).name)

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

export class ConstructorNode extends SymbolicNode {
    readonly args: SymbolicNode[];
    readonly name: string

    constructor(args: SymbolicNode[], name: string) {
        super();
        this.args = args
        this.name = name
    }

    size(): number {
        return 1 + this.args.reduce((acc, arg) => acc + arg.size(), 0);
    }

    holesNumber(): number {
        return this.args.reduce((acc, arg) => acc + arg.holesNumber(), 0);
    }

    evaluate(env: Environment): SymbolicNode {
        return new ConstructorNode(this.args.map(arg => arg.evaluate(env)), this.name)
    }

    toString() {
        if (this.args.length === 0) return this.name
        return `${this.name}(${this.args.join(", ")})`
    }
}

export class FunctionNode extends SymbolicNode implements ApplicableNode {
    readonly clauses: Clause[];
    readonly closure: Environment;

    constructor(clauses: Clause[], closure: Environment) {
        super();
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
            throw new PatternMatchingNotExhaustiveError()
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
        if (newClauses.length === 0) throw new PatternMatchingNotExhaustiveError()
        return new FunctionNode(newClauses, this.closure)
    }

    evaluate(env: Environment): SymbolicNode {
        throw new NotImplementedError()
    }
}

export class BuiltInFunctionNode extends SymbolicNode implements ApplicableNode {
    readonly func: (args: SymbolicNode) => SymbolicNode;

    constructor(func: (args: SymbolicNode) => SymbolicNode) {
        super();
        this.func = func;
    }

    apply(argument: SymbolicNode): SymbolicNode {
        return this.func(argument)
    }

    evaluate(env: Environment): SymbolicNode {
        throw new UnexpectedError()
    }
}

export class BuiltInBinopNode<BaseType, NodeType extends SymbolicNode & ValuableNode<BaseType>> extends BuiltInFunctionNode {
    constructor(func: (a: BaseType, b: BaseType) => BaseType, nodeType: Constructor<NodeType>) {
        super((node): SymbolicNode => {
            if (!(node instanceof ConstructorNode) || node.name !== getTupleConstructorName(2)) {
                throw new BuiltinOperationError("Expected tuple with two elements")
            }
            const [a, b] = node.args
            if (!(a instanceof nodeType) || !(b instanceof nodeType)) {
                throw new BuiltinOperationError("expected two arguments of type " + nodeType.toString())
            }
            return new nodeType(func((<NodeType>a).value, (<NodeType>b).value))
        });
    }
}

export class TestFunctionNode extends SymbolicNode {
    readonly argName: string;
    readonly body: SymbolicNode;

    constructor(argName: string, body: SymbolicNode) {
        super();
        this.argName = argName
        this.body = body
    }

    size(): number {
        return 1 + this.body.size();
    }

    holesNumber(): number {
        return this.body.holesNumber();
    }

    evaluate(env: Environment): SymbolicNode {
        throw new NotImplementedError()
    }

    toString() {
        return `λ${this.argName}.${this.body}`
    }
}

export class HoleNode extends SymbolicNode {
    readonly type: Type;
    readonly env: Map<string, Type>;
    readonly substitution: Map<PolymorphicType, Type>;

    constructor(type: Type, env: Map<string, Type>, substitution: Map<PolymorphicType, Type>) {
        super();
        this.type = type;
        this.env = env;
        this.substitution = substitution;
    }

    holesNumber(): number {
        return 1;
    }

    evaluate(env: Environment): SymbolicNode {
        throw new UnexpectedError()
    }

    toString() {
        return "_"
    }
}

export class IntegerSymbolNode extends SymbolicNode {
    evaluate(env: Environment): SymbolicNode {
        throw new UnexpectedError()
    }

    toString() {
        return "I"
    }
}

export class StringSymbolNode extends SymbolicNode {
    evaluate(env: Environment): SymbolicNode {
        throw new UnexpectedError()
    }

    toString() {
        return "S"
    }
}
