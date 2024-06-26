import {PolymorphicType, TupleType, Type} from "./types";
import {applySymPattern, Pattern, tryMatch} from "../parsers/pattern";
import {Bindings, Constructors, Environment, getTupleConstructorName, InfixData} from "../parsers/program";
import {BuiltinOperationError, UnexpectedError, VariableNotDefinedError} from "./errors";
import {Clause, EnvMutator} from "../parsers/declaration";
import {CustomContext, String} from "./context";
import {
    ApplicableSymBind,
    bindingsToSym,
    Constructor,
    product,
    Summary,
    SymBind,
    SymBindings,
    SymEnvironment,
    zip
} from "./utils";
import {Bool, Expr, Model} from "z3-solver";

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

    abstract summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T>

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        if (other instanceof BottomNode) {
            return context.Bool.val(false)
        }
        throw new UnexpectedError()
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        if (other instanceof BottomNode) {
            return false
        }
        throw new UnexpectedError()
    }

    abstract concretize<T extends string>(model: Model<T>, context: CustomContext<T>): SymbolicNode

    abstract toSMLString(infixData: InfixData): string
}

export interface ApplicableNode {
    apply(argument: SymbolicNode,
          onMatchException?: () => SymbolicNode): SymbolicNode;

    symbolicApply<T extends string>(context: CustomContext<T>, argument: Summary<T>, path: Bool<T>,
                                    onMatchException?: (path: Bool<T>) => Summary<T>): Summary<T>

    evaluate(env: Environment): ApplicableNode

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): [ApplicableSymBind<T>]

    concretize<T extends string>(model: Model<T>, context: CustomContext<T>): ApplicableNode
}

export interface ValuableNode<T> {
    readonly value: T
}

export interface SymValuableNode {
    getZ3Value<T extends string>(context: CustomContext<T>): Expr<T>
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

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        if (other instanceof IntegerNode) {
            return context.Bool.val(this.value === other.value)
        }
        if (other instanceof IntegerSymbolNode) {
            return context.Int.val(this.value).eq(other.getZ3Value(context))
        }
        return super.eqZ3To(other, context)
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>) {
        if (other instanceof IntegerNode) {
            return this.value === other.value
        }
        if (other instanceof IntegerSymbolNode) {
            return this.eqZ3To(other, context!)
        }
        return super.eqTo(other, context)
    }

    toString() {
        return this.value.toString();
    }

    concretize<T extends string>(checkResult: Model<T>) {
        return this
    }

    toSMLString(infixData: InfixData): string {
        return (this.value) < 0 ? `~${Math.abs(this.value)}` : this.value.toString()
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

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        if (other instanceof StringNode) {
            return context.Bool.val(this.value === other.value)
        }
        if (other instanceof StringSymbolNode) {
            return other.valueSupplier(context).eq(context.String.val(this.value))
        }
        return super.eqZ3To(other, context)
    }

    toString() {
        return this.value;
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        if (other instanceof StringNode) {
            return this.value === other.value
        }
        if (other instanceof StringSymbolNode) {
            return this.eqZ3To(other, context!)
        }
        return super.eqTo(other, context)
    }

    concretize<T extends string>(checkResult: Model<T>): SymbolicNode {
        return this;
    }

    toSMLString(infixData: InfixData): string {
        return `"${this.value}"`
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
        if (!value) {
            throw new VariableNotDefinedError(this.name)
        }

        return value
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        // name may be a constructor
        const constructor = this.evaluateConstructor(env.constructors)
        if (constructor) {
            return [{path, value: constructor}]
        }

        const value = env.bindings.get(this.name)
        if (!value) {
            throw new VariableNotDefinedError(this.name)
        }

        return value.map((symBind) => ({path: context.AndBool(path, (symBind.path)), value: symBind.value}))
    }

    toString() {
        return this.name
    }

    private evaluateConstructor(constructors: Constructors): SymbolicNode | null {
        const constructor = constructors.get(this.name)

        if (!constructor) {
            return null
        }

        // special case for constructors with no arguments
        if (constructor.argType instanceof TupleType && constructor.argType.elementTypes.length === 0) {
            return ConstructorNode.create([], this.name)
        }
        return new BuiltInFunctionNode(
            (arg) => ConstructorNode.create([arg], this.name),
            (context, argument, path) => argument.map((symBind) => {
                if (symBind.value instanceof BottomNode) {
                    return {path: context.AndBool(symBind.path, (path)), value: symBind.value}
                }
                return {
                    path: context.AndBool(symBind.path, (path)),
                    value: ConstructorNode.create([symBind.value], this.name)
                }
            })
        )
    }

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        throw new UnexpectedError()
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        throw new UnexpectedError()
    }

    concretize<T extends string>(checkResult: Model<T>): SymbolicNode {
        return this;
    }

    toSMLString(infixData: InfixData): string {
        return this.name;
    }
}

export class ApplicationNode extends SymbolicNode {
    constructor(nodes: SymbolicNode[]) {
        super();
        this.nodes = nodes
    }

    readonly nodes: SymbolicNode[];

    static isInfix<T>(node: (SymbolicNode | T), infixData: InfixData): boolean {
        return node instanceof IdentifierNode && !node.opped && infixData.has(node.name) && infixData.get(node.name)!.infix !== "NonInfix"
    }

    size(): number {
        return this.nodes.reduce((acc, node) => acc + node.size(), 0);
    }

    holesNumber(): number {
        return this.nodes.reduce((acc, node) => acc + node.holesNumber(), 0);
    }

