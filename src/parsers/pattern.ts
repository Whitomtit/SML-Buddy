import Parser from "tree-sitter";
import {Bindings, Environment, getTupleConstructorName} from "./program";
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
    CONSTRAIN_PATTERN,
    LIST_PATTERN,
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
import {NotImplementedError} from "../models/errors";
import {Bool} from "z3-solver";
import {CustomContext} from "../models/context";
import {LIST_CONSTRUCTOR_NAME, LIST_NIL_NAME} from "../models/utils";

type PatternResult<T extends string> = {
    bindings: Bindings
    condition: Bool<T>
}
export type Pattern = <T extends string>(node: SymbolicNode, context?: CustomContext<T>) => PatternResult<T>

// export const parseMatch = (node: Parser.SyntaxNode, env: Environment): PatternMatchNode => {
//     const cases = node.children
//         .filter(child => child.type === CASE).map(child => parseRule(child, env))
//     return new PatternMatchNode(cases)
// }
//
// const parseRule = (node: Parser.SyntaxNode, env: Environment): { pattern: Pattern, body: SymbolicNode } => {
//     const pattern = parsePattern(node.children[0], env)
//     const body = parseExpression(node.children[2])
//     return {pattern, body}
// }

export const parsePattern = (node: Parser.SyntaxNode, env: Environment): Pattern => {
    switch (node.type) {
        case APP_PATTERN:
            return parseAppPattern(node.children, env)
        case PARENTHESIZED_PATTERN:
            return parsePattern(node.children[1], env)
        case VARIABLE_PATTERN:
        case OP_PATTERN:
            const name = node.lastChild.text
            const constructor = env.constructors.get(name)
            // zero parameter constructor
            if (constructor) {
                return parameterlessConstructorPattern(name)
            }
            return <T extends string>(node: SymbolicNode) => ({
                bindings: new Map<string, SymbolicNode>([[name, node]]),
                condition: null
            })
        case RECORD_UNIT_PATTERN:
        case TUPLE_UNIT_PATTERN:
        case TUPLE_PATTERN:
            const subPatterns = node.children.filter(isPattern).map((child) => parsePattern(child, env))
            return <T extends string>(node: SymbolicNode, context?: CustomContext<T>): PatternResult<T> => {
                if (!(node instanceof ConstructorNode) || node.name !== getTupleConstructorName(subPatterns.length)) {
                    throw new PatternMatchError()
                }
                const result: PatternResult<T> = {
                    bindings: new Map<string, SymbolicNode>(),
                    condition: null
                }
                for (let i = 0; i < subPatterns.length; i++) {
                    const {bindings, condition} = subPatterns[i](node.args[i], context)
                    result.bindings = new Map([...result.bindings, ...bindings])
                    if (condition !== null) {
                        if (result.condition === null) {
                            result.condition = condition
                        } else {
                            result.condition = result.condition.and(condition)
                        }
                    }
                }
                return result
            }
        case OR_PATTERN:
            const subPatternsOr = node.children.filter(isPattern).map((child) => parsePattern(child, env))
            return <T extends string>(node: SymbolicNode, context?: CustomContext<T>): PatternResult<T> => {
                for (const subPattern of subPatternsOr) {
                    const result = tryMatch<T>(() => {
                        return subPattern(node, context)
                    })
                    if (result !== null) {
                        return result
                    }
                }
                throw new PatternMatchError()
            }
        case CONSTANT_PATTERN:
            const constant = parseConstant(node.firstChild)
            if (constant instanceof IntegerNode) {
                return <T extends string>(node: SymbolicNode, context?: CustomContext<T>): PatternResult<T> => {
                    if (node instanceof IntegerNode && node.value === constant.value) {
                        return {
                            bindings: new Map<string, SymbolicNode>(),
                            condition: null
                        }
                    }
                    if (node instanceof IntegerSymbolNode) {

                        return {
                            bindings: new Map<string, SymbolicNode>(),
                            condition: node.getZ3Value(context).eq(constant.value)
                        }
                    }
                    throw new PatternMatchError()
                }
            } else if (constant instanceof StringNode) {
                return <T extends string>(node: SymbolicNode, context?: CustomContext<T>): PatternResult<T> => {
                    if (node instanceof StringNode && node.value === constant.value) {
                        return {
                            bindings: new Map<string, SymbolicNode>(),
                            condition: null
                        }
                    }
                    if (node instanceof StringSymbolNode) {
                        return {
                            bindings: new Map<string, SymbolicNode>(),
                            condition: node.getZ3Value(context).eq(context.String.val(constant.value))
                        }
                    }
                    throw new PatternMatchError()
                }
            } else {
                throw new NotImplementedError("Unsupported constant type: " + constant)
            }
        case LIST_PATTERN:
            const listElements = node.children.filter(isPattern).map((child) => parsePattern(child, env))
            return listElements.reduceRight(
                (acc, subPattern) => infixConstructorPattern(LIST_CONSTRUCTOR_NAME, subPattern, acc),
                parameterlessConstructorPattern(LIST_NIL_NAME)
            )
        case CONSTRAIN_PATTERN:
            return parsePattern(node.firstChild, env)
        case WILD_PATTERN:
            return <T extends string>(): PatternResult<T> => ({
                bindings: new Map<string, SymbolicNode>(),
                condition: null
            })
        default:
            throw new NotImplementedError()
    }

}

