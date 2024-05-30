exception Error of string

datatype ae = CONST of int
        | VAR of string
        | POWER of string * int
        | TIMES of ae list
        | SUM of ae list

fun remove x lst =
  case lst of
    [] => []
  | h::t => if h = x then t else h :: remove x t

fun remove_zero exp =
  case exp of
    TIMES lst => TIMES (List.filter (fn x => x <> CONST 0) lst)
  | SUM lst => SUM (List.filter (fn x => x <> CONST 0) lst)
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
    | TIMES lst => SUM (List.map (fn t => TIMES (diff (t, x) :: remove t lst)) lst)
    | SUM lst => SUM (List.map (fn s => diff (s, x)) lst)
  end