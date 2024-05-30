import {
    AnyExpr,
    Ast,
    Bool,
    CoercibleToExpr,
    Context,
    Expr,
    FuncDecl,
    Model,
    Sort,
    Z3_app,
    Z3_apply_result,
    Z3_ast,
    Z3_ast_kind,
    Z3_ast_map,
    Z3_ast_print_mode,
    Z3_ast_vector,
    Z3_config,
    Z3_constructor,
    Z3_constructor_list,
    Z3_context,
    Z3_decl_kind,
    Z3_error_code,
    Z3_fixedpoint,
    Z3_func_decl,
    Z3_func_entry,
    Z3_func_interp,
    Z3_goal,
    Z3_goal_prec,
    Z3_lbool,
    Z3_model,
    Z3_optimize,
    Z3_param_descrs,
    Z3_param_kind,
    Z3_parameter_kind,
    Z3_params,
    Z3_parser_context,
    Z3_pattern,
    Z3_probe,
    Z3_rcf_num,
    Z3_simplifier,
    Z3_solver,
    Z3_solver_callback,
    Z3_sort,
    Z3_stats,
    Z3_symbol,
    Z3_symbol_kind,
    Z3_tactic
} from "z3-solver";
import {assert} from "z3-solver/build/high-level/utils";
import {UnexpectedError} from "./errors";

export interface CustomContext<Name extends string> extends Context<Name> {
    readonly String: StringCreation<Name>;
    AndBool: (a: Bool<Name>, b: Bool<Name>) => Bool<Name>;
    OrBool: (a: Bool<Name>, b: Bool<Name>) => Bool<Name>;
    EqBool: (a: Bool<Name>, b: Bool<Name>) => Bool<Name>;
}

export interface StringSort<Name extends string = 'main'> extends Sort<Name> {
}

export interface String<Name extends string = 'main'> extends Expr<Name, StringSort<Name>, Z3_ast> {
    concat(other: String<Name>): String<Name>;

    getFromModel(model: Model<Name>): string
}

export interface StringCreation<Name extends string = 'main'> {
    sort(): StringSort<Name>;

    const(name: string): String<Name>;

    val(value: string): String<Name>;
}