    evaluate(env: Environment): SymbolicNode {
        return this.baseEvaluate<SymbolicNode>(
            env.infixData,
            node => node.evaluate(env),
            (left, infix, right) => (<ApplicableNode><unknown>infix).apply(
                ConstructorNode.create([left, right], getTupleConstructorName(2))),
            (func, arg) => (<ApplicableNode><unknown>func).apply(arg)
        )
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        const applyFunction = (func: Summary<T>, arg: Summary<T>): Summary<T> =>
            func.reduce((acc: Summary<T>, funcSymBind: SymBind<T>): Summary<T> =>
                acc.concat((<ApplicableNode><unknown>funcSymBind.value).symbolicApply(context, arg, funcSymBind.path)), [])
        const applyInfix = (left: Summary<T>, infix: Summary<T>, right: Summary<T>): Summary<T> =>
            applyFunction(infix, product([left, right]).map(([l, r]) => ({
                path: context.AndBool(l.path, r.path),
                value: ConstructorNode.create([l.value, r.value], getTupleConstructorName(2))
            })))
        return this.baseEvaluate<Summary<T>>(
            env.infixData,
            node => node.summarize(context, env, path),
            applyInfix,
            applyFunction
        )
    }

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        throw new UnexpectedError()
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        throw new UnexpectedError()
    }

    private baseEvaluate<T>(infixData: InfixData,
                            evaluateNode: (node: SymbolicNode) => T,
                            applyInfix: (left: T, infix: T, right: T) => T,
                            applyFunction: (func: T, arg: T) => T): T {
        const inputStack = [...this.nodes].reverse()
        const workStack: (SymbolicNode | T)[] = []

        // always have at least one node in input stack for lookahead
        while (inputStack.length !== 0) {
            const node = inputStack.pop()!
            const lookahead = inputStack[inputStack.length - 1]

            // push infix to work stack if no reduce
            if (ApplicationNode.isInfix(node, infixData)) {
                if (workStack.length >= 3) {
                    const leftInfix = infixData.get((<IdentifierNode>workStack[workStack.length - 2]).name)!
                    const rightInfix = infixData.get((<IdentifierNode>node).name)!

                    if (leftInfix.precedence > rightInfix.precedence ||
                        (leftInfix.precedence === rightInfix.precedence && leftInfix.infix === "Left")) {
                        const rightArg = workStack.pop() as T
                        const func = evaluateNode(workStack.pop() as SymbolicNode)
                        const leftArg = workStack.pop() as T
                        workStack.push(applyInfix(leftArg, func, rightArg))
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
                workStack.push(evaluateNode(node))
                continue
            }

            const workTop = workStack[workStack.length - 1]
            // if previous node is not infix, it's applicable and has higher precedence than infix
            if (!ApplicationNode.isInfix(workTop, infixData)) {
                const func = workStack.pop() as T
                workStack.push(applyFunction(func, evaluateNode(node)))
                continue
            }
            // if previous node is infix and the next node is not, we skip
            if (!ApplicationNode.isInfix(lookahead, infixData)) {
                workStack.push(evaluateNode(node))
                continue
            }
            // both lookahead and work top are infix, thus compare precedence
            const leftInfix = infixData.get((<IdentifierNode>workTop).name)!
            const rightInfix = infixData.get((<IdentifierNode>lookahead).name)!

            if (leftInfix.precedence > rightInfix.precedence ||
                (leftInfix.precedence === rightInfix.precedence && leftInfix.infix === "Left")) {
                const func = evaluateNode(workStack.pop() as SymbolicNode)
                const leftArg = workStack.pop() as T
                const rightArg = evaluateNode(node)
                workStack.push(applyInfix(leftArg, func, rightArg))
                continue
            }
            workStack.push(evaluateNode(node))
        }
        while (workStack.length > 1) {
            const rightArg = workStack.pop() as T
            const func = evaluateNode(workStack.pop() as SymbolicNode)
            const leftArg = workStack.pop() as T
            workStack.push(applyInfix(leftArg, func, rightArg))
        }
        return workStack[0] as T
    }

    toString() {
        return `(${this.nodes.join(" ")})`
    }

    concretize<T extends string>(model: Model<T>, context: CustomContext<T>): SymbolicNode {
        return new ApplicationNode(this.nodes.map(node => node.concretize(model, context)));
    }

    toSMLString(infixData: InfixData): string {
        return `(${this.nodes.map(node => node.toSMLString(infixData)).join(" ")})`
    }
}

export class ConstructorNode extends SymbolicNode implements SymValuableNode, ValuableNode<boolean> {
    readonly args: SymbolicNode[];
    readonly name: string

    protected constructor(args: SymbolicNode[], name: string) {
        super();
        this.args = args
        this.name = name
    }

    static create(args: SymbolicNode[], name: string): ConstructorNode | BottomNode {
        const bottom = args.find(arg => arg instanceof BottomNode)
        if (bottom instanceof BottomNode) {
            return bottom
        }
        return new ConstructorNode(args, name)
    }

    size(): number {
        const burden = (this.args.length <= 1) ? 1 : 0
        return burden + this.args.reduce((acc, arg) => acc + arg.size(), 0);
    }

    holesNumber(): number {
        return this.args.reduce((acc, arg) => acc + arg.holesNumber(), 0);
    }

    evaluate(env: Environment): SymbolicNode {
        return ConstructorNode.create(this.args.map(arg => arg.evaluate(env)), this.name)
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        const summaries = this.args.map(arg => arg.summarize(context, env, path))
        return product(summaries).map((binds) => {
            let combined_path = context.Bool.val(true)
            const args: SymbolicNode[] = []
            for (const {path, value} of binds) {
                combined_path = context.AndBool(combined_path, path)
                if (value instanceof BottomNode) {
                    return {path: combined_path, value}
                }
                args.push(value)
            }
            return {path: combined_path, value: ConstructorNode.create(args, this.name)}
        })
    }

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        if (other instanceof ConstructorNode && this.name === other.name) {
            return this.args.reduce((acc, arg, i) => {
                return context.AndBool(acc, arg.eqZ3To(other.args[i], context))
            }, context.Bool.val(true))
        }
        if (other instanceof BooleanSymbolNode) {
            return other.eqZ3To(this, context)
        }
        if (other instanceof ConstructorNode) {
            return context.Bool.val(false)
        }
        return super.eqZ3To(other, context)
    }

    get value() {
        if (this.name === "true") {
            return true
        }
        if (this.name === "false") {
            return false
        }
        throw new UnexpectedError()
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        if (other instanceof ConstructorNode && this.name === other.name) {
            let result: boolean | Bool<T> = true;
            // handle special case for parameterless constructors
            if (this.args.length === 0 && other.args.length === 1) {
                const arg = other.args[0]
                if (arg instanceof ConstructorNode && arg.name === getTupleConstructorName(0)) {
                    return true
                }
            }
            if (this.args.length === 1 && other.args.length === 0) {
                const arg = this.args[0]
                if (arg instanceof ConstructorNode && arg.name === getTupleConstructorName(0)) {
                    return true
                }
            }
            for (let [arg, otherArg] of zip(this.args, other.args)) {
                const subEquality = arg.eqTo<T>(otherArg, context)
                if (subEquality === false) {
                    return false
                }
                if (subEquality === true) {
                    continue
                }
                if (typeof result === "boolean") {
                    result = context!.Bool.val(result as boolean)
                }
                result = context!.AndBool(subEquality, result)
            }
            return result
        }
        if (other instanceof BooleanSymbolNode) {
            return this.eqZ3To(this, context!)
        }
        if (other instanceof ConstructorNode) {
            return false
        }
        return super.eqTo(other, context);
    }

    toString() {
        if (this.args.length === 0) {
            return this.name
        }
        if (this.args.length === 1) {
            return `${this.name}${this.args[0]}`
        }
        return `(${this.args.join(", ")})`
    }

    getZ3Value<T extends string>(context: CustomContext<T>): Bool<T> {
        if (this.name === "true") {
            return context.Bool.val(true)
        }
        if (this.name === "false") {
            return context.Bool.val(false)
        }
        throw new UnexpectedError()
    }

    concretize<T extends string>(model: Model<T>, context: CustomContext<T>): SymbolicNode {
        return ConstructorNode.create(this.args.map(arg => arg.concretize(model, context)), this.name)
    }

    toSMLString(infixData: InfixData): string {
        if (this.args.length === 0) {
            return this.name
        }
        if (infixData.has(this.name) && infixData.get(this.name)!.infix !== "NonInfix") {
            const subTuple = this.args[0] as ConstructorNode
            return `(${subTuple.args[0].toSMLString(infixData)} ${this.name} ${subTuple.args[1].toSMLString(infixData)})`
        }
        if (this.args.length === 1) {
            const arg = this.args[0]
            if (arg instanceof ConstructorNode && arg.name === getTupleConstructorName(0)) {
                return this.name
            }
            return `(${this.name} ${this.args[0].toSMLString(infixData)})`
        }
        return `(${this.args.map(arg => arg.toSMLString(infixData)).join(", ")})`
    }
}

