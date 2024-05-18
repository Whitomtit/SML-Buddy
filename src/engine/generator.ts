import {
    BinopNode,
    BINOPS,
    ConcatNode,
    ConstructorNode,
    HoleNode,
    IdentifierNode,
    IntegerSymbolNode,
    StringSymbolNode,
    SymbolicNode,
    TestFunctionNode
} from "../models/symbolic_nodes";
import {AddableContainer, Interception} from "../models/containers";
import {FunctionType, MergeError, PolymorphicType, PrimitiveType, substitute, TupleType, Type} from "../models/types";

const tryMerge = (f: (substitution: Map<PolymorphicType, Type>) => void, hole: HoleNode) => {
    try {
        f(new Map(hole.substitution))
    } catch (error) {
        if (error instanceof MergeError) return
        console.log(error)
    }
}
export const Generator = (testCase: SymbolicNode,
                          minHeap: AddableContainer<SymbolicNode>,
                          constructors: Map<string, FunctionType>) => {
    if (testCase instanceof HoleNode) {
        // E-Num
        tryMerge((substitution) => {
            testCase.type.mergeWith(PrimitiveType.INT, substitution)
            minHeap.push(new IntegerSymbolNode())

            if (testCase.env.size === 0) return

            // E-Binop
            for (const op of BINOPS) {
                minHeap.push(new BinopNode(op,
                    new HoleNode(PrimitiveType.INT, testCase.env, substitution),
                    new HoleNode(PrimitiveType.INT, testCase.env, substitution)
                ))
            }
        }, testCase)
        // E-Str
        tryMerge((substitution) => {
            testCase.type.mergeWith(PrimitiveType.STRING, substitution)
            minHeap.push(new StringSymbolNode())

            if (testCase.env.size === 0) return

            // E-Concat
            minHeap.push(new ConcatNode(
                new HoleNode(PrimitiveType.STRING, testCase.env, substitution),
                new HoleNode(PrimitiveType.STRING, testCase.env, substitution)
            ))
        }, testCase)
        // E-Cnstr
        for (const [consName, consType] of constructors) {
            tryMerge((substitution) => {
                const freshType = consType.clone(new Map())
                testCase.type.mergeWith(freshType.returnType, substitution)

                let args: SymbolicNode[]
                if (freshType.argType instanceof TupleType) {
                    args = freshType.argType.elementTypes.map((type) => new HoleNode(type, testCase.env, substitution))
                } else {
                    args = [new HoleNode(freshType.argType, testCase.env, substitution)]
                }

                minHeap.push(new ConstructorNode(args, consName))
            }, testCase)
        }

        // E-Fun
        tryMerge((substitution) => {
            const freshType = new FunctionType(new PolymorphicType(), new PolymorphicType())
            testCase.type.mergeWith(freshType, substitution)
            const argName = TestFunctionNode.freshArgName()
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
                expandedEnv.set(`${varName}.${i}`, varType.elementTypes[i])
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
            Generator(testCase.args[i], new Interception(minHeap,
                (node) => {
                    const newArgs = [...testCase.args]
                    newArgs[i] = node
                    return new ConstructorNode(newArgs, testCase.name)

                }), constructors)
            break
        }
    } else if (testCase instanceof TestFunctionNode) {
        Generator(testCase.body,
            new Interception(minHeap,
                (node) => new TestFunctionNode(testCase.argName, node)),
            constructors
        )
    } else if (testCase instanceof BinopNode) {
        if (testCase.left.holesNumber() > 0) {
            Generator(testCase.left,
                new Interception(minHeap,
                    (node) => new BinopNode(testCase.op, node, testCase.right)),
                constructors)
        } else {
            Generator(testCase.right,
                new Interception(minHeap,
                    (node) => new BinopNode(testCase.op, testCase.left, node)),
                constructors)
        }
    } else if (testCase instanceof ConcatNode) {
        if (testCase.left.holesNumber() > 0) {
            Generator(testCase.left,
                new Interception(minHeap,
                    (node) => new ConcatNode(node, testCase.right)),
                constructors)
        } else {
            Generator(testCase.right,
                new Interception(minHeap,
                    (node) => new ConcatNode(testCase.left, node)),
                constructors)
        }
    } else {
        throw new Error('Unreachable')
    }
}