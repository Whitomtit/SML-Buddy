datatype ae = CONST of int
        | VAR of string
        | POWER of string * int
        | TIMES of ae list
        | SUM of ae list

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

fun diff (a, s) =
  case a of
    CONST i => CONST 0
  | VAR v => if v = s then CONST 1 else CONST 0
  | POWER (v, p) => if v = s then TIMES [CONST p, POWER (v, p-1)] else CONST 0
  | TIMES l => SUM (map (fn x => TIMES [diff (x, s), filter (fn y => y <> x) l]) l)
  | SUM l => SUM (map (fn x => diff (x, s)) l)