export class BooleanNode extends ConstructorNode {
    constructor(value: boolean) {
        super([], value ? "true" : "false")
    }
}

export class FunctionNode extends SymbolicNode implements ApplicableNode {
    readonly clauses: Clause[];
    readonly closure?: Environment;
    readonly symBinds?: SymBindings<any>;
    readonly args: (SymbolicNode | Summary<any>)[];

    constructor(clauses: Clause[], closure?: Environment, args: (SymbolicNode | Summary<any>)[] = [], symBinds?: SymBindings<any>) {
        super();
        this.clauses = clauses
        this.closure = closure
        this.args = args
        this.symBinds = symBinds
    }

    static generatedFunction(pattern: Pattern, body: SymbolicNode): FunctionNode {
        return new FunctionNode(
            [{
                patterns: [pattern],
                body
            }]
        )
    }

    size(): number {
        return 1 + this.clauses.reduce((acc, clause) => acc + clause.body.size(), 0);
    }

    holesNumber(): number {
        return this.clauses.reduce((acc, clause) => acc + clause.body.holesNumber(), 0);
    }

    apply(argument: SymbolicNode,
          onMatchException?: () => SymbolicNode): SymbolicNode {
        const newArgs = [...this.args, argument] as SymbolicNode[]
        if (this.clauses[0].patterns.length === 1 + this.args.length) {
            for (const clause of this.clauses) {
                const clauseResult = this.applyClause(clause, newArgs)
                if (clauseResult === null) {
                    continue
                }
                const env: Environment = {
                    bindings: new Map([...this.closure!.bindings, ...clauseResult]),
                    constructors: this.closure!.constructors,
                    infixData: this.closure!.infixData
                }
                return clause.body.evaluate(env)
            }
            return onMatchException ? onMatchException() : BottomNode.matchException()
        }
        return this.recreate(newArgs)
    }

