import {Bool, Context, Z3_ast, Z3_error_code} from "z3-solver";

export interface CustomContext<T extends string> extends Context<T> {
    assert_string_eq: (name: string, value: string) => Bool<T>
}

export const createCustomContext = <T extends string>(context: Context<T>, Z3): CustomContext<T> => {
    const check = <T>(val: T): T => {
        if (Z3.get_error_code(context.ptr) !== Z3_error_code.Z3_OK) {
            throw new Error(Z3.get_error_msg(context.ptr, Z3.get_error_code(context.ptr)));
        }
        return val;
    }

    const dummyNode = context.Bool.val(true)

    const cleanup = new FinalizationRegistry<() => void>(callback => callback());

    type BoolConstructor = new (ast: Z3_ast) => typeof dummyNode
    const BoolConstructorRef = dummyNode.constructor as BoolConstructor

    const AssertStringEq = (name: string, value: string): Bool<T> => {
        const string_sort = check(Z3.mk_string_sort(context.ptr))

        const symbol = check(Z3.mk_string_symbol(context.ptr, name))
        const constant = check(Z3.mk_const(context.ptr, symbol, string_sort))
        Z3.inc_ref(context.ptr, constant)

        const str = check(Z3.mk_string(context.ptr, value))
        const constraint = check(Z3.mk_eq(context.ptr, constant, str))
        Z3.inc_ref(context.ptr, constraint)
        const node = new BoolConstructorRef(constraint)
        cleanup.register(node, () => {
            Z3.dec_ref(context.ptr, constant)
            Z3.dec_ref(context.ptr, constraint)
        })
        return node
    }

    const extendedContext = context as CustomContext<T>
    extendedContext.assert_string_eq = AssertStringEq
    return extendedContext
}