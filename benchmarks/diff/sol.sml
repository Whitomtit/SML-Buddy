exception Failure of string

datatype ae =
    CONST of int
  | VAR of string
  | POWER of string * int
  | TIMES of ae list
  | SUM of ae list

fun map f (l, x) =
  case l of
    [] => []
  | hd::tl => (f (hd, x)) :: (map f (tl, x))

fun diff (e, x) =
  case e of
    CONST n => CONST 0
  | VAR a => if a <> x then CONST 0 else CONST 1
  | POWER (a, n) =>
      if n < 0 then raise (Failure "Invalid")
      else if n = 0 orelse a <> x then CONST 0
      else TIMES [CONST n, POWER (a, n-1)]
  | TIMES l =>
      (case l of
         [] => raise (Failure "Invalid")
       | [hd] => diff (hd, x)
       | hd::tl => SUM [TIMES (diff (hd, x) :: tl), TIMES [hd, diff (TIMES tl, x)]])
  | SUM l =>
      (case l of
         [] => raise (Failure "Invalid")
       | _ => SUM (map diff (l, x)))