import Parser from "tree-sitter";
import {isDeclaration, parseFunctionDeclaration} from "./declaration";
import SML from "tree-sitter-sml";
import {FunctionType, PolymorphicType, TupleType} from "../models/types";
import {SymbolicNode} from "../models/symbolic_nodes";
import {DATATYPE_DECLARATION, FUNCTION_DECLARATION} from "./const";
import {parseDatatypeDeclaration} from "./datatype";

export type InfixType = "Left" | "Right"
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
const b = new PolymorphicType()
const c = new PolymorphicType()

export const parseProgram = (program: string): Environment => {
    const parser = new Parser();
    parser.setLanguage(SML);

    const parseTree = parser.parse(program)

    traverse(parseTree.rootNode)

    const initialBindings: Bindings = new Map<string, SymbolicNode>()
    const initialConstructors: Constructors = new Map<string, FunctionType>([
        [getTupleConstructorName(0), new FunctionType(new TupleType([]), new TupleType([]))],
        [getTupleConstructorName(2), new FunctionType(new TupleType([a, b]), new TupleType([a, b]))],
        [getTupleConstructorName(3), new FunctionType(new TupleType([a, b, c]), new TupleType([a, b, c]))]
    ])
    const initialInfixData: InfixData = new Map<string, Infix>([
        ["*", {infix: "Left", precedence: 7}],
        ["/", {infix: "Left", precedence: 7}],
        ["div", {infix: "Left", precedence: 7}],
        ["mod", {infix: "Left", precedence: 7}],
        ["+", {infix: "Left", precedence: 6}],
        ["-", {infix: "Left", precedence: 6}],
        ["^", {infix: "Left", precedence: 6}],
        ["::", {infix: "Right", precedence: 5}],
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

    const environment: Environment = {
        bindings: initialBindings,
        constructors: initialConstructors,
        infixData: initialInfixData
    }

    // ignore program-level expressions in file, we only care about declarations here
    const declarations = parseTree.rootNode.children.filter(isDeclaration);

    for (const declaration of declarations) {
        switch (declaration.type) {
            case DATATYPE_DECLARATION:
                environment.constructors = new Map([...environment.constructors, ...parseDatatypeDeclaration(declaration)])
                break
            case FUNCTION_DECLARATION:
                environment.bindings = new Map([...environment.bindings, ...parseFunctionDeclaration(declaration, environment)])
                break
            default:
                console.log("Declaration not implemented: " + declaration.type + " || " + declaration.text)
                break
        }
    }
    return environment
}

function traverse(node: Parser.SyntaxNode, depth = 0) {
    console.log('\t'.repeat(depth) + node.type + ' : ' + node.text)
    for (const child of node.children) {
        traverse(child, depth + 1)
    }
}

export const getTupleConstructorName = (arity: number): string => {
    if (arity === 1 || arity < 0) {
        throw new Error("Tuple arity must be not equal 1 or less than zero")
    }
    return `${arity}_tuple`

}