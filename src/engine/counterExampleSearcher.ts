import Heap from "heap-js";
import {HoleNode, RecursiveFunctionNode, SymbolicNode} from "../models/symbolic_nodes";
import {PolymorphicType, Type} from "../models/types";
import {Environment} from "../parsers/program";
import {SymbolicExecutor} from "./symbolicExecutor";
import {createCustomContext} from "../models/context";
import {init} from "z3-solver";
import {Generator} from "./generator";
import {TimeoutError} from "../models/errors";
import {CounterExample} from "../extension";

const DEFAULT_TIMEOUT = 60000

export class CounterExampleSearcher {
    readonly targetFunction: string

    readonly cases: Heap<SymbolicNode>
    readonly targetType: Type

    readonly referenceEnv: Environment
    readonly referenceFun: RecursiveFunctionNode

    readonly timeout: number

    constructor(targetFunction: string, targetType: Type, referenceEnv: Environment, referenceFun: RecursiveFunctionNode, timeout: number = DEFAULT_TIMEOUT) {
        this.targetFunction = targetFunction

        this.cases = new Heap<SymbolicNode>((a, b) => a.size() - b.size())
        this.targetType = targetType

        this.referenceEnv = referenceEnv
        this.referenceFun = referenceFun

        this.timeout = timeout
    }

    search = async (checkedEnv: Environment, checkedFun: RecursiveFunctionNode): Promise<CounterExample | null> => {
        this.cases.clear()
        this.cases.push(new HoleNode(this.targetType, new Map<string, Type>(), new Map<PolymorphicType, Type>()))

        const {Context, Z3} = await init();
        const context = createCustomContext(Context(this.targetFunction), Z3)
        const symbolicExecutor = new SymbolicExecutor(context,
            this.referenceFun, checkedFun,
            this.referenceEnv, checkedEnv
        )

        const generator = new Generator(this.referenceEnv.constructors)

        const startTime = Date.now()

        while (this.cases.size() > 0) {
            const testCase = this.cases.pop()!
            if (testCase.isGround()) {
                const checkResult = await symbolicExecutor.check(testCase)
                if (checkResult) {
                    const concreteCase = testCase.concretize(checkResult, context)
                    const referenceResult = this.referenceFun.apply(concreteCase.evaluate(this.referenceEnv))
                    const checkedResult = checkedFun.apply(concreteCase.evaluate(checkedEnv))
                    if (referenceResult.eqTo(checkedResult)) {
                        continue
                    }
                    return {
                        input: concreteCase.toSMLString(checkedEnv.infixData),
                        output: checkedResult.toSMLString(checkedEnv.infixData),
                        expectedOutput: referenceResult.toSMLString(checkedEnv.infixData)
                    }
                }
                continue
            }
            generator.generate(testCase, this.cases)

            if (Date.now() - startTime > this.timeout) {
                throw new TimeoutError()
            }
        }

        return null
    }
}