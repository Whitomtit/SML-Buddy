import Parser from "tree-sitter";
import {
    CLAUSE,
    DATATYPE_DECLARATION,
    DECLARATIONS,
    EXCEPTION_BIND,
    EXCEPTION_DECLARATION,
    FUNCTION_BIND,
    FUNCTION_DECLARATION,
    INFIX_DECLARATION,
    INT_CONSTANT,
    LEFT_INFIX,
    NON_INFIX,
    OP,
    PARAMETRIC_EXCEPTION,
    REDEFINED_EXCEPTION,
    RIGHT_INFIX,
    VALUE_BIND,
    VALUE_DECLARATION
} from "./const";
import {Constructors, Environment, Infix, InfixData, InfixType} from "./program";
import {IntegerNode, RecursiveFunctionNode, SymbolicNode} from "../models/symbolic_nodes";
import {applySymPattern, isPattern, parsePattern, Pattern} from "./pattern";
import {parseExpression} from "./expression";
import {NotImplementedError, UnexpectedError} from "../models/errors";
import {parseConstant} from "./constant";
import {parseType} from "./type";
import {FunctionType, PrimitiveType, TupleType, Type} from "../models/types";
import {parseDatatypeDeclaration} from "./datatype";
import {CustomContext} from "../models/context";
import {SymEnvironment} from "../models/utils";
import {Bool} from "z3-solver";

export const parseDeclaration = (node: Parser.SyntaxNode, constructors: Constructors, infixData: InfixData): EnvMutator => {
    switch (node.type) {
        case DATATYPE_DECLARATION:
            const newConstructors = parseDatatypeDeclaration(node)
            return {
                base: (env: Environment) => ({
                    ...env,
                    constructors: new Map([...env.constructors, ...newConstructors])
                }),
                symbolic: <T extends string>(context: CustomContext<T>, env: SymEnvironment<T>) => ({
                    ...env,
                    constructors: new Map([...env.constructors, ...newConstructors]),
                }),
                bindless: true
            }
        case FUNCTION_DECLARATION:
            return parseFunctionDeclaration(node, constructors, infixData)
        case VALUE_DECLARATION:
            return parseValueDeclaration(node, constructors, infixData)
        case INFIX_DECLARATION:
            const newInfixData = parseInfixDeclaration(node)
            return {
                base: (env: Environment) => ({
                    ...env,
                    infixData: new Map([...env.infixData, ...newInfixData])
                }),
                symbolic: <T extends string>(context: CustomContext<T>, env: SymEnvironment<T>) => ({
                    ...env,
                    infixData: new Map([...env.infixData, ...newInfixData])
                }),
                bindless: true
            }
        case EXCEPTION_DECLARATION:
            const newExceptionsConstructors = parseException(node, constructors)
            return {
                base: (env: Environment) => ({
                    ...env,
                    constructors: new Map([...env.constructors, ...newExceptionsConstructors])
                }),
                symbolic: <T extends string>(context: CustomContext<T>, env: SymEnvironment<T>) => ({
                    ...env,
                    constructors: new Map([...env.constructors, ...newExceptionsConstructors])
                }),
                bindless: true
            }
        default:
            throw new NotImplementedError("Declaration not implemented: " + node.type + " || " + node.text)
    }
}

export const isDeclaration = (node: Parser.SyntaxNode): boolean => {
    return DECLARATIONS.includes(node.type)
}

export type EnvMutator = {
    base: (env: Environment) => Environment
    symbolic: <T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>) => SymEnvironment<T>
    bindless?: boolean
}

export const mergeEnvMutators = (mutators: EnvMutator[]): EnvMutator => {
    return mutators.reduce(({base: accBase, symbolic: accSym}, {base, symbolic}) => ({
        base: (env) => base(accBase(env)),
        symbolic: (context, env, path) => symbolic(context, accSym(context, env, path), path)
    }), {
        base: (env: Environment) => env,
        symbolic: (context, env) => env
    })
}

