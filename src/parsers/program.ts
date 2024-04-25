import Parser from "tree-sitter";
import {isDeclaration} from "./declaration";
import SML from "tree-sitter-sml";
import {FunctionType, PolymorphicType, TupleType} from "../models/types";
import {SymbolicNode} from "../models/symbolic_nodes";
import {DATATYPE_DECLARATION, VALUE_DECLARATION} from "./const";
import {parseDatatypeDeclaration} from "./datatype";

export type Constructors = Map<string, FunctionType>
export type Environment = Map<string, SymbolicNode>

const a = new PolymorphicType()
const b = new PolymorphicType()
const c = new PolymorphicType()

export const parseProgram = (program: string): Constructors => {
    const parser = new Parser();
    parser.setLanguage(SML);

    const parseTree = parser.parse(program)

    traverse(parseTree.rootNode)

    const env = new Map<string, SymbolicNode>()
    let constructors = new Map<string, FunctionType>([
        [tupleConstructorName(0), new FunctionType(new TupleType([]), new TupleType([]))],
        [tupleConstructorName(2), new FunctionType(new TupleType([a, b]), new TupleType([a, b]))],
        [tupleConstructorName(3), new FunctionType(new TupleType([a, b, c]), new TupleType([a, b, c]))]
    ])

    // ignore program-level expressions in file, we only care about declarations here
    const declarations = parseTree.rootNode.children.filter(isDeclaration);

    for (const declaration of declarations) {
        switch (declaration.type) {
            case DATATYPE_DECLARATION:
                constructors = new Map([...constructors, ...parseDatatypeDeclaration(declaration)])
                break
            case VALUE_DECLARATION:
                // constructors = new Map([...constructors, ...parseValueDeclaration(declaration, env)])
                break
            default:
                console.log("Declaration not implemented: " + declaration.type + " || " + declaration.text)
                break
        }
    }
    return constructors
}

function traverse(node: Parser.SyntaxNode, depth = 0) {
    console.log('\t'.repeat(depth) + node.type + ' : ' + node.text)
    for (const child of node.children) {
        traverse(child, depth + 1)
    }
}

export const tupleConstructorName = (arity: number): string => {
    if (arity === 1 || arity < 0) {
        throw new Error("Tuple arity must be not equal 1 or less than zero")
    }
    return `${arity}_tuple`

}