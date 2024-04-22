import Parser from "tree-sitter";
import {DATATYPE_DECLARATION, DECLARATIONS} from "./const";
import {parseDatatypeDeclaration} from "./datatype";
import {Constructors} from "./program";
import {FunctionType} from "../models/types";

export const parseDeclaration = (node: Parser.SyntaxNode): Constructors => {
    switch (node.type) {
        case DATATYPE_DECLARATION:
            return parseDatatypeDeclaration(node)
        default:
            console.log("Declaration not implemented: " + node.type + " || " + node.text)
            return new Map<string, FunctionType>()
    }
}

export const isDeclaration = (node: Parser.SyntaxNode) => {
    return DECLARATIONS.includes(node.type)
}