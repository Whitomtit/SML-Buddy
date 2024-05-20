import {PolymorphicType, TupleType, Type} from "./types";
import {Pattern, tryMatch} from "../parsers/pattern";
import {Bindings, Constructors, Environment, getTupleConstructorName} from "../parsers/program";
import {
    BuiltinOperationError,
    NotImplementedError,
    PatternMatchingNotExhaustiveError,
    UnexpectedError,
    VariableNotDefinedError
} from "./errors";
import {Clause} from "../parsers/declaration";
import {
    bindingsToSym,
    Constructor,
    mergeSymBindingsInto,
    product,
    Summary,
    SymBindings,
    SymEnvironment,
    zip
} from "./utils";
import {Bool} from "z3-solver";
import {CustomContext} from "./context";

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

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        throw new NotImplementedError()
    }

    abstract eqZ3To<T extends string>(context: CustomContext<T>, other: SymbolicNode);
}

export interface ApplicableNode {
    apply(argument: SymbolicNode): SymbolicNode;

    symbolicApply<T extends string>(context: CustomContext<T>, argument: Summary<T>, path: Bool<T>): Summary<T>
}

export interface ValuableNode<T> {
    readonly value: T
}

export interface FormulaNode {
    readonly formulaName: string
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

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        return [{path, value: this}]
    }

    eqZ3To<T extends string>(context: CustomContext<T>, other: SymbolicNode) {
        if (other instanceof IntegerNode) {
            return context.Bool.val(this.value === other.value)
        }
        if (other instanceof IntegerSymbolNode) {
            return context.Int.const(other.formulaName).eq(context.Int.val(this.value))
        }
        throw new UnexpectedError()
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

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        return [{path, value: this}]
    }

    eqZ3To<T extends string>(context: CustomContext<T>, other: SymbolicNode) {
        if (other instanceof StringNode) {
            return context.Bool.val(this.value === other.value)
        }
        if (other instanceof StringSymbolNode) {
            return context.VarEqString(other.formulaName, this.value)
        }
        throw new UnexpectedError()
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

    evaluate(env: Environment): SymbolicNode {
        // name may be a constructor
        const constructor = this.evaluateConstructor(env.constructors)
        if (constructor) {
            return constructor
        }

        const value = env.bindings.get(this.name)
        if (!value) throw new VariableNotDefinedError(this.name)

        return value
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        // name may be a constructor
        const constructor = this.evaluateConstructor(env.constructors)
        if (constructor) {
            return [{path, value: constructor}]
        }

        const value = env.bindings.get(this.name)
        if (!value) throw new VariableNotDefinedError(this.name)

        return value
    }

    toString() {
        return this.name
    }

    private evaluateConstructor(constructors: Constructors): SymbolicNode {
        const constructor = constructors.get(this.name)

        if (!constructor) {
            return null
        }

        // special case for constructors with no arguments
        if (constructor.argType instanceof TupleType && constructor.argType.elementTypes.length === 0) {
            return new ConstructorNode([], this.name)
        }
        return new BuiltInFunctionNode((args) =>
            new ConstructorNode([args], this.name))
    }

    eqZ3To<T extends string>(context: CustomContext<T>, other: SymbolicNode) {
        throw new UnexpectedError()
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

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        // TODO
        if (this.nodes.length === 1) {
            return this.nodes[0].summarize(context, env, path)
        }
        super.summarize(context, env, path)
    }

    eqZ3To<T extends string>(context: CustomContext<T>, other: SymbolicNode) {
        throw new UnexpectedError()
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

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        const summaries = this.args.map(arg => arg.summarize(context, env, path))
        return product(summaries).map((binds) => {
            const args = binds.map(({value}) => value)
            const combined_path =
                binds.reduce((combined_path, {path}) =>
                    context.And(combined_path, path), context.Bool.val(true))
            return {path: combined_path, value: new ConstructorNode(args, this.name)}
        })
    }

    eqZ3To<T extends string>(context: CustomContext<T>, other: SymbolicNode) {
        if (other instanceof ConstructorNode && this.name === other.name) {
            return this.args.reduce((acc, arg, i) => {
                return context.And(acc, arg.eqZ3To(context, other.args[i]))
            }, context.Bool.val(true))
        }
        if (other instanceof ConstructorNode) {
            return context.Bool.val(false)
        }
        throw new UnexpectedError()
    }

    toString() {
        if (this.args.length === 0) return this.name
        return `${this.name}(${this.args.join(", ")})`
    }
}

