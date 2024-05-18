import Parser from "tree-sitter";
import {IntegerNode, StringNode, SymbolicNode} from "../models/symbolic_nodes";
import {INT_CONSTANT, STRING_CONSTANT} from "./const";
import {NotImplementedError} from "../models/errors";

export const parseConstant = (node: Parser.SyntaxNode): SymbolicNode => {
    switch (node.type) {
        case INT_CONSTANT:
            return new IntegerNode(parseInt(node.text))
        case STRING_CONSTANT:
            return new StringNode(node.text)
        default:
            throw new NotImplementedError("Unsupported constant type: " + node.type)
    }
}