    symbolicApply<T extends string>(context: CustomContext<T>, argument: Summary<T>, path: Bool<T>,
                                    onMatchException?: (path: Bool<T>) => Summary<T>): Summary<T> {
        const preSymbolicApplyHook = this.preSymbolicApplyHook<T>(path)
        if (preSymbolicApplyHook !== null) {
            return preSymbolicApplyHook
        }

        const newArgs = [...this.args, argument] as Summary<T>[]
        if (this.clauses[0].patterns.length === 1 + this.args.length) {
            const closureBinds = (this.symBinds === undefined) ? bindingsToSym(this.closure!.bindings, context.Bool.val(true)) : this.symBinds
            let combinedPath = path
            let successfulClauses: [Clause, SymEnvironment<T>, Bool<T>][] = []
            for (const clause of this.clauses) {
                const clauseResult = this.applySymClause(clause, newArgs, combinedPath, context)
                if (clauseResult === null) {
                    continue
                }
                const [matchBindings, matchPath] = clauseResult
                const env: SymEnvironment<T> = {
                    bindings: new Map([...closureBinds!, ...matchBindings]),
                    constructors: this.closure!.constructors,
                    infixData: this.closure!.infixData
                }
                const callPath = context.AndBool(combinedPath, matchPath)
                successfulClauses.push([clause, env, callPath])

                combinedPath = context.AndBool(combinedPath, matchPath.not())
            }
            // pattern matching non-exhaustive
            const summary: Summary<T> = onMatchException ? onMatchException(combinedPath) : [{
                path: combinedPath,
                value: BottomNode.matchException()
            }]

            // successful matching
            successfulClauses.forEach(([clause, env, path]) => {
                this.preSymbolicExecuteHook(env, path, successfulClauses.length)

                summary.push(...clause.body.summarize(context, env, path))
            })
            return summary
        }
        return [{
            path,
            value: this.recreate(newArgs)
        }]
    }

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        throw new UnexpectedError()
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        throw new UnexpectedError()
    }

    evaluate(env: Environment): SymbolicNode & ApplicableNode {
        return new FunctionNode(this.clauses, env, this.args)
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> & [ApplicableSymBind<T>] {
        return [{
            path,
            value: new FunctionNode(
                this.clauses,
                {
                    bindings: new Map<string, SymbolicNode>(),
                    constructors: env.constructors,
                    infixData: env.infixData
                },
                this.args,
                env.bindings)
        }]
    }

    protected preSymbolicApplyHook<T extends string>(path: Bool<T>): Summary<T> | null {
        return null
    }

    protected recreate(newArgs: (SymbolicNode | Summary<any>)[]): FunctionNode {
        return new FunctionNode(this.clauses, this.closure, newArgs, this.symBinds)
    }

    protected preSymbolicExecuteHook<T extends string>(env: SymEnvironment<T>, path: Bool<T>, successfulClauses: number) {
        return
    }

    // null stands for failed match
    private applyClause(clause: Clause, args: SymbolicNode[]): Bindings | null {
        let clauseBindings: Bindings = new Map()
        for (const [pattern, arg] of zip(clause.patterns, args)) {
            const patternResult = tryMatch(() => pattern(arg))
            // pattern is not applicable for this clause
            if (patternResult === null) {
                return null
            }
            clauseBindings = new Map([...clauseBindings, ...patternResult.bindings])
        }
        return clauseBindings
    }

    private applySymClause<T extends string>(clause: Clause, args: Summary<T>[], combinedPath: Bool<T>, context: CustomContext<T>): [SymBindings<T>, Bool<T>] | null {
        let clauseBindings: SymBindings<T> = new Map()
        let clausePath: Bool<T> = context.Bool.val(true)
        for (const [pattern, argSummary] of zip(clause.patterns, args)) {
            const [patternBindings, patternPath] = applySymPattern(pattern, argSummary, context.AndBool(combinedPath, clausePath), context)
            if (patternPath === null) {
                return null
            }
            clauseBindings = new Map([...clauseBindings, ...patternBindings])
            clausePath = context.AndBool(clausePath, patternPath)
        }
        return [clauseBindings, clausePath]
    }

    toString() {
        return "λx." + this.clauses[0].body.toString()
    }

    concretize<T extends string>(model: Model<T>, context: CustomContext<T>): FunctionNode {
        return new FunctionNode(this.clauses.map(({patterns, body}) => ({
            patterns,
            body: body.concretize(model, context)
        })), this.closure, this.args.map(arg => (arg as SymbolicNode).concretize(model, context)))
    }

    toSMLString(infixData: InfixData): string {
        const clause = this.clauses[0]
        const paramName = clause.patterns[0](new IdentifierNode("_")).bindings.keys().next().value as string
        return `fn ${paramName} => ${this.clauses[0].body.toSMLString(infixData)}`
    }
}

export class RecursiveFunctionNode extends FunctionNode implements ApplicableNode {
    static readonly INITIAL_DEEP_LIMIT = 7
    readonly deepLimit: number;
    name: string

    constructor(name: string, clauses: Clause[], closure?: Environment, args: (SymbolicNode | Summary<any>)[] = [], symBinds?: SymBindings<any>, deepLimit: number = RecursiveFunctionNode.INITIAL_DEEP_LIMIT) {
        super(clauses, closure, args, symBinds)
        this.name = name
        this.deepLimit = deepLimit
    }

    evaluate(env: Environment): RecursiveFunctionNode {
        return new RecursiveFunctionNode(this.name, this.clauses, env, this.args, this.symBinds, this.deepLimit)
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): [{
        path: Bool<T>,
        value: RecursiveFunctionNode
    }] {
        return [{
            path,
            value: new RecursiveFunctionNode(
                this.name,
                this.clauses,
                {
                    bindings: new Map<string, SymbolicNode>(),
                    constructors: env.constructors,
                    infixData: env.infixData
                },
                this.args,
                env.bindings)
        }]
    }

    protected preSymbolicApplyHook<T extends string>(path: Bool<T>): Summary<T> | null {
        if (this.deepLimit === 0) {
            return [{path, value: BottomNode.deepLimitException()}]
        }
        return super.preSymbolicApplyHook(path)
    }

