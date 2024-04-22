import Parser from "tree-sitter";
import {isDeclaration, parseDeclaration} from "./declaration";
import SML from "tree-sitter-sml";
import {FunctionType} from "../models/types";

export type Constructors = Map<string, FunctionType>

export const parseProgram = (program: string): Constructors => {
    const parser = new Parser();
    parser.setLanguage(SML);

    const parseTree = parser.parse(program)

    // ignore program-level expressions in file, we only care about declarations here
    const declarations = parseTree.rootNode.children.filter(isDeclaration);
    return declarations.map(parseDeclaration)
        .reduce((acc, val) => new Map([...acc, ...val]), new Map<string, FunctionType>())
}

function traverse(node: Parser.SyntaxNode, depth = 0) {
    console.log('\t'.repeat(depth) + node.type + ' : ' + node.text)
    for (const child of node.children) {
        traverse(child, depth + 1)
    }
}