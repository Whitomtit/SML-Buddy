datatype ae = CONST of int | VAR of string | POWER of string * int | TIMES of ae list | SUM of ae list

fun simplify a =
  case a of
    POWER(_, 0) => CONST 1
  | TIMES l =>
      if List.exists (fn x => x = CONST 0) l then CONST 0
      else if List.length l = 1 then List.hd l
      else TIMES l
  | SUM ll => SUM (List.map simplify ll)
  | _ => a

fun diff (a, str) =
  case a of
    CONST n => CONST 0
  | VAR s =>
      if s = str then CONST 1 else CONST 0
  | POWER (s, p) =>
      if p = 0 then CONST 0
      else if s = str then
        if p = 1 then CONST 1
        else simplify (TIMES [CONST p, POWER (s, p-1)])
      else CONST 0
  | TIMES l =>
      (case l of
         [] => raise (Failure "Invalid value!")
       | [h] => simplify (diff (h, str))
       | h::t => simplify (SUM [TIMES [diff (h, str), TIMES t], TIMES [h, diff (TIMES t, str)]]))
  | SUM ll =>
      (case ll of
         [] => CONST 0
       | [h] => simplify (diff (h, str))
       | h::t => simplify (SUM (List.map (fn aa => diff (aa, str)) ll)))