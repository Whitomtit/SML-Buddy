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

    private readonly referenceEnv: SymEnvironment<T>
    private readonly checkedEnv: SymEnvironment<T>

    private readonly startPath: Bool<T>

    constructor(context: CustomContext<T>, referenceProgram: RecursiveFunctionNode, checkedProgram: RecursiveFunctionNode, referenceEnv: Environment, checkedEnv: Environment) {
        this.context = context
        this.solver = new context.Solver()

        this.referenceProgram = referenceProgram
        this.checkedProgram = checkedProgram

        this.referenceEnv = {
            bindings: bindingsToSym(referenceEnv.bindings, this.context.Bool.val(true)),
            constructors: referenceEnv.constructors,
            infixData: referenceEnv.infixData
        }
        this.checkedEnv = {
            bindings: bindingsToSym(checkedEnv.bindings, this.context.Bool.val(true)),
            constructors: checkedEnv.constructors,
            infixData: checkedEnv.infixData
        }

        this.startPath = this.context.Bool.val(true)
    }

    async check(input: SymbolicNode) {
        const referenceInput = input.summarize(this.context, this.referenceEnv, this.startPath)
        const checkedInput = input.summarize(this.context, this.checkedEnv, this.startPath)
        const referenceSummary = this.referenceProgram.symbolicApply(this.context, referenceInput, this.startPath)
        const checkedSummary = this.checkedProgram.symbolicApply(this.context, checkedInput, this.startPath)

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
                return this.context.OrBool(acc, this.context.AndBool(symBind.path, (referenceValue.eqZ3To(checkedValue, this.context))))
            }, this.context.Bool.val(false))
            return this.context.AndBool(formula, (symBind.path.implies(rhe)))
        }, this.context.Bool.val(true))
        this.solver.reset()

        if (await this.solver.check(formula.not()) === "sat") {
            return this.solver.model()
        }
        return null
    }
}