const parseAppPattern = (children: Parser.SyntaxNode[], env: Environment): Pattern => {
    if (children.length === 1) {
        // just embedding another pattern
        return parsePattern(children[0], env)
    } else if (children.length === 2) {
        // constructor pattern
        const constructorName = children[0].text
        const subPattern = parsePattern(children[1], env)
        return <T extends string>(node: SymbolicNode, context?: CustomContext<T>) => {
            if (!(node instanceof ConstructorNode) || node.name !== constructorName) {
                throw new PatternMatchError()
            }
            return subPattern(node.args[0], context)
        }
    }
    // infix including pattern
    const leastInfixPosition = findLeastInfixPosition(children, env)

    const constructorName = children[leastInfixPosition].text
    const leftPattern = parseAppPattern(children.slice(0, leastInfixPosition), env)
    const rightPattern = parseAppPattern(children.slice(leastInfixPosition + 1), env)
    return infixConstructorPattern(constructorName, leftPattern, rightPattern)
}

const infixConstructorPattern = (constructorName: string, leftPattern: Pattern, rightPattern: Pattern): Pattern =>
    <T extends string>(node: SymbolicNode, context?: CustomContext<T>): PatternResult<T> => {
        if (!(node instanceof ConstructorNode) || node.name !== constructorName) {
            throw new PatternMatchError()
        }
        // the only child is a tuple constructor
        const tuple = <ConstructorNode>node.args[0]
        const left = leftPattern(tuple.args[0], context)
        const right = rightPattern(tuple.args[1], context)

        let condition: Bool<T> = null
        if (left.condition !== null && right.condition !== null) {
            condition = left.condition.and(right.condition)
        } else if (left.condition !== null) {
            condition = left.condition
        } else if (right.condition !== null) {
            condition = right.condition
        }
        return {
            bindings: new Map([...left.bindings, ...right.bindings]),
            condition: condition
        }
    }

const parameterlessConstructorPattern = (constructorName: string): Pattern =>
    <T extends string>(node: SymbolicNode): PatternResult<T> => {
        if (!(node instanceof ConstructorNode) || node.name !== constructorName) {
            throw new PatternMatchError()
        }
        return {
            bindings: new Map<string, SymbolicNode>(),
            condition: null
        }
    }


const findLeastInfixPosition = (children: Parser.SyntaxNode[], env: Environment): number => {
    let leastPrecedence = Infinity
    let leastIndex = -1
    let leastInfixType = ""
    for (let i = 1; i < children.length; i++) {
        const infixName = children[i].text
        const infixData = env.infixData.get(infixName)
        if (infixData && (infixData.precedence < leastPrecedence || (infixData.precedence === leastPrecedence && leastInfixType === "Left"))) {
            leastPrecedence = infixData.precedence
            leastInfixType = infixData.infix
            leastIndex = i
        }
    }
    return leastIndex

}

export const isPattern = (node: Parser.SyntaxNode): boolean => {
    return PATTERNS.includes(node.type)
}

export const tryMatch = <T extends string>(f: () => PatternResult<T>): PatternResult<T> | null => {
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
