datatype ae = CONST of int
        | VAR of string
        | POWER of string * int
        | TIMES of ae list
        | SUM of ae list

fun diff (a, s) =
  case a of
    CONST i => CONST 0
  | VAR v => if v = s then CONST 1 else CONST 0
  | POWER (v, p) => if v = s then TIMES [CONST p, POWER (v, p-1)] else CONST 0
  | TIMES l => SUM (List.map (fn x => TIMES [diff (x, s), List.filter (fn y => y <> x) l]) l)
  | SUM l => SUM (List.map (fn x => diff (x, s)) l)