import Heap from "heap-js";
import {PolymorphicType, PrimitiveType, Type} from "./models/types";
import {HoleNode, RecursiveFunctionNode, SymbolicNode} from "./models/symbolic_nodes";
import {parseProgram, SMLParser} from "./parsers/program";
import {Generator} from "./engine/generator";
import {init} from "z3-solver";
import {createCustomContext} from "./models/context";
import {SymbolicExecutor} from "./engine/symbolicExecutor";

export const main = async (parser: SMLParser) => {
    const targetType = new PrimitiveType("btree")
    const targetFun = "mirror"

    const minHeap = new Heap<SymbolicNode>((a, b) => a.size() - b.size())
    minHeap.init([new HoleNode(targetType, new Map<string, Type>(), new Map<PolymorphicType, Type>())])

    const referenceInput = "\n" +
        "datatype btree = Empty | Node of int * btree * btree\n" +
        "\n" +
        "fun mirror t =\n" +
        "  case t of\n" +
        "    Empty => Empty\n" +
        "  | Node (n, l, r) => Node (n, mirror r, mirror l)\n" +
        "\n"
    const buggyInput = "\n" +
        "datatype btree = Empty | Node of int * btree * btree\n" +
        "\n" +
        "fun mirror t =\n" +
        "  case t of\n" +
        "    Empty => Empty\n" +
        "  | Node (a, b, c) => if b = Empty orelse c = Empty then Node (a, c, b) else Node (a, mirror c, mirror b)\n" +
        "\n"

    printSection("PARSING")
    const referenceEnv = parseProgram(referenceInput, parser)
    const buggyEnv = parseProgram(buggyInput, parser)

    printSection("SYMBOLIC SUMMARIES")
    const referenceFun = <RecursiveFunctionNode>referenceEnv.bindings.get(targetFun)
    const buggyFun = <RecursiveFunctionNode>buggyEnv.bindings.get(targetFun)

    const {Context, Z3} = await init();
    const context = createCustomContext(Context('main'), Z3)

    const symbolicExecutor = new SymbolicExecutor(context, referenceFun, buggyFun, referenceEnv, buggyEnv)

    printSection("GENERATOR")

    const generator = new Generator(referenceEnv.constructors)
    while (minHeap.size() > 0) {
        const testCase = minHeap.pop()!
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
}

const printSection = (title: string) => {
    console.log("\n\n")
    console.log("=== " + title + " ===")
}