export const createCustomContext = <Name extends string>(ctx: Context<Name>, Z3: {
    mk_context?: (c: Z3_config) => Z3_context;
    mk_context_rc?: (c: Z3_config) => Z3_context;
    global_param_set?: (param_id: string, param_value: string) => void;
    global_param_reset_all?: () => void;
    global_param_get?: (param_id: string) => string | null;
    mk_config?: () => Z3_config;
    del_config?: (c: Z3_config) => void;
    set_param_value?: (c: Z3_config, param_id: string, param_value: string) => void;
    del_context?: (c: Z3_context) => void;
    inc_ref: any;
    dec_ref: any;
    update_param_value?: (c: Z3_context, param_id: string, param_value: string) => void;
    get_global_param_descrs?: (c: Z3_context) => Z3_param_descrs;
    interrupt?: (c: Z3_context) => void;
    enable_concurrent_dec_ref?: (c: Z3_context) => void;
    mk_params?: (c: Z3_context) => Z3_params;
    params_inc_ref?: (c: Z3_context, p: Z3_params) => void;
    params_dec_ref?: (c: Z3_context, p: Z3_params) => void;
    params_set_bool?: (c: Z3_context, p: Z3_params, k: Z3_symbol, v: boolean) => void;
    params_set_uint?: (c: Z3_context, p: Z3_params, k: Z3_symbol, v: number) => void;
    params_set_double?: (c: Z3_context, p: Z3_params, k: Z3_symbol, v: number) => void;
    params_set_symbol?: (c: Z3_context, p: Z3_params, k: Z3_symbol, v: Z3_symbol) => void;
    params_to_string?: (c: Z3_context, p: Z3_params) => string;
    params_validate?: (c: Z3_context, p: Z3_params, d: Z3_param_descrs) => void;
    param_descrs_inc_ref?: (c: Z3_context, p: Z3_param_descrs) => void;
    param_descrs_dec_ref?: (c: Z3_context, p: Z3_param_descrs) => void;
    param_descrs_get_kind?: (c: Z3_context, p: Z3_param_descrs, n: Z3_symbol) => Z3_param_kind;
    param_descrs_size?: (c: Z3_context, p: Z3_param_descrs) => number;
    param_descrs_get_name?: (c: Z3_context, p: Z3_param_descrs, i: number) => Z3_symbol;
    param_descrs_get_documentation?: (c: Z3_context, p: Z3_param_descrs, s: Z3_symbol) => string;
    param_descrs_to_string?: (c: Z3_context, p: Z3_param_descrs) => string;
    mk_int_symbol?: (c: Z3_context, i: number) => Z3_symbol;
    mk_string_symbol: any;
    mk_uninterpreted_sort?: (c: Z3_context, s: Z3_symbol) => Z3_sort;
    mk_type_variable?: (c: Z3_context, s: Z3_symbol) => Z3_sort;
    mk_bool_sort?: (c: Z3_context) => Z3_sort;
    mk_int_sort?: (c: Z3_context) => Z3_sort;
    mk_real_sort?: (c: Z3_context) => Z3_sort;
    mk_bv_sort?: (c: Z3_context, sz: number) => Z3_sort;
    mk_finite_domain_sort?: (c: Z3_context, name: Z3_symbol, size: bigint) => Z3_sort;
    mk_array_sort?: (c: Z3_context, domain: Z3_sort, range: Z3_sort) => Z3_sort;
    mk_array_sort_n?: (c: Z3_context, domain: Z3_sort[], range: Z3_sort) => Z3_sort;
    mk_tuple_sort?: (c: Z3_context, mk_tuple_name: Z3_symbol, field_names: Z3_symbol[], field_sorts: Z3_sort[]) => {
        rv: Z3_sort;
        mk_tuple_decl: Z3_func_decl;
        proj_decl: Z3_func_decl[];
    };
    mk_enumeration_sort?: (c: Z3_context, name: Z3_symbol, enum_names: Z3_symbol[]) => {
        rv: Z3_sort;
        enum_consts: Z3_func_decl[];
        enum_testers: Z3_func_decl[];
    };
    mk_list_sort?: (c: Z3_context, name: Z3_symbol, elem_sort: Z3_sort) => {
        rv: Z3_sort;
        nil_decl: Z3_func_decl;
        is_nil_decl: Z3_func_decl;
        cons_decl: Z3_func_decl;
        is_cons_decl: Z3_func_decl;
        head_decl: Z3_func_decl;
        tail_decl: Z3_func_decl;
    };
    mk_constructor?: (c: Z3_context, name: Z3_symbol, recognizer: Z3_symbol, field_names: Z3_symbol[], sorts: (Z3_sort | null)[], sort_refs: number[]) => Z3_constructor;
    constructor_num_fields?: (c: Z3_context, constr: Z3_constructor) => number;
    del_constructor?: (c: Z3_context, constr: Z3_constructor) => void;
    mk_datatype?: (c: Z3_context, name: Z3_symbol, constructors: Z3_constructor[]) => Z3_sort;
    mk_datatype_sort?: (c: Z3_context, name: Z3_symbol) => Z3_sort;
    mk_constructor_list?: (c: Z3_context, constructors: Z3_constructor[]) => Z3_constructor_list;
    del_constructor_list?: (c: Z3_context, clist: Z3_constructor_list) => void;
    mk_datatypes?: (c: Z3_context, sort_names: Z3_symbol[], constructor_lists: Z3_constructor_list[]) => Z3_sort[];
    query_constructor?: (c: Z3_context, constr: Z3_constructor, num_fields: number) => {
        constructor: Z3_func_decl;
        tester: Z3_func_decl;
        accessors: Z3_func_decl[];
    };
    mk_func_decl?: (c: Z3_context, s: Z3_symbol, domain: Z3_sort[], range: Z3_sort) => Z3_func_decl;
    mk_app?: (c: Z3_context, d: Z3_func_decl, args: Z3_ast[]) => Z3_ast;
    mk_const: any;
    mk_fresh_func_decl?: (c: Z3_context, prefix: string, domain: Z3_sort[], range: Z3_sort) => Z3_func_decl;
    mk_fresh_const?: (c: Z3_context, prefix: string, ty: Z3_sort) => Z3_ast;
    mk_rec_func_decl?: (c: Z3_context, s: Z3_symbol, domain: Z3_sort[], range: Z3_sort) => Z3_func_decl;
    add_rec_def?: (c: Z3_context, f: Z3_func_decl, args: Z3_ast[], body: Z3_ast) => void;
    mk_true?: (c: Z3_context) => Z3_ast;
    mk_false?: (c: Z3_context) => Z3_ast;
    mk_eq: any;
    mk_distinct: any;
    mk_not?: (c: Z3_context, a: Z3_ast) => Z3_ast;
    mk_ite?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast, t3: Z3_ast) => Z3_ast;
    mk_iff?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_implies?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_xor?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_and?: (c: Z3_context, args: Z3_ast[]) => Z3_ast;
    mk_or?: (c: Z3_context, args: Z3_ast[]) => Z3_ast;
    mk_add?: (c: Z3_context, args: Z3_ast[]) => Z3_ast;
    mk_mul?: (c: Z3_context, args: Z3_ast[]) => Z3_ast;
    mk_sub?: (c: Z3_context, args: Z3_ast[]) => Z3_ast;
    mk_unary_minus?: (c: Z3_context, arg: Z3_ast) => Z3_ast;
    mk_div?: (c: Z3_context, arg1: Z3_ast, arg2: Z3_ast) => Z3_ast;
    mk_mod?: (c: Z3_context, arg1: Z3_ast, arg2: Z3_ast) => Z3_ast;
    mk_rem?: (c: Z3_context, arg1: Z3_ast, arg2: Z3_ast) => Z3_ast;
    mk_power?: (c: Z3_context, arg1: Z3_ast, arg2: Z3_ast) => Z3_ast;
    mk_lt?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_le?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_gt?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_ge?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_divides?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_int2real?: (c: Z3_context, t1: Z3_ast) => Z3_ast;
    mk_real2int?: (c: Z3_context, t1: Z3_ast) => Z3_ast;
    mk_is_int?: (c: Z3_context, t1: Z3_ast) => Z3_ast;
    mk_bvnot?: (c: Z3_context, t1: Z3_ast) => Z3_ast;
    mk_bvredand?: (c: Z3_context, t1: Z3_ast) => Z3_ast;
    mk_bvredor?: (c: Z3_context, t1: Z3_ast) => Z3_ast;
    mk_bvand?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvor?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvxor?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvnand?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvnor?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvxnor?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvneg?: (c: Z3_context, t1: Z3_ast) => Z3_ast;
    mk_bvadd?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvsub?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvmul?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvudiv?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvsdiv?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvurem?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvsrem?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvsmod?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvult?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvslt?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvule?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvsle?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvuge?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvsge?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvugt?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvsgt?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_concat?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_extract?: (c: Z3_context, high: number, low: number, t1: Z3_ast) => Z3_ast;
    mk_sign_ext?: (c: Z3_context, i: number, t1: Z3_ast) => Z3_ast;
    mk_zero_ext?: (c: Z3_context, i: number, t1: Z3_ast) => Z3_ast;
    mk_repeat?: (c: Z3_context, i: number, t1: Z3_ast) => Z3_ast;
    mk_bit2bool?: (c: Z3_context, i: number, t1: Z3_ast) => Z3_ast;
    mk_bvshl?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvlshr?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvashr?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_rotate_left?: (c: Z3_context, i: number, t1: Z3_ast) => Z3_ast;
    mk_rotate_right?: (c: Z3_context, i: number, t1: Z3_ast) => Z3_ast;
    mk_ext_rotate_left?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_ext_rotate_right?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_int2bv?: (c: Z3_context, n: number, t1: Z3_ast) => Z3_ast;
    mk_bv2int?: (c: Z3_context, t1: Z3_ast, is_signed: boolean) => Z3_ast;
    mk_bvadd_no_overflow?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast, is_signed: boolean) => Z3_ast;
    mk_bvadd_no_underflow?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvsub_no_overflow?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvsub_no_underflow?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast, is_signed: boolean) => Z3_ast;
    mk_bvsdiv_no_overflow?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_bvneg_no_overflow?: (c: Z3_context, t1: Z3_ast) => Z3_ast;
    mk_bvmul_no_overflow?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast, is_signed: boolean) => Z3_ast;
    mk_bvmul_no_underflow?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_select?: (c: Z3_context, a: Z3_ast, i: Z3_ast) => Z3_ast;
    mk_select_n?: (c: Z3_context, a: Z3_ast, idxs: Z3_ast[]) => Z3_ast;
    mk_store?: (c: Z3_context, a: Z3_ast, i: Z3_ast, v: Z3_ast) => Z3_ast;
    mk_store_n?: (c: Z3_context, a: Z3_ast, idxs: Z3_ast[], v: Z3_ast) => Z3_ast;
    mk_const_array?: (c: Z3_context, domain: Z3_sort, v: Z3_ast) => Z3_ast;
    mk_map?: (c: Z3_context, f: Z3_func_decl, args: Z3_ast[]) => Z3_ast;
    mk_array_default?: (c: Z3_context, array: Z3_ast) => Z3_ast;
    mk_as_array?: (c: Z3_context, f: Z3_func_decl) => Z3_ast;
    mk_set_has_size?: (c: Z3_context, set: Z3_ast, k: Z3_ast) => Z3_ast;
    mk_set_sort?: (c: Z3_context, ty: Z3_sort) => Z3_sort;
    mk_empty_set?: (c: Z3_context, domain: Z3_sort) => Z3_ast;
    mk_full_set?: (c: Z3_context, domain: Z3_sort) => Z3_ast;
    mk_set_add?: (c: Z3_context, set: Z3_ast, elem: Z3_ast) => Z3_ast;
    mk_set_del?: (c: Z3_context, set: Z3_ast, elem: Z3_ast) => Z3_ast;
    mk_set_union?: (c: Z3_context, args: Z3_ast[]) => Z3_ast;
    mk_set_intersect?: (c: Z3_context, args: Z3_ast[]) => Z3_ast;
    mk_set_difference?: (c: Z3_context, arg1: Z3_ast, arg2: Z3_ast) => Z3_ast;
    mk_set_complement?: (c: Z3_context, arg: Z3_ast) => Z3_ast;
    mk_set_member?: (c: Z3_context, elem: Z3_ast, set: Z3_ast) => Z3_ast;
    mk_set_subset?: (c: Z3_context, arg1: Z3_ast, arg2: Z3_ast) => Z3_ast;
    mk_array_ext?: (c: Z3_context, arg1: Z3_ast, arg2: Z3_ast) => Z3_ast;
    mk_numeral?: (c: Z3_context, numeral: string, ty: Z3_sort) => Z3_ast;
    mk_real?: (c: Z3_context, num: number, den: number) => Z3_ast;
    mk_real_int64?: (c: Z3_context, num: bigint, den: bigint) => Z3_ast;
    mk_int?: (c: Z3_context, v: number, ty: Z3_sort) => Z3_ast;
    mk_unsigned_int?: (c: Z3_context, v: number, ty: Z3_sort) => Z3_ast;
    mk_int64?: (c: Z3_context, v: bigint, ty: Z3_sort) => Z3_ast;
    mk_unsigned_int64?: (c: Z3_context, v: bigint, ty: Z3_sort) => Z3_ast;
    mk_bv_numeral?: (c: Z3_context, bits: boolean[]) => Z3_ast;
    mk_seq_sort?: (c: Z3_context, s: Z3_sort) => Z3_sort;
    is_seq_sort?: (c: Z3_context, s: Z3_sort) => boolean;
    get_seq_sort_basis?: (c: Z3_context, s: Z3_sort) => Z3_sort;
    mk_re_sort?: (c: Z3_context, seq: Z3_sort) => Z3_sort;
    is_re_sort?: (c: Z3_context, s: Z3_sort) => boolean;
    get_re_sort_basis?: (c: Z3_context, s: Z3_sort) => Z3_sort;
    mk_string_sort: any;
    mk_char_sort?: (c: Z3_context) => Z3_sort;
    is_string_sort?: (c: Z3_context, s: Z3_sort) => boolean;
    is_char_sort?: (c: Z3_context, s: Z3_sort) => boolean;
    mk_string: any;
    mk_lstring?: (c: Z3_context, len: number, s: string) => Z3_ast;
    mk_u32string?: (c: Z3_context, chars: number[]) => Z3_ast;
    is_string?: (c: Z3_context, s: Z3_ast) => boolean;
    get_string?: (c: Z3_context, s: Z3_ast) => string;
    get_string_length?: (c: Z3_context, s: Z3_ast) => number;
    get_string_contents?: (c: Z3_context, s: Z3_ast, length: number) => number[];
    mk_seq_empty?: (c: Z3_context, seq: Z3_sort) => Z3_ast;
    mk_seq_unit?: (c: Z3_context, a: Z3_ast) => Z3_ast;
    mk_seq_concat: any;
    mk_seq_prefix?: (c: Z3_context, prefix: Z3_ast, s: Z3_ast) => Z3_ast;
    mk_seq_suffix?: (c: Z3_context, suffix: Z3_ast, s: Z3_ast) => Z3_ast;
    mk_seq_contains?: (c: Z3_context, container: Z3_ast, containee: Z3_ast) => Z3_ast;
    mk_str_lt?: (c: Z3_context, prefix: Z3_ast, s: Z3_ast) => Z3_ast;
    mk_str_le?: (c: Z3_context, prefix: Z3_ast, s: Z3_ast) => Z3_ast;
    mk_seq_extract?: (c: Z3_context, s: Z3_ast, offset: Z3_ast, length: Z3_ast) => Z3_ast;
    mk_seq_replace?: (c: Z3_context, s: Z3_ast, src: Z3_ast, dst: Z3_ast) => Z3_ast;
    mk_seq_at?: (c: Z3_context, s: Z3_ast, index: Z3_ast) => Z3_ast;
    mk_seq_nth?: (c: Z3_context, s: Z3_ast, index: Z3_ast) => Z3_ast;
    mk_seq_length?: (c: Z3_context, s: Z3_ast) => Z3_ast;
    mk_seq_index?: (c: Z3_context, s: Z3_ast, substr: Z3_ast, offset: Z3_ast) => Z3_ast;
    mk_seq_last_index?: (c: Z3_context, s: Z3_ast, substr: Z3_ast) => Z3_ast;
    mk_str_to_int?: (c: Z3_context, s: Z3_ast) => Z3_ast;
    mk_int_to_str?: (c: Z3_context, s: Z3_ast) => Z3_ast;
    mk_string_to_code?: (c: Z3_context, a: Z3_ast) => Z3_ast;
    mk_string_from_code?: (c: Z3_context, a: Z3_ast) => Z3_ast;
    mk_ubv_to_str?: (c: Z3_context, s: Z3_ast) => Z3_ast;
    mk_sbv_to_str?: (c: Z3_context, s: Z3_ast) => Z3_ast;
    mk_seq_to_re?: (c: Z3_context, seq: Z3_ast) => Z3_ast;
    mk_seq_in_re?: (c: Z3_context, seq: Z3_ast, re: Z3_ast) => Z3_ast;
    mk_re_plus?: (c: Z3_context, re: Z3_ast) => Z3_ast;
    mk_re_star?: (c: Z3_context, re: Z3_ast) => Z3_ast;
    mk_re_option?: (c: Z3_context, re: Z3_ast) => Z3_ast;
    mk_re_union?: (c: Z3_context, args: Z3_ast[]) => Z3_ast;
    mk_re_concat?: (c: Z3_context, args: Z3_ast[]) => Z3_ast;
    mk_re_range?: (c: Z3_context, lo: Z3_ast, hi: Z3_ast) => Z3_ast;
    mk_re_allchar?: (c: Z3_context, regex_sort: Z3_sort) => Z3_ast;
    mk_re_loop?: (c: Z3_context, r: Z3_ast, lo: number, hi: number) => Z3_ast;
    mk_re_power?: (c: Z3_context, re: Z3_ast, n: number) => Z3_ast;
    mk_re_intersect?: (c: Z3_context, args: Z3_ast[]) => Z3_ast;
    mk_re_complement?: (c: Z3_context, re: Z3_ast) => Z3_ast;
    mk_re_diff?: (c: Z3_context, re1: Z3_ast, re2: Z3_ast) => Z3_ast;
    mk_re_empty?: (c: Z3_context, re: Z3_sort) => Z3_ast;
    mk_re_full?: (c: Z3_context, re: Z3_sort) => Z3_ast;
    mk_char?: (c: Z3_context, ch: number) => Z3_ast;
    mk_char_le?: (c: Z3_context, ch1: Z3_ast, ch2: Z3_ast) => Z3_ast;
    mk_char_to_int?: (c: Z3_context, ch: Z3_ast) => Z3_ast;
    mk_char_to_bv?: (c: Z3_context, ch: Z3_ast) => Z3_ast;
    mk_char_from_bv?: (c: Z3_context, bv: Z3_ast) => Z3_ast;
    mk_char_is_digit?: (c: Z3_context, ch: Z3_ast) => Z3_ast;
    mk_linear_order?: (c: Z3_context, a: Z3_sort, id: number) => Z3_func_decl;
    mk_partial_order?: (c: Z3_context, a: Z3_sort, id: number) => Z3_func_decl;
    mk_piecewise_linear_order?: (c: Z3_context, a: Z3_sort, id: number) => Z3_func_decl;
    mk_tree_order?: (c: Z3_context, a: Z3_sort, id: number) => Z3_func_decl;
    mk_transitive_closure?: (c: Z3_context, f: Z3_func_decl) => Z3_func_decl;
    mk_pattern?: (c: Z3_context, terms: Z3_ast[]) => Z3_pattern;
    mk_bound?: (c: Z3_context, index: number, ty: Z3_sort) => Z3_ast;
    mk_forall?: (c: Z3_context, weight: number, patterns: Z3_pattern[], sorts: Z3_sort[], decl_names: Z3_symbol[], body: Z3_ast) => Z3_ast;
    mk_exists?: (c: Z3_context, weight: number, patterns: Z3_pattern[], sorts: Z3_sort[], decl_names: Z3_symbol[], body: Z3_ast) => Z3_ast;
    mk_quantifier?: (c: Z3_context, is_forall: boolean, weight: number, patterns: Z3_pattern[], sorts: Z3_sort[], decl_names: Z3_symbol[], body: Z3_ast) => Z3_ast;
    mk_quantifier_ex?: (c: Z3_context, is_forall: boolean, weight: number, quantifier_id: Z3_symbol, skolem_id: Z3_symbol, patterns: Z3_pattern[], no_patterns: Z3_ast[], sorts: Z3_sort[], decl_names: Z3_symbol[], body: Z3_ast) => Z3_ast;
    mk_forall_const?: (c: Z3_context, weight: number, bound: Z3_app[], patterns: Z3_pattern[], body: Z3_ast) => Z3_ast;
    mk_exists_const?: (c: Z3_context, weight: number, bound: Z3_app[], patterns: Z3_pattern[], body: Z3_ast) => Z3_ast;
    mk_quantifier_const?: (c: Z3_context, is_forall: boolean, weight: number, bound: Z3_app[], patterns: Z3_pattern[], body: Z3_ast) => Z3_ast;
    mk_quantifier_const_ex?: (c: Z3_context, is_forall: boolean, weight: number, quantifier_id: Z3_symbol, skolem_id: Z3_symbol, bound: Z3_app[], patterns: Z3_pattern[], no_patterns: Z3_ast[], body: Z3_ast) => Z3_ast;
    mk_lambda?: (c: Z3_context, sorts: Z3_sort[], decl_names: Z3_symbol[], body: Z3_ast) => Z3_ast;
    mk_lambda_const?: (c: Z3_context, bound: Z3_app[], body: Z3_ast) => Z3_ast;
    get_symbol_kind: any;
    get_symbol_int: any;
    get_symbol_string: any;
    get_sort_name: any;
    get_sort_id?: (c: Z3_context, s: Z3_sort) => number;
    sort_to_ast: any;
    is_eq_sort: any;
    get_sort_kind: any;
    get_bv_sort_size?: (c: Z3_context, t: Z3_sort) => number;
    get_finite_domain_sort_size?: (c: Z3_context, s: Z3_sort) => bigint | null;
    get_array_sort_domain?: (c: Z3_context, t: Z3_sort) => Z3_sort;
    get_array_sort_domain_n?: (c: Z3_context, t: Z3_sort, idx: number) => Z3_sort;
    get_array_sort_range?: (c: Z3_context, t: Z3_sort) => Z3_sort;
    get_tuple_sort_mk_decl?: (c: Z3_context, t: Z3_sort) => Z3_func_decl;
    get_tuple_sort_num_fields?: (c: Z3_context, t: Z3_sort) => number;
    get_tuple_sort_field_decl?: (c: Z3_context, t: Z3_sort, i: number) => Z3_func_decl;
    get_datatype_sort_num_constructors?: (c: Z3_context, t: Z3_sort) => number;
    get_datatype_sort_constructor?: (c: Z3_context, t: Z3_sort, idx: number) => Z3_func_decl;
    get_datatype_sort_recognizer?: (c: Z3_context, t: Z3_sort, idx: number) => Z3_func_decl;
    get_datatype_sort_constructor_accessor?: (c: Z3_context, t: Z3_sort, idx_c: number, idx_a: number) => Z3_func_decl;
    datatype_update_field?: (c: Z3_context, field_access: Z3_func_decl, t: Z3_ast, value: Z3_ast) => Z3_ast;
    get_relation_arity?: (c: Z3_context, s: Z3_sort) => number;
    get_relation_column?: (c: Z3_context, s: Z3_sort, col: number) => Z3_sort;
    mk_atmost?: (c: Z3_context, args: Z3_ast[], k: number) => Z3_ast;
    mk_atleast?: (c: Z3_context, args: Z3_ast[], k: number) => Z3_ast;
    mk_pble?: (c: Z3_context, args: Z3_ast[], coeffs: number[], k: number) => Z3_ast;
    mk_pbge?: (c: Z3_context, args: Z3_ast[], coeffs: number[], k: number) => Z3_ast;
    mk_pbeq?: (c: Z3_context, args: Z3_ast[], coeffs: number[], k: number) => Z3_ast;
    func_decl_to_ast?: (c: Z3_context, f: Z3_func_decl) => Z3_ast;
    is_eq_func_decl?: (c: Z3_context, f1: Z3_func_decl, f2: Z3_func_decl) => boolean;
    get_func_decl_id?: (c: Z3_context, f: Z3_func_decl) => number;
    get_decl_name?: (c: Z3_context, d: Z3_func_decl) => Z3_symbol;
    get_decl_kind?: (c: Z3_context, d: Z3_func_decl) => Z3_decl_kind;
    get_domain_size?: (c: Z3_context, d: Z3_func_decl) => number;
    get_arity?: (c: Z3_context, d: Z3_func_decl) => number;
    get_domain?: (c: Z3_context, d: Z3_func_decl, i: number) => Z3_sort;
    get_range?: (c: Z3_context, d: Z3_func_decl) => Z3_sort;
    get_decl_num_parameters?: (c: Z3_context, d: Z3_func_decl) => number;
    get_decl_parameter_kind?: (c: Z3_context, d: Z3_func_decl, idx: number) => Z3_parameter_kind;
    get_decl_int_parameter?: (c: Z3_context, d: Z3_func_decl, idx: number) => number;
    get_decl_double_parameter?: (c: Z3_context, d: Z3_func_decl, idx: number) => number;
    get_decl_symbol_parameter?: (c: Z3_context, d: Z3_func_decl, idx: number) => Z3_symbol;
    get_decl_sort_parameter?: (c: Z3_context, d: Z3_func_decl, idx: number) => Z3_sort;
    get_decl_ast_parameter?: (c: Z3_context, d: Z3_func_decl, idx: number) => Z3_ast;
    get_decl_func_decl_parameter?: (c: Z3_context, d: Z3_func_decl, idx: number) => Z3_func_decl;
    get_decl_rational_parameter?: (c: Z3_context, d: Z3_func_decl, idx: number) => string;
    app_to_ast?: (c: Z3_context, a: Z3_app) => Z3_ast;
    get_app_decl?: (c: Z3_context, a: Z3_app) => Z3_func_decl;
    get_app_num_args?: (c: Z3_context, a: Z3_app) => number;
    get_app_arg?: (c: Z3_context, a: Z3_app, i: number) => Z3_ast;
    is_eq_ast: any;
    get_ast_id: any;
    get_ast_hash: any;
    get_sort: any;
    is_well_sorted?: (c: Z3_context, t: Z3_ast) => boolean;
    get_bool_value?: (c: Z3_context, a: Z3_ast) => Z3_lbool;
    get_ast_kind?: (c: Z3_context, a: Z3_ast) => Z3_ast_kind;
    is_app?: (c: Z3_context, a: Z3_ast) => boolean;
    is_numeral_ast?: (c: Z3_context, a: Z3_ast) => boolean;
    is_algebraic_number?: (c: Z3_context, a: Z3_ast) => boolean;
    to_app?: (c: Z3_context, a: Z3_ast) => Z3_app;
    to_func_decl?: (c: Z3_context, a: Z3_ast) => Z3_func_decl;
    get_numeral_string?: (c: Z3_context, a: Z3_ast) => string;
    get_numeral_binary_string?: (c: Z3_context, a: Z3_ast) => string;
    get_numeral_decimal_string?: (c: Z3_context, a: Z3_ast, precision: number) => string;
    get_numeral_double?: (c: Z3_context, a: Z3_ast) => number;
    get_numerator?: (c: Z3_context, a: Z3_ast) => Z3_ast;
    get_denominator?: (c: Z3_context, a: Z3_ast) => Z3_ast;
    get_numeral_small?: (c: Z3_context, a: Z3_ast) => { num: bigint; den: bigint; } | null;
    get_numeral_int?: (c: Z3_context, v: Z3_ast) => number | null;
    get_numeral_uint?: (c: Z3_context, v: Z3_ast) => number | null;
    get_numeral_uint64?: (c: Z3_context, v: Z3_ast) => bigint | null;
    get_numeral_int64?: (c: Z3_context, v: Z3_ast) => bigint | null;
    get_numeral_rational_int64?: (c: Z3_context, v: Z3_ast) => { num: bigint; den: bigint; } | null;
    get_algebraic_number_lower?: (c: Z3_context, a: Z3_ast, precision: number) => Z3_ast;
    get_algebraic_number_upper?: (c: Z3_context, a: Z3_ast, precision: number) => Z3_ast;
    pattern_to_ast?: (c: Z3_context, p: Z3_pattern) => Z3_ast;
    get_pattern_num_terms?: (c: Z3_context, p: Z3_pattern) => number;
    get_pattern?: (c: Z3_context, p: Z3_pattern, idx: number) => Z3_ast;
    get_index_value?: (c: Z3_context, a: Z3_ast) => number;
    is_quantifier_forall?: (c: Z3_context, a: Z3_ast) => boolean;
    is_quantifier_exists?: (c: Z3_context, a: Z3_ast) => boolean;
    is_lambda?: (c: Z3_context, a: Z3_ast) => boolean;
    get_quantifier_weight?: (c: Z3_context, a: Z3_ast) => number;
    get_quantifier_skolem_id?: (c: Z3_context, a: Z3_ast) => Z3_symbol;
    get_quantifier_id?: (c: Z3_context, a: Z3_ast) => Z3_symbol;
    get_quantifier_num_patterns?: (c: Z3_context, a: Z3_ast) => number;
    get_quantifier_pattern_ast?: (c: Z3_context, a: Z3_ast, i: number) => Z3_pattern;
    get_quantifier_num_no_patterns?: (c: Z3_context, a: Z3_ast) => number;
    get_quantifier_no_pattern_ast?: (c: Z3_context, a: Z3_ast, i: number) => Z3_ast;
    get_quantifier_num_bound?: (c: Z3_context, a: Z3_ast) => number;
    get_quantifier_bound_name?: (c: Z3_context, a: Z3_ast, i: number) => Z3_symbol;
    get_quantifier_bound_sort?: (c: Z3_context, a: Z3_ast, i: number) => Z3_sort;
    get_quantifier_body?: (c: Z3_context, a: Z3_ast) => Z3_ast;
    simplify?: (c: Z3_context, a: Z3_ast) => Promise<Z3_ast>;
    simplify_ex?: (c: Z3_context, a: Z3_ast, p: Z3_params) => Promise<Z3_ast>;
    simplify_get_help?: (c: Z3_context) => string;
    simplify_get_param_descrs?: (c: Z3_context) => Z3_param_descrs;
    update_term?: (c: Z3_context, a: Z3_ast, args: Z3_ast[]) => Z3_ast;
    substitute?: (c: Z3_context, a: Z3_ast, from: Z3_ast[], to: Z3_ast[]) => Z3_ast;
    substitute_vars?: (c: Z3_context, a: Z3_ast, to: Z3_ast[]) => Z3_ast;
    substitute_funs?: (c: Z3_context, a: Z3_ast, from: Z3_func_decl[], to: Z3_ast[]) => Z3_ast;
    translate?: (source: Z3_context, a: Z3_ast, target: Z3_context) => Z3_ast;
    mk_model?: (c: Z3_context) => Z3_model;
    model_inc_ref?: (c: Z3_context, m: Z3_model) => void;
    model_dec_ref?: (c: Z3_context, m: Z3_model) => void;
    model_eval?: (c: Z3_context, m: Z3_model, t: Z3_ast, model_completion: boolean) => Z3_ast | null;
    model_get_const_interp?: (c: Z3_context, m: Z3_model, a: Z3_func_decl) => Z3_ast | null;
    model_has_interp?: (c: Z3_context, m: Z3_model, a: Z3_func_decl) => boolean;
    model_get_func_interp?: (c: Z3_context, m: Z3_model, f: Z3_func_decl) => Z3_func_interp | null;
    model_get_num_consts?: (c: Z3_context, m: Z3_model) => number;
    model_get_const_decl?: (c: Z3_context, m: Z3_model, i: number) => Z3_func_decl;
    model_get_num_funcs?: (c: Z3_context, m: Z3_model) => number;
    model_get_func_decl?: (c: Z3_context, m: Z3_model, i: number) => Z3_func_decl;
    model_get_num_sorts?: (c: Z3_context, m: Z3_model) => number;
    model_get_sort?: (c: Z3_context, m: Z3_model, i: number) => Z3_sort;
    model_get_sort_universe?: (c: Z3_context, m: Z3_model, s: Z3_sort) => Z3_ast_vector;
    model_translate?: (c: Z3_context, m: Z3_model, dst: Z3_context) => Z3_model;
    is_as_array?: (c: Z3_context, a: Z3_ast) => boolean;
    get_as_array_func_decl?: (c: Z3_context, a: Z3_ast) => Z3_func_decl;
    add_func_interp?: (c: Z3_context, m: Z3_model, f: Z3_func_decl, default_value: Z3_ast) => Z3_func_interp;
    add_const_interp?: (c: Z3_context, m: Z3_model, f: Z3_func_decl, a: Z3_ast) => void;
    func_interp_inc_ref?: (c: Z3_context, f: Z3_func_interp) => void;
    func_interp_dec_ref?: (c: Z3_context, f: Z3_func_interp) => void;
    func_interp_get_num_entries?: (c: Z3_context, f: Z3_func_interp) => number;
    func_interp_get_entry?: (c: Z3_context, f: Z3_func_interp, i: number) => Z3_func_entry;
    func_interp_get_else?: (c: Z3_context, f: Z3_func_interp) => Z3_ast;
    func_interp_set_else?: (c: Z3_context, f: Z3_func_interp, else_value: Z3_ast) => void;
    func_interp_get_arity?: (c: Z3_context, f: Z3_func_interp) => number;
    func_interp_add_entry?: (c: Z3_context, fi: Z3_func_interp, args: Z3_ast_vector, value: Z3_ast) => void;
    func_entry_inc_ref?: (c: Z3_context, e: Z3_func_entry) => void;
    func_entry_dec_ref?: (c: Z3_context, e: Z3_func_entry) => void;
    func_entry_get_value?: (c: Z3_context, e: Z3_func_entry) => Z3_ast;
    func_entry_get_num_args?: (c: Z3_context, e: Z3_func_entry) => number;
    func_entry_get_arg?: (c: Z3_context, e: Z3_func_entry, i: number) => Z3_ast;
    open_log?: (filename: string) => boolean;
    append_log?: (string: string) => void;
    close_log?: () => void;
    toggle_warning_messages?: (enabled: boolean) => void;
    set_ast_print_mode?: (c: Z3_context, mode: Z3_ast_print_mode) => void;
    ast_to_string: any;
    pattern_to_string?: (c: Z3_context, p: Z3_pattern) => string;
    sort_to_string?: (c: Z3_context, s: Z3_sort) => string;
    func_decl_to_string?: (c: Z3_context, d: Z3_func_decl) => string;
    model_to_string?: (c: Z3_context, m: Z3_model) => string;
    benchmark_to_smtlib_string?: (c: Z3_context, name: string, logic: string, status: string, attributes: string, assumptions: Z3_ast[], formula: Z3_ast) => string;
    parse_smtlib2_string?: (c: Z3_context, str: string, sort_names: Z3_symbol[], sorts: Z3_sort[], decl_names: Z3_symbol[], decls: Z3_func_decl[]) => Z3_ast_vector;
    parse_smtlib2_file?: (c: Z3_context, file_name: string, sort_names: Z3_symbol[], sorts: Z3_sort[], decl_names: Z3_symbol[], decls: Z3_func_decl[]) => Z3_ast_vector;
    eval_smtlib2_string?: (c: Z3_context, str: string) => Promise<string>;
    mk_parser_context?: (c: Z3_context) => Z3_parser_context;
    parser_context_inc_ref?: (c: Z3_context, pc: Z3_parser_context) => void;
    parser_context_dec_ref?: (c: Z3_context, pc: Z3_parser_context) => void;
    parser_context_add_sort?: (c: Z3_context, pc: Z3_parser_context, s: Z3_sort) => void;
    parser_context_add_decl?: (c: Z3_context, pc: Z3_parser_context, f: Z3_func_decl) => void;
    parser_context_from_string?: (c: Z3_context, pc: Z3_parser_context, s: string) => Z3_ast_vector;
    get_error_code: any;
    set_error?: (c: Z3_context, e: Z3_error_code) => void;
    get_error_msg: any;
    get_version?: () => { major: number; minor: number; build_number: number; revision_number: number; };
    get_full_version?: () => string;
    enable_trace?: (tag: string) => void;
    disable_trace?: (tag: string) => void;
    reset_memory?: () => void;
    finalize_memory?: () => void;
    mk_goal?: (c: Z3_context, models: boolean, unsat_cores: boolean, proofs: boolean) => Z3_goal;
    goal_inc_ref?: (c: Z3_context, g: Z3_goal) => void;
    goal_dec_ref?: (c: Z3_context, g: Z3_goal) => void;
    goal_precision?: (c: Z3_context, g: Z3_goal) => Z3_goal_prec;
    goal_assert?: (c: Z3_context, g: Z3_goal, a: Z3_ast) => void;
    goal_inconsistent?: (c: Z3_context, g: Z3_goal) => boolean;
    goal_depth?: (c: Z3_context, g: Z3_goal) => number;
    goal_reset?: (c: Z3_context, g: Z3_goal) => void;
    goal_size?: (c: Z3_context, g: Z3_goal) => number;
    goal_formula?: (c: Z3_context, g: Z3_goal, idx: number) => Z3_ast;
    goal_num_exprs?: (c: Z3_context, g: Z3_goal) => number;
    goal_is_decided_sat?: (c: Z3_context, g: Z3_goal) => boolean;
    goal_is_decided_unsat?: (c: Z3_context, g: Z3_goal) => boolean;
    goal_translate?: (source: Z3_context, g: Z3_goal, target: Z3_context) => Z3_goal;
    goal_convert_model?: (c: Z3_context, g: Z3_goal, m: Z3_model) => Z3_model;
    goal_to_string?: (c: Z3_context, g: Z3_goal) => string;
    goal_to_dimacs_string?: (c: Z3_context, g: Z3_goal, include_names: boolean) => string;
    mk_tactic?: (c: Z3_context, name: string) => Z3_tactic;
    tactic_inc_ref?: (c: Z3_context, t: Z3_tactic) => void;
    tactic_dec_ref?: (c: Z3_context, g: Z3_tactic) => void;
    mk_probe?: (c: Z3_context, name: string) => Z3_probe;
    probe_inc_ref?: (c: Z3_context, p: Z3_probe) => void;
    probe_dec_ref?: (c: Z3_context, p: Z3_probe) => void;
    tactic_and_then?: (c: Z3_context, t1: Z3_tactic, t2: Z3_tactic) => Z3_tactic;
    tactic_or_else?: (c: Z3_context, t1: Z3_tactic, t2: Z3_tactic) => Z3_tactic;
    tactic_par_or?: (c: Z3_context, ts: Z3_tactic[]) => Z3_tactic;
    tactic_par_and_then?: (c: Z3_context, t1: Z3_tactic, t2: Z3_tactic) => Z3_tactic;
    tactic_try_for?: (c: Z3_context, t: Z3_tactic, ms: number) => Z3_tactic;
    tactic_when?: (c: Z3_context, p: Z3_probe, t: Z3_tactic) => Z3_tactic;
    tactic_cond?: (c: Z3_context, p: Z3_probe, t1: Z3_tactic, t2: Z3_tactic) => Z3_tactic;
    tactic_repeat?: (c: Z3_context, t: Z3_tactic, max: number) => Z3_tactic;
    tactic_skip?: (c: Z3_context) => Z3_tactic;
    tactic_fail?: (c: Z3_context) => Z3_tactic;
    tactic_fail_if?: (c: Z3_context, p: Z3_probe) => Z3_tactic;
    tactic_fail_if_not_decided?: (c: Z3_context) => Z3_tactic;
    tactic_using_params?: (c: Z3_context, t: Z3_tactic, p: Z3_params) => Z3_tactic;
    mk_simplifier?: (c: Z3_context, name: string) => Z3_simplifier;
    simplifier_inc_ref?: (c: Z3_context, t: Z3_simplifier) => void;
    simplifier_dec_ref?: (c: Z3_context, g: Z3_simplifier) => void;
    solver_add_simplifier?: (c: Z3_context, solver: Z3_solver, simplifier: Z3_simplifier) => Z3_solver;
    simplifier_and_then?: (c: Z3_context, t1: Z3_simplifier, t2: Z3_simplifier) => Z3_simplifier;
    simplifier_using_params?: (c: Z3_context, t: Z3_simplifier, p: Z3_params) => Z3_simplifier;
    get_num_simplifiers?: (c: Z3_context) => number;
    get_simplifier_name?: (c: Z3_context, i: number) => string;
    simplifier_get_help?: (c: Z3_context, t: Z3_simplifier) => string;
    simplifier_get_param_descrs?: (c: Z3_context, t: Z3_simplifier) => Z3_param_descrs;
    simplifier_get_descr?: (c: Z3_context, name: string) => string;
    probe_const?: (x: Z3_context, val: number) => Z3_probe;
    probe_lt?: (x: Z3_context, p1: Z3_probe, p2: Z3_probe) => Z3_probe;
    probe_gt?: (x: Z3_context, p1: Z3_probe, p2: Z3_probe) => Z3_probe;
    probe_le?: (x: Z3_context, p1: Z3_probe, p2: Z3_probe) => Z3_probe;
    probe_ge?: (x: Z3_context, p1: Z3_probe, p2: Z3_probe) => Z3_probe;
    probe_eq?: (x: Z3_context, p1: Z3_probe, p2: Z3_probe) => Z3_probe;
    probe_and?: (x: Z3_context, p1: Z3_probe, p2: Z3_probe) => Z3_probe;
    probe_or?: (x: Z3_context, p1: Z3_probe, p2: Z3_probe) => Z3_probe;
    probe_not?: (x: Z3_context, p: Z3_probe) => Z3_probe;
    get_num_tactics?: (c: Z3_context) => number;
    get_tactic_name?: (c: Z3_context, i: number) => string;
    get_num_probes?: (c: Z3_context) => number;
    get_probe_name?: (c: Z3_context, i: number) => string;
    tactic_get_help?: (c: Z3_context, t: Z3_tactic) => string;
    tactic_get_param_descrs?: (c: Z3_context, t: Z3_tactic) => Z3_param_descrs;
    tactic_get_descr?: (c: Z3_context, name: string) => string;
    probe_get_descr?: (c: Z3_context, name: string) => string;
    probe_apply?: (c: Z3_context, p: Z3_probe, g: Z3_goal) => number;
    tactic_apply?: (c: Z3_context, t: Z3_tactic, g: Z3_goal) => Promise<Z3_apply_result>;
    tactic_apply_ex?: (c: Z3_context, t: Z3_tactic, g: Z3_goal, p: Z3_params) => Promise<Z3_apply_result>;
    apply_result_inc_ref?: (c: Z3_context, r: Z3_apply_result) => void;
    apply_result_dec_ref?: (c: Z3_context, r: Z3_apply_result) => void;
    apply_result_to_string?: (c: Z3_context, r: Z3_apply_result) => string;
    apply_result_get_num_subgoals?: (c: Z3_context, r: Z3_apply_result) => number;
    apply_result_get_subgoal?: (c: Z3_context, r: Z3_apply_result, i: number) => Z3_goal;
    mk_solver?: (c: Z3_context) => Z3_solver;
    mk_simple_solver?: (c: Z3_context) => Z3_solver;
    mk_solver_for_logic?: (c: Z3_context, logic: Z3_symbol) => Z3_solver;
    mk_solver_from_tactic?: (c: Z3_context, t: Z3_tactic) => Z3_solver;
    solver_translate?: (source: Z3_context, s: Z3_solver, target: Z3_context) => Z3_solver;
    solver_import_model_converter?: (ctx: Z3_context, src: Z3_solver, dst: Z3_solver) => void;
    solver_get_help?: (c: Z3_context, s: Z3_solver) => string;
    solver_get_param_descrs?: (c: Z3_context, s: Z3_solver) => Z3_param_descrs;
    solver_set_params?: (c: Z3_context, s: Z3_solver, p: Z3_params) => void;
    solver_inc_ref?: (c: Z3_context, s: Z3_solver) => void;
    solver_dec_ref?: (c: Z3_context, s: Z3_solver) => void;
    solver_interrupt?: (c: Z3_context, s: Z3_solver) => void;
    solver_push?: (c: Z3_context, s: Z3_solver) => void;
    solver_pop?: (c: Z3_context, s: Z3_solver, n: number) => void;
    solver_reset?: (c: Z3_context, s: Z3_solver) => void;
    solver_get_num_scopes?: (c: Z3_context, s: Z3_solver) => number;
    solver_assert?: (c: Z3_context, s: Z3_solver, a: Z3_ast) => void;
    solver_assert_and_track?: (c: Z3_context, s: Z3_solver, a: Z3_ast, p: Z3_ast) => void;
    solver_from_file?: (c: Z3_context, s: Z3_solver, file_name: string) => void;
    solver_from_string?: (c: Z3_context, s: Z3_solver, file_name: string) => void;
    solver_get_assertions?: (c: Z3_context, s: Z3_solver) => Z3_ast_vector;
    solver_get_units?: (c: Z3_context, s: Z3_solver) => Z3_ast_vector;
    solver_get_trail?: (c: Z3_context, s: Z3_solver) => Z3_ast_vector;
    solver_get_non_units?: (c: Z3_context, s: Z3_solver) => Z3_ast_vector;
    solver_get_levels?: (c: Z3_context, s: Z3_solver, literals: Z3_ast_vector, levels: number[]) => void;
    solver_congruence_root?: (c: Z3_context, s: Z3_solver, a: Z3_ast) => Z3_ast;
    solver_congruence_next?: (c: Z3_context, s: Z3_solver, a: Z3_ast) => Z3_ast;
    solver_next_split?: (c: Z3_context, cb: Z3_solver_callback, t: Z3_ast, idx: number, phase: Z3_lbool) => boolean;
    solver_propagate_declare?: (c: Z3_context, name: Z3_symbol, domain: Z3_sort[], range: Z3_sort) => Z3_func_decl;
    solver_propagate_register?: (c: Z3_context, s: Z3_solver, e: Z3_ast) => void;
    solver_propagate_register_cb?: (c: Z3_context, cb: Z3_solver_callback, e: Z3_ast) => void;
    solver_propagate_consequence?: (c: Z3_context, cb: Z3_solver_callback, fixed: Z3_ast[], eq_lhs: Z3_ast[], eq_rhs: Z3_ast[], conseq: Z3_ast) => boolean;
    solver_check?: (c: Z3_context, s: Z3_solver) => Promise<Z3_lbool>;
    solver_check_assumptions?: (c: Z3_context, s: Z3_solver, assumptions: Z3_ast[]) => Promise<Z3_lbool>;
    get_implied_equalities?: (c: Z3_context, s: Z3_solver, terms: Z3_ast[]) => { rv: Z3_lbool; class_ids: number[]; };
    solver_get_consequences?: (c: Z3_context, s: Z3_solver, assumptions: Z3_ast_vector, variables: Z3_ast_vector, consequences: Z3_ast_vector) => Promise<Z3_lbool>;
    solver_cube?: (c: Z3_context, s: Z3_solver, vars: Z3_ast_vector, backtrack_level: number) => Promise<Z3_ast_vector>;
    solver_get_model?: (c: Z3_context, s: Z3_solver) => Z3_model;
    solver_get_proof?: (c: Z3_context, s: Z3_solver) => Z3_ast;
    solver_get_unsat_core?: (c: Z3_context, s: Z3_solver) => Z3_ast_vector;
    solver_get_reason_unknown?: (c: Z3_context, s: Z3_solver) => string;
    solver_get_statistics?: (c: Z3_context, s: Z3_solver) => Z3_stats;
    solver_to_string?: (c: Z3_context, s: Z3_solver) => string;
    solver_to_dimacs_string?: (c: Z3_context, s: Z3_solver, include_names: boolean) => string;
    stats_to_string?: (c: Z3_context, s: Z3_stats) => string;
    stats_inc_ref?: (c: Z3_context, s: Z3_stats) => void;
    stats_dec_ref?: (c: Z3_context, s: Z3_stats) => void;
    stats_size?: (c: Z3_context, s: Z3_stats) => number;
    stats_get_key?: (c: Z3_context, s: Z3_stats, idx: number) => string;
    stats_is_uint?: (c: Z3_context, s: Z3_stats, idx: number) => boolean;
    stats_is_double?: (c: Z3_context, s: Z3_stats, idx: number) => boolean;
    stats_get_uint_value?: (c: Z3_context, s: Z3_stats, idx: number) => number;
    stats_get_double_value?: (c: Z3_context, s: Z3_stats, idx: number) => number;
    get_estimated_alloc_size?: () => bigint;
    algebraic_is_value?: (c: Z3_context, a: Z3_ast) => boolean;
    algebraic_is_pos?: (c: Z3_context, a: Z3_ast) => boolean;
    algebraic_is_neg?: (c: Z3_context, a: Z3_ast) => boolean;
    algebraic_is_zero?: (c: Z3_context, a: Z3_ast) => boolean;
    algebraic_sign?: (c: Z3_context, a: Z3_ast) => number;
    algebraic_add?: (c: Z3_context, a: Z3_ast, b: Z3_ast) => Z3_ast;
    algebraic_sub?: (c: Z3_context, a: Z3_ast, b: Z3_ast) => Z3_ast;
    algebraic_mul?: (c: Z3_context, a: Z3_ast, b: Z3_ast) => Z3_ast;
    algebraic_div?: (c: Z3_context, a: Z3_ast, b: Z3_ast) => Z3_ast;
    algebraic_root?: (c: Z3_context, a: Z3_ast, k: number) => Z3_ast;
    algebraic_power?: (c: Z3_context, a: Z3_ast, k: number) => Z3_ast;
    algebraic_lt?: (c: Z3_context, a: Z3_ast, b: Z3_ast) => boolean;
    algebraic_gt?: (c: Z3_context, a: Z3_ast, b: Z3_ast) => boolean;
    algebraic_le?: (c: Z3_context, a: Z3_ast, b: Z3_ast) => boolean;
    algebraic_ge?: (c: Z3_context, a: Z3_ast, b: Z3_ast) => boolean;
    algebraic_eq?: (c: Z3_context, a: Z3_ast, b: Z3_ast) => boolean;
    algebraic_neq?: (c: Z3_context, a: Z3_ast, b: Z3_ast) => boolean;
    algebraic_roots?: (c: Z3_context, p: Z3_ast, a: Z3_ast[]) => Promise<Z3_ast_vector>;
    algebraic_eval?: (c: Z3_context, p: Z3_ast, a: Z3_ast[]) => Promise<number>;
    algebraic_get_poly?: (c: Z3_context, a: Z3_ast) => Z3_ast_vector;
    algebraic_get_i?: (c: Z3_context, a: Z3_ast) => number;
    mk_ast_vector?: (c: Z3_context) => Z3_ast_vector;
    ast_vector_inc_ref?: (c: Z3_context, v: Z3_ast_vector) => void;
    ast_vector_dec_ref?: (c: Z3_context, v: Z3_ast_vector) => void;
    ast_vector_size?: (c: Z3_context, v: Z3_ast_vector) => number;
    ast_vector_get?: (c: Z3_context, v: Z3_ast_vector, i: number) => Z3_ast;
    ast_vector_set?: (c: Z3_context, v: Z3_ast_vector, i: number, a: Z3_ast) => void;
    ast_vector_resize?: (c: Z3_context, v: Z3_ast_vector, n: number) => void;
    ast_vector_push?: (c: Z3_context, v: Z3_ast_vector, a: Z3_ast) => void;
    ast_vector_translate?: (s: Z3_context, v: Z3_ast_vector, t: Z3_context) => Z3_ast_vector;
    ast_vector_to_string?: (c: Z3_context, v: Z3_ast_vector) => string;
    mk_ast_map?: (c: Z3_context) => Z3_ast_map;
    ast_map_inc_ref?: (c: Z3_context, m: Z3_ast_map) => void;
    ast_map_dec_ref?: (c: Z3_context, m: Z3_ast_map) => void;
    ast_map_contains?: (c: Z3_context, m: Z3_ast_map, k: Z3_ast) => boolean;
    ast_map_find?: (c: Z3_context, m: Z3_ast_map, k: Z3_ast) => Z3_ast;
    ast_map_insert?: (c: Z3_context, m: Z3_ast_map, k: Z3_ast, v: Z3_ast) => void;
    ast_map_erase?: (c: Z3_context, m: Z3_ast_map, k: Z3_ast) => void;
    ast_map_reset?: (c: Z3_context, m: Z3_ast_map) => void;
    ast_map_size?: (c: Z3_context, m: Z3_ast_map) => number;
    ast_map_keys?: (c: Z3_context, m: Z3_ast_map) => Z3_ast_vector;
    ast_map_to_string?: (c: Z3_context, m: Z3_ast_map) => string;
    mk_fixedpoint?: (c: Z3_context) => Z3_fixedpoint;
    fixedpoint_inc_ref?: (c: Z3_context, d: Z3_fixedpoint) => void;
    fixedpoint_dec_ref?: (c: Z3_context, d: Z3_fixedpoint) => void;
    fixedpoint_add_rule?: (c: Z3_context, d: Z3_fixedpoint, rule: Z3_ast, name: Z3_symbol) => void;
    fixedpoint_add_fact?: (c: Z3_context, d: Z3_fixedpoint, r: Z3_func_decl, args: number[]) => void;
    fixedpoint_assert?: (c: Z3_context, d: Z3_fixedpoint, axiom: Z3_ast) => void;
    fixedpoint_query?: (c: Z3_context, d: Z3_fixedpoint, query: Z3_ast) => Promise<Z3_lbool>;
    fixedpoint_query_relations?: (c: Z3_context, d: Z3_fixedpoint, relations: Z3_func_decl[]) => Promise<Z3_lbool>;
    fixedpoint_get_answer?: (c: Z3_context, d: Z3_fixedpoint) => Z3_ast;
    fixedpoint_get_reason_unknown?: (c: Z3_context, d: Z3_fixedpoint) => string;
    fixedpoint_update_rule?: (c: Z3_context, d: Z3_fixedpoint, a: Z3_ast, name: Z3_symbol) => void;
    fixedpoint_get_num_levels?: (c: Z3_context, d: Z3_fixedpoint, pred: Z3_func_decl) => number;
    fixedpoint_get_cover_delta?: (c: Z3_context, d: Z3_fixedpoint, level: number, pred: Z3_func_decl) => Z3_ast;
    fixedpoint_add_cover?: (c: Z3_context, d: Z3_fixedpoint, level: number, pred: Z3_func_decl, property: Z3_ast) => void;
    fixedpoint_get_statistics?: (c: Z3_context, d: Z3_fixedpoint) => Z3_stats;
    fixedpoint_register_relation?: (c: Z3_context, d: Z3_fixedpoint, f: Z3_func_decl) => void;
    fixedpoint_set_predicate_representation?: (c: Z3_context, d: Z3_fixedpoint, f: Z3_func_decl, relation_kinds: Z3_symbol[]) => void;
    fixedpoint_get_rules?: (c: Z3_context, f: Z3_fixedpoint) => Z3_ast_vector;
    fixedpoint_get_assertions?: (c: Z3_context, f: Z3_fixedpoint) => Z3_ast_vector;
    fixedpoint_set_params?: (c: Z3_context, f: Z3_fixedpoint, p: Z3_params) => void;
    fixedpoint_get_help?: (c: Z3_context, f: Z3_fixedpoint) => string;
    fixedpoint_get_param_descrs?: (c: Z3_context, f: Z3_fixedpoint) => Z3_param_descrs;
    fixedpoint_to_string?: (c: Z3_context, f: Z3_fixedpoint, queries: Z3_ast[]) => string;
    fixedpoint_from_string?: (c: Z3_context, f: Z3_fixedpoint, s: string) => Z3_ast_vector;
    fixedpoint_from_file?: (c: Z3_context, f: Z3_fixedpoint, s: string) => Z3_ast_vector;
    mk_fpa_rounding_mode_sort?: (c: Z3_context) => Z3_sort;
    mk_fpa_round_nearest_ties_to_even?: (c: Z3_context) => Z3_ast;
    mk_fpa_rne?: (c: Z3_context) => Z3_ast;
    mk_fpa_round_nearest_ties_to_away?: (c: Z3_context) => Z3_ast;
    mk_fpa_rna?: (c: Z3_context) => Z3_ast;
    mk_fpa_round_toward_positive?: (c: Z3_context) => Z3_ast;
    mk_fpa_rtp?: (c: Z3_context) => Z3_ast;
    mk_fpa_round_toward_negative?: (c: Z3_context) => Z3_ast;
    mk_fpa_rtn?: (c: Z3_context) => Z3_ast;
    mk_fpa_round_toward_zero?: (c: Z3_context) => Z3_ast;
    mk_fpa_rtz?: (c: Z3_context) => Z3_ast;
    mk_fpa_sort?: (c: Z3_context, ebits: number, sbits: number) => Z3_sort;
    mk_fpa_sort_half?: (c: Z3_context) => Z3_sort;
    mk_fpa_sort_16?: (c: Z3_context) => Z3_sort;
    mk_fpa_sort_single?: (c: Z3_context) => Z3_sort;
    mk_fpa_sort_32?: (c: Z3_context) => Z3_sort;
    mk_fpa_sort_double?: (c: Z3_context) => Z3_sort;
    mk_fpa_sort_64?: (c: Z3_context) => Z3_sort;
    mk_fpa_sort_quadruple?: (c: Z3_context) => Z3_sort;
    mk_fpa_sort_128?: (c: Z3_context) => Z3_sort;
    mk_fpa_nan?: (c: Z3_context, s: Z3_sort) => Z3_ast;
    mk_fpa_inf?: (c: Z3_context, s: Z3_sort, negative: boolean) => Z3_ast;
    mk_fpa_zero?: (c: Z3_context, s: Z3_sort, negative: boolean) => Z3_ast;
    mk_fpa_fp?: (c: Z3_context, sgn: Z3_ast, exp: Z3_ast, sig: Z3_ast) => Z3_ast;
    mk_fpa_numeral_float?: (c: Z3_context, v: number, ty: Z3_sort) => Z3_ast;
    mk_fpa_numeral_double?: (c: Z3_context, v: number, ty: Z3_sort) => Z3_ast;
    mk_fpa_numeral_int?: (c: Z3_context, v: number, ty: Z3_sort) => Z3_ast;
    mk_fpa_numeral_int_uint?: (c: Z3_context, sgn: boolean, exp: number, sig: number, ty: Z3_sort) => Z3_ast;
    mk_fpa_numeral_int64_uint64?: (c: Z3_context, sgn: boolean, exp: bigint, sig: bigint, ty: Z3_sort) => Z3_ast;
    mk_fpa_abs?: (c: Z3_context, t: Z3_ast) => Z3_ast;
    mk_fpa_neg?: (c: Z3_context, t: Z3_ast) => Z3_ast;
    mk_fpa_add?: (c: Z3_context, rm: Z3_ast, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_fpa_sub?: (c: Z3_context, rm: Z3_ast, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_fpa_mul?: (c: Z3_context, rm: Z3_ast, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_fpa_div?: (c: Z3_context, rm: Z3_ast, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_fpa_fma?: (c: Z3_context, rm: Z3_ast, t1: Z3_ast, t2: Z3_ast, t3: Z3_ast) => Z3_ast;
    mk_fpa_sqrt?: (c: Z3_context, rm: Z3_ast, t: Z3_ast) => Z3_ast;
    mk_fpa_rem?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_fpa_round_to_integral?: (c: Z3_context, rm: Z3_ast, t: Z3_ast) => Z3_ast;
    mk_fpa_min?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_fpa_max?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_fpa_leq?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_fpa_lt?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_fpa_geq?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_fpa_gt?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_fpa_eq?: (c: Z3_context, t1: Z3_ast, t2: Z3_ast) => Z3_ast;
    mk_fpa_is_normal?: (c: Z3_context, t: Z3_ast) => Z3_ast;
    mk_fpa_is_subnormal?: (c: Z3_context, t: Z3_ast) => Z3_ast;
    mk_fpa_is_zero?: (c: Z3_context, t: Z3_ast) => Z3_ast;
    mk_fpa_is_infinite?: (c: Z3_context, t: Z3_ast) => Z3_ast;
    mk_fpa_is_nan?: (c: Z3_context, t: Z3_ast) => Z3_ast;
    mk_fpa_is_negative?: (c: Z3_context, t: Z3_ast) => Z3_ast;
    mk_fpa_is_positive?: (c: Z3_context, t: Z3_ast) => Z3_ast;
    mk_fpa_to_fp_bv?: (c: Z3_context, bv: Z3_ast, s: Z3_sort) => Z3_ast;
    mk_fpa_to_fp_float?: (c: Z3_context, rm: Z3_ast, t: Z3_ast, s: Z3_sort) => Z3_ast;
    mk_fpa_to_fp_real?: (c: Z3_context, rm: Z3_ast, t: Z3_ast, s: Z3_sort) => Z3_ast;
    mk_fpa_to_fp_signed?: (c: Z3_context, rm: Z3_ast, t: Z3_ast, s: Z3_sort) => Z3_ast;
    mk_fpa_to_fp_unsigned?: (c: Z3_context, rm: Z3_ast, t: Z3_ast, s: Z3_sort) => Z3_ast;
    mk_fpa_to_ubv?: (c: Z3_context, rm: Z3_ast, t: Z3_ast, sz: number) => Z3_ast;
    mk_fpa_to_sbv?: (c: Z3_context, rm: Z3_ast, t: Z3_ast, sz: number) => Z3_ast;
    mk_fpa_to_real?: (c: Z3_context, t: Z3_ast) => Z3_ast;
    fpa_get_ebits?: (c: Z3_context, s: Z3_sort) => number;
    fpa_get_sbits?: (c: Z3_context, s: Z3_sort) => number;
    fpa_is_numeral_nan?: (c: Z3_context, t: Z3_ast) => boolean;
    fpa_is_numeral_inf?: (c: Z3_context, t: Z3_ast) => boolean;
    fpa_is_numeral_zero?: (c: Z3_context, t: Z3_ast) => boolean;
    fpa_is_numeral_normal?: (c: Z3_context, t: Z3_ast) => boolean;
    fpa_is_numeral_subnormal?: (c: Z3_context, t: Z3_ast) => boolean;
    fpa_is_numeral_positive?: (c: Z3_context, t: Z3_ast) => boolean;
    fpa_is_numeral_negative?: (c: Z3_context, t: Z3_ast) => boolean;
    fpa_get_numeral_sign_bv?: (c: Z3_context, t: Z3_ast) => Z3_ast;
    fpa_get_numeral_significand_bv?: (c: Z3_context, t: Z3_ast) => Z3_ast;
    fpa_get_numeral_sign?: (c: Z3_context, t: Z3_ast) => number | null;
    fpa_get_numeral_significand_string?: (c: Z3_context, t: Z3_ast) => string;
    fpa_get_numeral_significand_uint64?: (c: Z3_context, t: Z3_ast) => bigint | null;
    fpa_get_numeral_exponent_string?: (c: Z3_context, t: Z3_ast, biased: boolean) => string;
    fpa_get_numeral_exponent_int64?: (c: Z3_context, t: Z3_ast, biased: boolean) => bigint | null;
    fpa_get_numeral_exponent_bv?: (c: Z3_context, t: Z3_ast, biased: boolean) => Z3_ast;
    mk_fpa_to_ieee_bv?: (c: Z3_context, t: Z3_ast) => Z3_ast;
    mk_fpa_to_fp_int_real?: (c: Z3_context, rm: Z3_ast, exp: Z3_ast, sig: Z3_ast, s: Z3_sort) => Z3_ast;
    mk_optimize?: (c: Z3_context) => Z3_optimize;
    optimize_inc_ref?: (c: Z3_context, d: Z3_optimize) => void;
    optimize_dec_ref?: (c: Z3_context, d: Z3_optimize) => void;
    optimize_assert?: (c: Z3_context, o: Z3_optimize, a: Z3_ast) => void;
    optimize_assert_and_track?: (c: Z3_context, o: Z3_optimize, a: Z3_ast, t: Z3_ast) => void;
    optimize_assert_soft?: (c: Z3_context, o: Z3_optimize, a: Z3_ast, weight: string, id: Z3_symbol) => number;
    optimize_maximize?: (c: Z3_context, o: Z3_optimize, t: Z3_ast) => number;
    optimize_minimize?: (c: Z3_context, o: Z3_optimize, t: Z3_ast) => number;
    optimize_push?: (c: Z3_context, d: Z3_optimize) => void;
    optimize_pop?: (c: Z3_context, d: Z3_optimize) => void;
    optimize_check?: (c: Z3_context, o: Z3_optimize, assumptions: Z3_ast[]) => Promise<Z3_lbool>;
    optimize_get_reason_unknown?: (c: Z3_context, d: Z3_optimize) => string;
    optimize_get_model?: (c: Z3_context, o: Z3_optimize) => Z3_model;
    optimize_get_unsat_core?: (c: Z3_context, o: Z3_optimize) => Z3_ast_vector;
    optimize_set_params?: (c: Z3_context, o: Z3_optimize, p: Z3_params) => void;
    optimize_get_param_descrs?: (c: Z3_context, o: Z3_optimize) => Z3_param_descrs;
    optimize_get_lower?: (c: Z3_context, o: Z3_optimize, idx: number) => Z3_ast;
    optimize_get_upper?: (c: Z3_context, o: Z3_optimize, idx: number) => Z3_ast;
    optimize_get_lower_as_vector?: (c: Z3_context, o: Z3_optimize, idx: number) => Z3_ast_vector;
    optimize_get_upper_as_vector?: (c: Z3_context, o: Z3_optimize, idx: number) => Z3_ast_vector;
    optimize_to_string?: (c: Z3_context, o: Z3_optimize) => string;
    optimize_from_string?: (c: Z3_context, o: Z3_optimize, s: string) => void;
    optimize_from_file?: (c: Z3_context, o: Z3_optimize, s: string) => void;
    optimize_get_help?: (c: Z3_context, t: Z3_optimize) => string;
    optimize_get_statistics?: (c: Z3_context, d: Z3_optimize) => Z3_stats;
    optimize_get_assertions?: (c: Z3_context, o: Z3_optimize) => Z3_ast_vector;
    optimize_get_objectives?: (c: Z3_context, o: Z3_optimize) => Z3_ast_vector;
    polynomial_subresultants?: (c: Z3_context, p: Z3_ast, q: Z3_ast, x: Z3_ast) => Promise<Z3_ast_vector>;
    rcf_del?: (c: Z3_context, a: Z3_rcf_num) => void;
    rcf_mk_rational?: (c: Z3_context, val: string) => Z3_rcf_num;
    rcf_mk_small_int?: (c: Z3_context, val: number) => Z3_rcf_num;
    rcf_mk_pi?: (c: Z3_context) => Z3_rcf_num;
    rcf_mk_e?: (c: Z3_context) => Z3_rcf_num;
    rcf_mk_infinitesimal?: (c: Z3_context) => Z3_rcf_num;
    rcf_mk_roots?: (c: Z3_context, a: Z3_rcf_num[]) => { rv: number; roots: Z3_rcf_num[]; };
    rcf_add?: (c: Z3_context, a: Z3_rcf_num, b: Z3_rcf_num) => Z3_rcf_num;
    rcf_sub?: (c: Z3_context, a: Z3_rcf_num, b: Z3_rcf_num) => Z3_rcf_num;
    rcf_mul?: (c: Z3_context, a: Z3_rcf_num, b: Z3_rcf_num) => Z3_rcf_num;
    rcf_div?: (c: Z3_context, a: Z3_rcf_num, b: Z3_rcf_num) => Z3_rcf_num;
    rcf_neg?: (c: Z3_context, a: Z3_rcf_num) => Z3_rcf_num;
    rcf_inv?: (c: Z3_context, a: Z3_rcf_num) => Z3_rcf_num;
    rcf_power?: (c: Z3_context, a: Z3_rcf_num, k: number) => Z3_rcf_num;
    rcf_lt?: (c: Z3_context, a: Z3_rcf_num, b: Z3_rcf_num) => boolean;
    rcf_gt?: (c: Z3_context, a: Z3_rcf_num, b: Z3_rcf_num) => boolean;
    rcf_le?: (c: Z3_context, a: Z3_rcf_num, b: Z3_rcf_num) => boolean;
    rcf_ge?: (c: Z3_context, a: Z3_rcf_num, b: Z3_rcf_num) => boolean;
    rcf_eq?: (c: Z3_context, a: Z3_rcf_num, b: Z3_rcf_num) => boolean;
    rcf_neq?: (c: Z3_context, a: Z3_rcf_num, b: Z3_rcf_num) => boolean;
    rcf_num_to_string?: (c: Z3_context, a: Z3_rcf_num, compact: boolean, html: boolean) => string;
    rcf_num_to_decimal_string?: (c: Z3_context, a: Z3_rcf_num, prec: number) => string;
    rcf_get_numerator_denominator?: (c: Z3_context, a: Z3_rcf_num) => { n: Z3_rcf_num; d: Z3_rcf_num; };
    rcf_is_rational?: (c: Z3_context, a: Z3_rcf_num) => boolean;
    rcf_is_algebraic?: (c: Z3_context, a: Z3_rcf_num) => boolean;
    rcf_is_infinitesimal?: (c: Z3_context, a: Z3_rcf_num) => boolean;
    rcf_is_transcendental?: (c: Z3_context, a: Z3_rcf_num) => boolean;
    rcf_extension_index?: (c: Z3_context, a: Z3_rcf_num) => number;
    rcf_transcendental_name?: (c: Z3_context, a: Z3_rcf_num) => Z3_symbol;
    rcf_infinitesimal_name?: (c: Z3_context, a: Z3_rcf_num) => Z3_symbol;
    rcf_num_coefficients?: (c: Z3_context, a: Z3_rcf_num) => number;
    rcf_coefficient?: (c: Z3_context, a: Z3_rcf_num, i: number) => Z3_rcf_num;
    rcf_num_sign_conditions?: (c: Z3_context, a: Z3_rcf_num) => number;
    rcf_sign_condition_sign?: (c: Z3_context, a: Z3_rcf_num, i: number) => number;
    rcf_num_sign_condition_coefficients?: (c: Z3_context, a: Z3_rcf_num, i: number) => number;
    rcf_sign_condition_coefficient?: (c: Z3_context, a: Z3_rcf_num, i: number, j: number) => Z3_rcf_num;
    fixedpoint_query_from_lvl?: (c: Z3_context, d: Z3_fixedpoint, query: Z3_ast, lvl: number) => Promise<Z3_lbool>;
    fixedpoint_get_ground_sat_answer?: (c: Z3_context, d: Z3_fixedpoint) => Z3_ast;
    fixedpoint_get_rules_along_trace?: (c: Z3_context, d: Z3_fixedpoint) => Z3_ast_vector;
    fixedpoint_get_rule_names_along_trace?: (c: Z3_context, d: Z3_fixedpoint) => Z3_symbol;
    fixedpoint_add_invariant?: (c: Z3_context, d: Z3_fixedpoint, pred: Z3_func_decl, property: Z3_ast) => void;
    fixedpoint_get_reachable?: (c: Z3_context, d: Z3_fixedpoint, pred: Z3_func_decl) => Z3_ast;
    qe_model_project?: (c: Z3_context, m: Z3_model, bound: Z3_app[], body: Z3_ast) => Z3_ast;
    qe_model_project_skolem?: (c: Z3_context, m: Z3_model, bound: Z3_app[], body: Z3_ast, map: Z3_ast_map) => Z3_ast;
    model_extrapolate?: (c: Z3_context, m: Z3_model, fml: Z3_ast) => Z3_ast;
    qe_lite?: (c: Z3_context, vars: Z3_ast_vector, body: Z3_ast) => Z3_ast;
}): CustomContext<Name> => {
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

        concat(other: String<Name>): String<Name> {
            return new StringImpl(check(Z3.mk_seq_concat(this.ctx.ptr, [this.ast, other.ast])));
        }

        getFromModel(model: Model<Name>): string {
            return model.eval(this).toString().slice(1, -1)
        }
    }

    const trueBool = ctx.Bool.val(true)
    trueBool.and = (other: Bool<Name>): Bool<Name> => {
        return other
    }
    trueBool.or = (_: Bool<Name>): Bool<Name> => {
        return trueBool
    }
    trueBool.not = (): Bool<Name> => {
        return falseBool
    }
    trueBool.eq = (other: Bool<Name>): Bool<Name> => {
        return other
    }
    const falseBool = ctx.Bool.val(false)
    falseBool.and = (_: Bool<Name>): Bool<Name> => {
        return falseBool
    }
    falseBool.or = (other: Bool<Name>): Bool<Name> => {
        return other
    }
    falseBool.not = (): Bool<Name> => {
        return trueBool
    }
    falseBool.eq = (other: Bool<Name>): Bool<Name> => {
        return other.not()
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
        Bool: {
            ...ctx.Bool,
            val: (val: boolean) => {
                if (val) {
                    return trueBool
                }
                return falseBool
            }
        },
        AndBool: (a: Bool<Name>, b: Bool<Name>): Bool<Name> => {
            if (b === trueBool) {
                return a
            }
            if (b === falseBool) {
                return falseBool
            }
            return a.and(b)
        },
        OrBool: (a: Bool<Name>, b: Bool<Name>): Bool<Name> => {
            if (b === trueBool) {
                return trueBool
            }
            if (b === falseBool) {
                return a
            }
            return a.or(b)
        },
        EqBool: (a: Bool<Name>, b: Bool<Name>): Bool<Name> => {
            if (b === trueBool) {
                return a
            }
            if (b === falseBool) {
                return a.not()
            }
            return a.eq(b)
        },
    }
}