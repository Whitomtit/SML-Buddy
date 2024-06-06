datatype ae = CONST of int
        | VAR of string
        | POWER of string * int
        | TIMES of ae list
        | SUM of ae list

fun diff (ae, str) =
  let
    fun isThereStr ae str =
      case ae of
        CONST _ => false
      | VAR s => s = str
      | POWER (s, _) => s = str
      | TIMES l => (case l of
                      [] => false
                    | h::t => isThereStr h str orelse isThereStr (TIMES t) str)
      | SUM l => (case l of
                    [] => false
                  | h::t => isThereStr h str orelse isThereStr (SUM t) str)
    fun mul al str =
      case al of
        [] => []
      | [h] => if isThereStr h str then [diff (h, str)] else [h]
      | h::t => if isThereStr h str then diff (h, str) :: mul t str else h :: mul t str
  in
    case ae of
      CONST _ => CONST 0
    | VAR s => if s = str then CONST 1 else CONST 0
    | POWER (s, i) => if s = str then if i > 1 then TIMES [CONST i, POWER (s, i-1)] else CONST 1 else CONST 0
    | TIMES l => if isThereStr ae str then TIMES (mul l str) else CONST 0
    | SUM l => (case l of
                  [] => CONST 0
                | [h] => diff (h, str)
                | h::t => SUM (diff (h, str) :: [diff (SUM t, str)]))
  end