    protected recreate(newArgs: (SymbolicNode | Summary<any>)[]): FunctionNode {
        return new RecursiveFunctionNode(this.name, this.clauses, this.closure, newArgs, this.symBinds, this.deepLimit)
    }

    protected preSymbolicExecuteHook<T extends string>(env: SymEnvironment<T>, path: Bool<T>, successfulClauses: number) {
        if (successfulClauses === 1) {
            return
        }
        env.bindings.set(this.name, [{
            path,
            value: new RecursiveFunctionNode(this.name, this.clauses, this.closure, [], this.symBinds, this.deepLimit - 1)
        }])
    }

    toSMLString(infixData: InfixData): string {
        throw new UnexpectedError()
    }
}

export class BuiltInFunctionNode extends SymbolicNode implements ApplicableNode {
    readonly func: (args: SymbolicNode) => SymbolicNode;
    readonly symFunc: <T extends string>(context: CustomContext<T>, argument: Summary<T>, path: Bool<T>) => Summary<T>;

    constructor(func: (args: SymbolicNode) => SymbolicNode,
                symFunc: <T extends string>(context: CustomContext<T>, argument: Summary<T>, path: Bool<T>) => Summary<T>) {
        super();
        this.func = func;
        this.symFunc = symFunc
    }

    apply(argument: SymbolicNode): SymbolicNode {
        return this.func(argument)
    }

    evaluate(env: Environment): SymbolicNode & ApplicableNode {
        return this
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> & [ApplicableSymBind<T>] {
        return [{path, value: this}]
    }

    symbolicApply<T extends string>(context: CustomContext<T>, argument: Summary<T>, path: Bool<T>): Summary<T> {
        return this.symFunc(context, argument, path)
    }

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        throw new UnexpectedError()
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        throw new UnexpectedError()
    }

    concretize<T extends string>(checkResult: Model<T>): BuiltInFunctionNode {
        return this;
    }

    toSMLString(infixData: InfixData): string {
        throw new UnexpectedError()
    }
}

export class BuiltInBinopNode<
    BaseInType,
    InNodeType extends SymbolicNode & ValuableNode<BaseInType>,
    InSymNodeType extends SymbolicNode & SymValuableNode,
    BaseOutputType = BaseInType,
    OutNodeType extends SymbolicNode = InNodeType,
    OutSymNodeType extends SymbolicNode = InSymNodeType
> extends BuiltInFunctionNode {
    constructor(
        func: (a: BaseInType, b: BaseInType) => BaseOutputType,
        symFunc: <T extends string>(a: Expr<T>, b: Expr<T>) => Expr<T>,
        symValue: <T extends string>(value: BaseInType, context: CustomContext<T>) => Expr<T>,
        inNodeType: Constructor<InNodeType>,
        inSymNodeType: Constructor<InSymNodeType>,
        outNodeConstructor: Constructor<OutNodeType, BaseOutputType>,
        outSymNodeConstructor: Constructor<OutSymNodeType>
    ) {
        super((node): SymbolicNode => {
            if (!(node instanceof ConstructorNode) || node.name !== getTupleConstructorName(2)) {
                throw new BuiltinOperationError("Expected tuple with two elements")
            }
            const [a, b] = node.args
            if (a instanceof BottomNode) {
                return a
            }
            if (b instanceof BottomNode) {
                return b
            }
            if (!(a instanceof inNodeType) || !(b instanceof inNodeType)) {
                throw new BuiltinOperationError("expected two arguments of type " + inNodeType.name.toString())
            }
            return new outNodeConstructor(func((<InNodeType>a).value, (<InNodeType>b).value))
        }, <T extends string>(context: CustomContext<T>, argument: Summary<T>, path: Bool<T>): Summary<T> => {
            return argument.reduce((acc: Summary<T>, symBind) => {
                const node = symBind.value
                const nodePath = context.AndBool(symBind.path, path)
                if (!(node instanceof ConstructorNode) || node.name !== getTupleConstructorName(2)) {
                    throw new BuiltinOperationError("Expected tuple with two elements")
                }
                const [a, b] = node.args
                if (a instanceof inNodeType && b instanceof inNodeType) {
                    return acc.concat({
                        path: nodePath,
                        value: new outNodeConstructor(func((<InNodeType>a).value, (<InNodeType>b).value))
                    })
                }
                if (a instanceof BottomNode) {
                    return acc.concat({path: nodePath, value: a})
                }
                if (b instanceof BottomNode) {
                    return acc.concat({path: nodePath, value: b})
                }
                if ((!(a instanceof inSymNodeType) && !(a instanceof inNodeType)) || (!(b instanceof inSymNodeType) && !(b instanceof inNodeType))) {
                    throw new BuiltinOperationError("expected two arguments of type " + inSymNodeType.name.toString() + " or " + inNodeType.name.toString())
                }
                const aExpr = a instanceof inSymNodeType ? (<InSymNodeType>a).getZ3Value(context) : symValue((<InNodeType>a).value, context) as Expr<T>
                const bExpr = b instanceof inSymNodeType ? (<InSymNodeType>b).getZ3Value(context) : symValue((<InNodeType>b).value, context) as Expr<T>

                return acc.concat({
                    path: nodePath,
                    value: new outSymNodeConstructor((_: CustomContext<T>) => symFunc(aExpr, bExpr))
                })
            }, [])
        })
    }
}

