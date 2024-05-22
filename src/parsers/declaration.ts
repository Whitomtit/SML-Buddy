import Parser from "tree-sitter";
import {
    CLAUSE,
    DECLARATIONS,
    EXCEPTION_BIND,
    FUNCTION_BIND,
    INT_CONSTANT,
    LEFT_INFIX,
    NON_INFIX,
    OP,
    PARAMETRIC_EXCEPTION,
    REDEFINED_EXCEPTION,
    RIGHT_INFIX,
    VALUE_BIND
} from "./const";
import {Bindings, Constructors, Environment, Infix, InfixData, InfixType} from "./program";
import {IntegerNode, RecursiveFunctionNode, SymbolicNode} from "../models/symbolic_nodes";
import {isPattern, parsePattern, Pattern} from "./pattern";
import {parseExpression} from "./expression";
import {UnexpectedError} from "../models/errors";
import {parseConstant} from "./constant";
import {parseType} from "./type";
import {FunctionType, PrimitiveType, TupleType, Type} from "../models/types";

export const isDeclaration = (node: Parser.SyntaxNode): boolean => {
    return DECLARATIONS.includes(node.type)
}

export const parseFunctionDeclaration = (node: Parser.SyntaxNode, env: Environment): Bindings => {
    return node.children
        .filter((child) => child.type === FUNCTION_BIND)
        .map((child) => parseFunctionBind(child, env))
        .reduce((acc, val) => new Map([...acc, ...val]), new Map<string, SymbolicNode>())
}

const parseFunctionBind = (node: Parser.SyntaxNode, env: Environment): Bindings => {
    //TODO support for infix function declarations
    const clauses = node.children.filter((child) => child.type === CLAUSE).map((child) => parseClause(child, env))
    // drop function name
    const namePattern = clauses[0].patterns[0]
    clauses.forEach((clause) => clause.patterns.shift())
    const functionNode = new RecursiveFunctionNode(null, clauses, {
        bindings: new Map(env.bindings),
        constructors: new Map(env.constructors),
        infixData: new Map(env.infixData)
    })
    const nameBind = namePattern(functionNode)
    functionNode.closure.bindings = new Map([...functionNode.closure.bindings, ...nameBind.bindings])
    functionNode.name = nameBind.bindings.keys().next().value
    return nameBind.bindings
}

export const parseValueDeclaration = (node: Parser.SyntaxNode, env: Environment): Bindings => {
    return node.children
        .filter((child) => child.type === VALUE_BIND)
        .map((child) => parseValueBind(child, env))
        .reduce((acc, val) => new Map([...acc, ...val]), new Map<string, SymbolicNode>())
}

const parseValueBind = (node: Parser.SyntaxNode, env: Environment): Bindings => {
    const pattern = parsePattern(node.firstChild, env)
    const exp = parseExpression(node.lastChild, env)
    return pattern(exp.evaluate(env)).bindings
}

export const parseInfixDeclaration = (node: Parser.SyntaxNode): InfixData => {
    const infixType = parseInfixType(node.firstChild)
    let firstIdChild = 1
    let precedence = -1
    if (node.children[1].type === INT_CONSTANT) {
        firstIdChild = 2
        precedence = (parseConstant(node.children[1]) as IntegerNode).value
    }
    const infix: Infix = {
        infix: infixType,
        precedence: precedence
    }
    return node.children.slice(firstIdChild).reduce(
        (acc: InfixData, idNode): InfixData => acc.set(idNode.text, infix),
        new Map<string, Infix>()
    )
}

const parseInfixType = (node: Parser.SyntaxNode): InfixType => {
    switch (node.type) {
        case NON_INFIX:
            return "NonInfix"
        case LEFT_INFIX:
            return "Left"
        case RIGHT_INFIX:
            return "Right"
        default:
            throw new UnexpectedError()
    }
}

export const parseException = (node: Parser.SyntaxNode, env: Environment): Constructors => {
    const result: Constructors = new Map<string, FunctionType>()
    node.children
        .filter((child) => child.type === EXCEPTION_BIND)
        .map((child) => parseExceptionBind(child, env))
        .forEach(([constructorName, constructorFunc]) => result.set(constructorName, constructorFunc))
    return result
}

const parseExceptionBind = (node: Parser.SyntaxNode, env: Environment): [string, FunctionType] => {
    let child = node.firstChild
    if (child.type === OP) {
        child = child.nextSibling
    }
    const constructorName = child.text

    let argType: Type = new TupleType([])
    if (node.lastChild.type === PARAMETRIC_EXCEPTION) {
        argType = parseType(node.lastChild.lastChild, new Map())
    } else if (node.lastChild.type === REDEFINED_EXCEPTION) {
        argType = env.constructors.get(node.lastChild.lastChild.text)
    }
    return [constructorName, new FunctionType(argType, PrimitiveType.EXCEPTION)]
}

export type Clause = {
    patterns: Pattern[],
    body: SymbolicNode,
}
const parseClause = (node: Parser.SyntaxNode, env: Environment): Clause => {
    const patterns = node.children.filter(isPattern).map((child) => parsePattern(child, env))
    const body = parseExpression(node.lastChild, env)
    return {patterns, body}
}

