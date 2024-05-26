import Heap from "heap-js";
import {PolymorphicType, PrimitiveType, Type} from "./models/types";
import {HoleNode, RecursiveFunctionNode, SymbolicNode} from "./models/symbolic_nodes";
import {parseProgram} from "./parsers/program";
import {promises as fs} from "fs";
import {Generator} from "./engine/generator";
import {init} from "z3-solver";
import {createCustomContext} from "./models/context";
import {SymbolicExecutor} from "./engine/symbolicExecutor";

const main = async () => {
    const targetType = new PrimitiveType("btree")
    const targetFun = "mirror"

    const minHeap = new Heap<SymbolicNode>((a, b) => a.size() - b.size())
    minHeap.init([new HoleNode(targetType, new Map<string, Type>(), new Map<PolymorphicType, Type>())])

    const referenceInput = await fs.readFile("benchmarks/mirror/sol.sml", "utf-8")
    const buggyInput = await fs.readFile("benchmarks/mirror/sub29.sml", "utf-8")

    printSection("PARSING")
    const referenceEnv = parseProgram(referenceInput)
    const buggyEnv = parseProgram(buggyInput)

    printSection("SYMBOLIC SUMMARIES")
    const referenceFun = <RecursiveFunctionNode>referenceEnv.bindings.get(targetFun)
    const buggyFun = <RecursiveFunctionNode>buggyEnv.bindings.get(targetFun)

    const {Context, Z3} = await init();
    const context = createCustomContext(Context('main'), Z3)

    const symbolicExecutor = new SymbolicExecutor(context, referenceFun, buggyFun, referenceEnv, buggyEnv)

    printSection("GENERATOR")

    const generator = new Generator(referenceEnv.constructors)
    while (minHeap.size() > 0) {
        const testCase = minHeap.pop()
        if (testCase.isGround()) {
            console.log("CHECKING ", testCase.toString(), testCase.size())
            const checkResult = await symbolicExecutor.check(testCase)
            if (checkResult) {
                console.log("FOUND CANDIDATE")
                const concreteCase = testCase.concretize(checkResult, context)
                const referenceResult = referenceFun.apply(concreteCase.evaluate(referenceEnv))
                const checkedResult = buggyFun.apply(concreteCase.evaluate(buggyEnv))
                if (referenceResult.eqTo(checkedResult)) {
                    continue
                }
                console.log("FOUND")
                console.log(concreteCase.toSMLString(referenceEnv.infixData))
                break
            }
            continue
        }
        generator.generate(testCase, minHeap)
    }
    printSection("END")
    process.exit(0)
}

const printSection = (title: string) => {
    console.log("\n\n")
    console.log("=== " + title + " ===")
}

void main()