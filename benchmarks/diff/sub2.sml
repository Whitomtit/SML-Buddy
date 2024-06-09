datatype ae = CONST of int | VAR of string | POWER of string * int | TIMES of ae list | SUM of ae list

exception Failure of string

fun map f l =
  case l of
    [] => []
  | hd::tl => (f hd) :: (map f tl)

fun exists f l =
  case l of
    [] => false
  | hd::tl => if f hd then true else exists f tl

fun length l =
    case l of
        [] => 0
    | hd::tl => 1 + length tl;

fun hd l =
    case l of
        [] => raise (Failure "Invalid value!")
    | hd::tl => hd;

fun tl l =
    case l of
        [] => raise (Failure "Invalid value!")
    | hd::tl => tl;

fun filter f l =
  case l of
    [] => []
  | hd::tl => if f hd then hd::(filter f tl) else filter f tl;

fun simplify a =
  case a of
    POWER(_, 0) => CONST 1
  | TIMES l =>
      if exists (fn x => x = CONST 0) l then CONST 0
      else if length l = 1 then hd l
      else TIMES l
  | SUM ll => SUM (map simplify ll)
  | _ => a;

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
       | h::t => simplify (SUM (map (fn aa => diff (aa, str)) ll)));