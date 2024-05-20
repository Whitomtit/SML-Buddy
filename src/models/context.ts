import {
    AnyExpr,
    Ast,
    Bool,
    CoercibleToExpr,
    Context,
    Expr,
    FuncDecl,
    Sort,
    Z3_ast,
    Z3_error_code,
    Z3_sort,
    Z3_symbol,
    Z3_symbol_kind
} from "z3-solver";
import {assert} from "z3-solver/build/high-level/utils";
import {UnexpectedError} from "./errors";

export interface CustomContext<Name extends string> extends Context<Name> {
    readonly String: StringCreation<Name>;
}

export interface StringSort<Name extends string = 'main'> extends Sort<Name> {
}

export interface String<Name extends string = 'main'> extends Expr<Name, StringSort<Name>, Z3_ast> {
}

export interface StringCreation<Name extends string = 'main'> {
    sort(): StringSort<Name>;

    const(name: string): String<Name>;

    val(value: string): String<Name>;
}

export const createCustomContext = <Name extends string>(ctx: Context<Name>, Z3): CustomContext<Name> => {
    const dummyNode = ctx.Bool.val(true)

    const cleanup = new FinalizationRegistry<() => void>(callback => callback());

    type BoolConstructor = new (ast: Z3_ast) => typeof dummyNode
    const BoolConstructorRef = dummyNode.constructor as BoolConstructor

    const check = <T>(val: T): T => {
        if (Z3.get_error_code(ctx.ptr) !== Z3_error_code.Z3_OK) {
            throw new Error(Z3.get_error_msg(ctx.ptr, Z3.get_error_code(ctx.ptr)));
        }
        return val;
    }

    const _assertContext = (...ctxs: (Context<Name> | { ctx: Context<Name> })[]) => {
        ctxs.forEach(other => assert('ctx' in other ? ctx === other.ctx : ctx === other, 'Context mismatch'));
    }

    const _fromSymbol = (sym: Z3_symbol) => {
        const kind = check(Z3.get_symbol_kind(ctx.ptr, sym));
        switch (kind) {
            case Z3_symbol_kind.Z3_INT_SYMBOL:
                return Z3.get_symbol_int(ctx.ptr, sym);
            case Z3_symbol_kind.Z3_STRING_SYMBOL:
                return Z3.get_symbol_string(ctx.ptr, sym);
            default:
                throw new UnexpectedError()
        }
    }

    class AstImpl<Ptr extends Z3_ast> implements Ast<Name, Ptr> {
        declare readonly __typename: Ast['__typename'];
        readonly ctx: Context<Name>;

        constructor(readonly ptr: Ptr) {
            this.ctx = ctx;
            const myAst = this.ast;

            Z3.inc_ref(this.ctx.ptr, myAst);
            cleanup.register(this, () => Z3.dec_ref(this.ctx.ptr, myAst));
        }

        get ast(): Z3_ast {
            return this.ptr;
        }

        id() {
            return Z3.get_ast_id(this.ctx.ptr, this.ast);
        }

        eqIdentity(other: Ast<Name>) {
            _assertContext(other);
            return check(Z3.is_eq_ast(this.ctx.ptr, this.ast, other.ast));
        }

        neqIdentity(other: Ast<Name>) {
            _assertContext(other);
            return !this.eqIdentity(other);
        }

        sexpr() {
            return Z3.ast_to_string(this.ctx.ptr, this.ast);
        }

        hash() {
            return Z3.get_ast_hash(this.ctx.ptr, this.ast);
        }

        toString() {
            return this.sexpr();
        }
    }

    class StringSortImpl extends AstImpl<Z3_sort> implements StringSort<Name> {
        declare readonly __typename: Sort['__typename'];

        get ast(): Z3_ast {
            return Z3.sort_to_ast(this.ctx.ptr, this.ptr);
        }

        kind() {
            return Z3.get_sort_kind(this.ctx.ptr, this.ptr);
        }

        subsort(other: Sort<Name>) {
            _assertContext(other);
            return false;
        }

        cast(expr: Expr<Name>): Expr<Name> {
            _assertContext(expr);
            assert(expr.sort.eqIdentity(expr.sort), 'Sort mismatch');
            return expr;
        }

        name() {
            return _fromSymbol(Z3.get_sort_name(this.ctx.ptr, this.ptr));
        }

        eqIdentity(other: Sort<Name>) {
            _assertContext(other);
            return check(Z3.is_eq_sort(this.ctx.ptr, this.ptr, other.ptr));
        }

        neqIdentity(other: Sort<Name>) {
            return !this.eqIdentity(other);
        }
    }

    class StringImpl extends AstImpl<Z3_ast> implements String<Name> {
        declare readonly __typename: Expr['__typename'];

        get sort(): StringSortImpl {
            return new StringSortImpl(Z3.get_sort(this.ctx.ptr, this.ast))
        }

        eq(other: CoercibleToExpr<Name>): Bool<Name> {
            if (!(other instanceof StringImpl)) {
                throw new UnexpectedError()
            }
            return new BoolConstructorRef(check(Z3.mk_eq(this.ctx.ptr, this.ast, other.ast)))
        }

        neq(other: CoercibleToExpr<Name>): Bool<Name> {
            if (!(other instanceof StringImpl)) {
                throw new UnexpectedError()
            }
            return new BoolConstructorRef(
                check(
                    Z3.mk_distinct(
                        this.ctx.ptr,
                        [this.ast, other.ast],
                    ),
                ),
            );
        }

        name() {
            return this.decl().name();
        }

        params() {
            return this.decl().params();
        }

        decl(): FuncDecl<Name> {
            throw new UnexpectedError()
        }

        numArgs(): number {
            throw new UnexpectedError()
        }

        arg(i: number): AnyExpr<Name> {
            throw new UnexpectedError()
        }

        children(): AnyExpr<Name>[] {
            throw new UnexpectedError()
        }
    }

    return {
        ...ctx,
        String: {
            sort: () => new StringSortImpl(check(Z3.mk_string_sort(ctx.ptr))),
            const: (name: string) => {
                const symbol = check(Z3.mk_string_symbol(ctx.ptr, name))
                const constant = check(Z3.mk_const(ctx.ptr, symbol, check(Z3.mk_string_sort(ctx.ptr))))
                return new StringImpl(constant)
            },
            val: (value: string) => {
                const str = check(Z3.mk_string(ctx.ptr, value))
                return new StringImpl(str)
            },
        },
    }
}