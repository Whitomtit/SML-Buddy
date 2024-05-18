import {ApplicationNode, ConstructorNode, SymbolicNode, VariableNode} from "../models/symbolic_nodes";
import Parser from "tree-sitter";
import {
    APP_EXPRESSION,
    CONSTANT_EXPRESSION,
    EXPRESSIONS,
    OP_EXPRESSION,
    RECORD_UNIT_EXPRESSION,
    SEQUENCE_EXPRESSION,
    TUPLE_EXPRESSION,
    TUPLE_UNIT_EXPRESSION,
    VAR_EXPRESSION
} from "./const";
import {parseConstant} from "./constant";
import {getTupleConstructorName} from "./program";

export const parseExpression = (node: Parser.SyntaxNode): SymbolicNode => {
    switch (node.type) {
        case APP_EXPRESSION:
            return new ApplicationNode(node.children.map(parseExpression))
        case VAR_EXPRESSION:
            return new VariableNode(node.text)
        case OP_EXPRESSION:
            return new VariableNode(node.lastChild.text, true)
        case CONSTANT_EXPRESSION:
            return parseConstant(node.firstChild)
        case RECORD_UNIT_EXPRESSION:
        case TUPLE_UNIT_EXPRESSION:
        case TUPLE_EXPRESSION:
            const subExpressions = node.children.filter(isExpression).map(parseExpression)
            return new ConstructorNode(subExpressions, getTupleConstructorName(subExpressions.length))
        case SEQUENCE_EXPRESSION:
            const seqExpressions = node.children.filter(isExpression).map(parseExpression)
            if (seqExpressions.length === 1)
                return seqExpressions[0]
            // TODO support real sequence expressions
            throw new Error("Unsupported sequence expression")
        default:
            throw new Error("Expression not implemented: " + node.type + " || " + node.text)
    }
}

const isExpression = (node: Parser.SyntaxNode): boolean => {
    return EXPRESSIONS.includes(node.type)
}