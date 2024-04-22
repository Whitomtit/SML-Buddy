import Parser from "tree-sitter";
import {
    CONSTRUCTOR_TYPE,
    FUNCTION_TYPE,
    PARENTHESIZED_TYPE,
    POLYMORPHIC_TYPE,
    RECORD_TYPE,
    TUPLE_TYPE,
    TYPES,
    WRAPPED_POLYMORPHIC_TYPE
} from "./const";
import {CompoundType, FunctionType, PrimitiveType, TupleType, Type} from "../models/types";

export const generateType = (typeName: string, subTypes: Type[]): Type => {
    const base = new PrimitiveType(typeName)
    if (subTypes.length === 0) {
        return base
    } else if (subTypes.length === 1) {
        return new CompoundType(subTypes[0], base)
    } else {
        return new CompoundType(new TupleType(subTypes), base)
    }
}
const isTypeNode = (node: Parser.SyntaxNode): boolean => {
    return TYPES.includes(node.type)
}
export const parseType = (node: Parser.SyntaxNode, typeMap: Map<string, Type>): Type => {
    if (node.type === TUPLE_TYPE) {
        const types = node.children
            .filter(isTypeNode)
            .map((child) => parseType(child, typeMap))
        return new TupleType(types)
    } else if (node.type === FUNCTION_TYPE) {
        const argType = parseType(node.children[0], typeMap)
        const returnType = parseType(node.children[2], typeMap)
        return new FunctionType(argType, returnType)
    } else if (node.type === POLYMORPHIC_TYPE || node.type === WRAPPED_POLYMORPHIC_TYPE) {
        return typeMap.get(node.text)
    } else if (node.type === RECORD_TYPE) {
        // TODO implement record type
        throw new Error("Record type not implemented")
    } else if (node.type === CONSTRUCTOR_TYPE) {
        const types = node.children
            .filter(isTypeNode)
            .map((child) => parseType(child, typeMap))
        const typeName = node.lastChild.text
        return generateType(typeName, types)
    } else if (node.type === PARENTHESIZED_TYPE) {
        return parseType(node.children[1], typeMap)
    } else {
        throw new Error(`Invalid type: ${node.type}`)
    }
}