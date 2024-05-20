import {Bool, Context, Z3_ast, Z3_error_code} from "z3-solver";

export interface CustomContext<T extends string> extends Context<T> {
    VarEqString: (name: string, value: string) => Bool<T>
    StringEqString: (a: string, b: string) => Bool<T>
    VarEqVar: (a: string, b: string) => Bool<T>
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

    const extendedContext = context as CustomContext<T>
    extendedContext.VarEqString = (name: string, value: string): Bool<T> => {
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
    extendedContext.StringEqString = (a: string, b: string): Bool<T> => {
        const str_a = check(Z3.mk_string(context.ptr, a))
        const str_b = check(Z3.mk_string(context.ptr, b))
        const constraint = check(Z3.mk_eq(context.ptr, str_a, str_b))
        Z3.inc_ref(context.ptr, constraint)
        const node = new BoolConstructorRef(constraint)
        cleanup.register(node, () => {
            Z3.dec_ref(context.ptr, constraint)
        })
        return node
    }
    extendedContext.VarEqVar = (a: string, b: string): Bool<T> => {
        const symbol_a = check(Z3.mk_string_symbol(context.ptr, a))
        const constant_a = check(Z3.mk_const(context.ptr, symbol_a, check(Z3.mk_string_sort(context.ptr))))
        Z3.inc_ref(context.ptr, constant_a)

        const symbol_b = check(Z3.mk_string_symbol(context.ptr, b))
        const constant_b = check(Z3.mk_const(context.ptr, symbol_b, check(Z3.mk_string_sort(context.ptr))))
        Z3.inc_ref(context.ptr, constant_b)

        const constraint = check(Z3.mk_eq(context.ptr, constant_a, constant_b))
        Z3.inc_ref(context.ptr, constraint)
        const node = new BoolConstructorRef(constraint)
        cleanup.register(node, () => {
            Z3.dec_ref(context.ptr, constant_a)
            Z3.dec_ref(context.ptr, constant_b)
            Z3.dec_ref(context.ptr, constraint)
        })
        return node
    }


    return extendedContext
}