export class FunctionNode extends SymbolicNode implements ApplicableNode {
    readonly clauses: Clause[];
    readonly closure: Environment;
    readonly args: (SymbolicNode | Summary<any>)[];

    constructor(clauses: Clause[], closure: Environment, args: (SymbolicNode | Summary<any>)[] = []) {
        super();
        this.clauses = clauses
        this.closure = closure
        this.args = args
    }

    size(): number {
        return 1 + this.clauses.reduce((acc, clause) => acc + clause.body.size(), 0);
    }

    holesNumber(): number {
        // TODO binds contains holes?
        return this.clauses.reduce((acc, clause) => acc + clause.body.holesNumber(), 0);
    }

    apply(argument: SymbolicNode): SymbolicNode {
        const newArgs = [...this.args, argument]
        if (this.clauses[0].patterns.length === 1 + this.args.length) {
            for (const clause of this.clauses) {
                const clauseResult = this.applyClause(clause, newArgs as SymbolicNode[])
                if (clauseResult === null) continue
                const env: Environment = {
                    bindings: new Map([...this.closure.bindings, ...clauseResult]),
                    constructors: this.closure.constructors,
                    infixData: this.closure.infixData
                }
                return clause.body.evaluate(env)
            }
            throw new PatternMatchingNotExhaustiveError()
        }
        return this.recreate(newArgs)
    }

    symbolicApply<T extends string>(context: CustomContext<T>, argument: Summary<T>, path: Bool<T>): Summary<T> {
        const newArgs = [...this.args, argument] as Summary<T>[]
        if (this.clauses[0].patterns.length === 1 + this.args.length) {
            // TODO check it
            const closureBinds = bindingsToSym(this.closure.bindings, context.Bool.val(true))
            const summary: Summary<T> = []
            let combinedPath = path
            for (const clause of this.clauses) {
                const clauseResult = this.applySymClause(clause, newArgs, combinedPath, context)
                if (clauseResult === null) continue
                const [matchBindings, matchPath] = clauseResult
                const env: SymEnvironment<T> = {
                    bindings: new Map([...closureBinds, ...matchBindings]),
                    constructors: this.closure.constructors,
                    infixData: this.closure.infixData
                }

                summary.push(...clause.body.summarize(context, env, combinedPath.and(matchPath)))
                combinedPath = combinedPath.and(matchPath.not())
            }
            if (summary.length === 0) {
                throw new PatternMatchingNotExhaustiveError()
            }
            return summary
        }
        return [{
            path,
            value: this.recreate(newArgs)
        }]
    }

    eqZ3To<T extends string>(context: CustomContext<T>, other: SymbolicNode) {
        throw new UnexpectedError()
    }

    protected recreate(newArgs: (SymbolicNode | Summary<any>)[]): FunctionNode {
        return new FunctionNode(this.clauses, this.closure, newArgs)
    }

    // null stands for failed match
    private applyClause(clause: Clause, args: SymbolicNode[]): Bindings {
        let clauseBindings: Bindings = new Map()
        for (const [pattern, arg] of zip(clause.patterns, args)) {
            const patternResult = tryMatch(() => pattern(arg))
            // pattern is not applicable for this clause
            if (patternResult === null) return null
            clauseBindings = new Map([...clauseBindings, ...patternResult.bindings])
        }
        return clauseBindings
    }

