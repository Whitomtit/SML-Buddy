import Parser from "tree-sitter";
import {isDeclaration, parseDeclaration} from "./declaration";
import SML from "tree-sitter-sml";
import {CompoundType, FunctionType, PolymorphicType, PrimitiveType, TupleType} from "../models/types";
import {
    BooleanNode,
    BooleanSymbolNode,
    BottomNode,
    BuiltInBinopNode,
    BuiltInFunctionNode,
    ConstructorNode,
    EqualityFunction,
    IntegerNode,
    IntegerSymbolNode,
    StringNode,
    StringSymbolNode,
    SymbolicNode
} from "../models/symbolic_nodes";
import {UnexpectedError} from "../models/errors";
import {Arith, Bool, Expr} from "z3-solver";
import {LIST_CONSTRUCTOR_NAME, LIST_NIL_NAME, Summary} from "../models/utils";
import {CustomContext, String as Z3String} from "../models/context";

export type InfixType = "Left" | "Right" | "NonInfix"
export type Infix = {
    infix: InfixType
    precedence: number
}

export type Constructors = Map<string, FunctionType>
export type InfixData = Map<string, Infix>
export type Bindings = Map<string, SymbolicNode>

export type Environment = {
    bindings: Bindings
    constructors: Constructors
    infixData: InfixData
}

const a = new PolymorphicType()

export const list = new PrimitiveType("list")

