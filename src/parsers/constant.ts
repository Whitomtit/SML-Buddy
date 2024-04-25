import Parser from "tree-sitter";
import {IntegerNode, StringNode, SymbolicNode} from "../models/symbolic_nodes";
import {INT_CONSTANT, STRING_CONSTANT} from "./const";

export const parseConstant = (node: Parser.SyntaxNode): SymbolicNode => {
    switch (node.type) {
        case INT_CONSTANT:
            return new IntegerNode(parseInt(node.text))
        case STRING_CONSTANT:
            return new StringNode(node.text)
        default:
            throw new Error("Unsupported constant type: " + node.type)
    }
}