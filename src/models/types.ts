import {MergeError} from "./errors";
import {substitute} from "./utils";

export interface Type {
    mergeWith(other: Type, substitution: Map<PolymorphicType, Type>): void;

    clone(substitution: Map<PolymorphicType, PolymorphicType>): Type;
}

export class PrimitiveType implements Type {
    static readonly INT = new PrimitiveType("int");
    static readonly STRING = new PrimitiveType("string");
    static readonly BOOL = new PrimitiveType("bool");
    static readonly EXCEPTION = new PrimitiveType("exn");

    readonly name: string;

    constructor(name: string) {
        this.name = name;
    }

    mergeWith(other: Type, substitution: Map<PolymorphicType, Type>): void {
        other = substitute(other, substitution);

        if (other instanceof PolymorphicType) {
            substitution.set(other, this);
            return;
        }

        if (other instanceof PrimitiveType && this.name === other.name) {
            return;
        }
        throw new MergeError();
    }

    clone(): PrimitiveType {
        return this;
    }

    toString() {
        return this.name;
    }
}

export class TupleType implements Type {
    readonly elementTypes: Type[];

    constructor(elementTypes: Type[]) {
        this.elementTypes = elementTypes;
    }

    mergeWith(other: Type, substitution: Map<PolymorphicType, Type>) {
        other = substitute(other, substitution);

        if (other instanceof PolymorphicType) {
            substitution.set(other, this);
            return;
        }

        if (other instanceof TupleType) {
            if (this.elementTypes.length !== other.elementTypes.length) {
                throw new MergeError();
            }
            other.elementTypes.forEach((t, i) => t.mergeWith(this.elementTypes[i], substitution));
            return;
        }
        throw new MergeError();
    }

    clone(substitution: Map<PolymorphicType, PolymorphicType>): TupleType {
        return new TupleType(this.elementTypes.map(t => t.clone(substitution)));
    }

    toString() {
        return `(${this.elementTypes.map(t => t.toString()).join("*")})`
    }
}

export class FunctionType implements Type {
    readonly argType: Type;
    readonly returnType: Type;

    constructor(argType: Type, returnType: Type) {
        this.argType = argType;
        this.returnType = returnType;
    }

    mergeWith(other: Type, substitution: Map<PolymorphicType, Type>) {
        other = substitute(other, substitution);

        if (other instanceof PolymorphicType) {
            substitution.set(other, this);
            return;
        }

        if (other instanceof FunctionType) {
            this.argType.mergeWith(other.argType, substitution);
            this.returnType.mergeWith(other.returnType, substitution);
            return;
        }
        throw new MergeError();
    }

    clone(substitution: Map<PolymorphicType, PolymorphicType>): FunctionType {
        return new FunctionType(this.argType.clone(substitution), this.returnType.clone(substitution));
    }

    toString() {
        return `(${this.argType.toString()} → ${this.returnType.toString()})`
    }
}

export class PolymorphicType implements Type {
    private static polyCount = 0;
    private readonly index: number;

    constructor() {
        this.index = PolymorphicType.polyCount++;
    }


    mergeWith(other: Type, substitution: Map<PolymorphicType, Type>) {
        const current = substitute(this, substitution);
        if (current instanceof PolymorphicType) {
            substitution.set(current, other);
            return;
        } else {
            current.mergeWith(other, substitution);
        }
    }

    clone(substitution: Map<PolymorphicType, PolymorphicType>): PolymorphicType {
        if (!substitution.has(this)) {
            substitution.set(this, new PolymorphicType());
        }
        return substitution.get(this)!;
    }

    toString() {
        return "'"
            + 'z'.repeat(this.index / 26)
            + String.fromCharCode("a".charCodeAt(0) + this.index % 26);
    }
}

export class CompoundType implements Type {
    readonly polymorphicType: Type;
    readonly baseType: Type;

    constructor(type: Type, baseType: Type) {
        this.polymorphicType = type;
        this.baseType = baseType;
    }

    mergeWith(other: Type, substitution: Map<PolymorphicType, Type>) {
        other = substitute(other, substitution);

        if (other instanceof PolymorphicType) {
            substitution.set(other, this);
            return;
        }

        if (other instanceof CompoundType) {
            this.polymorphicType.mergeWith(other.polymorphicType, substitution);
            this.baseType.mergeWith(other.baseType, substitution);
            return;
        }
        throw new MergeError();
    }

    clone(substitution: Map<PolymorphicType, PolymorphicType>): CompoundType {
        return new CompoundType(this.polymorphicType.clone(substitution), this.baseType.clone(substitution));
    }

    toString() {
        return this.polymorphicType.toString() + " " + this.baseType.toString();
    }
}