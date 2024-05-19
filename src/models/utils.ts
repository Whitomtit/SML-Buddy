import {PolymorphicType, Type} from "./types";
import {Constructors, InfixData} from "../parsers/program";
import {Bool} from "z3-solver";
import {SymbolicNode} from "./symbolic_nodes";

export type Constructor<T> = new (...args: any[]) => T;

export const BINARY_OPS = ['+', '-', '*', 'div', 'mod'];

export const substitute = (type: Type, substitution: Map<PolymorphicType, Type>): Type => {
    if (type instanceof PolymorphicType) {
        return substitution.get(type) || type;
    }
    return type;
}

export type SymBind<T extends string> = {
    path: Bool<T>
    value: SymbolicNode
}

export type SymBindings<T extends string> = Map<string, SymBind<T>[]>

export type Summary<T extends string> = SymBind<T>[]

export type SymEnvironment<T extends string> = {
    bindings: SymBindings<T>
    constructors: Constructors
    infixData: InfixData
}

export const product = <T>(args: T[][]): T[][] => {
    return <T[][]>args.reduce((accumulator: T[][], value): T[][] => {
        const tmp: T[][] = [];
        accumulator.forEach((a) => value.forEach((b) => tmp.push(a.concat(b))));
        return tmp;
    }, [[]])
}