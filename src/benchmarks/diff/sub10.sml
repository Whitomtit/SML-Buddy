datatype ae = CONST of int
            | VAR of string
            | POWER of string * int
            | TIMES of ae list
            | SUM of ae list

fun map f [] = []
  | map f (x::xs) = (f x)::(map f xs);

exception Subscript;

fun nth ([], _) = raise Subscript
  | nth (x::xs, 0) = x
  | nth (x::xs, n) = if n < 0 then raise Subscript else nth (xs, n-1);

fun diff (ex, var) =
    let
        fun diffSum e = diff (e, var)

        fun replace lst n elem =
            let
                fun get_result res prev =
                    case prev of
                        [] => res
                      | hd :: tl => if length res = n then res @ [elem] @ tl
                                    else get_result (res @ [hd]) tl
            in
                get_result [] lst
            end

        fun diffTimes lst =
            let
                fun looper i n =
                    if i = n then []
                    else TIMES (replace lst i (diff (nth (lst, i), var))) :: looper (i + 1) n
            in
                SUM (looper 0 (length lst))
            end
    in
        case ex of
            CONST i => CONST 0
          | VAR v => if v = var then CONST 1 else CONST 0
          | POWER (v, i) => if v = var then
                                if i = 1 then CONST i
                                else TIMES [CONST i, POWER (v, i - 1)]
                            else CONST 0
          | TIMES lst => diffTimes lst
          | SUM lst => SUM (map diffSum lst)
    end
