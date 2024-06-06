datatype ae = CONST of int
        | VAR of string
        | POWER of string * int
        | TIMES of ae list
        | SUM of ae list

fun diff (a, x) =
  let
    fun sumListDiff lst =
      case lst of
        [] => CONST 0
      | hd::tl => SUM [diff (hd, x), sumListDiff tl]
  in
    case a of
      CONST _ => CONST 0
    | VAR s => if s = x then CONST 1 else CONST 0
    | POWER (s, i) => if s = x then TIMES [CONST i, POWER (s, i-1)] else CONST 0
    | TIMES lst =>
        (case lst of
           [] => CONST 0
         | [hd] => diff (hd, x)
         | hd::tl => SUM [TIMES [diff (hd, x), TIMES tl], TIMES [hd, diff (TIMES tl, x)]])
    | SUM lst => sumListDiff lst
  end