export const parseFunctionDeclaration = (node: Parser.SyntaxNode, constructors: Constructors, infixData: InfixData): EnvMutator => {
    return mergeEnvMutators(node.children
        .filter((child) => child.type === FUNCTION_BIND)
        .map((child) => parseFunctionBind(child, constructors, infixData)))

}

const parseFunctionBind = (node: Parser.SyntaxNode, constructors: Constructors, infixData: InfixData): EnvMutator => {
    //TODO support for infix function declarations
    const clauses = node.children.filter((child) => child.type === CLAUSE).map((child) => parseClause(child, constructors, infixData))
    // drop function name
    const namePattern = clauses[0].patterns[0]
    clauses.forEach((clause) => clause.patterns.shift())
    const functionTemplateNode = new RecursiveFunctionNode(null, clauses)
    const name = namePattern(functionTemplateNode).bindings.keys().next().value as string
    functionTemplateNode.name = name
    return {
        base: (env: Environment) => {
            const functionNode = functionTemplateNode.evaluate(env)
            functionNode.closure.bindings.set(name, functionNode)
            return {
                ...env,
                bindings: new Map([...env.bindings, [name, functionNode]])
            }
        },
        symbolic: <T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>) => {
            const funcBind = functionTemplateNode.summarize(context, env, path)[0]
            const newBindings = new Map(env.bindings)
            funcBind.value.symBinds.set(name, [funcBind])
            newBindings.set(name, [funcBind])
            return {
                ...env,
                bindings: newBindings
            }
        }
    }
}

export const parseValueDeclaration = (node: Parser.SyntaxNode, constructors: Constructors, infixData: InfixData): EnvMutator => {
    return mergeEnvMutators(node.children
        .filter((child) => child.type === VALUE_BIND)
        .map((child) => parseValueBind(child, constructors, infixData)))
}

const parseValueBind = (node: Parser.SyntaxNode, constructors: Constructors, infixData: InfixData): EnvMutator => {
    const pattern = parsePattern(node.firstChild, constructors, infixData)
    const exp = parseExpression(node.lastChild, constructors, infixData)
    return {
        base: (env: Environment) => ({
            ...env,
            bindings: new Map([...env.bindings, ...pattern(exp.evaluate(env)).bindings])
        }),
        symbolic: <T extends string>(context: CustomContext<T>, env: SymEnvironment<T>, path: Bool<T>) => {
            const [newSymBindings] = applySymPattern<T>(pattern, exp.summarize(context, env, path), path, context)
            return {
                bindings: new Map([...env.bindings, ...newSymBindings]),
                constructors: env.constructors,
                infixData: env.infixData
            }
        }
    }
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

export const parseException = (node: Parser.SyntaxNode, constructors: Constructors): Constructors => {
    const result: Constructors = new Map<string, FunctionType>()
    node.children
        .filter((child) => child.type === EXCEPTION_BIND)
        .map((child) => parseExceptionBind(child, constructors))
        .forEach(([constructorName, constructorFunc]) => result.set(constructorName, constructorFunc))
    return result
}

const parseExceptionBind = (node: Parser.SyntaxNode, constructors: Constructors): [string, FunctionType] => {
    let child = node.firstChild
    if (child.type === OP) {
        child = child.nextSibling
    }
    const constructorName = child.text

    let argType: Type = new TupleType([])
    if (node.lastChild.type === PARAMETRIC_EXCEPTION) {
        argType = parseType(node.lastChild.lastChild, new Map())
    } else if (node.lastChild.type === REDEFINED_EXCEPTION) {
        argType = constructors.get(node.lastChild.lastChild.text)
    }
    return [constructorName, new FunctionType(argType, PrimitiveType.EXCEPTION)]
}

export type Clause = {
    patterns: Pattern[],
    body: SymbolicNode,
}
const parseClause = (node: Parser.SyntaxNode, constructors: Constructors, infixData: InfixData): Clause => {
    const patterns = node.children.filter(isPattern).map((child) => parsePattern(child, constructors, infixData))
    const body = parseExpression(node.lastChild, constructors, infixData)
    return {patterns, body}
}

