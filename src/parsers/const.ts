export const VALUE_DECLARATION = "val_ldec";
export const FUNCTION_DECLARATION = "fun_ldec";
// TODO implement
export const TYPE_DECLARATION = "type_ldec";
// TODO implement
export const DATATYPE_REPLICATION = "datatype_repl_ldec";
export const DATATYPE_DECLARATION = "datatype_ldec";
// TODO implement
export const ABSTRACT_TYPE_DECLARATION = "abstype_ldec";
export const EXCEPTION_DECLARATION = "exception_ldec";
// TODO implement
export const OPEN_DECLARATION = "open_ldec";
export const INFIX_DECLARATION = "fixity_ldec";

// TODO implement
export const STRUCTURE_DECLARATION = "structure_dec";
// TODO implement
export const SIGNATURE_DECLARATION = "signature_dec";
// TODO implement
export const FUNCTOR_SIGNATURE_DECLARATION = "funsig_dec";
// TODO implement
export const FUNCTOR_DECLARATION = "functor_dec";
// TODO implement
export const LOCAL_DECLARATION = "local_dec";

export const DECLARATIONS = [
    VALUE_DECLARATION, FUNCTION_DECLARATION, TYPE_DECLARATION,
    DATATYPE_REPLICATION, DATATYPE_DECLARATION, ABSTRACT_TYPE_DECLARATION,
    EXCEPTION_DECLARATION, OPEN_DECLARATION, INFIX_DECLARATION,
    STRUCTURE_DECLARATION, SIGNATURE_DECLARATION, FUNCTOR_SIGNATURE_DECLARATION,
    FUNCTOR_DECLARATION, LOCAL_DECLARATION];


export const DATATYPE_BIND = "db"
export const CONSTRUCTOR = "constr";
export const FUNCTION_BIND = "fb";
export const VALUE_BIND = "vb";
export const EXCEPTION_BIND = "eb";
export const CLAUSE = "clause";
export const RULE = "rule";

export const PARAMETRIC_EXCEPTION = "exn_gen"
export const REDEFINED_EXCEPTION = "exn_def"

export const LEFT_INFIX = 'infix'
export const RIGHT_INFIX = 'infixr'
export const NON_INFIX = 'nonfix'

export const OP = "op"

export const POLYMORPHIC_TYPE_SEQUENCE = "tyvar_seq";

export const TUPLE_TYPE = "tuple_ty";
export const FUNCTION_TYPE = "arrow_ty"
export const POLYMORPHIC_TYPE = "tyvar";
export const WRAPPED_POLYMORPHIC_TYPE = "var_ty";
export const RECORD_TYPE = "rec_ty"
export const CONSTRUCTOR_TYPE = "mark_ty"
export const PARENTHESIZED_TYPE = "paren_ty"
export const TYPES = [TUPLE_TYPE, FUNCTION_TYPE, POLYMORPHIC_TYPE, RECORD_TYPE, CONSTRUCTOR_TYPE, PARENTHESIZED_TYPE, WRAPPED_POLYMORPHIC_TYPE]

// TODO implement
export const AS_PATTERN = "as_pat";
export const CONSTRAIN_PATTERN = "constraint_pat";
export const APP_PATTERN = "app_pat";
export const PARENTHESIZED_PATTERN = "paren_pat";
export const VARIABLE_PATTERN = "var_pat";
export const TUPLE_UNIT_PATTERN = "tuple_unit_pat";
export const TUPLE_PATTERN = "tuple_pat";
export const OR_PATTERN = "or_pat";
export const OP_PATTERN = "op_pat";
// TODO implement
export const ACCESS_PATTERN = "access_pat";
export const CONSTANT_PATTERN = "constant_pat";
export const WILD_PATTERN = "wild_pat";
export const LIST_PATTERN = "list_pat";
// TODO implement
export const VECTOR_PATTERN = "vector_pat";
export const RECORD_UNIT_PATTERN = "rec_unit_pat";
// TODO implement
export const RECORD_PATTERN = "rec_pat";

export const PATTERNS = [
    AS_PATTERN, CONSTRAIN_PATTERN, APP_PATTERN,
    PARENTHESIZED_PATTERN, VARIABLE_PATTERN, TUPLE_UNIT_PATTERN, TUPLE_PATTERN, OR_PATTERN, OP_PATTERN,
    ACCESS_PATTERN, CONSTANT_PATTERN, WILD_PATTERN, LIST_PATTERN, VECTOR_PATTERN, RECORD_UNIT_PATTERN, RECORD_PATTERN
]

export const INT_CONSTANT = "int_constant";
export const WORD_CONSTANT = "word_constant";
export const FLOAT_CONSTANT = "float_constant";
export const CHAR_CONSTANT = "char_constant";
export const STRING_CONSTANT = "string_constant";

export const HANDLE_EXPRESSION = "handle_exp";
export const ORELSE_EXPRESSION = "orelse_exp";
export const ANDALSO_EXPRESSION = "andalso_exp";
export const CONSTRAINT_EXPRESSION = "constraint_exp";
export const APP_EXPRESSION = "app_exp";
export const FN_EXPRESSION = "fn_exp";
export const CASE_EXPRESSION = "case_exp";
// TODO implement
export const WHILE_EXPRESSION = "while_exp";
export const IF_EXPRESSION = "if_exp";
export const RAISE_EXPRESSION = "raise_exp";

export const VAR_EXPRESSION = "var_exp";
export const OP_EXPRESSION = "op_exp";
// TODO implement
export const ACCESS_EXPRESSION = "access_exp";
export const CONSTANT_EXPRESSION = "constant_exp";
export const SELECTOR_EXPRESSION = "selector_exp";
// TODO implement
export const RECORD_EXPRESSION = "rec_exp";
export const RECORD_UNIT_EXPRESSION = "rec_unit_exp";
export const TUPLE_UNIT_EXPRESSION = "tuple_unit_exp";
export const SEQUENCE_EXPRESSION = "seq_exp";
export const TUPLE_EXPRESSION = "tuple_exp";
export const LIST_EXPRESSION = "list_exp";
// TODO implement
export const VECTOR_EXPRESSION = "vector_exp";
export const LET_EXPRESSION = "let_exp";

export const EXPRESSIONS = [
    HANDLE_EXPRESSION, ORELSE_EXPRESSION, ANDALSO_EXPRESSION, CONSTRAINT_EXPRESSION, APP_EXPRESSION,
    FN_EXPRESSION, CASE_EXPRESSION, WHILE_EXPRESSION, IF_EXPRESSION, RAISE_EXPRESSION,
    VAR_EXPRESSION, OP_EXPRESSION, ACCESS_EXPRESSION, CONSTANT_EXPRESSION, SELECTOR_EXPRESSION,
    RECORD_EXPRESSION, RECORD_UNIT_EXPRESSION, TUPLE_UNIT_EXPRESSION, SEQUENCE_EXPRESSION,
    TUPLE_EXPRESSION, LIST_EXPRESSION, VECTOR_EXPRESSION, LET_EXPRESSION
]