export class EqualityFunction extends BuiltInFunctionNode {
    constructor(negate: boolean) {
        super(
            (node) => {
                if (!(node instanceof ConstructorNode) || node.name !== getTupleConstructorName(2)) {
                    throw new BuiltinOperationError("Expected tuple with two elements")
                }
                const [a, b] = node.args
                const subEquality = a.eqTo(b) as boolean
                return new BooleanNode(negate ? !subEquality : subEquality)
            },
            <T extends string>(context: CustomContext<T>, argument: Summary<T>, path: Bool<T>): Summary<T> => {
                return argument.map((symBind): SymBind<T> => {
                    const node = symBind.value
                    const nodePath = context.AndBool(path, symBind.path)
                    if (!(node instanceof ConstructorNode) || node.name !== getTupleConstructorName(2)) {
                        throw new BuiltinOperationError("Expected tuple with two elements")
                    }
                    const [a, b] = node.args
                    const subEquality = a.eqTo(b, context)
                    if (subEquality === false || subEquality === true) {
                        return ({
                            path: nodePath,
                            value: new BooleanNode(negate ? !subEquality : subEquality)
                        })
                    }
                    return ({
                        path: nodePath,
                        value: new BooleanSymbolNode(<T extends string>(_: CustomContext<T>): any => negate ? subEquality.not() : subEquality)
                    })
                })
            }
        );
    }
}

export class AndNode extends SymbolicNode {
    readonly left: SymbolicNode;
    readonly right: SymbolicNode;

    constructor(left: SymbolicNode, right: SymbolicNode) {
        super();
        this.left = left
        this.right = right
    }

    size(): number {
        return 1 + this.left.size() + this.right.size();
    }

    holesNumber(): number {
        return this.left.holesNumber() + this.right.holesNumber();
    }

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        throw new UnexpectedError()
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        throw new UnexpectedError()
    }

    evaluate(env: Environment): SymbolicNode {
        const leftResult = this.left.evaluate(env)
        if (!(leftResult instanceof ConstructorNode)) {
            throw new UnexpectedError()
        }
        if (leftResult.value) {
            return this.right.evaluate(env)
        }
        return leftResult
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        const leftSummary = this.left.summarize(context, env, path)
        const rightSummary = this.right.summarize(context, env, path)
        const summary: Summary<T> = []

        leftSummary.forEach((leftSymBind) => {
            const leftValue = leftSymBind.value
            if (leftValue instanceof BottomNode) {
                summary.push(leftSymBind)
                return
            }
            if (leftValue instanceof ConstructorNode) {
                if (leftValue.value) {
                    summary.push(...rightSummary.map((rightSymBind) => ({
                        path: context.AndBool(leftSymBind.path, rightSymBind.path),
                        value: rightSymBind.value
                    })))
                } else {
                    summary.push(leftSymBind)
                }
                return
            }
            // leftSymBind.value is a BooleanSymbolNode
            if (!(leftValue instanceof BooleanSymbolNode)) {
                throw new UnexpectedError()
            }

            rightSummary.forEach((rightSymBind) => {
                const rightValue = rightSymBind.value
                if (rightValue instanceof BottomNode) {
                    summary.push({
                        path: context.AndBool(context.AndBool(leftSymBind.path, leftValue.getZ3Value(context)), rightSymBind.path),
                        value: rightValue
                    })
                    summary.push({
                        path: context.AndBool(leftSymBind.path, leftValue.getZ3Value(context).not()),
                        value: leftValue
                    })
                    return
                }
                if (rightValue instanceof ConstructorNode || rightValue instanceof BooleanSymbolNode) {
                    summary.push({
                        path: context.AndBool(leftSymBind.path, rightSymBind.path),
                        value: new BooleanSymbolNode((context) => context.AndBool(leftValue.getZ3Value(context), rightValue.getZ3Value(context)))
                    })
                    return
                }
                throw new UnexpectedError()
            })
        })
        return summary
    }

    concretize<T extends string>(model: Model<T>, context: CustomContext<T>): SymbolicNode {
        return new AndNode(this.left.concretize(model, context), this.right.concretize(model, context));
    }

    toSMLString(infixData: InfixData): string {
        return `(${this.left.toSMLString(infixData)} andalso ${this.right.toSMLString(infixData)})`
    }
}

export class OrNode extends SymbolicNode {
    readonly left: SymbolicNode;
    readonly right: SymbolicNode;

    constructor(left: SymbolicNode, right: SymbolicNode) {
        super();
        this.left = left
        this.right = right
    }

    size(): number {
        return 1 + this.left.size() + this.right.size();
    }

