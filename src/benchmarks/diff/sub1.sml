exception EMPTYLIST

datatype ae = CONST of int
  | VAR of string
  | SUM of ae list
  | TIMES of ae list
  | POWER of string * int

fun diff (ae, str) =
  case ae of
    CONST a => CONST 0
  | VAR b => if str = b then CONST 1 else CONST 0
  | POWER (pstr, i) => if str = pstr then TIMES [CONST i, POWER (pstr, i-1)] else CONST 0
  | SUM lst => SUM (map (fn x => diff (x, str)) lst)
  | TIMES lst =>
      (case lst of
         [] => raise EMPTYLIST
       | hd::tl => SUM [TIMES (diff (hd, str) :: tl), TIMES [hd, diff (TIMES tl, str)]])