export const parseProgram = (program: string): Environment => {
    const parser = new Parser();
    parser.setLanguage(SML);

    const parseTree = parser.parse(program)

    const notFunction = (node): SymbolicNode => {
        if (node instanceof BottomNode) {
            return node
        }
        if (node instanceof ConstructorNode) {
            if (node.name === "true") {
                return new BooleanNode(false)
            }
            if (node.name === "false") {
                return new BooleanNode(true)
            }
        }

        throw new UnexpectedError()
    }
    const unaryMinusFunction = (node): SymbolicNode => {
        if (node instanceof BottomNode) {
            return node
        }
        if (node instanceof IntegerNode) {
            return new IntegerNode(-node.value)
        }
        throw new UnexpectedError()
    }
    const initialBindings: Bindings = new Map([
        ["+", new BuiltInBinopNode<number, IntegerNode, IntegerSymbolNode>(
            (a, b) => a + b,
            <T extends string>(a: Expr<T>, b: Expr<T>) => (a as Arith<T>).add((b as Arith<T>)),
            <T extends string>(a, context) => context.Int.val(a),
            IntegerNode, IntegerSymbolNode, IntegerNode, IntegerSymbolNode)],
        ["-", new BuiltInBinopNode<number, IntegerNode, IntegerSymbolNode>(
            (a, b) => a - b,
            <T extends string>(a: Expr<T>, b: Expr<T>) => (a as Arith<T>).sub((b as Arith<T>)),
            <T extends string>(a, context) => context.Int.val(a),
            IntegerNode, IntegerSymbolNode, IntegerNode, IntegerSymbolNode)],
        ["*", new BuiltInBinopNode<number, IntegerNode, IntegerSymbolNode>(
            (a, b) => a * b,
            <T extends string>(a: Expr<T>, b: Expr<T>) => (a as Arith<T>).mul((b as Arith<T>)),
            <T extends string>(a, context) => context.Int.val(a),
            IntegerNode, IntegerSymbolNode, IntegerNode, IntegerSymbolNode)],
        ["div", new BuiltInBinopNode<number, IntegerNode, IntegerSymbolNode>(
            (a, b) => Math.floor(a / b),
            <T extends string>(a: Expr<T>, b: Expr<T>) => (a as Arith<T>).div((b as Arith<T>)),
            <T extends string>(a, context) => context.Int.val(a),
            IntegerNode, IntegerSymbolNode, IntegerNode, IntegerSymbolNode)],
        ["mod", new BuiltInBinopNode<number, IntegerNode, IntegerSymbolNode>(
            (a, b) => a % b,
            <T extends string>(a: Expr<T>, b: Expr<T>) => (a as Arith<T>).mod((b as Arith<T>)),
            <T extends string>(a, context) => context.Int.val(a),
            IntegerNode, IntegerSymbolNode, IntegerNode, IntegerSymbolNode)],
        ["^", new BuiltInBinopNode<string, StringNode, StringSymbolNode>(
            (a, b) => a.concat(b),
            <T extends string>(a: Expr<T>, b: Expr<T>) => (a as Z3String<T>).concat((b as Z3String<T>)),
            <T extends string>(a, context) => context.String.val(a),
            StringNode, StringSymbolNode, StringNode, StringSymbolNode)],
        // TODO support string comparison
        [">", new BuiltInBinopNode<number, IntegerNode, IntegerSymbolNode, boolean, ConstructorNode, BooleanSymbolNode>(
            (a, b) => a > b,
            <T extends string>(a: Expr<T>, b: Expr<T>) => (a as Arith<T>).gt((b as Arith<T>)),
            <T extends string>(a, context) => context.Int.val(a),
            IntegerNode, IntegerSymbolNode, BooleanNode, BooleanSymbolNode)],
        [">=", new BuiltInBinopNode<number, IntegerNode, IntegerSymbolNode, boolean, ConstructorNode, BooleanSymbolNode>(
            (a, b) => a >= b,
            <T extends string>(a: Expr<T>, b: Expr<T>) => (a as Arith<T>).ge((b as Arith<T>)),
            <T extends string>(a, context) => context.Int.val(a),
            IntegerNode, IntegerSymbolNode, BooleanNode, BooleanSymbolNode)],
        ["<", new BuiltInBinopNode<number, IntegerNode, IntegerSymbolNode, boolean, ConstructorNode, BooleanSymbolNode>(
            (a, b) => a < b,
            <T extends string>(a: Expr<T>, b: Expr<T>) => (a as Arith<T>).lt((b as Arith<T>)),
            <T extends string>(a, context) => context.Int.val(a),
            IntegerNode, IntegerSymbolNode, BooleanNode, BooleanSymbolNode)],
        ["<=", new BuiltInBinopNode<number, IntegerNode, IntegerSymbolNode, boolean, ConstructorNode, BooleanSymbolNode>(
            (a, b) => a <= b,
            <T extends string>(a: Expr<T>, b: Expr<T>) => (a as Arith<T>).le((b as Arith<T>)),
            <T extends string>(a, context) => context.Int.val(a),
            IntegerNode, IntegerSymbolNode, BooleanNode, BooleanSymbolNode)],
        ["=", new EqualityFunction(false)],
        ["<>", new EqualityFunction(true)],
        ["not", new BuiltInFunctionNode(
            notFunction,
            <T extends string>(context: CustomContext<T>, argument: Summary<T>, _: Bool<T>): Summary<T> => {
                return argument.map(({path, value}) => {
                    let node: SymbolicNode;
                    if (value instanceof BooleanSymbolNode) {
                        node = new BooleanSymbolNode(() => value.getZ3Value(context).not() as Bool<any>)
                    } else {
                        node = notFunction(value)
                    }
                    return {path, value: node}
                })
            })],
        ["~", new BuiltInFunctionNode(
            unaryMinusFunction,
            <T extends string>(context: CustomContext<T>, argument: Summary<T>, _: Bool<T>): Summary<T> => {
                return argument.map(({path, value}) => {
                    let node: SymbolicNode;
                    if (value instanceof IntegerSymbolNode) {
                        node = new IntegerSymbolNode(() => (value.getZ3Value(context) as Arith<any>).neg())
                    } else {
                        node = unaryMinusFunction(value)
                    }
                    return {path, value: node}
                })
            })]
    ])
    const initialConstructors: Constructors = new Map([
        [LIST_CONSTRUCTOR_NAME, new FunctionType(new TupleType([a, new CompoundType(a, list)]), new CompoundType(a, list))],
        [LIST_NIL_NAME, new FunctionType(new TupleType([]), new CompoundType(a, list))],
        ["false", new FunctionType(new TupleType([]), PrimitiveType.BOOL)],
        ["true", new FunctionType(new TupleType([]), PrimitiveType.BOOL)]
    ])
    const initialInfixData: InfixData = new Map<string, Infix>([
        ["*", {infix: "Left", precedence: 7}],
        ["/", {infix: "Left", precedence: 7}],
        ["div", {infix: "Left", precedence: 7}],
        ["mod", {infix: "Left", precedence: 7}],
        ["+", {infix: "Left", precedence: 6}],
        ["-", {infix: "Left", precedence: 6}],
        ["^", {infix: "Left", precedence: 6}],
        [LIST_CONSTRUCTOR_NAME, {infix: "Right", precedence: 5}],
        ["@", {infix: "Right", precedence: 5}],
        ["=", {infix: "Left", precedence: 4}],
        ["<>", {infix: "Left", precedence: 4}],
        [">", {infix: "Left", precedence: 4}],
        [">=", {infix: "Left", precedence: 4}],
        ["<", {infix: "Left", precedence: 4}],
        ["<=", {infix: "Left", precedence: 4}],
        ["o", {infix: "Left", precedence: 3}],
        [":=", {infix: "Left", precedence: 3}],
        ["before", {infix: "Left", precedence: 0}]
    ])

    const env: Environment = {
        bindings: initialBindings,
        constructors: initialConstructors,
        infixData: initialInfixData
    }

    // ignore program-level expressions in file, we only care about declarations here
    const declarations = parseTree.rootNode.children.filter(isDeclaration);

    return declarations
        .reduce((acc, declaration) => parseDeclaration(declaration, acc.constructors, acc.infixData).base(acc), env)
}

export const getTupleConstructorName = (arity: number): string => {
    if (arity === 1 || arity < 0) {
        throw new UnexpectedError()
    }
    return `${arity}_tuple`

}