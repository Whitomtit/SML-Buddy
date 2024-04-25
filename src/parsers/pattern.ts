import Parser from "tree-sitter";
import {Environment, tupleConstructorName} from "./program";
import {
    ConstructorNode,
    IntegerNode,
    IntegerSymbolNode,
    StringNode,
    StringSymbolNode,
    SymbolicNode
} from "../models/symbolic_nodes";
import {
    APP_PATTERN,
    CONSTANT_PATTERN,
    OP_PATTERN,
    OR_PATTERN,
    PARENTHESIZED_PATTERN,
    PATTERNS,
    RECORD_UNIT_PATTERN,
    TUPLE_PATTERN,
    TUPLE_UNIT_PATTERN,
    VARIABLE_PATTERN,
    WILD_PATTERN
} from "./const";
import {parseConstant} from "./constant";

type Pattern = (SymbolicNode) => Environment

export const isPattern = (node: Parser.SyntaxNode): boolean => {
    return PATTERNS.includes(node.type)
}

export const tryMatch = (f: () => Environment): Environment | null => {
    try {
        return f()
    } catch (error) {
        if (error instanceof PatternMatchError) return null
        throw error
    }
}

export class PatternMatchError extends Error {
    constructor() {
        super("Pattern match error")
    }
}

export const parsePattern = (node: Parser.SyntaxNode): Pattern => {
    switch (node.type) {
        case APP_PATTERN:
            const subPatternsApp = node.children.filter(isPattern).map(parsePattern)
            if (subPatternsApp.length === 1) {
                // just embedding another pattern
                return subPatternsApp[0]
            } else if (subPatternsApp.length === 2) {
                // constructor pattern
                const constructorName = node.firstChild.text
                return (node: SymbolicNode) => {
                    if (!(node instanceof ConstructorNode) || node.name !== constructorName) {
                        throw new PatternMatchError()
                    }
                    return subPatternsApp[1](node.args[0])
                }
            } else if (subPatternsApp.length === 3) {
                // infix pattern
                const constructorName = node.children[1].text
                return (node: SymbolicNode) => {
                    if (!(node instanceof ConstructorNode) || node.name !== constructorName) {
                        throw new PatternMatchError()
                    }
                    return new Map<string, SymbolicNode>([
                        ...subPatternsApp[0](node.args[0]),
                        ...subPatternsApp[2](node.args[1])
                    ])
                }
            } else {
                throw new Error("Unsupported number of subpatterns in app pattern: " + subPatternsApp.length)
            }
        case PARENTHESIZED_PATTERN:
            return parsePattern(node.children[1])
        case VARIABLE_PATTERN:
        case OP_PATTERN:
            const name = node.lastChild.text
            return (node: SymbolicNode) => new Map<string, SymbolicNode>([[name, node]])
        case RECORD_UNIT_PATTERN:
        case TUPLE_UNIT_PATTERN:
        case TUPLE_PATTERN:
            const subPatterns = node.children.filter(isPattern).map(parsePattern)
            return (node: SymbolicNode) => {
                if (!(node instanceof ConstructorNode) || node.name !== tupleConstructorName(subPatterns.length)) {
                    throw new PatternMatchError()
                }
                let env = new Map<string, SymbolicNode>()
                for (let i = 0; i < subPatterns.length; i++) {
                    env = new Map([...env, ...subPatterns[i](node.args[i])])
                }
                return env
            }
        case OR_PATTERN:
            const subPatternsOr = node.children.filter(isPattern).map(parsePattern)
            return (node: SymbolicNode) => {
                for (const subPattern of subPatternsOr) {
                    const env = tryMatch(() => {
                        return subPattern(node)
                    })
                    if (env !== null)
                        return env
                }
                throw new PatternMatchError()
            }
        case CONSTANT_PATTERN:
            const constant = parseConstant(node.firstChild)
            if (constant instanceof IntegerNode) {
                return (node: SymbolicNode) => {
                    if (node instanceof IntegerNode && node.value === constant.value) {
                        return new Map<string, SymbolicNode>()
                    }
                    if (node instanceof IntegerSymbolNode) {
                        // TODO handle special case of integer symbol
                        return new Map<string, SymbolicNode>()
                    }
                    throw new PatternMatchError()
                }
            } else if (constant instanceof StringNode) {
                return (node: SymbolicNode) => {
                    if (node instanceof StringNode && node.value === constant.value) {
                        return new Map<string, SymbolicNode>()
                    }
                    if (node instanceof StringSymbolNode) {
                        // TODO handle special case of integer symbol
                        return new Map<string, SymbolicNode>()
                    }
                    throw new PatternMatchError()
                }
            } else {
                throw new Error("Unsupported constant type: " + constant)
            }
        case WILD_PATTERN:
            return (_: SymbolicNode) => new Map<string, SymbolicNode>()
        default:
            throw new Error(`Unknown pattern type: ${node.type}`)
    }

}