    holesNumber(): number {
        return this.left.holesNumber() + this.right.holesNumber();
    }

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        throw new UnexpectedError()
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        throw new UnexpectedError()
    }

    evaluate(env: Environment): SymbolicNode {
        const leftResult = this.left.evaluate(env)
        if (!(leftResult instanceof ConstructorNode)) {
            throw new UnexpectedError()
        }
        if (!leftResult.value) {
            return this.right.evaluate(env)
        }
        return leftResult
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        const leftSummary = this.left.summarize(context, env, path)
        const rightSummary = this.right.summarize(context, env, path)
        const summary: Summary<T> = []

        leftSummary.forEach((leftSymBind) => {
            const leftValue = leftSymBind.value
            if (leftValue instanceof BottomNode) {
                summary.push(leftSymBind)
                return
            }
            if (leftValue instanceof ConstructorNode) {
                if (!leftValue.value) {
                    summary.push(...rightSummary.map((rightSymBind) => ({
                        path: context.AndBool(leftSymBind.path, rightSymBind.path),
                        value: rightSymBind.value
                    })))
                } else {
                    summary.push(leftSymBind)
                }
                return
            }
            // leftSymBind.value is a BooleanSymbolNode
            if (!(leftValue instanceof BooleanSymbolNode)) {
                throw new UnexpectedError()
            }

            rightSummary.forEach((rightSymBind) => {
                const rightValue = rightSymBind.value
                if (rightValue instanceof BottomNode) {
                    summary.push({
                        path: context.AndBool(context.AndBool(leftSymBind.path, leftValue.getZ3Value(context).not()), rightSymBind.path),
                        value: rightValue
                    })
                    summary.push({
                        path: context.AndBool(leftSymBind.path, leftValue.getZ3Value(context)),
                        value: leftValue
                    })
                    return
                }
                if (rightValue instanceof ConstructorNode || rightValue instanceof BooleanSymbolNode) {
                    summary.push({
                        path: context.AndBool(leftSymBind.path, rightSymBind.path),
                        value: new BooleanSymbolNode((context) => context.OrBool(leftValue.getZ3Value(context), rightValue.getZ3Value(context)))
                    })
                    return
                }
                throw new UnexpectedError()
            })
        })
        return summary
    }

    concretize<T extends string>(model: Model<T>, context: CustomContext<T>): SymbolicNode {
        return new OrNode(this.left.concretize(model, context), this.right.concretize(model, context));
    }

    toSMLString(infixData: InfixData): string {
        return `(${this.left.toSMLString(infixData)} orelse ${this.right.toSMLString(infixData)})`
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

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        throw new UnexpectedError()
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        throw new UnexpectedError()
    }

    toString() {
        return "_"
    }

    concretize<T extends string>(checkResult: Model<T>): SymbolicNode {
        throw new UnexpectedError()
    }

    toSMLString(infixData: InfixData): string {
        throw new UnexpectedError()
    }
}

export class IntegerSymbolNode extends SymbolicNode implements SymValuableNode {
    readonly valueSupplier: <T extends string>(context: CustomContext<T>) => Expr<T>;

    constructor(valueSupplier: <T extends string>(context: CustomContext<T>) => Expr<T>) {
        super();
        this.valueSupplier = valueSupplier
    }

    static readonly fromVarName = (varName: string) => new IntegerSymbolNode((context) => context.Int.const(varName))

    evaluate(env: Environment): SymbolicNode {
        throw new UnexpectedError()
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        return [{path, value: this}]
    }

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        if (other instanceof IntegerSymbolNode) {
            return this.getZ3Value(context).eq(other.getZ3Value(context))
        }
        if (other instanceof IntegerNode) {
            return this.getZ3Value(context).eq(context.Int.val(other.value))
        }
        return super.eqZ3To(other, context)
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        if (other instanceof BottomNode) {
            return false
        }
        return this.eqZ3To(other, context!)
    }

    getZ3Value<T extends string>(context: CustomContext<T>): Expr<T> {
        return this.valueSupplier(context)
    }

    toString() {
        return "I"
    }

    concretize<T extends string>(model: Model<T>, context: CustomContext<T>): SymbolicNode {
        const nodeValue = this.valueSupplier(context)
        const value = model.eval(nodeValue).toString()

        if (value === nodeValue.toString()) {
            // the variable doesn't appear in the model, thus its value is arbitrary
            return new IntegerNode(0)
        }
        return new IntegerNode(parseInt(value))
    }

    toSMLString(infixData: InfixData): string {
        throw new UnexpectedError()
    }
}

export class StringSymbolNode extends SymbolicNode implements SymValuableNode {
    readonly valueSupplier: <T extends string>(context: CustomContext<T>) => Expr<T>;

    constructor(valueSupplier: <T extends string>(context: CustomContext<T>) => Expr<T>) {
        super();
        this.valueSupplier = valueSupplier
    }

    static readonly fromVarName = (varName: string) => new StringSymbolNode((context) => context.String.const(varName))

    evaluate(env: Environment): SymbolicNode {
        throw new UnexpectedError()
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        return [{path, value: this}]
    }

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        if (other instanceof StringSymbolNode) {
            return this.getZ3Value(context).eq(other.getZ3Value(context))
        }
        if (other instanceof StringNode) {
            return this.getZ3Value(context).eq(context.String.val(other.value))
        }
        return super.eqZ3To(other, context)
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        if (other instanceof BottomNode) {
            return false
        }
        return this.eqZ3To(other, context!)
    }

    getZ3Value<T extends string>(context: CustomContext<T>): Expr<T> {
        return this.valueSupplier(context)
    }

    toString() {
        return "S"
    }

    concretize<T extends string>(model: Model<T>, context: CustomContext<T>): SymbolicNode {
        const value = (this.valueSupplier(context) as String<T>).getFromModel(model)
        return new StringNode(value.toString())
    }

    toSMLString(infixData: InfixData): string {
        throw new UnexpectedError()
    }
}

export class BooleanSymbolNode extends SymbolicNode implements SymValuableNode {
    readonly valueSupplier: <T extends string>(context: CustomContext<T>) => Bool<T>;

    constructor(valueSupplier: <T extends string>(context: CustomContext<T>) => Bool<T>) {
        super();
        this.valueSupplier = valueSupplier
    }

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        if (other instanceof BooleanSymbolNode || other instanceof ConstructorNode) {
            return context.EqBool(this.getZ3Value(context), other.getZ3Value(context))
        }
        return super.eqZ3To(other, context)
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        if (other instanceof BottomNode) {
            return false
        }
        return this.eqZ3To(other, context!)
    }

    evaluate(env: Environment): SymbolicNode {
        throw new UnexpectedError()
    }

    getZ3Value<T extends string>(context: CustomContext<T>): Bool<T> {
        return this.valueSupplier(context)
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        return [{path, value: this}]
    }

    concretize<T extends string>(model: Model<T>, context: CustomContext<T>): SymbolicNode {
        throw new UnexpectedError()
    }

    toSMLString(infixData: InfixData): string {
        throw new UnexpectedError()
    }
}

