import Parser from 'web-tree-sitter';
import {IntegerNode, StringNode, SymbolicNode} from "../models/symbolic_nodes";
import {INT_CONSTANT, STRING_CONSTANT} from "./const";
import {NotImplementedError} from "../models/errors";

export const parseConstant = (node: Parser.SyntaxNode): SymbolicNode => {
    switch (node.type) {
        case INT_CONSTANT:
            return new IntegerNode(parseInt(node.text.replace("~", "-")))
        case STRING_CONSTANT:
            return new StringNode(node.text.slice(1, -1))
        default:
            throw new NotImplementedError("Unsupported constant type: " + node.type)
    }
}