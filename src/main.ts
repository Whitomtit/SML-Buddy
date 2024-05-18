import Heap from "heap-js";
import {FunctionType, PolymorphicType, PrimitiveType, TupleType, Type} from "./models/types";
import {HoleNode, SymbolicNode} from "./models/symbolic_nodes";
import {parseProgram} from "./parsers/program";
import {promises as fs} from "fs";

const main = async () => {
    const targetType = new TupleType([new FunctionType(PrimitiveType.INT, PrimitiveType.INT), new PrimitiveType("int")])

    const minHeap = new Heap<SymbolicNode>((a, b) => a.size() - b.size())
    minHeap.init([new HoleNode(targetType, new Map<string, Type>(), new Map<PolymorphicType, Type>())])

    const program = await fs.readFile("test/test_1.in", "utf-8")

    const env = parseProgram(program)

    env.constructors.forEach((value, key) => {
        console.log(key, value.toString())
    })

    env.bindings.forEach((value, key) => {
        console.log(key, value.toString())
    })


    // const { Context } = await init();
    // const { Solver, Int, And } = Context('main');
    //
    // const x = Int.const('x');
    //
    // const solver = new Solver();
    // solver.add(And(x.ge(5), x.le(9)));
    // const result = await solver.check();
    // console.log(solver.model().get(x).toString());


    // while (minHeap.size() > 0) {
    //     const testCase = minHeap.pop()
    //     if (testCase.holesNumber() === 0) {
    //         console.log(testCase.toString())
    //         continue
    //     }
    //     Generator(testCase, minHeap, constructors)
    //     if (testCase.size() >= 20) break
    // }
}

void main()