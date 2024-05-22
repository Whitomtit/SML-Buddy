import {CustomContext} from "../models/context";
import {BottomNode, RecursiveFunctionNode, SymbolicNode} from "../models/symbolic_nodes";
import {Bool, Solver} from "z3-solver";
import {Environment} from "../parsers/program";
import {bindingsToSym, SymEnvironment} from "../models/utils";

export class SymbolicExecutor<T extends string> {
    private readonly context: CustomContext<T>
    private readonly solver: Solver<T>

    private readonly referenceProgram: RecursiveFunctionNode
    private readonly checkedProgram: RecursiveFunctionNode

    private readonly env: SymEnvironment<T>

    private readonly startPath: Bool<T>

    constructor(context: CustomContext<T>, referenceProgram: RecursiveFunctionNode, checkedProgram: RecursiveFunctionNode, env: Environment) {
        this.context = context
        this.solver = new context.Solver()

        this.referenceProgram = referenceProgram
        this.checkedProgram = checkedProgram

        this.env = {
            bindings: bindingsToSym(env.bindings, this.context.Bool.val(true)),
            constructors: env.constructors,
            infixData: env.infixData
        }

        this.startPath = this.context.Bool.val(true)
    }

    async check(input: SymbolicNode) {
        const processedInput = input.summarize(this.context, this.env, this.startPath)
        const referenceSummary = this.referenceProgram.symbolicApply(this.context, processedInput, this.startPath)
        const checkedSummary = this.checkedProgram.symbolicApply(this.context, processedInput, this.startPath)

        const formula = referenceSummary.reduce((formula, symBind) => {
            const referenceValue = symBind.value
            if (referenceValue instanceof BottomNode) {
                return formula
            }
            const rhe = checkedSummary.reduce((acc, symBind) => {
                const checkedValue = symBind.value
                if (checkedValue instanceof BottomNode) {
                    return acc
                }
                return acc.or(symBind.path.and(referenceValue.eqZ3To(checkedValue, this.context)))
            }, this.context.Bool.val(false))
            return formula.and(symBind.path.implies(rhe))
        }, this.context.Bool.val(true))
        this.solver.reset()
        this.solver.add(formula.not())
        if (await this.solver.check() === "sat") {
            return this.solver.model()
        }
        return null
    }
}