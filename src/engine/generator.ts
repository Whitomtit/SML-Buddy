import {
    ApplicationNode,
    ConstructorNode,
    HoleNode,
    IdentifierNode,
    IntegerSymbolNode,
    StringSymbolNode,
    SymbolicNode,
    TestFunctionNode
} from "../models/symbolic_nodes";
import {AddableContainer, Interception} from "../models/containers";
import {FunctionType, PolymorphicType, PrimitiveType, TupleType, Type} from "../models/types";
import {BINARY_OPS, substitute} from "../models/utils";
import {MergeError, UnexpectedError} from "../models/errors";
import {Constructors, getTupleConstructorName} from "../parsers/program";

export class Generator {
    private readonly constructors: Constructors
    private argCount: number
    private formulaCount: number

    constructor(constructors: Constructors) {
        this.constructors = constructors
        this.argCount = 0
        this.formulaCount = 0
    }

    generate(testCase: SymbolicNode, minHeap: AddableContainer<SymbolicNode>) {
        if (testCase instanceof HoleNode) {
            // E-Num
            tryMerge((substitution) => {
                testCase.type.mergeWith(PrimitiveType.INT, substitution)
                minHeap.push(IntegerSymbolNode.fromVarName(this.freshFormulaName()))

                if (testCase.env.size === 0) return

                // E-Binop
                for (const op of BINARY_OPS) {
                    minHeap.push(new ApplicationNode([
                        new HoleNode(PrimitiveType.INT, testCase.env, substitution),
                        new IdentifierNode(op),
                        new HoleNode(PrimitiveType.INT, testCase.env, substitution)
                    ]))
                }
            }, testCase)
            // E-Str
            tryMerge((substitution) => {
                testCase.type.mergeWith(PrimitiveType.STRING, substitution)
                minHeap.push(new StringSymbolNode(this.freshFormulaName()))

                if (testCase.env.size === 0) return

                // E-Concat
                minHeap.push(new ApplicationNode([
                    new HoleNode(PrimitiveType.STRING, testCase.env, substitution),
                    new IdentifierNode('^'),
                    new HoleNode(PrimitiveType.STRING, testCase.env, substitution)
                ]))
            }, testCase)
            // E-Constr
            for (const [consName, consType] of this.constructors) {
                tryMerge((substitution) => {
                    const freshType = consType.clone(new Map())
                    testCase.type.mergeWith(freshType.returnType, substitution)

                    if (freshType.argType instanceof TupleType) {
                        const args = freshType.argType.elementTypes.map((type) => new HoleNode(type, testCase.env, substitution))
                        minHeap.push(new ConstructorNode([new ConstructorNode(args, getTupleConstructorName(args.length))], consName))
                    } else {
                        minHeap.push(new ConstructorNode([new HoleNode(freshType.argType, testCase.env, substitution)], consName))
                    }
                }, testCase)
            }

            // E-Fun
            tryMerge((substitution) => {
                const freshType = new FunctionType(new PolymorphicType(), new PolymorphicType())
                testCase.type.mergeWith(freshType, substitution)
                const argName = this.freshArgName()

                minHeap.push(
                    new TestFunctionNode(argName,
                        new HoleNode(freshType.returnType, new Map([...testCase.env.entries(), [argName, freshType.argType]]), substitution)
                    ))
            }, testCase)

            // E-Var
            const expandedEnv = new Map(testCase.env)
            for (let [varName, varType] of testCase.env) {
                varType = substitute(varType, testCase.substitution)
                if (!(varType instanceof TupleType)) continue
                for (let i = 0; i < varType.elementTypes.length; i++) {
                    expandedEnv.set(`${varName}_${i}`, varType.elementTypes[i])
                }
            }
            for (const [varName, varType] of expandedEnv) {
                tryMerge((substitution) => {
                    testCase.type.mergeWith(varType, substitution)
                    minHeap.push(new IdentifierNode(varName))
                }, testCase)
            }
        } else if (testCase instanceof ConstructorNode) {
            for (let i = 0; i < testCase.args.length; i++) {
                if (testCase.args[i].holesNumber() === 0)
                    continue
                this.generate(testCase.args[i], new Interception(minHeap,
                    (node) => {
                        const newArgs = [...testCase.args]
                        newArgs[i] = node
                        return new ConstructorNode(newArgs, testCase.name)

                    }))
                break
            }
        } else if (testCase instanceof TestFunctionNode) {
            this.generate(testCase.body, new Interception(minHeap,
                (node) => new TestFunctionNode(testCase.argName, node)))
        } else if (testCase instanceof ApplicationNode) {
            const left = testCase.nodes[0]
            const op = testCase.nodes[1]
            const right = testCase.nodes[2]
            if (left.holesNumber() > 0) {
                this.generate(left, new Interception(minHeap,
                    (node) => new ApplicationNode([node, op, right])))
            } else {
                this.generate(right, new Interception(minHeap,
                    (node) => new ApplicationNode([left, op, node])))
            }
        } else {
            throw new UnexpectedError()
        }
    }

    private freshArgName() {
        return 'arg' + this.argCount++;
    }

    private freshFormulaName() {
        return 'v' + this.formulaCount++;
    }
}

const tryMerge = (f: (substitution: Map<PolymorphicType, Type>) => void, hole: HoleNode) => {
    try {
        f(new Map(hole.substitution))
    } catch (error) {
        if (error instanceof MergeError) return
        throw error
    }
}