    private applySymPattern<T extends string>(pattern: Pattern, arg: Summary<T>, combinedPath: Bool<T>, context: CustomContext<T>): [SymBindings<T>, Bool<T>] {
        const patternBindings: SymBindings<T> = new Map()
        let patternPath: Bool<T> = null
        for (let {path, value} of arg) {
            const patternResult = tryMatch(() => pattern(value, context))
            if (patternResult === null) continue
            const argPath = (patternResult.condition === null) ? path : path.and(patternResult.condition)
            if (patternPath === null) {
                patternPath = argPath
            } else {
                patternPath = patternPath.or(argPath)
            }
            mergeSymBindingsInto(patternBindings, bindingsToSym(patternResult.bindings, combinedPath.and(argPath)))
        }
        return [patternBindings, patternPath]
    }

    evaluate(env: Environment): SymbolicNode {
        throw new NotImplementedError()
    }

    private applySymClause<T extends string>(clause: Clause, args: Summary<T>[], path: Bool<T>, context: CustomContext<T>): [SymBindings<T>, Bool<T>] {
        let clauseBindings: SymBindings<T> = new Map()
        let clausePath: Bool<T> = context.Bool.val(true)
        for (const [pattern, argSummary] of zip(clause.patterns, args)) {
            const [patternBindings, patternPath] = this.applySymPattern(pattern, argSummary, path.and(clausePath), context)
            if (patternPath === null) return null
            clauseBindings = new Map([...clauseBindings, ...patternBindings])
            clausePath = clausePath.and(patternPath)
        }
        return [clauseBindings, clausePath]
    }
}

export class RecursiveFunctionNode extends FunctionNode implements ApplicableNode {
    static readonly INITIAL_DEEP_LIMIT = 7
    readonly deepLimit: number;

    constructor(clauses: Clause[], closure: Environment, args: (SymbolicNode | Summary<any>)[] = [], deepLimit: number = RecursiveFunctionNode.INITIAL_DEEP_LIMIT) {
        super(clauses, closure, args)
        this.deepLimit = deepLimit
    }

    protected recreate(newArgs: (SymbolicNode | Summary<any>)[]): FunctionNode {
        return new RecursiveFunctionNode(this.clauses, this.closure, newArgs, this.deepLimit)
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

    symbolicApply<T extends string>(context: CustomContext<T>, argument: Summary<T>, path: Bool<T>): Summary<T> {
        throw new NotImplementedError()
        // TODO
    }

    eqZ3To<T extends string>(context: CustomContext<T>, other: SymbolicNode) {
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

    eqZ3To<T extends string>(context: CustomContext<T>, other: SymbolicNode) {
        throw new UnexpectedError()
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

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        throw new UnexpectedError()
    }

    eqZ3To<T extends string>(context: CustomContext<T>, other: SymbolicNode) {
        throw new UnexpectedError()
    }

    toString() {
        return "_"
    }
}

export class IntegerSymbolNode extends SymbolicNode implements FormulaNode {
    readonly formulaName: string;

    constructor(formulaName: string) {
        super();
        this.formulaName = formulaName;
    }

    evaluate(env: Environment): SymbolicNode {
        throw new UnexpectedError()
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        return [{path, value: this}]
    }

    eqZ3To<T extends string>(context: CustomContext<T>, other: SymbolicNode) {
        if (other instanceof IntegerSymbolNode) {
            return context.Int.const(this.formulaName).eq(context.Int.const(other.formulaName))
        }
        if (other instanceof IntegerNode) {
            return context.Int.const(this.formulaName).eq(context.Int.val(other.value))
        }
        throw new UnexpectedError()
    }

    toString() {
        return this.formulaName
    }
}

export class StringSymbolNode extends SymbolicNode {
    readonly formulaName: string;

    constructor(formulaName: string) {
        super();
        this.formulaName = formulaName;
    }

    evaluate(env: Environment): SymbolicNode {
        throw new UnexpectedError()
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        return [{path, value: this}]
    }

    eqZ3To<T extends string>(context: CustomContext<T>, other: SymbolicNode) {
        if (other instanceof StringSymbolNode) {
            return context.VarEqVar(this.formulaName, other.formulaName)
        }
        if (other instanceof StringNode) {
            return context.VarEqString(this.formulaName, other.value)
        }
        throw new UnexpectedError()
    }

    toString() {
        return this.formulaName
    }
}
