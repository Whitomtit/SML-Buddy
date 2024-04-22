export interface AddableContainer<T> {
    push(...elements: Array<T>): boolean;

    add(element: T): boolean;
}

export class Interception<T> implements AddableContainer<T> {
    private readonly mapFunction: (item: T) => T
    private readonly container: AddableContainer<T>

    constructor(container: AddableContainer<T>, mapFunction: (item: T) => T) {
        this.container = container
        this.mapFunction = mapFunction
    }

    push(...elements: Array<T>): boolean {
        return this.container.push(...elements.map(this.mapFunction))
    }

    add(element: T): boolean {
        return this.container.add(this.mapFunction(element))
    }
}