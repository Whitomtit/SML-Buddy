import {
    AndNode,
    ApplicableNode,
    ApplicationNode,
    ConstructorNode,
    ExceptionNode,
    FunctionNode,
    HandleNode,
    IdentifierNode,
    LetNode,
    OrNode,
    SelectorNode,
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
    LET_EXPRESSION,
    LIST_EXPRESSION,
    OP_EXPRESSION,
    ORELSE_EXPRESSION,
    RAISE_EXPRESSION,
    RECORD_UNIT_EXPRESSION,
    RULE,
    SELECTOR_EXPRESSION,
    SEQUENCE_EXPRESSION,
    TUPLE_EXPRESSION,
    TUPLE_UNIT_EXPRESSION,
    VAR_EXPRESSION
} from "./const";
import {parseConstant} from "./constant";
import {Constructors, Environment, getTupleConstructorName, InfixData} from "./program";
import {NotImplementedError} from "../models/errors";
import {LIST_CONSTRUCTOR_NAME, LIST_NIL_NAME} from "../models/utils";
import {Clause, EnvMutator, isDeclaration, mergeEnvMutators, parseDeclaration} from "./declaration";
import {parameterlessConstructorPattern, parsePattern} from "./pattern";

export const parseExpression = (node: Parser.SyntaxNode, constructors: Constructors, infixData: InfixData): SymbolicNode => {
    switch (node.type) {
        case APP_EXPRESSION:
            return new ApplicationNode(node.children.map((child) => parseExpression(child, constructors, infixData)))
        case VAR_EXPRESSION:
            return new IdentifierNode(node.text)
        case OP_EXPRESSION:
            return new IdentifierNode(node.lastChild.text, true)
        case CONSTANT_EXPRESSION:
            return parseConstant(node.firstChild)
        case RECORD_UNIT_EXPRESSION:
        case TUPLE_UNIT_EXPRESSION:
        case TUPLE_EXPRESSION:
            const subExpressions = node.children.filter(isExpression).map((child) => parseExpression(child, constructors, infixData))
            return new ConstructorNode(subExpressions, getTupleConstructorName(subExpressions.length))
        case SEQUENCE_EXPRESSION:
            const seqExpressions = node.children.filter(isExpression).map((child) => parseExpression(child, constructors, infixData))
            return createSequenceExpression(seqExpressions)
        case LIST_EXPRESSION:
            const listExpressions = node.children.filter(isExpression).map((child) => parseExpression(child, constructors, infixData))
            return listExpressions.reduceRight(
                (acc, expr) => new ConstructorNode(
                    [new ConstructorNode([expr, acc], getTupleConstructorName(2))],
                    LIST_CONSTRUCTOR_NAME),
                new ConstructorNode([], LIST_NIL_NAME))
        case CONSTRAINT_EXPRESSION:
            return parseExpression(node.firstChild, constructors, infixData)
        case FN_EXPRESSION:
            return parseMatch(node.lastChild, constructors, infixData)
        case CASE_EXPRESSION:
            return new ApplicationNode([parseMatch(node.lastChild, constructors, infixData), parseExpression(node.children[1], constructors, infixData)])
        case ANDALSO_EXPRESSION:
            return new AndNode(parseExpression(node.firstChild, constructors, infixData), parseExpression(node.lastChild, constructors, infixData))
        case ORELSE_EXPRESSION:
            return new OrNode(parseExpression(node.firstChild, constructors, infixData), parseExpression(node.lastChild, constructors, infixData))
        case IF_EXPRESSION:
            const [conditionExp, trueCaseExp, falseCaseExp] = node.children.filter(isExpression).map((child) => parseExpression(child, constructors, infixData))
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
            return new ExceptionNode(parseExpression(node.lastChild, constructors, infixData))
        case HANDLE_EXPRESSION:
            return new HandleNode(parseExpression(node.firstChild, constructors, infixData), parseMatch(node.lastChild, constructors, infixData))
        case SELECTOR_EXPRESSION:
            const index = parseInt(node.lastChild.text)
            return new SelectorNode(index - 1)
        case LET_EXPRESSION:
            let subEnv: Environment = {bindings: new Map(), constructors, infixData}
            const declarations = node.children.filter(isDeclaration)
            const envMutators: EnvMutator[] = []
            for (const declaration of declarations) {
                const envMutator = parseDeclaration(declaration, subEnv.constructors, subEnv.infixData)
                if (envMutator.bindless) {
                    subEnv = envMutator.base(subEnv)
                } else {
                    envMutators.push(envMutator)
                }
            }
            const envMutator = mergeEnvMutators(envMutators)
            const expression = createSequenceExpression(node.children.filter(isExpression).map((child) => parseExpression(child, subEnv.constructors, subEnv.infixData)))
            return new LetNode(envMutator, expression)
        default:
            throw new NotImplementedError("Expression not implemented: " + node.type + " || " + node.text)
    }
}

const createSequenceExpression = (expressions: SymbolicNode[]): SymbolicNode => {
    if (expressions.length === 1)
        return expressions[0]
    throw new NotImplementedError("Sequence expressions not implemented")
}

const parseMatch = (node: Parser.SyntaxNode, constructors: Constructors, infixData: InfixData): ApplicableNode & SymbolicNode => {
    const clauses = node.children.filter((child) => child.type === RULE).map((child) => parseRule(child, constructors, infixData))
    // closure will be filled in evaluation
    return new FunctionNode(clauses)

}

const parseRule = (node: Parser.SyntaxNode, constructors: Constructors, infixData: InfixData): Clause => {
    const pattern = parsePattern(node.firstChild, constructors, infixData)
    const body = parseExpression(node.lastChild, constructors, infixData)
    return {patterns: [pattern], body}
}

const isExpression = (node: Parser.SyntaxNode): boolean => {
    return EXPRESSIONS.includes(node.type)
}