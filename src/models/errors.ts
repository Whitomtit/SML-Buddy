export class NotImplementedError extends Error {
    constructor(message?: string) {
        super(message || 'Not implemented');
    }
}

export class VariableNotDefinedError extends Error {
    constructor(name: string) {
        super(`Variable ${name} is not defined`);
    }
}

export class PatternMatchingNotExhaustiveError extends Error {
    constructor() {
        super('Pattern matching is not exhaustive');
    }
}

export class UnexpectedError extends Error {
    constructor() {
        super('Unexpected condition reached');
    }
}

export class BuiltinOperationError extends Error {
}

export class MergeError extends Error {
    constructor() {
        super("Cannot merge types");
    }
}