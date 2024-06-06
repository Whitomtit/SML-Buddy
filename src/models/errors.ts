export class ExecutorError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class NotImplementedError extends Error {
    constructor(message?: string) {
        super(message || 'Not implemented');
    }
}

export class VariableNotDefinedError extends ExecutorError {
    constructor(name: string) {
        super(`Variable ${name} is not defined`);
    }
}

export class UnexpectedError extends ExecutorError {
    constructor() {
        super('Unexpected condition reached');
    }
}

export class BuiltinOperationError extends ExecutorError {
}

export class MergeError extends ExecutorError {
    constructor() {
        super("Cannot merge types");
    }
}

export class ConfigurationError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export class TimeoutError extends Error {
    constructor() {
        super("Timeout");
    }
}