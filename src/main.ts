import Heap from "heap-js";
import {FunctionType, PolymorphicType, PrimitiveType, TupleType, Type} from "./models/types";
import {FunctionNode, HoleNode, IntegerNode, SymbolicNode} from "./models/symbolic_nodes";
import {parseProgram} from "./parsers/program";
import {promises as fs} from "fs";
import {Generator} from "./engine/generator";

const main = async () => {
    const targetType = new TupleType([new FunctionType(PrimitiveType.INT, PrimitiveType.INT), new PrimitiveType("int")])

    const minHeap = new Heap<SymbolicNode>((a, b) => a.size() - b.size())
    minHeap.init([new HoleNode(targetType, new Map<string, Type>(), new Map<PolymorphicType, Type>())])

    const program = await fs.readFile("test/test_1.in", "utf-8")

    printSection("PARSING")
    const env = parseProgram(program)

    printSection("CONSTRUCTORS")

    env.constructors.forEach((value, key) => {
        console.log(key, value.toString())
    })

    printSection("MAIN RUN")
    const main = <FunctionNode>env.bindings.get("main")
    console.log(main.apply(new IntegerNode(5)).toString())

    // const { Context } = await init();
    // const { Solver, Int, And } = Context('main');
    //
    // const x = Int.const('x');
    //
    // const solver = new Solver();
    // solver.add(And(x.ge(5), x.le(9)));
    // const result = await solver.check();
    // console.log(solver.model().get(x).toString());

    printSection("GENERATOR")

    const generator = new Generator(env.constructors)
    while (minHeap.size() > 0) {
        const testCase = minHeap.pop()
        if (testCase.isGround()) {
            console.log(testCase.toString())
            continue
        }

        generator.generate(testCase, minHeap)

        if (testCase.size() >= 10) break
    }
    printSection("END")
}

const printSection = (title: string) => {
    console.log("\n\n")
    console.log("=== " + title + " ===")
}

void main()