export class BottomNode extends SymbolicNode {
    readonly exceptionNode: SymbolicNode

    constructor(exceptionNode: SymbolicNode) {
        super();
        this.exceptionNode = exceptionNode
    }

    static matchException(): BottomNode {
        return new BottomNode(ConstructorNode.create([], "Match"))
    }

    static deepLimitException(): BottomNode {
        return new BottomNode(ConstructorNode.create([], "---DeepLimit---"))
    }

    evaluate(env: Environment): SymbolicNode {
        throw new UnexpectedError()
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        throw new UnexpectedError()
    }

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        return context.Bool.val(false)
    }

    eqTo<T extends string>(other: SymbolicNode, context?: CustomContext<T>): boolean | Bool<T> {
        return false
    }

    concretize<T extends string>(model: Model<T>, context: CustomContext<T>): SymbolicNode {
        throw new UnexpectedError()
    }

    toSMLString(infixData: InfixData): string {
        return "Uncaught exception: " + this.exceptionNode.toSMLString(infixData)
    }
}

export class ExceptionNode extends SymbolicNode {
    readonly exp: SymbolicNode

    constructor(exp: SymbolicNode) {
        super();
        this.exp = exp
    }

    holesNumber(): number {
        return this.exp.holesNumber();
    }

    size(): number {
        return 1 + this.exp.size()
    }

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        throw new UnexpectedError()
    }

    evaluate(env: Environment): SymbolicNode {
        return new BottomNode(this.exp.evaluate(env))
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        return this.exp.summarize(context, env, path).map(({path, value}) => ({
            path,
            value: new BottomNode(value)
        }))
    }

    concretize<T extends string>(model: Model<T>, context: CustomContext<T>): SymbolicNode {
        return new ExceptionNode(this.exp.concretize(model, context))
    }

    toSMLString(infixData: InfixData): string {
        throw new UnexpectedError()
    }
}

export class HandleNode extends SymbolicNode {
    readonly exp: SymbolicNode
    readonly match: ApplicableNode & SymbolicNode

    constructor(exp: SymbolicNode, match: ApplicableNode & SymbolicNode) {
        super();
        this.exp = exp
        this.match = match
    }

    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        throw new UnexpectedError();
    }

    evaluate(env: Environment): SymbolicNode {
        const evalResult = this.exp.evaluate(env)
        if (!(evalResult instanceof BottomNode)) {
            return evalResult
        }
        const evaluatedMatch = this.match.evaluate(env)
        return evaluatedMatch.apply(evalResult.exceptionNode, () => evalResult)
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        const evalResult = this.exp.summarize(context, env, path)
        const bottomValues = evalResult.filter(({value}) => value instanceof BottomNode)
        const exceptionValues = bottomValues.map(
            ({path, value}) => ({path, value: (value as BottomNode).exceptionNode})
        )
        const successfulValues = evalResult.filter(({value}) => !(value instanceof BottomNode))
        const onHandleFail = (matchPath: Bool<T>) => bottomValues.map(({path, value}) => ({
            path: context.AndBool(matchPath, path),
            value
        }))
        const evaluatedMatch = this.match.summarize(context, env, path)[0]
        return [...successfulValues, ...evaluatedMatch.value.symbolicApply(context, exceptionValues, context.Bool.val(true), onHandleFail)]
    }

    concretize<T extends string>(model: Model<T>, context: CustomContext<T>): SymbolicNode {
        return new HandleNode(this.exp.concretize(model, context), this.match.concretize(model, context) as ApplicableNode & SymbolicNode)
    }

    toSMLString(infixData: InfixData): string {
        throw new UnexpectedError()
    }
}

export class SelectorNode extends BuiltInFunctionNode {
    readonly index: number

    constructor(index: number) {
        super((argument) => {
                if (argument instanceof BottomNode) {
                    return argument
                }
                if (!(argument instanceof ConstructorNode)) {
                    throw new UnexpectedError()
                }
                return argument.args[index]
            },
            <T extends string>(context: CustomContext<T>, argument: Summary<T>): Summary<T> => {
                return argument.map(({path, value}) => {
                    if (value instanceof BottomNode) {
                        return {path, value}
                    }
                    if (!(value instanceof ConstructorNode)) {
                        throw new UnexpectedError()
                    }
                    return {path, value: value.args[index]}
                })
            });
        this.index = index
    }

    size(): number {
        return 0
    }

    toString() {
        return `#${this.index}`
    }

    concretize<T extends string>(checkResult: Model<T>): BuiltInFunctionNode {
        return this
    }

    toSMLString(infixData: InfixData): string {
        return `#${this.index}`
    }
}

export class LetNode extends SymbolicNode {
    readonly envMutator: EnvMutator
    readonly exp: SymbolicNode

    constructor(envMutator: EnvMutator, exp: SymbolicNode) {
        super();
        this.envMutator = envMutator
        this.exp = exp
    }


    eqZ3To<T extends string>(other: SymbolicNode, context: CustomContext<T>): Bool<T> {
        throw new UnexpectedError();
    }

    concretize<T extends string>(model: Model<T>, context: CustomContext<T>): SymbolicNode {
        return new LetNode(this.envMutator, this.exp.concretize(model, context))
    }

    evaluate(env: Environment): SymbolicNode {
        const updatedEnv = this.envMutator.base(env)
        return this.exp.evaluate(updatedEnv)
    }

    summarize<T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>): Summary<T> {
        const updatedEnv = this.envMutator.symbolic(context, env, path)
        return this.exp.summarize(context, updatedEnv, path)
    }

    toSMLString(infixData: InfixData): string {
        throw new UnexpectedError()
    }

}