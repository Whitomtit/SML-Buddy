import {
    AndNode,
    ApplicableNode,
    ApplicationNode,
    ConstructorNode,
    ExceptionNode,
    FunctionNode,
    HandleNode,
    IdentifierNode,
    OrNode,
    SymbolicNode
} from "../models/symbolic_nodes";
import Parser from "tree-sitter";
import {
    ANDALSO_EXPRESSION,
    APP_EXPRESSION,
    CASE_EXPRESSION,
    CONSTANT_EXPRESSION,
    CONSTRAINT_EXPRESSION,
    EXPRESSIONS,
    FN_EXPRESSION,
    HANDLE_EXPRESSION,
    IF_EXPRESSION,
    LIST_EXPRESSION,
    OP_EXPRESSION,
    ORELSE_EXPRESSION,
    RAISE_EXPRESSION,
    RECORD_UNIT_EXPRESSION,
    RULE,
    SEQUENCE_EXPRESSION,
    TUPLE_EXPRESSION,
    TUPLE_UNIT_EXPRESSION,
    VAR_EXPRESSION
} from "./const";
import {parseConstant} from "./constant";
import {Environment, getTupleConstructorName} from "./program";
import {NotImplementedError} from "../models/errors";
import {LIST_CONSTRUCTOR_NAME, LIST_NIL_NAME} from "../models/utils";
import {Clause} from "./declaration";
import {parameterlessConstructorPattern, parsePattern} from "./pattern";

export const parseExpression = (node: Parser.SyntaxNode, env: Environment): SymbolicNode => {
    switch (node.type) {
        case APP_EXPRESSION:
            return new ApplicationNode(node.children.map((child) => parseExpression(child, env)))
        case VAR_EXPRESSION:
            return new IdentifierNode(node.text)
        case OP_EXPRESSION:
            return new IdentifierNode(node.lastChild.text, true)
        case CONSTANT_EXPRESSION:
            return parseConstant(node.firstChild)
        case RECORD_UNIT_EXPRESSION:
        case TUPLE_UNIT_EXPRESSION:
        case TUPLE_EXPRESSION:
            const subExpressions = node.children.filter(isExpression).map((child) => parseExpression(child, env))
            return new ConstructorNode(subExpressions, getTupleConstructorName(subExpressions.length))
        case SEQUENCE_EXPRESSION:
            const seqExpressions = node.children.filter(isExpression).map((child) => parseExpression(child, env))
            if (seqExpressions.length === 1)
                return seqExpressions[0]
            throw new NotImplementedError("Sequence expressions not implemented")
        case LIST_EXPRESSION:
            const listExpressions = node.children.filter(isExpression).map((child) => parseExpression(child, env))
            return listExpressions.reduceRight(
                (acc, expr) => new ConstructorNode(
                    [new ConstructorNode([expr, acc], getTupleConstructorName(2))],
                    LIST_CONSTRUCTOR_NAME),
                new ConstructorNode([], LIST_NIL_NAME))
        case CONSTRAINT_EXPRESSION:
            return parseExpression(node.firstChild, env)
        case FN_EXPRESSION:
            return parseMatch(node.lastChild, env)
        case CASE_EXPRESSION:
            return new ApplicationNode([parseMatch(node.lastChild, env), parseExpression(node.children[1], env)])
        case ANDALSO_EXPRESSION:
            return new AndNode(parseExpression(node.firstChild, env), parseExpression(node.lastChild, env))
        case ORELSE_EXPRESSION:
            return new OrNode(parseExpression(node.firstChild, env), parseExpression(node.lastChild, env))
        case IF_EXPRESSION:
            const [conditionExp, trueCaseExp, falseCaseExp] = node.children.filter(isExpression).map((child) => parseExpression(child, env))
            return new ApplicationNode([
                new FunctionNode([
                    {
                        patterns: [parameterlessConstructorPattern("true")],
                        body: trueCaseExp
                    },
                    {
                        patterns: [parameterlessConstructorPattern("false")],
                        body: falseCaseExp
                    }
                ], null),
                conditionExp
            ])
        case RAISE_EXPRESSION:
            return new ExceptionNode(parseExpression(node.lastChild, env))
        case HANDLE_EXPRESSION:
            return new HandleNode(parseExpression(node.firstChild, env), parseMatch(node.lastChild, env))
        default:
            throw new NotImplementedError("Expression not implemented: " + node.type + " || " + node.text)
    }
}

const parseMatch = (node: Parser.SyntaxNode, env: Environment): ApplicableNode & SymbolicNode => {
    const clauses = node.children.filter((child) => child.type === RULE).map((child) => parseRule(child, env))
    // closure will be filled in evaluation
    return new FunctionNode(clauses, null)

}

const parseRule = (node: Parser.SyntaxNode, env: Environment): Clause => {
    const pattern = parsePattern(node.firstChild, env)
    const body = parseExpression(node.lastChild, env)
    return {patterns: [pattern], body}
}

const isExpression = (node: Parser.SyntaxNode): boolean => {
    return EXPRESSIONS.includes(node.type)
}