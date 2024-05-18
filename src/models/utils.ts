import {PolymorphicType, Type} from "./types";

export type Constructor<T> = new (...args: any[]) => T;

export const BINARY_OPS = ['+', '-', '*', 'div', 'mod'];

export const substitute = (type: Type, substitution: Map<PolymorphicType, Type>): Type => {
    if (type instanceof PolymorphicType) {
        return substitution.get(type) || type;
    }
    return type;
}