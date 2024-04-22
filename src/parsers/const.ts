export const VALUE_DECLARATION = "val_ldec";
export const FUNCTION_DECLARATION = "fun_ldec";
export const TYPE_DECLARATION = "type_ldec";
export const DATATYPE_REPLICATION = "datatype_repl_ldec";
export const DATATYPE_DECLARATION = "datatype_ldec";
export const ABSTRACT_TYPE_DECLARATION = "abstype_ldec";
export const EXCEPTION_DECLARATION = "exception_ldec";
export const OPEN_DECLARATION = "open_ldec";
export const INFIX_DECLARATION = "fixity_ldec";

export const STRUCTURE_DECLARATION = "structure_dec";
export const SIGNATURE_DECLARATION = "signature_dec";
export const FUNCTOR_SIGNATURE_DECLARATION = "funsig_dec";
export const FUNCTOR_DECLARATION = "functor_dec";
export const LOCAL_DECLARATION = "local_dec";

export const DECLARATIONS = [
    VALUE_DECLARATION, FUNCTION_DECLARATION, TYPE_DECLARATION,
    DATATYPE_REPLICATION, DATATYPE_DECLARATION, ABSTRACT_TYPE_DECLARATION,
    EXCEPTION_DECLARATION, OPEN_DECLARATION, INFIX_DECLARATION,
    STRUCTURE_DECLARATION, SIGNATURE_DECLARATION, FUNCTOR_SIGNATURE_DECLARATION,
    FUNCTOR_DECLARATION, LOCAL_DECLARATION];


export const DATATYPE_BIND = "db"
export const CONSTRUCTOR = "constr";

export const ALPHANUMERIC = "ident";
export const SYMBOLIC = "symbolic";

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