import {ApplicationNode, ConstructorNode, IdentifierNode, SymbolicNode} from "../models/symbolic_nodes";
import Parser from "tree-sitter";
import {
    APP_EXPRESSION,
    CONSTANT_EXPRESSION,
    CONSTRAINT_EXPRESSION,
    EXPRESSIONS,
    LIST_EXPRESSION,
    OP_EXPRESSION,
    RECORD_UNIT_EXPRESSION,
    SEQUENCE_EXPRESSION,
    TUPLE_EXPRESSION,
    TUPLE_UNIT_EXPRESSION,
    VAR_EXPRESSION
} from "./const";
import {parseConstant} from "./constant";
import {getTupleConstructorName} from "./program";
import {NotImplementedError} from "../models/errors";
import {LIST_CONSTRUCTOR_NAME, LIST_NIL_NAME} from "../models/utils";

export const parseExpression = (node: Parser.SyntaxNode): SymbolicNode => {
    switch (node.type) {
        case APP_EXPRESSION:
            return new ApplicationNode(node.children.map(parseExpression))
        case VAR_EXPRESSION:
            return new IdentifierNode(node.text)
        case OP_EXPRESSION:
            return new IdentifierNode(node.lastChild.text, true)
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
            throw new NotImplementedError()
        case LIST_EXPRESSION:
            const listExpressions = node.children.filter(isExpression).map(parseExpression)
            return listExpressions.reduceRight(
                (acc, expr) => new ConstructorNode(
                    [new ConstructorNode([expr, acc], getTupleConstructorName(2))],
                    LIST_CONSTRUCTOR_NAME),
                new ConstructorNode([], LIST_NIL_NAME))
        case CONSTRAINT_EXPRESSION:
            return parseExpression(node.firstChild)
        default:
            throw new NotImplementedError("Expression not implemented: " + node.type + " || " + node.text)
    }
}

const isExpression = (node: Parser.SyntaxNode): boolean => {
    return EXPRESSIONS.includes(node.type)
}