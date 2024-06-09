exception Error of string

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

fun remove x lst =
  case lst of
    [] => []
  | h::t => if h = x then t else h :: remove x t

fun remove_zero exp =
  case exp of
    TIMES lst => TIMES (filter (fn x => x <> CONST 0) lst)
  | SUM lst => SUM (filter (fn x => x <> CONST 0) lst)
  | _ => exp

fun diff (ae, x) =
  let
    fun mult (lst1, lst2) =
      case lst1 of
        [] => lst2
      | hd::tl => hd :: (mult (tl, lst2))
  in
    case ae of
      CONST _ => CONST 0
    | VAR s => if s = x then CONST 1 else CONST 0
    | POWER (s, i) => if s = x then TIMES [CONST i, POWER (s, i-1)] else CONST 0
    | TIMES lst => SUM (map (fn t => TIMES (diff (t, x) :: remove t lst)) lst)
    | SUM lst => SUM (map (fn s => diff (s, x)) lst)
  end