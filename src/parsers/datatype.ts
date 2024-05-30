import Parser from "web-tree-sitter";
import {FunctionType, PolymorphicType, TupleType} from "../models/types";
import {CONSTRUCTOR, DATATYPE_BIND, OP, POLYMORPHIC_TYPE, POLYMORPHIC_TYPE_SEQUENCE} from "./const";
import {generateType, parseType} from "./type";
import {Constructors} from "./program";

export const parseDatatypeDeclaration = (node: Parser.SyntaxNode): Constructors => {
    // TODO withtype
    return node.children
        .filter((child) => child.type === DATATYPE_BIND)
        .map(parseDatatypeBind)
        .reduce((acc: Constructors, val: Constructors) => new Map([...acc, ...val]), new Map())
}

const parseDatatypeBind = (node: Parser.SyntaxNode): Constructors => {
    const typeMap = new Map<string, PolymorphicType>()
    const constructors: Constructors = new Map();

    let child = node.firstChild

    if (child!.type === POLYMORPHIC_TYPE_SEQUENCE) {
        parsePolymorphicTypeSequence(child!, typeMap)
        child = child!.nextSibling
    }
    const typeName = child!.text
    const type = generateType(typeName, Array.from(typeMap.values()))

    const constructorNodes = node.children.filter((child) => child.type === CONSTRUCTOR)
    constructorNodes.forEach((constructorNode) => {
        let child = constructorNode.firstChild
        if (child!.type === OP) {
            child = child!.nextSibling
        }
        const constructorName = child!.text
        const argType = child!.nextSibling ? parseType(child!.nextSibling.nextSibling!, typeMap) : new TupleType([])
        constructors.set(constructorName, new FunctionType(argType, type))
    })

    return constructors
}

const parsePolymorphicTypeSequence = (node: Parser.SyntaxNode, typeMap: Map<string, PolymorphicType>) => {
    const polymorphicTypes = node.children.filter((child) => child.type === POLYMORPHIC_TYPE)
    polymorphicTypes.forEach((polymorphicType) => {
        if (!typeMap.has(polymorphicType.text)) {
            typeMap.set(polymorphicType.text, new PolymorphicType())
        }
    })
}

