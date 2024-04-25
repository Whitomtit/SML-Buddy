import Parser from "tree-sitter";
import {DECLARATIONS, REC} from "./const";
import {SymbolicNode} from "../models/symbolic_nodes";
import {Constructors} from "./program";

export const parseValueDeclaration = (node: Parser.SyntaxNode,
                                      env: Map<string, SymbolicNode>, constructors: Constructors) => {
    if (node.children.map(n => n.type).includes(REC)) {
        // TODO handle rec function
    }


}

const parseValueBind = (node: Parser.SyntaxNode, env: Map<string, SymbolicNode>, constructors: Constructors) => {
    // TODO implement
}

export const isDeclaration = (node: Parser.SyntaxNode) => {
    return DECLARATIONS.includes(node.type)
}