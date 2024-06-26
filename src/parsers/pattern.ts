import Parser from "web-tree-sitter";
import {Bindings, Constructors, getTupleConstructorName, InfixData} from "./program";
import {
    BooleanSymbolNode,
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
import {
    bindingsToSym,
    LIST_CONSTRUCTOR_NAME,
    LIST_NIL_NAME,
    mergeSymBindingsInto,
    Summary,
    SymBindings
} from "../models/utils";

type PatternResult<T extends string> = {
    bindings: Bindings
    condition: Bool<T> | null
}
export type Pattern = <T extends string>(node: SymbolicNode, context?: CustomContext<T>) => PatternResult<T>

export const parsePattern = (node: Parser.SyntaxNode, constructors: Constructors, infixData: InfixData): Pattern => {
    switch (node.type) {
        case APP_PATTERN:
            return parseAppPattern(node.children, constructors, infixData)
        case PARENTHESIZED_PATTERN:
            return parsePattern(node.children[1], constructors, infixData)
        case VARIABLE_PATTERN:
        case OP_PATTERN:
            const name = node.lastChild!.text
            const constructor = constructors.get(name)
            // zero parameter constructor
            if (constructor) {
                return parameterlessConstructorPattern(name)
            }
            return identifierPattern(name)
        case RECORD_UNIT_PATTERN:
        case TUPLE_UNIT_PATTERN:
        case TUPLE_PATTERN:
            const subPatterns = node.children.filter(isPattern).map((child) => parsePattern(child, constructors, infixData))
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
                            result.condition = context!.AndBool(result.condition, (condition))
                        }
                    }
                }
                return result
            }
        case OR_PATTERN:
            const subPatternsOr = node.children.filter(isPattern).map((child) => parsePattern(child, constructors, infixData))
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
            const constant = parseConstant(node.firstChild!)
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
                            condition: node.getZ3Value(context!).eq(constant.value)
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
                            condition: node.getZ3Value(context!).eq(context!.String.val(constant.value))
                        }
                    }
                    throw new PatternMatchError()
                }
            } else {
                throw new NotImplementedError("Unsupported constant type: " + constant)
            }
        case LIST_PATTERN:
            const listElements = node.children.filter(isPattern).map((child) => parsePattern(child, constructors, infixData))
            return listElements.reduceRight(
                (acc, subPattern) => infixConstructorPattern(LIST_CONSTRUCTOR_NAME, subPattern, acc),
                parameterlessConstructorPattern(LIST_NIL_NAME)
            )
        case CONSTRAIN_PATTERN:
            return parsePattern(node.firstChild!, constructors, infixData)
        case WILD_PATTERN:
            return <T extends string>(): PatternResult<T> => ({
                bindings: new Map<string, SymbolicNode>(),
                condition: null
            })
        default:
            throw new NotImplementedError("Pattern not implemented: " + node.type + " || " + node.text)
    }

}

const parseAppPattern = (children: Parser.SyntaxNode[], constructors: Constructors, infixData: InfixData): Pattern => {
    if (children.length === 1) {
        // just embedding another pattern
        return parsePattern(children[0], constructors, infixData)
    } else if (children.length === 2) {
        // constructor pattern
        const constructorName = children[0].text
        const subPattern = parsePattern(children[1], constructors, infixData)
        return <T extends string>(node: SymbolicNode, context?: CustomContext<T>) => {
            if (!(node instanceof ConstructorNode) || node.name !== constructorName) {
                throw new PatternMatchError()
            }
            return subPattern(node.args[0], context)
        }
    }
    // infix including pattern
    const leastInfixPosition = findLeastInfixPosition(children, infixData)

    const constructorName = children[leastInfixPosition].text
    const leftPattern = parseAppPattern(children.slice(0, leastInfixPosition), constructors, infixData)
    const rightPattern = parseAppPattern(children.slice(leastInfixPosition + 1), constructors, infixData)
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

        let condition: Bool<T> | null = null
        if (left.condition !== null && right.condition !== null) {
            condition = context!.AndBool(left.condition, (right.condition))
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

export const parameterlessConstructorPattern = (constructorName: string): Pattern => {
    return <T extends string>(node: SymbolicNode, context?: CustomContext<T>): PatternResult<T> => {
        if (node instanceof BooleanSymbolNode) {
            return {
                bindings: new Map<string, SymbolicNode>(),
                condition: node.eqZ3To(ConstructorNode.create([], constructorName), context!)
            }
        }
        if (!(node instanceof ConstructorNode) || node.name !== constructorName) {
            throw new PatternMatchError()
        }
        return {
            bindings: new Map<string, SymbolicNode>(),
            condition: null
        }
    }
}

export const identifierPattern = (name: string): Pattern => {
    return <T extends string>(node: SymbolicNode) => ({
        bindings: new Map<string, SymbolicNode>([[name, node]]),
        condition: null
    })
}


const findLeastInfixPosition = (children: Parser.SyntaxNode[], infixData: InfixData): number => {
    let leastPrecedence = Infinity
    let leastIndex = -1
    let leastInfixType = ""
    for (let i = 1; i < children.length; i++) {
        const infixName = children[i].text
        const infix = infixData.get(infixName)
        if (infix && infix.infix !== "NonInfix" && (infix.precedence < leastPrecedence || (infix.precedence === leastPrecedence && leastInfixType === "Left"))) {
            leastPrecedence = infix.precedence
            leastInfixType = infix.infix
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

export const applySymPattern = <T extends string>(pattern: Pattern, arg: Summary<T>, combinedPath: Bool<T>, context: CustomContext<T>): [SymBindings<T>, Bool<T> | null] => {
    const patternBindings: SymBindings<T> = new Map()
    let patternPath: Bool<T> | null = null
    for (let {path, value} of arg) {
        const patternResult = tryMatch(() => pattern(value, context))
        if (patternResult === null) continue
        const argPath = (patternResult.condition === null) ? path : context.AndBool(path, patternResult.condition)
        if (patternPath === null) {
            patternPath = argPath
        } else {
            patternPath = context.OrBool(patternPath, argPath)
        }
        mergeSymBindingsInto(patternBindings, bindingsToSym(patternResult.bindings, context.AndBool(combinedPath, argPath)))
    }
    return [patternBindings, patternPath]
}

export class PatternMatchError extends Error {
    constructor() {
        super("Pattern match error")
    }
}
