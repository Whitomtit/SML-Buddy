import Parser from "tree-sitter";
import {CLAUSE, DECLARATIONS, FUNCTION_BIND} from "./const";
import {Bindings, Environment} from "./program";
import {RecursiveFunctionNode, SymbolicNode} from "../models/symbolic_nodes";
import {isPattern, parsePattern, Pattern} from "./pattern";
import {parseExpression} from "./expression";

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

export type Clause = {
    patterns: Pattern[],
    body: SymbolicNode,
}
const parseClause = (node: Parser.SyntaxNode, env: Environment): Clause => {
    const patterns = node.children.filter(isPattern).map((child) => parsePattern(child, env))
    const body = parseExpression(node.lastChild, env)
    return {patterns, body}
}

